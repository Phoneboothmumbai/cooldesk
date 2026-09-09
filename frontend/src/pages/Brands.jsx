import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, Buildings } from "@phosphor-icons/react";

const TYPES = ["installation", "repair", "service"];
const toText = (arr) => (arr || []).join("\n");
const toArr = (txt) => (txt || "").split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

const emptyBrand = {
  name: "",
  code: "",
  active: true,
  catch_all: "",
  installation: "",
  repair: "",
  service: "",
};

export default function Brands() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [brands, setBrands] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyBrand);

  const load = () => api.get("/brands").then(({ data }) => setBrands(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyBrand);
    setOpen(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code,
      active: b.active,
      catch_all: toText(b.catch_all_emails),
      installation: toText(b.routing?.installation),
      repair: toText(b.routing?.repair),
      service: toText(b.routing?.service),
    });
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name,
      code: form.code,
      active: form.active,
      catch_all_emails: toArr(form.catch_all),
      routing: {
        installation: toArr(form.installation),
        repair: toArr(form.repair),
        service: toArr(form.service),
      },
    };
    try {
      if (editing) await api.put(`/brands/${editing.id}`, payload);
      else await api.post("/brands", payload);
      toast.success(editing ? "Brand updated" : "Brand created");
      setOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Delete ${b.name}? Existing tickets stay intact.`)) return;
    try {
      await api.delete(`/brands/${b.id}`);
      toast.success("Brand deleted");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="p-6 sm:p-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Brands</p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">Brands & routing</h1>
          <p className="mt-1 text-sm text-[#52525B]">Map stakeholder emails per brand and per complaint type.</p>
        </div>
        {isAdmin && (
          <Button data-testid="add-brand-button" onClick={openNew} className="gap-2">
            <Plus size={16} /> Add brand
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <div key={b.id} data-testid={`brand-card-${b.code}`} className="rounded-md border border-border bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#EEF2FF] text-primary">
                  <Buildings size={18} weight="duotone" />
                </div>
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="font-mono text-xs text-[#A1A1AA]">{b.code}</div>
                </div>
              </div>
              {!b.active && <span className="rounded bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#A1A1AA]">Inactive</span>}
            </div>
            <div className="mt-4 space-y-1 text-sm text-[#52525B]">
              <Row label="Always CC" n={b.catch_all_emails?.length || 0} />
              {TYPES.map((tp) => (
                <Row key={tp} label={tp} n={b.routing?.[tp]?.length || 0} cap />
              ))}
            </div>
            {isAdmin && (
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" data-testid={`edit-brand-${b.code}`} onClick={() => openEdit(b)} className="gap-1">
                  <PencilSimple size={14} /> Edit
                </Button>
                <Button variant="ghost" size="sm" data-testid={`delete-brand-${b.code}`} onClick={() => remove(b)} className="gap-1 text-[#E63946] hover:text-[#E63946]">
                  <Trash size={14} /> Delete
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit brand" : "Add brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-sm">Brand name</Label>
                <Input data-testid="brand-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Voltas" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Code (ticket prefix)</Label>
                <Input data-testid="brand-code-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="VOLT" />
              </div>
            </div>
            <EmailArea label="Always CC (brand stakeholders)" hint="Added to every complaint for this brand" value={form.catch_all} onChange={(v) => setForm({ ...form, catch_all: v })} testid="catch-all-input" />
            <EmailArea label="Installation team" value={form.installation} onChange={(v) => setForm({ ...form, installation: v })} testid="installation-input" />
            <EmailArea label="Repair team" value={form.repair} onChange={(v) => setForm({ ...form, repair: v })} testid="repair-input" />
            <EmailArea label="Service team" value={form.service} onChange={(v) => setForm({ ...form, service: v })} testid="service-input" />
            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm font-medium">Active (shown on dealer form)</span>
              <Switch data-testid="brand-active-switch" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button data-testid="save-brand-button" onClick={save}>Save brand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Row = ({ label, n, cap }) => (
  <div className="flex items-center justify-between">
    <span className={cap ? "capitalize" : ""}>{label}</span>
    <span className="font-mono text-xs">{n} email{n === 1 ? "" : "s"}</span>
  </div>
);

const EmailArea = ({ label, value, onChange, hint, testid }) => (
  <div>
    <Label className="mb-1.5 block text-sm">{label}</Label>
    <Textarea data-testid={testid} value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder="one email per line or comma separated" />
    {hint && <p className="mt-1 text-xs text-[#A1A1AA]">{hint}</p>}
  </div>
);
