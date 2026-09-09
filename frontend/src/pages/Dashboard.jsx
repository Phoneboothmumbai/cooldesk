import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Ticket, Warning, Clock, CheckCircle, TrendUp } from "@phosphor-icons/react";
import { TYPE_LABELS } from "@/lib/labels";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/tickets").then(({ data }) => setRecent(data.slice(0, 6))).catch(() => {});
  }, []);

  const cards = [
    { label: "Total tickets", value: stats?.total, icon: Ticket, color: "text-primary" },
    { label: "Open / active", value: stats?.open_active, icon: Clock, color: "text-[#B45309]" },
    { label: "Urgent", value: stats?.urgent, icon: Warning, color: "text-[#E63946]" },
    { label: "Resolved", value: stats?.by_status?.resolved, icon: CheckCircle, color: "text-[#2A9D8F]" },
  ];

  return (
    <div className="p-6 sm:p-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Overview</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">Service desk dashboard</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} data-testid={`stat-${c.label.split(" ")[0].toLowerCase()}`} className="rounded-md border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A1A1AA]">{c.label}</span>
              <c.icon size={20} className={c.color} weight="duotone" />
            </div>
            <div className="mt-3 font-mono text-3xl font-bold">{c.value ?? "—"}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-white p-5 lg:col-span-1">
          <h3 className="mb-4 text-sm font-bold">By complaint type</h3>
          {Object.entries(stats?.by_type || {}).map(([k, v]) => (
            <Bar key={k} label={TYPE_LABELS[k] || k} value={v} total={stats?.total || 1} />
          ))}
          <h3 className="mb-4 mt-6 text-sm font-bold">By brand</h3>
          {Object.entries(stats?.by_brand || {}).map(([k, v]) => (
            <Bar key={k} label={k} value={v} total={stats?.total || 1} />
          ))}
          {!Object.keys(stats?.by_brand || {}).length && (
            <p className="text-sm text-[#A1A1AA]">No tickets yet.</p>
          )}
        </div>

        <div className="rounded-md border border-border bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-sm font-bold">Recent complaints</h3>
            <button onClick={() => navigate("/admin/tickets")} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              View all <TrendUp size={14} />
            </button>
          </div>
          <div className="divide-y divide-border">
            {recent.map((t) => (
              <button
                key={t.id}
                data-testid={`recent-ticket-${t.ticket_number}`}
                onClick={() => navigate(`/admin/tickets/${t.id}`)}
                className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors duration-200 hover:bg-[#FAFAFA]"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm font-semibold text-primary">{t.ticket_number}</span>
                  <span className="ml-2 truncate text-sm text-[#09090B]">{t.subject}</span>
                  <div className="text-xs text-[#A1A1AA]">
                    {t.brand_name} · {TYPE_LABELS[t.complaint_type]} · {t.customer_name}
                  </div>
                </div>
              </button>
            ))}
            {!recent.length && <p className="px-5 py-6 text-sm text-[#A1A1AA]">No complaints yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const Bar = ({ label, value, total }) => (
  <div className="mb-3">
    <div className="mb-1 flex items-center justify-between text-sm">
      <span className="text-[#52525B]">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F4F4F5]">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (value / total) * 100)}%` }} />
    </div>
  </div>
);
