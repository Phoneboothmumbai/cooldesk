from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import re
import ipaddress
import logging
import uuid
import bcrypt
import jwt
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
APP_BASE_URL = os.environ.get('APP_BASE_URL', '')

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get('EMERGENT_EMAIL_KEY')
EMAIL_FROM_NAME = os.environ.get('EMAIL_FROM_NAME', 'CoolDesk')
EMAIL_REPLY_TO = os.environ.get('EMAIL_REPLY_TO')

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

COMPLAINT_TYPES = ["installation", "repair", "service"]
TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"]
PRIORITIES = ["low", "normal", "high", "urgent"]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Email (Emergent-managed Resend) — guardrail gate
# ---------------------------------------------------------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_via_emergent(to: List[str], subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set; skipping email send")
        return None
    payload = {"to": to, "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": EMAIL_KEY},
            json=payload,
        )
    resp.raise_for_status()
    return resp.json().get("id")


async def send_via_resend(to: List[str], subject: str, html: str,
                          api_key: str, from_email: str, from_name: str) -> Optional[str]:
    from_addr = f"{from_name} <{from_email}>" if from_name else from_email
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": from_addr, "to": to, "subject": subject, "html": html},
        )
    if resp.status_code >= 400:
        raise ValueError(f"Resend error {resp.status_code}: {resp.text}")
    return resp.json().get("id")


async def dispatch_email(*, to: List[str], subject: str, html: str, settings: dict) -> Optional[str]:
    _assert_safe_email(subject, html)  # anti-phishing gate on EVERY send path
    provider = settings.get("email_provider", "emergent")
    if provider == "resend" and settings.get("resend_api_key") and settings.get("resend_from_email"):
        return await send_via_resend(
            to, subject, html,
            settings["resend_api_key"], settings["resend_from_email"],
            settings.get("resend_from_name", ""),
        )
    return await send_via_emergent(to, subject, html)


def build_ticket_email(ticket: dict) -> str:
    def row(label, value):
        return (f'<tr><td style="padding:6px 12px;color:#52525B;font-size:13px;'
                f'border-bottom:1px solid #E4E4E7;white-space:nowrap">{escape(label)}</td>'
                f'<td style="padding:6px 12px;color:#09090B;font-size:13px;'
                f'border-bottom:1px solid #E4E4E7">{escape(str(value))}</td></tr>')

    rows = "".join([
        row("Ticket", ticket["ticket_number"]),
        row("Brand", ticket["brand_name"]),
        row("Type", ticket["complaint_type"].title()),
        row("Priority", ticket["priority"].title()),
        row("Customer", ticket["customer_name"]),
        row("Customer Phone", ticket.get("customer_phone", "-")),
        row("Location", ticket.get("city", "-")),
        row("Address", ticket.get("customer_address", "-")),
        row("Raised by (Dealer)", f'{ticket.get("dealer_name","-")} ({ticket.get("dealer_phone","-")})'),
    ])
    link_html = ""
    if APP_BASE_URL.startswith("https://"):
        link_html = (f'<p style="margin:20px 0 0"><a href="{escape(APP_BASE_URL)}/login" '
                     f'style="background:#002FA7;color:#fff;text-decoration:none;padding:10px 18px;'
                     f'border-radius:6px;font-size:14px;display:inline-block">Open Service Desk</a></p>')
    return (
        f'<table role="presentation" width="100%" style="max-width:640px;margin:0 auto;'
        f'font-family:Arial,Helvetica,sans-serif"><tr><td style="padding:24px">'
        f'<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#002FA7;'
        f'margin:0 0 4px;font-weight:700">New AC Complaint</p>'
        f'<h1 style="font-size:22px;color:#09090B;margin:0 0 4px">{escape(ticket["ticket_number"])}'
        f' &middot; {escape(ticket["brand_name"])}</h1>'
        f'<p style="font-size:14px;color:#52525B;margin:0 0 16px">'
        f'{escape(ticket["complaint_type"].title())} request &mdash; '
        f'{escape(ticket["subject"])}</p>'
        f'<table role="presentation" width="100%" style="border:1px solid #E4E4E7;'
        f'border-radius:6px;border-collapse:collapse">{rows}</table>'
        f'<p style="font-size:13px;color:#09090B;margin:16px 0 4px;font-weight:700">Issue Details</p>'
        f'<p style="font-size:13px;color:#52525B;margin:0;white-space:pre-wrap">'
        f'{escape(ticket.get("description",""))}</p>'
        f'{link_html}'
        f'<p style="font-size:11px;color:#A1A1AA;margin:28px 0 0">You are receiving this because you '
        f'are a registered stakeholder for {escape(ticket["brand_name"])}. Sent by {escape(EMAIL_FROM_NAME)}. '
        f'We never ask for your password or payment details by email.</p>'
        f'</td></tr></table>'
    )


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class AgentCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "agent"


