import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, FileText, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

export const Route = createFileRoute("/manuals")({
  head: () => ({ meta: [{ title: "Manuals — MTCE Manual Search" }] }),
  component: ManualsPage,
});

function ManualsPage() {
  const queryClient = useQueryClient();
  const { data: manuals = [], isLoading, isError } = useQuery({ queryKey: ["manuals"], queryFn: api.manuals });
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: api.machines });
  const [q, setQ] = useState("");
  const [machine, setMachine] = useState("all");
  const [status, setStatus] = useState("all");

  const deleteMutation = useMutation({
    mutationFn: api.deleteManual,
    onSuccess: () => {
      toast.success("Manual deleted");
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete manual"),
  });

  const filtered = manuals.filter(
    (m) =>
      (machine === "all" || String(m.machineId) === machine) &&
      (status === "all" || m.status === status) &&
      (q === "" || m.title.toLowerCase().includes(q.toLowerCase()) || m.machineName.toLowerCase().includes(q.toLowerCase()) || m.fileName.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Manuals"
        description="Your searchable library of indexed equipment documentation. Uploads are saved by FastAPI."
        actions={
          <Button asChild>
            <Link to="/upload">
              <Plus className="mr-2 h-4 w-4" /> Upload Manual
            </Link>
          </Button>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search manuals, machines, or file names…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={machine} onValueChange={setMachine}>
              <SelectTrigger className="w-full lg:w-56"><SelectValue placeholder="Machine" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All machines</SelectItem>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full lg:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Indexed">Indexed</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card><CardContent className="p-12 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading manuals…</CardContent></Card>
      )}
      {isError && (
        <Card><CardContent className="p-12 text-center text-sm text-destructive">Could not connect to FastAPI.</CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && filtered.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-12 text-center text-sm text-muted-foreground">No manuals found.</CardContent></Card>
        )}
        {filtered.map((m) => (
          <Card key={m.id} className="shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <StatusBadge kind="manual" value={m.status} />
              </div>
              <div>
                <h3 className="font-semibold leading-tight">{m.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{m.machineName} · {m.model}</p>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="truncate">File: {m.fileName}</div>
                <div>Uploaded {new Date(m.uploadDate).toLocaleDateString()} · {m.pages} pages</div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" asChild>
                  <Link to="/search"><Search className="mr-2 h-4 w-4" />Search</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={api.manualViewerUrl(m.id)} title="Open manual">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => confirm(`Delete ${m.title}?`) && deleteMutation.mutate(m.id)}
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
