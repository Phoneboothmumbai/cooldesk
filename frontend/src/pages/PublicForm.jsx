import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Snowflake, Wrench, CheckCircle, ArrowRight, Copy } from "@phosphor-icons/react";

const HERO =
  "https://images.unsplash.com/photo-1698479603408-1a66a6d9e80f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxodmFjJTIwaW5zdGFsbGF0aW9ufGVufDB8fHx8MTc4ODk3MDc4Mnww&ixlib=rb-4.1.0&q=85";

const TYPES = [
  { v: "installation", label: "Installation" },
  { v: "repair", label: "Repair" },
  { v: "service", label: "Service / Maintenance" },
];

const empty = {
  brand_id: "",
  complaint_type: "",
  priority: "normal",
  subject: "",
  description: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  customer_address: "",
  city: "",
  dealer_name: "",
  dealer_phone: "",
  dealer_email: "",
};

export default function PublicForm() {
  const [brands, setBrands] = useState([]);
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/public/brands").then(({ data }) => setBrands(data)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.brand_id || !form.complaint_type) {
      toast.error("Please select a brand and complaint type");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/public/tickets", form);
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="rounded-md border border-border bg-white p-8 sm:p-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#E7F6F3]">
              <CheckCircle size={28} weight="fill" className="text-[#2A9D8F]" />
            </div>
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">
              Complaint registered
            </h1>
            <p className="mt-2 text-[#52525B]">
              Your ticket has been raised and {result.brand_name} stakeholders have been notified by
              email.
            </p>
            <div className="mt-6 flex items-center justify-between rounded-md border border-border bg-[#FAFAFA] px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A1A1AA]">
                  Ticket ID
                </div>
                <div
                  data-testid="ticket-number-result"
                  className="font-mono text-xl font-bold text-primary"
                >
                  {result.ticket_number}
                </div>
              </div>
              <button
                data-testid="copy-ticket-number"
                onClick={() => {
                  navigator.clipboard.writeText(result.ticket_number);
                  toast.success("Ticket ID copied");
                }}
                className="rounded-md border border-border p-2 text-[#52525B] transition-colors duration-200 hover:bg-white"
              >
                <Copy size={18} />
              </button>
            </div>
            <p className="mt-4 text-sm text-[#52525B]">
              {result.collaborators?.length
                ? `${result.collaborators.length} stakeholder(s) added as collaborators.`
                : "No stakeholders configured for this brand yet."}
            </p>
            <Button
              data-testid="raise-another-button"
              className="mt-8"
              onClick={() => {
                setForm(empty);
                setResult(null);
              }}
            >
              Raise another complaint
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Dealer Complaint Desk
            </p>
            <h1 className="mt-2 font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Raise an AC complaint on behalf of your customer
            </h1>
            <p className="mt-4 text-[#52525B]">
              Pick the brand and issue type. The right brand stakeholders are automatically added as
              collaborators and emailed instantly — no follow-ups needed.
            </p>
            <div className="mt-8 overflow-hidden rounded-md border border-border">
              <img src={HERO} alt="Air conditioners" className="h-56 w-full object-cover" />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {TYPES.map((t) => (
                <div key={t.v} className="rounded-md border border-border bg-white px-2 py-3">
                  <Wrench size={18} className="mx-auto text-primary" weight="duotone" />
                  <div className="mt-1 text-xs font-semibold">{t.label.split(" ")[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-7">
          <form
            onSubmit={submit}
            className="rounded-md border border-border bg-white p-6 sm:p-10"
            data-testid="complaint-form"
          >
            <Section title="Complaint">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Brand">
                  <Select value={form.brand_id} onValueChange={set("brand_id")}>
                    <SelectTrigger data-testid="brand-select">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Complaint type">
                  <Select value={form.complaint_type} onValueChange={set("complaint_type")}>
                    <SelectTrigger data-testid="type-select">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t.v} value={t.v}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Priority">
                  <Select value={form.priority} onValueChange={set("priority")}>
                    <SelectTrigger data-testid="priority-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "normal", "high", "urgent"].map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Subject">
                  <Input
                    data-testid="subject-input"
                    value={form.subject}
                    onChange={set("subject")}
                    placeholder="e.g. New 1.5T split AC install"
                    required
                  />
                </Field>
              </div>
              <Field label="Issue details" className="mt-5">
                <Textarea
                  data-testid="description-input"
                  value={form.description}
                  onChange={set("description")}
                  rows={4}
                  placeholder="Describe the issue, model, and any relevant details"
                  required
                />
              </Field>
            </Section>

            <Section title="Customer" className="mt-8">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Customer name">
                  <Input data-testid="customer-name-input" value={form.customer_name} onChange={set("customer_name")} required />
                </Field>
                <Field label="Customer phone">
                  <Input data-testid="customer-phone-input" value={form.customer_phone} onChange={set("customer_phone")} required />
                </Field>
                <Field label="Customer email (optional)">
                  <Input data-testid="customer-email-input" value={form.customer_email} onChange={set("customer_email")} type="email" />
                </Field>
                <Field label="City">
                  <Input data-testid="city-input" value={form.city} onChange={set("city")} />
                </Field>
              </div>
              <Field label="Address" className="mt-5">
                <Textarea data-testid="address-input" value={form.customer_address} onChange={set("customer_address")} rows={2} />
              </Field>
            </Section>

            <Section title="Dealer (raised by)" className="mt-8">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Dealer name">
                  <Input data-testid="dealer-name-input" value={form.dealer_name} onChange={set("dealer_name")} required />
                </Field>
                <Field label="Dealer phone">
                  <Input data-testid="dealer-phone-input" value={form.dealer_phone} onChange={set("dealer_phone")} required />
                </Field>
              </div>
              <Field label="Dealer email (you'll be kept in the loop)" className="mt-5">
                <Input data-testid="dealer-email-input" type="email" value={form.dealer_email} onChange={set("dealer_email")} placeholder="you@dealership.com" required />
              </Field>
            </Section>

            <Button
              type="submit"
              data-testid="submit-complaint-button"
              disabled={submitting}
              className="mt-8 w-full gap-2 sm:w-auto"
            >
              {submitting ? "Submitting..." : "Submit complaint"}
              <ArrowRight size={18} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

const TopBar = () => (
  <header className="border-b border-border bg-white">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white">
          <Snowflake size={18} weight="fill" />
        </div>
        <span className="font-heading text-lg font-extrabold tracking-tight">CoolDesk</span>
      </div>
      <a
        href="/login"
        data-testid="staff-login-link"
        className="text-sm font-semibold text-[#52525B] transition-colors duration-200 hover:text-primary"
      >
        Staff login
      </a>
    </div>
  </header>
);

const Section = ({ title, children, className = "" }) => (
  <div className={className}>
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#A1A1AA]">{title}</h2>
    {children}
  </div>
);

const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <Label className="mb-1.5 block text-sm font-medium text-[#09090B]">{label}</Label>
    {children}
  </div>
);