class BrandInput(BaseModel):
    name: str
    code: str
    catch_all_emails: List[str] = []
    routing: dict = Field(default_factory=lambda: {"installation": [], "repair": [], "service": []})
    active: bool = True


class TicketCreate(BaseModel):
    brand_id: str
    complaint_type: str
    subject: str
    description: str
    priority: str = "normal"
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = ""
    customer_address: str = ""
    city: str = ""
    dealer_name: str
    dealer_phone: str


class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent: Optional[str] = None


class ReplyInput(BaseModel):
    message: str
    internal: bool = False


class SettingsInput(BaseModel):
    default_stakeholders: List[str] = []
    email_provider: str = "emergent"  # "emergent" | "resend"
    resend_api_key: Optional[str] = None  # blank/None keeps existing
    resend_from_email: Optional[str] = ""
    resend_from_name: Optional[str] = ""


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"token": token, "user": {"id": user["id"], "name": user["name"],
                                     "email": user["email"], "role": user["role"]}}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Agents (admin)
# ---------------------------------------------------------------------------
@api_router.get("/agents")
async def list_agents(user: dict = Depends(get_current_user)):
    agents = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return agents


@api_router.post("/agents")
async def create_agent(data: AgentCreate, admin: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    role = data.role if data.role in ("agent", "admin") else "agent"
    doc = {"id": str(uuid.uuid4()), "name": data.name, "email": email,
           "password_hash": hash_password(data.password), "role": role,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    return {"id": doc["id"], "name": doc["name"], "email": doc["email"], "role": doc["role"]}


@api_router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": agent_id})
    if not target:
        raise HTTPException(status_code=404, detail="Agent not found")
    if target["email"] == ADMIN_EMAIL.lower():
        raise HTTPException(status_code=400, detail="Cannot delete the primary admin")
    await db.users.delete_one({"id": agent_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Brands
# ---------------------------------------------------------------------------
@api_router.get("/brands")
async def list_brands(user: dict = Depends(get_current_user)):
    return await db.brands.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api_router.post("/brands")
async def create_brand(data: BrandInput, admin: dict = Depends(require_admin)):
    code = data.code.strip().upper()
    if await db.brands.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Brand code already exists")
    doc = {"id": str(uuid.uuid4()), "name": data.name.strip(), "code": code,
           "catch_all_emails": data.catch_all_emails,
           "routing": {t: data.routing.get(t, []) for t in COMPLAINT_TYPES},
           "active": data.active, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.brands.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/brands/{brand_id}")
async def update_brand(brand_id: str, data: BrandInput, admin: dict = Depends(require_admin)):
    brand = await db.brands.find_one({"id": brand_id})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    update = {"name": data.name.strip(), "code": data.code.strip().upper(),
              "catch_all_emails": data.catch_all_emails,
              "routing": {t: data.routing.get(t, []) for t in COMPLAINT_TYPES},
              "active": data.active}
    await db.brands.update_one({"id": brand_id}, {"$set": update})
    return await db.brands.find_one({"id": brand_id}, {"_id": 0})


@api_router.delete("/brands/{brand_id}")
async def delete_brand(brand_id: str, admin: dict = Depends(require_admin)):
    await db.brands.delete_one({"id": brand_id})
    return {"ok": True}


# Public brand listing for the dealer form
@api_router.get("/public/brands")
async def public_brands():
    brands = await db.brands.find({"active": True}, {"_id": 0, "id": 1, "name": 1, "code": 1}).sort("name", 1).to_list(500)
    return brands


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "default_stakeholders": [], "email_provider": "emergent",
             "resend_api_key": "", "resend_from_email": "", "resend_from_name": ""}
        await db.settings.insert_one(dict(s))
    s.setdefault("email_provider", "emergent")
    s.setdefault("resend_api_key", "")
    s.setdefault("resend_from_email", "")
    s.setdefault("resend_from_name", "")
    return s


def _public_settings(s: dict) -> dict:
    key = s.get("resend_api_key") or ""
    return {
        "id": s.get("id", "global"),
        "default_stakeholders": s.get("default_stakeholders", []),
        "email_provider": s.get("email_provider", "emergent"),
        "resend_from_email": s.get("resend_from_email", ""),
        "resend_from_name": s.get("resend_from_name", ""),
        "resend_configured": bool(key),
        "resend_key_hint": (f"…{key[-4:]}" if len(key) >= 4 else ("set" if key else "")),
    }


@api_router.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    return _public_settings(await get_settings())


@api_router.put("/settings")
async def write_settings(data: SettingsInput, admin: dict = Depends(require_admin)):
    current = await get_settings()
    update = {
        "default_stakeholders": data.default_stakeholders,
        "email_provider": data.email_provider if data.email_provider in ("emergent", "resend") else "emergent",
        "resend_from_email": (data.resend_from_email or "").strip(),
        "resend_from_name": (data.resend_from_name or "").strip(),
    }
    # Only overwrite the key when a new non-empty value is supplied.
    if data.resend_api_key is not None and data.resend_api_key.strip():
        update["resend_api_key"] = data.resend_api_key.strip()
    else:
        update["resend_api_key"] = current.get("resend_api_key", "")
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    return _public_settings(await get_settings())


@api_router.post("/settings/test-email")
async def test_email(admin: dict = Depends(require_admin)):
    settings = await get_settings()
    html = (
        '<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;'
        'font-family:Arial,sans-serif"><tr><td style="padding:24px">'
        f'<p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#002FA7;'
        f'font-weight:700;margin:0 0 6px">CoolDesk</p>'
        '<h1 style="font-size:20px;color:#09090B;margin:0 0 8px">Test email successful</h1>'
        '<p style="font-size:14px;color:#52525B;margin:0">Your email provider is configured '
        'correctly. New complaint notifications will be delivered to brand stakeholders.</p>'
        f'<p style="font-size:11px;color:#A1A1AA;margin:24px 0 0">Sent by {escape(EMAIL_FROM_NAME)}.</p>'
        '</td></tr></table>'
    )
    try:
        email_id = await dispatch_email(to=[admin["email"]], subject="CoolDesk test email",
                                        html=html, settings=settings)
        return {"ok": True, "email_id": email_id, "sent_to": admin["email"],
                "provider": settings.get("email_provider", "emergent")}
    except Exception as e:
        logger.error(f"Test email failed: {e}")
        raise HTTPException(status_code=502, detail=f"Send failed: {e}")


# ---------------------------------------------------------------------------
# Tickets
# ---------------------------------------------------------------------------
async def next_ticket_number(code: str) -> str:
    counter = await db.counters.find_one_and_update(
        {"id": code}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    seq = counter["seq"] if counter else 1
    return f"{code}-{seq:06d}"


def resolve_collaborators(brand: dict, complaint_type: str, settings: dict) -> List[str]:
    emails = list(brand.get("catch_all_emails", []))
    emails += brand.get("routing", {}).get(complaint_type, [])
    if not emails:
        emails = list(settings.get("default_stakeholders", []))
    seen, out = set(), []
    for e in emails:
        e = (e or "").strip().lower()
        if e and e not in seen:
            seen.add(e)
            out.append(e)
    return out


@api_router.post("/public/tickets")
async def create_ticket(data: TicketCreate):
    if data.complaint_type not in COMPLAINT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid complaint type")
    brand = await db.brands.find_one({"id": data.brand_id, "active": True})
    if not brand:
        raise HTTPException(status_code=400, detail="Invalid or inactive brand")
    settings = await get_settings()
    collaborators = resolve_collaborators(brand, data.complaint_type, settings)
    now = datetime.now(timezone.utc).isoformat()
    priority = data.priority if data.priority in PRIORITIES else "normal"
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": await next_ticket_number(brand["code"]),
        "brand_id": brand["id"], "brand_name": brand["name"],
        "complaint_type": data.complaint_type,
        "subject": data.subject.strip(), "description": data.description.strip(),
        "priority": priority, "status": "open",
        "customer_name": data.customer_name.strip(), "customer_phone": data.customer_phone.strip(),
        "customer_email": (data.customer_email or "").strip(),
        "customer_address": data.customer_address.strip(), "city": data.city.strip(),
        "dealer_name": data.dealer_name.strip(), "dealer_phone": data.dealer_phone.strip(),
        "collaborators": collaborators, "assigned_agent": None,
        "thread": [], "email_status": "pending",
        "created_at": now, "updated_at": now,
    }
    if collaborators:
        try:
            email_id = await dispatch_email(
                to=collaborators,
                subject=f'[{ticket["ticket_number"]}] {ticket["brand_name"]} '
                        f'{ticket["complaint_type"].title()} — {ticket["subject"]}',
                html=build_ticket_email(ticket),
                settings=settings,
            )
            ticket["email_status"] = "sent" if email_id else "skipped"
        except Exception as e:
            logger.error(f"Ticket email failed: {e}")
            ticket["email_status"] = "failed"
    else:
        ticket["email_status"] = "no_recipients"
    await db.tickets.insert_one(ticket)
    return {"ticket_number": ticket["ticket_number"], "brand_name": ticket["brand_name"],
            "collaborators": collaborators, "email_status": ticket["email_status"]}


@api_router.get("/tickets")
async def list_tickets(user: dict = Depends(get_current_user),
                       status: Optional[str] = None, brand_id: Optional[str] = None,
                       complaint_type: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if status and status != "all":
        query["status"] = status
    if brand_id and brand_id != "all":
        query["brand_id"] = brand_id
    if complaint_type and complaint_type != "all":
        query["complaint_type"] = complaint_type
    if q:
        query["$or"] = [
            {"ticket_number": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"subject": {"$regex": q, "$options": "i"}},
            {"customer_phone": {"$regex": q, "$options": "i"}},
        ]
    return await db.tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    all_tickets = await db.tickets.find({}, {"_id": 0, "status": 1, "priority": 1,
                                             "complaint_type": 1, "brand_name": 1}).to_list(5000)
    by_status = {s: 0 for s in TICKET_STATUSES}
    by_type = {t: 0 for t in COMPLAINT_TYPES}
    by_brand = {}
    urgent = 0
    for t in all_tickets:
        by_status[t.get("status", "open")] = by_status.get(t.get("status", "open"), 0) + 1
        by_type[t.get("complaint_type", "service")] = by_type.get(t.get("complaint_type", "service"), 0) + 1
        by_brand[t.get("brand_name", "-")] = by_brand.get(t.get("brand_name", "-"), 0) + 1
        if t.get("priority") == "urgent":
            urgent += 1
    return {"total": len(all_tickets), "by_status": by_status, "by_type": by_type,
            "by_brand": by_brand, "urgent": urgent,
            "open_active": by_status.get("open", 0) + by_status.get("in_progress", 0)}


@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@api_router.patch("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, data: TicketUpdate, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.status and data.status in TICKET_STATUSES:
        update["status"] = data.status
    if data.priority and data.priority in PRIORITIES:
        update["priority"] = data.priority
    if data.assigned_agent is not None:
        update["assigned_agent"] = data.assigned_agent or None
    await db.tickets.update_one({"id": ticket_id}, {"$set": update})
    return await db.tickets.find_one({"id": ticket_id}, {"_id": 0})


@api_router.post("/tickets/{ticket_id}/reply")
async def add_reply(ticket_id: str, data: ReplyInput, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    entry = {"id": str(uuid.uuid4()), "author": user["name"], "author_email": user["email"],
             "message": data.message.strip(), "internal": data.internal,
             "created_at": datetime.now(timezone.utc).isoformat()}
    await db.tickets.update_one({"id": ticket_id},
                                {"$push": {"thread": entry},
                                 "$set": {"updated_at": entry["created_at"]}})
    return await db.tickets.find_one({"id": ticket_id}, {"_id": 0})


@api_router.get("/meta")
async def meta():
    return {"complaint_types": COMPLAINT_TYPES, "statuses": TICKET_STATUSES, "priorities": PRIORITIES}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
DEFAULT_BRANDS = [
    ("Voltas", "VOLT"), ("LG", "LG"), ("Daikin", "DKN"), ("Blue Star", "BLST"),
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.brands.create_index("code", unique=True)
    await db.tickets.create_index("ticket_number", unique=True)

    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        await db.users.insert_one({"id": str(uuid.uuid4()), "name": "Administrator",
                                   "email": ADMIN_EMAIL.lower(),
                                   "password_hash": hash_password(ADMIN_PASSWORD),
                                   "role": "admin",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL.lower()},
                                  {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    if await db.brands.count_documents({}) == 0:
        for name, code in DEFAULT_BRANDS:
            await db.brands.insert_one({
                "id": str(uuid.uuid4()), "name": name, "code": code,
                "catch_all_emails": [ADMIN_EMAIL.lower()],
                "routing": {t: [] for t in COMPLAINT_TYPES},
                "active": True, "created_at": datetime.now(timezone.utc).isoformat()})

    await get_settings()
    if not (await get_settings()).get("default_stakeholders"):
        await db.settings.update_one({"id": "global"},
                                     {"$set": {"default_stakeholders": [ADMIN_EMAIL.lower()]}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
