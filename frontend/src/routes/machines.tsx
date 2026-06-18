import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Plus, Search, Eye, Pencil, Trash2, X, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type Machine, type MachineStatus } from "@/lib/api";

export const Route = createFileRoute("/machines")({
  head: () => ({ meta: [{ title: "Machines — MTCE Manual Search" }] }),
  component: MachinesPage,
});

const emptyForm = { name: "", model: "", department: "", status: "Running" as MachineStatus };

function MachinesPage() {
  const queryClient = useQueryClient();
  const { data: machines = [], isLoading, isError } = useQuery({ queryKey: ["machines"], queryFn: api.machines });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<MachineStatus | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [form, setForm] = useState(emptyForm);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["machines"] });

  const createMutation = useMutation({
    mutationFn: api.createMachine,
    onSuccess: () => {
      toast.success("Machine saved");
      setForm(emptyForm);
      setShowForm(false);
      invalidate();
    },
    onError: () => toast.error("Could not save machine"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof emptyForm }) => api.updateMachine(id, payload),
    onSuccess: () => {
      toast.success("Machine updated");
      setEditing(null);
      setForm(emptyForm);
      setShowForm(false);
      invalidate();
    },
    onError: () => toast.error("Could not update machine"),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteMachine,
    onSuccess: () => {
      toast.success("Machine deleted");
      invalidate();
    },
    onError: () => toast.error("Delete failed. Remove linked manuals/cases first or try again."),
  });

  const filtered = machines.filter(
    (m) =>
      (status === "all" || m.status === status) &&
      (q === "" ||
        m.name.toLowerCase().includes(q.toLowerCase()) ||
        m.model.toLowerCase().includes(q.toLowerCase()) ||
        m.department.toLowerCase().includes(q.toLowerCase())),
  );

  const startEdit = (machine: Machine) => {
    setEditing(machine);
    setForm({ name: machine.name, model: machine.model, department: machine.department, status: machine.status });
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(false);
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, payload: form });
    else createMutation.mutate(form);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Machines"
        description="Manage equipment, link manuals, and review status. Data is loaded from FastAPI."
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Machine
          </Button>
        }
      />

      {showForm && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-4">
            <form onSubmit={submitForm} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_180px_auto] lg:items-end">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as MachineStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Running">Running</SelectItem>
                    <SelectItem value="Idle">Idle</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" /> {editing ? "Update" : "Save"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelForm}><X className="h-4 w-4" /></Button>
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
              <Input
                placeholder="Search by name, model, or department…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as MachineStatus | "all")}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Idle">Idle</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Manuals</TableHead>
                <TableHead className="text-center">Open Cases</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading machines…</TableCell></TableRow>
              )}
              {isError && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-destructive">Could not connect to FastAPI.</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No machines match your filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.model}</TableCell>
                  <TableCell className="text-muted-foreground">{m.department}</TableCell>
                  <TableCell><StatusBadge kind="machine" value={m.status} /></TableCell>
                  <TableCell className="text-center">{m.manualsCount}</TableCell>
                  <TableCell className="text-center">{m.openCases}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="View"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => startEdit(m)}><Pencil className="h-4 w-4" /></Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        onClick={() => confirm(`Delete ${m.name}?`) && deleteMutation.mutate(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
