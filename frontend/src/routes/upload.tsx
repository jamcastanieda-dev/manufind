import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type DragEvent } from "react";
import { UploadCloud, FileText, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "Upload Manual — MTCE Manual Search" }] }),
  component: UploadPage,
});

function UploadPage() {
  const queryClient = useQueryClient();
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: api.machines });
  const { data: manuals = [] } = useQuery({ queryKey: ["manuals"], queryFn: api.manuals });
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [machineId, setMachineId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!machineId) throw new Error("Select a machine");
      if (files.length === 0) throw new Error("Please add at least one PDF");
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("machine_id", machineId);
        formData.append("title", title.trim() || file.name.replace(/\.pdf$/i, ""));
        formData.append("description", description);
        formData.append("file", file);
        uploaded.push(await api.uploadManual(formData));
      }
      return uploaded;
    },
    onMutate: () => setProgress(35),
    onSuccess: (uploaded) => {
      setProgress(100);
      toast.success(`${uploaded.length} manual${uploaded.length > 1 ? "s" : ""} uploaded`);
      setFiles([]);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["manuals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      window.setTimeout(() => setProgress(0), 800);
    },
    onError: (error: Error) => {
      setProgress(0);
      toast.error(error.message || "Upload failed");
    },
  });

  const addFiles = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      toast.error("Only PDF files are accepted");
      return;
    }
    setFiles((prev) => [...prev, ...pdfs]);
    if (!title && pdfs.length === 1) setTitle(pdfs[0].name.replace(/\.pdf$/i, ""));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader title="Upload Manual" description="Add PDF manuals so technicians can search them instantly. FastAPI stores and indexes the PDF text." />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle>PDF Files</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">Drag and drop PDF files here</p>
                <p className="text-xs text-muted-foreground">or click to browse — multiple files supported</p>
              </div>
              <Input
                type="file"
                multiple
                accept="application/pdf,.pdf"
                onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
                className="max-w-xs"
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-md border bg-card p-3 text-sm">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setFiles(files.filter((_, index) => index !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {progress > 0 && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progress < 100 ? "Uploading and indexing…" : "Upload complete"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
          <CardHeader><CardTitle>Manual Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="machine">Machine</Label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger id="machine"><SelectValue placeholder="Select a machine" /></SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name} — {m.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Manual title</Label>
              <Input id="title" placeholder="e.g. CNC Lathe Maintenance Guide" value={title} onChange={(e) => setTitle(e.target.value)} />
              <p className="text-xs text-muted-foreground">If blank, the file name will be used.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Description / notes</Label>
              <Textarea id="notes" placeholder="Optional notes about this manual…" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              Upload &amp; Index
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle>Recent uploads</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {manuals.slice(0, 4).map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.machineName} · {new Date(m.uploadDate).toLocaleDateString()} · {m.status}</p>
                </div>
                <span className="text-xs text-muted-foreground">{m.pages} pages</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
