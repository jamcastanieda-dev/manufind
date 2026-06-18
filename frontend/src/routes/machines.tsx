import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Pencil, Trash2, X, Loader2, Save, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const imagePreviewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : editing?.imagePath ? api.machineImageUrl(editing.id) : ""), [editing, imageFile]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["machines"] });

  const createMutation = useMutation({
    mutationFn: (formData: FormData) => api.createMachineForm(formData),
    onSuccess: () => {
      toast.success("Machine saved");
      setForm(emptyForm);
      setImageFile(null);
      setShowForm(false);
      invalidate();
    },
    onError: () => toast.error("Could not save machine"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, formData }: { id: number; formData: FormData }) => api.updateMachineForm(id, formData),
    onSuccess: () => {
      toast.success("Machine updated");
      setEditing(null);
      setForm(emptyForm);
      setImageFile(null);
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
    setImageFile(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setShowForm(false);
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("model", form.model);
    formData.append("department", form.department);
    formData.append("status", form.status);
    if (imageFile) formData.append("image", imageFile);

    if (editing) updateMutation.mutate({ id: editing.id, formData });
    else createMutation.mutate(formData);
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
            <form onSubmit={submitForm} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_180px]">
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
              <div className="space-y-2 lg:col-span-2">
                <Label>Machine image</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                {imagePreviewUrl && (
                  <div className="overflow-hidden rounded-lg border bg-muted/20">
                    <img src={imagePreviewUrl} alt={form.name || "Machine preview"} className="h-40 w-full object-cover" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 lg:col-span-4">
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

      {isLoading && (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading machines…</CardContent></Card>
      )}
      {isError && (
        <Card><CardContent className="p-12 text-center text-sm text-destructive">Could not connect to FastAPI.</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && filtered.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center text-sm text-muted-foreground">No machines match your filters.</CardContent></Card>
        )}
        {filtered.map((m) => (
          <Card key={m.id} className="overflow-hidden shadow-[var(--shadow-card)]">
            <div className="aspect-[16/9] bg-muted/30">
              {m.imagePath ? (
                <img src={api.machineImageUrl(m.id)} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold leading-tight">{m.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{m.model} · {m.department}</p>
                </div>
                <StatusBadge kind="machine" value={m.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Manuals</div>
                  <div className="mt-1 font-semibold">{m.manualsCount}</div>
                </div>
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">Open Cases</div>
                  <div className="mt-1 font-semibold">{m.openCases}</div>
                </div>
              </div>
              <div className="flex justify-end gap-1">
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
