import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, EnvelopeSimple, User, MapPin, Phone, PaperPlaneRight, LockSimple } from "@phosphor-icons/react";
import { STATUS_META, PRIORITY_META, TYPE_LABELS, Pill } from "@/lib/labels";

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [agents, setAgents] = useState([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const load = () => api.get(`/tickets/${id}`).then(({ data }) => setT(data)).catch(() => {});
  useEffect(() => {
    load();
    api.get("/agents").then(({ data }) => setAgents(data)).catch(() => {});
  }, [id]);

  const patch = async (payload) => {
    try {
      const { data } = await api.patch(`/tickets/${id}`, payload);
      setT(data);
      toast.success("Ticket updated");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/tickets/${id}/reply`, { message: reply, internal });
      setT(data);
      setReply("");
      setInternal(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setSending(false);
    }
  };

  if (!t) return <div className="p-10 text-sm text-[#A1A1AA]">Loading…</div>;

  return (
    <div className="p-6 sm:p-10">
      <button onClick={() => navigate("/admin/tickets")} className="mb-5 flex items-center gap-1 text-sm font-semibold text-[#52525B] hover:text-primary" data-testid="back-to-tickets">
        <ArrowLeft size={16} /> Back to tickets
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-md border border-border bg-white p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold text-primary" data-testid="detail-ticket-number">{t.ticket_number}</span>
              <Pill meta={STATUS_META[t.status]} testid="detail-status-pill" />
              <Pill meta={PRIORITY_META[t.priority]} />
              <span className="rounded-md border border-border bg-[#FAFAFA] px-2 py-0.5 text-xs font-semibold text-[#52525B]">
                {t.brand_name} · {TYPE_LABELS[t.complaint_type]}
              </span>
            </div>
            <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight">{t.subject}</h1>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#52525B]">{t.description}</p>
          </div>

          <div className="mt-6 rounded-md border border-border bg-white">
            <div className="border-b border-border px-6 py-4 text-sm font-bold">Activity</div>
            <div className="divide-y divide-border">
              {t.thread?.map((m) => (
                <div key={m.id} className={`px-6 py-4 ${m.internal ? "bg-[#FFFBEB]" : ""}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{m.author}</span>
                    {m.internal && (
                      <span className="flex items-center gap-1 rounded bg-[#FDE68A] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#92400E]">
                        <LockSimple size={10} weight="fill" /> Internal
                      </span>
                    )}
                    <span className="text-xs text-[#A1A1AA]">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[#52525B]">{m.message}</p>
                </div>
              ))}
              {!t.thread?.length && <p className="px-6 py-6 text-sm text-[#A1A1AA]">No activity yet.</p>}
            </div>
            <div className="border-t border-border p-4">
              <Textarea
                data-testid="reply-input"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Add a note or update…"
              />
              <div className="mt-3 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-[#52525B]">
                  <Checkbox data-testid="internal-checkbox" checked={internal} onCheckedChange={setInternal} />
                  Internal note
                </label>
                <Button data-testid="send-reply-button" onClick={sendReply} disabled={sending} className="gap-2">
                  <PaperPlaneRight size={16} /> Post
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-border bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#A1A1AA]">Manage</h3>
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            <Select value={t.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger data-testid="status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="mb-1.5 mt-4 block text-sm font-medium">Priority</label>
            <Select value={t.priority} onValueChange={(v) => patch({ priority: v })}>
              <SelectTrigger data-testid="priority-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="mb-1.5 mt-4 block text-sm font-medium">Assigned agent</label>
            <Select value={t.assigned_agent || "unassigned"} onValueChange={(v) => patch({ assigned_agent: v === "unassigned" ? "" : v })}>
              <SelectTrigger data-testid="assign-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border bg-white p-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#A1A1AA]">Customer</h3>
            <Info icon={User} text={t.customer_name} />
            <Info icon={Phone} text={t.customer_phone} />
            {t.customer_email && <Info icon={EnvelopeSimple} text={t.customer_email} />}
            {(t.customer_address || t.city) && <Info icon={MapPin} text={[t.customer_address, t.city].filter(Boolean).join(", ")} />}
            <div className="mt-3 border-t border-border pt-3 text-xs text-[#A1A1AA]">
              Raised by dealer <span className="font-semibold text-[#52525B]">{t.dealer_name}</span> · {t.dealer_phone}
              {t.dealer_email && <span className="block break-all">{t.dealer_email}</span>}
            </div>
          </div>

          <div className="rounded-md border border-border bg-white p-5">
            <h3 className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-[#A1A1AA]">
              Collaborators (CC)
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${t.email_status === "sent" ? "bg-[#E7F6F3] text-[#1E7168]" : "bg-[#F4F4F5] text-[#52525B]"}`}>
                {t.email_status}
              </span>
            </h3>
            {t.collaborators?.length ? (
              <ul className="space-y-1.5" data-testid="collaborators-list">
                {t.collaborators.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm text-[#52525B]">
                    <EnvelopeSimple size={14} className="text-primary" /> {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#A1A1AA]">No stakeholders configured for this brand.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const Info = ({ icon: Icon, text }) => (
  <div className="mb-2 flex items-center gap-2 text-sm text-[#52525B]">
    <Icon size={15} className="text-[#A1A1AA]" /> <span className="break-all">{text}</span>
  </div>
);
