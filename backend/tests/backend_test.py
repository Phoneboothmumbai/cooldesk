"""Comprehensive backend tests for the CoolDesk ticketing platform."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://brand-ticket-system.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "phoneboothmumbai@gmail.com"
ADMIN_PASSWORD = "CoolDesk@2026"

# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def brands(api):
    r = api.get(f"{BASE_URL}/api/public/brands")
    assert r.status_code == 200
    return r.json()


# ---------------- Auth ----------------
class TestAuth:
    def test_login_success(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_bad_password(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL.lower()


# ---------------- Public form ----------------
class TestPublic:
    def test_public_brands_no_auth(self, api, brands):
        assert len(brands) >= 4
        codes = {b["code"] for b in brands}
        assert {"VOLT", "LG", "DKN", "BLST"}.issubset(codes)

    def test_public_ticket_creation(self, api, brands):
        volt = next(b for b in brands if b["code"] == "VOLT")
        payload = {
            "brand_id": volt["id"], "complaint_type": "installation",
            "subject": "TEST_ AC not cooling", "description": "TEST_ description",
            "customer_name": "TEST_ Customer", "customer_phone": "9999900000",
            "dealer_name": "TEST_ Dealer", "dealer_phone": "8888800000",
            "city": "Mumbai", "priority": "high",
        }
        r = api.post(f"{BASE_URL}/api/public/tickets", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ticket_number"].startswith("VOLT-")
        assert data["email_status"] in ("sent", "skipped")
        assert len(data["collaborators"]) >= 1

    def test_public_ticket_invalid_brand(self, api):
        r = api.post(f"{BASE_URL}/api/public/tickets", json={
            "brand_id": "no-such-id", "complaint_type": "repair", "subject": "x",
            "description": "x", "customer_name": "c", "customer_phone": "1",
            "dealer_name": "d", "dealer_phone": "1",
        })
        assert r.status_code == 400

    def test_public_ticket_invalid_type(self, api, brands):
        r = api.post(f"{BASE_URL}/api/public/tickets", json={
            "brand_id": brands[0]["id"], "complaint_type": "bogus",
            "subject": "x", "description": "x", "customer_name": "c",
            "customer_phone": "1", "dealer_name": "d", "dealer_phone": "1",
        })
        assert r.status_code == 400


# ---------------- Tickets management ----------------
class TestTickets:
    def test_list_tickets(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/tickets", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stats(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/stats", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        for k in ("total", "by_status", "by_type", "by_brand", "urgent", "open_active"):
            assert k in data

    def test_ticket_flow_update_reply(self, api, admin_headers, brands):
        # create via public
        lg = next(b for b in brands if b["code"] == "LG")
        create = api.post(f"{BASE_URL}/api/public/tickets", json={
            "brand_id": lg["id"], "complaint_type": "repair",
            "subject": "TEST_ flow", "description": "flow desc",
            "customer_name": "TEST_ C", "customer_phone": "1",
            "dealer_name": "TEST_ D", "dealer_phone": "1",
        }).json()
        # find it
        tickets = api.get(f"{BASE_URL}/api/tickets?q={create['ticket_number']}", headers=admin_headers).json()
        assert len(tickets) == 1
        tid = tickets[0]["id"]
        # patch status/priority
        r = api.patch(f"{BASE_URL}/api/tickets/{tid}",
                      headers=admin_headers,
                      json={"status": "in_progress", "priority": "urgent"})
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"
        assert r.json()["priority"] == "urgent"
        # add reply
        r = api.post(f"{BASE_URL}/api/tickets/{tid}/reply",
                     headers=admin_headers,
                     json={"message": "TEST_ reply", "internal": True})
        assert r.status_code == 200
        assert len(r.json()["thread"]) == 1
        assert r.json()["thread"][0]["internal"] is True

    def test_filters(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/tickets?status=open", headers=admin_headers)
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "open"


# ---------------- Brands admin ----------------
class TestBrands:
    _brand_id = None

    def test_create_brand(self, api, admin_headers):
        code = f"TB{uuid.uuid4().hex[:4].upper()}"
        r = api.post(f"{BASE_URL}/api/brands", headers=admin_headers, json={
            "name": f"TEST_ Brand {code}", "code": code,
            "catch_all_emails": ["catchall@test.com"],
            "routing": {"installation": ["inst@test.com"], "repair": [], "service": []},
            "active": True,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["code"] == code
        TestBrands._brand_id = data["id"]

    def test_update_brand(self, api, admin_headers):
        assert TestBrands._brand_id
        r = api.put(f"{BASE_URL}/api/brands/{TestBrands._brand_id}", headers=admin_headers, json={
            "name": "TEST_ Updated", "code": "TBUPD",
            "catch_all_emails": [], "routing": {"installation": [], "repair": [], "service": []},
            "active": True,
        })
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_ Updated"

    def test_brand_appears_in_public_list(self, api):
        r = api.get(f"{BASE_URL}/api/public/brands")
        assert any(b["code"] == "TBUPD" for b in r.json())

    def test_delete_brand(self, api, admin_headers):
        r = api.delete(f"{BASE_URL}/api/brands/{TestBrands._brand_id}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Agents admin ----------------
class TestAgents:
    _agent_id = None
    _agent_email = f"test_agent_{uuid.uuid4().hex[:6]}@test.com"
    _agent_pw = "AgentPass@123"

    def test_create_agent(self, api, admin_headers):
        r = api.post(f"{BASE_URL}/api/agents", headers=admin_headers, json={
            "name": "TEST_ Agent", "email": TestAgents._agent_email,
            "password": TestAgents._agent_pw, "role": "agent",
        })
        assert r.status_code == 200, r.text
        TestAgents._agent_id = r.json()["id"]

    def test_agent_can_login(self):
        # Use a separate requests session so cookies don't clobber the admin session
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TestAgents._agent_email, "password": TestAgents._agent_pw})
        assert r.status_code == 200
        TestAgents._agent_token = r.json()["token"]

    def test_agent_forbidden_from_admin(self):
        h = {"Authorization": f"Bearer {TestAgents._agent_token}", "Content-Type": "application/json"}
        r = requests.post(f"{BASE_URL}/api/brands", headers=h, json={
            "name": "nope", "code": "NOPE", "catch_all_emails": [],
            "routing": {"installation": [], "repair": [], "service": []}, "active": True})
        assert r.status_code == 403
        r = requests.post(f"{BASE_URL}/api/agents", headers=h, json={
            "name": "x", "email": "x@x.com", "password": "xxx", "role": "agent"})
        assert r.status_code == 403
        r = requests.put(f"{BASE_URL}/api/settings", headers=h, json={"default_stakeholders": []})
        assert r.status_code == 403

    def test_delete_agent(self, api, admin_headers):
        r = api.delete(f"{BASE_URL}/api/agents/{TestAgents._agent_id}", headers=admin_headers)
        assert r.status_code == 200


# ---------------- Settings ----------------
class TestSettings:
    def test_get_settings(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/settings", headers=admin_headers)
        assert r.status_code == 200
        assert "email_provider" in r.json()

    def test_update_settings(self, api, admin_headers):
        r = api.put(f"{BASE_URL}/api/settings", headers=admin_headers, json={
            "default_stakeholders": [ADMIN_EMAIL],
            "email_provider": "resend",
            "resend_from_email": "test@example.com",
            "resend_from_name": "TEST",
        })
        assert r.status_code == 200
        assert r.json()["email_provider"] == "resend"
        # revert
        api.put(f"{BASE_URL}/api/settings", headers=admin_headers, json={
            "default_stakeholders": [ADMIN_EMAIL], "email_provider": "emergent"})

    def test_send_test_email(self, api, admin_headers):
        # Ensure provider is emergent for reliable send
        api.put(f"{BASE_URL}/api/settings", headers=admin_headers, json={
            "default_stakeholders": [ADMIN_EMAIL], "email_provider": "emergent"})
        r = api.post(f"{BASE_URL}/api/settings/test-email", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True


# ---------------- Distributor / CC / Reply threading ----------------
class TestDistributorRouting:
    _brand_id = None
    _brand_code = None
    _ticket_id = None
    _ticket_number = None
    _distributor = f"test_dist_{uuid.uuid4().hex[:6]}@test.com"

    def test_set_distributor(self, api, admin_headers):
        r = api.put(f"{BASE_URL}/api/settings", headers=admin_headers, json={
            "default_stakeholders": [ADMIN_EMAIL],
            "distributor_email": TestDistributorRouting._distributor,
            "email_provider": "emergent",
        })
        assert r.status_code == 200, r.text
        assert r.json()["distributor_email"] == TestDistributorRouting._distributor

    def test_get_settings_returns_distributor(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/settings", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["distributor_email"] == TestDistributorRouting._distributor

    def test_create_brand_with_routing(self, api, admin_headers):
        code = f"TD{uuid.uuid4().hex[:4].upper()}"
        r = api.post(f"{BASE_URL}/api/brands", headers=admin_headers, json={
            "name": f"TEST_ DistBrand {code}", "code": code,
            "catch_all_emails": ["catchall@example.com", TestDistributorRouting._distributor],
            "routing": {"installation": ["inst@example.org"], "repair": [], "service": []},
            "active": True,
        })
        assert r.status_code == 200, r.text
        TestDistributorRouting._brand_id = r.json()["id"]
        TestDistributorRouting._brand_code = r.json()["code"]

    def test_public_ticket_routing_structure(self, api, admin_headers):
        dealer = "dealer_test@example.com"
        r = api.post(f"{BASE_URL}/api/public/tickets", json={
            "brand_id": TestDistributorRouting._brand_id,
            "complaint_type": "installation",
            "subject": "TEST_ dist routing", "description": "d",
            "customer_name": "TEST_ C", "customer_phone": "1",
            "dealer_name": "TEST_ D", "dealer_phone": "1",
            "dealer_email": dealer,
        })
        assert r.status_code == 200, r.text
        tn = r.json()["ticket_number"]
        TestDistributorRouting._ticket_number = tn
        # Fetch full ticket to validate structure
        tickets = api.get(f"{BASE_URL}/api/tickets?q={tn}", headers=admin_headers).json()
        assert len(tickets) == 1
        t = tickets[0]
        TestDistributorRouting._ticket_id = t["id"]
        dist = TestDistributorRouting._distributor
        assert t["distributor_email"] == dist
        assert dist not in t["cc"], f"distributor must be de-duplicated OUT of cc; cc={t['cc']}"
        # cc must contain catchall, installation route, and dealer email (each once)
        for expected in ["catchall@example.com", "inst@example.org", dealer]:
            assert expected in t["cc"], f"missing {expected} in cc={t['cc']}"
        # exactly-once
        assert len(t["cc"]) == len(set(t["cc"]))
        # collaborators = to + cc
        assert t["collaborators"][0] == dist
        assert set(t["collaborators"][1:]) == set(t["cc"])

    def test_public_reply_ok(self, api, admin_headers):
        tid = TestDistributorRouting._ticket_id
        r = api.post(f"{BASE_URL}/api/tickets/{tid}/reply", headers=admin_headers,
                     json={"message": "TEST_ public reply", "internal": False})
        assert r.status_code == 200, r.text
        thread = r.json()["thread"]
        assert any(e["message"] == "TEST_ public reply" and e["internal"] is False for e in thread)

    def test_internal_reply_ok(self, api, admin_headers):
        tid = TestDistributorRouting._ticket_id
        r = api.post(f"{BASE_URL}/api/tickets/{tid}/reply", headers=admin_headers,
                     json={"message": "TEST_ internal note", "internal": True})
        assert r.status_code == 200
        thread = r.json()["thread"]
        assert any(e["message"] == "TEST_ internal note" and e["internal"] is True for e in thread)

    def test_cleanup_brand(self, api, admin_headers):
        if TestDistributorRouting._brand_id:
            api.delete(f"{BASE_URL}/api/brands/{TestDistributorRouting._brand_id}", headers=admin_headers)
        # revert distributor to admin default
        api.put(f"{BASE_URL}/api/settings", headers=admin_headers, json={
            "default_stakeholders": [ADMIN_EMAIL],
            "distributor_email": ADMIN_EMAIL,
            "email_provider": "emergent",
        })


# ---------------- Meta ----------------
def test_meta(api):
    r = api.get(f"{BASE_URL}/api/meta")
    assert r.status_code == 200
    j = r.json()
    assert "complaint_types" in j and "statuses" in j and "priorities" in j
