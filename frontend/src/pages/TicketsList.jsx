import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { STATUS_META, PRIORITY_META, TYPE_LABELS, Pill } from "@/lib/labels";

export default function TicketsList() {
  const [tickets, setTickets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [brandId, setBrandId] = useState("all");
  const [type, setType] = useState("all");
  const navigate = useNavigate();

  const load = useMemo(
    () => () => {
      const params = { status, brand_id: brandId, complaint_type: type, q: q || undefined };
      api.get("/tickets", { params }).then(({ data }) => setTickets(data)).catch(() => {});
    },
    [status, brandId, type, q]
  );

  useEffect(() => {
    api.get("/brands").then(({ data }) => setBrands(data)).catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-6 sm:p-10">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Tickets</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">All complaints</h1>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <Input
            data-testid="ticket-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, customer, subject, phone"
            className="pl-9"
          />
        </div>
        <FilterSelect testid="filter-status" value={status} onChange={setStatus} placeholder="Status"
          options={[["all", "All statuses"], ...Object.entries(STATUS_META).map(([k, v]) => [k, v.label])]} />
        <FilterSelect testid="filter-brand" value={brandId} onChange={setBrandId} placeholder="Brand"
          options={[["all", "All brands"], ...brands.map((b) => [b.id, b.name])]} />
        <FilterSelect testid="filter-type" value={type} onChange={setType} placeholder="Type"
          options={[["all", "All types"], ...Object.entries(TYPE_LABELS)]} />
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-[#FAFAFA] text-xs uppercase tracking-wider text-[#A1A1AA]">
            <tr>
              <th className="px-4 py-3 font-semibold">Ticket</th>
              <th className="px-4 py-3 font-semibold">Brand / Type</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tickets.map((t) => (
              <tr
                key={t.id}
                data-testid={`ticket-row-${t.ticket_number}`}
                onClick={() => navigate(`/admin/tickets/${t.id}`)}
                className="cursor-pointer transition-colors duration-200 hover:bg-[#FAFAFA]"
              >
                <td className="px-4 py-3">
                  <div className="font-mono font-semibold text-primary">{t.ticket_number}</div>
                  <div className="max-w-[220px] truncate text-xs text-[#52525B]">{t.subject}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{t.brand_name}</div>
                  <div className="text-xs text-[#A1A1AA]">{TYPE_LABELS[t.complaint_type]}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{t.customer_name}</div>
                  <div className="text-xs text-[#A1A1AA]">{t.customer_phone}</div>
                </td>
                <td className="px-4 py-3"><Pill meta={PRIORITY_META[t.priority]} /></td>
                <td className="px-4 py-3"><Pill meta={STATUS_META[t.status]} /></td>
                <td className="px-4 py-3 font-mono text-xs text-[#52525B]">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!tickets.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#A1A1AA]">
                  No tickets match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const FilterSelect = ({ value, onChange, placeholder, options, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger data-testid={testid} className="w-[160px]">
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.map(([v, l]) => (
        <SelectItem key={v} value={v}>{l}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);
