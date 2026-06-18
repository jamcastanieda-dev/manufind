import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Search, Eye, Trash2, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type CasePriority, type CaseStatus } from "@/lib/api";

export const Route = createFileRoute("/cases")({
  head: () => ({ meta: [{ title: "Cases — MTCE Manual Search" }] }),
  component: CasesPage,
});

const emptyCase = {
  title: "",
  machine_id: 0,
  priority: "Medium" as CasePriority,
  status: "Open" as CaseStatus,
  created_by: "Technician",
  description: "",
};

function CasesPage() {
  const queryClient = useQueryClient();
  const { data: cases = [], isLoading, isError } = useQuery({ queryKey: ["cases"], queryFn: api.cases });
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: api.machines });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyCase);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cases"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const createMutation = useMutation({
    mutationFn: api.createCase,
    onSuccess: () => {
      toast.success("Case created");
      setShowForm(false);
      setForm(emptyCase);
      invalidate();
    },
    onError: () => toast.error("Could not create case"),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: CaseStatus }) => api.updateCase(id, { status }),
    onSuccess: () => {
      toast.success("Case status updated");
      invalidate();
    },
    onError: () => toast.error("Could not update case"),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteCase,
    onSuccess: () => {
      toast.success("Case deleted");
      invalidate();
    },
    onError: () => toast.error("Could not delete case"),
  });

  const filtered = cases.filter(
    (c) =>
      (status === "all" || c.status === status) &&
      (q === "" || c.title.toLowerCase().includes(q.toLowerCase()) || c.machineName.toLowerCase().includes(q.toLowerCase())),
  );

  const submitCase = (event: FormEvent) => {
    event.preventDefault();
    if (!form.machine_id) {
      toast.error("Select a machine");
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Cases / Concerns"
        description="Track and resolve maintenance issues reported by your team. Cases are saved in SQLite."
        actions={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Add Case</Button>}
      />

      {showForm && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <form onSubmit={submitCase} className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2"><Label>Case title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Machine</Label>
                <Select value={form.machine_id ? String(form.machine_id) : ""} onValueChange={(v) => setForm({ ...form, machine_id: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                  <SelectContent>{machines.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as CasePriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Created by</Label><Input value={form.created_by} onChange={(e) => setForm({ ...form, created_by: e.target.value })} /></div>
              <div className="space-y-2 lg:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
              <div className="flex gap-2 lg:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}><Save className="mr-2 h-4 w-4" />Save Case</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search cases…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading && <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading cases…</CardContent></Card>}
      {isError && <Card><CardContent className="py-12 text-center text-sm text-destructive">Could not connect to FastAPI.</CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((c) => (
          <Card key={c.id} className="shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold leading-tight">{c.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{c.machineName} · opened {new Date(c.createdAt).toLocaleDateString()} by {c.createdBy}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge kind="priority" value={c.priority} />
                  <StatusBadge kind="case" value={c.status} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline"><Eye className="mr-1.5 h-3.5 w-3.5" />View</Button>
                <Select value={c.status} onValueChange={(value) => updateStatusMutation.mutate({ id: c.id, status: value as CaseStatus })}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => confirm(`Delete ${c.title}?`) && deleteMutation.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
