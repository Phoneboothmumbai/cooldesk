import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash, ShieldCheck } from "@phosphor-icons/react";

export default function Agents() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [agents, setAgents] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent" });

  const load = () => api.get("/agents").then(({ data }) => setAgents(data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/agents", form);
      toast.success("Agent added");
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "agent" });
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Remove ${a.name}?`)) return;
    try {
      await api.delete(`/agents/${a.id}`);
      toast.success("Agent removed");
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  return (
    <div className="p-6 sm:p-10">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Team</p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold tracking-tight">Agents & admins</h1>
        </div>
        {isAdmin && (
          <Button data-testid="add-agent-button" onClick={() => setOpen(true)} className="gap-2">
            <Plus size={16} /> Add agent
          </Button>
        )}
      </header>

      <div className="overflow-hidden rounded-md border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-[#FAFAFA] text-xs uppercase tracking-wider text-[#A1A1AA]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.map((a) => (
              <tr key={a.id} data-testid={`agent-row-${a.email}`}>
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-[#52525B]">{a.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-[#FAFAFA] px-2 py-0.5 text-xs font-semibold capitalize">
                    {a.role === "admin" && <ShieldCheck size={12} className="text-primary" />}
                    {a.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <button data-testid={`delete-agent-${a.email}`} onClick={() => remove(a)} className="text-[#A1A1AA] transition-colors duration-200 hover:text-[#E63946]">
                      <Trash size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add agent</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Name</Label>
              <Input data-testid="agent-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Email</Label>
              <Input data-testid="agent-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Temporary password</Label>
              <Input data-testid="agent-password-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="agent-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button data-testid="save-agent-button" onClick={save}>Add agent</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
