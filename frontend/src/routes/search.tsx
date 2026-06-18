import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, FileText, ExternalLink, Copy, ChevronRight, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type SearchResult } from "@/lib/api";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search Manuals — MTCE Manual Search" }] }),
  component: SearchPage,
});

const recentChips = ["E-204", "spindle lubrication", "light curtain", "MOVL command", "chiller flow"];

function highlight(text: string, keyword: string) {
  if (!keyword) return text;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="rounded bg-[color:var(--warning)]/40 px-0.5 text-foreground">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function SearchPage() {
  const queryClient = useQueryClient();
  const { data: machines = [] } = useQuery({ queryKey: ["machines"], queryFn: api.machines });
  const { data: manuals = [] } = useQuery({ queryKey: ["manuals"], queryFn: api.manuals });
  const [query, setQuery] = useState("");
  const [machine, setMachine] = useState("all");
  const [manual, setManual] = useState("all");
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);

  const filteredManuals = useMemo(
    () => manuals.filter((m) => machine === "all" || String(m.machineId) === machine),
    [manuals, machine],
  );

  const runSearch = async (q?: string) => {
    const term = q ?? query;
    if (q !== undefined) setQuery(q);
    if (!term.trim()) {
      toast.error("Enter a search term");
      return;
    }
    try {
      setLoading(true);
      setExecuted(false);
      const response = await api.searchManuals({ q: term, machineId: machine, manualId: manual });
      setResults(response.results);
      setSelected(response.results[0] ?? null);
      setExecuted(true);
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader title="Search Manuals" description="Find error codes, parts, alarms, or procedures across every indexed manual." />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Search error code, part name, alarm, procedure…"
                  className="h-12 pl-11 text-base"
                />
              </div>
              <Select value={machine} onValueChange={(value) => { setMachine(value); setManual("all"); }}>
                <SelectTrigger className="h-12 w-full lg:w-52"><SelectValue placeholder="Machine" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All machines</SelectItem>
                  {machines.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={manual} onValueChange={setManual}>
                <SelectTrigger className="h-12 w-full lg:w-52"><SelectValue placeholder="Manual" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All manuals</SelectItem>
                  {filteredManuals.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="lg" className="h-12 px-6" onClick={() => runSearch()} disabled={loading}>Search</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Recent:</span>
              {recentChips.map((c) => (
                <button
                  key={c}
                  onClick={() => runSearch(c)}
                  className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >{c}</button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 flex flex-col gap-4">
          {loading && (
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching manuals with FastAPI…
            </CardContent></Card>
          )}

          {!loading && executed && (
            <div className="text-sm text-muted-foreground">{results.length} results for “{query}”</div>
          )}

          {!loading && !executed && (
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Start searching</p>
              <p className="text-xs text-muted-foreground">Type a term above or pick a recent search. Try “E-204”.</p>
            </CardContent></Card>
          )}

          {!loading && executed && results.length === 0 && (
            <Card className="shadow-[var(--shadow-card)]"><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No matches found. Try a different keyword or remove filters.
            </CardContent></Card>
          )}

          {!loading && results.map((r) => (
            <Card
              key={r.id}
              onClick={() => setSelected(r)}
              className={`cursor-pointer shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-elevated)] ${selected?.id === r.id ? "ring-2 ring-primary/40" : ""}`}
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> {r.manualTitle}
                    </div>
                    <h3 className="mt-1 font-semibold">{r.machineName} <span className="text-muted-foreground font-normal">· {r.model}</span></h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline">Page {r.page}</Badge>
                    <span className="text-xs text-muted-foreground">{Math.round(r.confidence * 100)}% match</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-foreground/90">{highlight(r.snippet, r.keyword)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href={api.manualFileUrl(r.manualId)} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open Manual</a>
                  </Button>
                  <Button size="sm" variant="outline">View Page {r.page}</Button>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(r.snippet); toast.success("Snippet copied"); }}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="lg:col-span-2">
          <Card className="sticky top-20 shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
            <CardContent>
              {selected ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold leading-tight">{selected.manualTitle}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">{selected.machineName} · {selected.model} · Page {selected.page}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
                    {highlight(selected.snippet, selected.keyword)}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Related pages</p>
                    <ul className="space-y-1.5 text-sm">
                      {[selected.page - 1, selected.page + 1, selected.page + 5].filter((p) => p > 0).map((p) => (
                        <li key={p}>
                          <button className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-muted">
                            <span>Page {p}</span>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button className="w-full" asChild><a href={api.manualFileUrl(selected.manualId)} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open PDF Viewer</a></Button>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">Select a result to preview.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
