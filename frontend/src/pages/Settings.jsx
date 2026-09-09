import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
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
import { PaperPlaneTilt, CheckCircle, Info } from "@phosphor-icons/react";

const toText = (arr) => (arr || []).join("\n");
const toArr = (txt) => (txt || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [s, setS] = useState(null);
  const [defaults, setDefaults] = useState("");
  const [provider, setProvider] = useState("emergent");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.get("/settings").then(({ data }) => {
      setS(data);
      setDefaults(toText(data.default_stakeholders));
      setProvider(data.email_provider || "emergent");
      setFromEmail(data.resend_from_email || "");
      setFromName(data.resend_from_name || "");
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/settings", {
        default_stakeholders: toArr(defaults),
        email_provider: provider,
        resend_from_email: fromEmail,
        resend_from_name: fromName,
        resend_api_key: apiKey || null,
      });
      setS(data);
      setApiKey("");
      toast.success("Settings saved");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/settings/test-email");
      toast.success(`Test email sent to ${data.sent_to} via ${data.provider}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setTesting(false);
    }
  };

  if (!s) return <div className="p-10 text-sm text-[#A1A1AA]">Loading…</div>;

  return (
    <div className="p-6 sm:p-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Settings</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">Configuration</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-md border border-border bg-white p-6">
          <h2 className="text-sm font-bold">Email provider</h2>
          <p className="mt-1 text-sm text-[#52525B]">Choose how stakeholder notifications are delivered.</p>

          <div className="mt-4 space-y-3">
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors duration-200 ${provider === "emergent" ? "border-primary bg-[#EEF2FF]" : "border-border"}`}>
              <input type="radio" data-testid="provider-emergent" name="provider" checked={provider === "emergent"} onChange={() => setProvider("emergent")} className="mt-1" disabled={!isAdmin} />
              <div>
                <div className="text-sm font-semibold">Emergent managed (default)</div>
                <div className="text-xs text-[#52525B]">Zero setup. Sends from a verified shared domain.</div>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors duration-200 ${provider === "resend" ? "border-primary bg-[#EEF2FF]" : "border-border"}`}>
              <input type="radio" data-testid="provider-resend" name="provider" checked={provider === "resend"} onChange={() => setProvider("resend")} className="mt-1" disabled={!isAdmin} />
              <div>
                <div className="text-sm font-semibold">My own Resend account</div>
                <div className="text-xs text-[#52525B]">Send from your own verified domain and branding.</div>
              </div>
            </label>
          </div>

          {provider === "resend" && (
            <div className="mt-4 space-y-4 rounded-md border border-border bg-[#FAFAFA] p-4">
              <div>
                <Label className="mb-1.5 block text-sm">Resend API key</Label>
                <Input data-testid="resend-key-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={s.resend_configured ? `Saved (${s.resend_key_hint}) — leave blank to keep` : "re_..."} disabled={!isAdmin} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-sm">From email</Label>
                  <Input data-testid="resend-from-email-input" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="tickets@yourdomain.com" disabled={!isAdmin} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">From name</Label>
                  <Input data-testid="resend-from-name-input" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Your Company Service" disabled={!isAdmin} />
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-[#52525B]">
                <Info size={14} className="mt-0.5 shrink-0 text-primary" />
                The from-domain must be verified in your Resend dashboard, or sends will be rejected.
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mt-5 flex items-center gap-3">
              <Button data-testid="save-settings-button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
              <Button variant="outline" data-testid="send-test-email-button" onClick={sendTest} disabled={testing} className="gap-2">
                <PaperPlaneTilt size={16} /> {testing ? "Sending…" : "Send test email"}
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-md border border-border bg-white p-6">
          <h2 className="text-sm font-bold">Default stakeholders (fallback)</h2>
          <p className="mt-1 text-sm text-[#52525B]">
            Used when a brand has no emails configured, so no complaint is ever dropped.
          </p>
          <Textarea data-testid="default-stakeholders-input" className="mt-4" rows={5} value={defaults} onChange={(e) => setDefaults(e.target.value)} placeholder="one email per line or comma separated" disabled={!isAdmin} />
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-[#F0FDF4] px-3 py-2 text-xs text-[#166534]">
            <CheckCircle size={14} weight="fill" /> Routing safety net is active.
          </div>
          {!isAdmin && <p className="mt-4 text-xs text-[#A1A1AA]">Only admins can change settings.</p>}
        </div>
      </div>
    </div>
  );
}
