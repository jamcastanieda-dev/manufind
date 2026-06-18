import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, RotateCw, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Search History — MTCE Manual Search" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const queryClient = useQueryClient();
  const { data: searchHistory = [], isLoading, isError } = useQuery({ queryKey: ["search-history"], queryFn: api.searchHistory });
  const clearMutation = useMutation({
    mutationFn: api.clearSearchHistory,
    onSuccess: () => {
      toast.success("Search history cleared");
      queryClient.invalidateQueries({ queryKey: ["search-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not clear search history"),
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Search History"
        description="Review and repeat previous searches saved by the FastAPI backend."
        actions={<Button variant="outline" onClick={() => confirm("Clear all search history?") && clearMutation.mutate()}><Trash2 className="mr-2 h-4 w-4" />Clear History</Button>}
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          {isLoading && <div className="py-12 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading history…</div>}
          {isError && <div className="py-12 text-center text-sm text-destructive">Could not connect to FastAPI.</div>}
          {!isLoading && searchHistory.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No searches yet. Run a manual search first.</div>}
          <ul className="divide-y">
            {searchHistory.map((h) => (
              <li key={h.id} className="flex items-center gap-4 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <HistoryIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{h.keyword}</p>
                  <p className="text-xs text-muted-foreground">{h.scope} · {new Date(h.date).toLocaleString()} · {h.resultsCount} results</p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/search"><RotateCw className="mr-1.5 h-3.5 w-3.5" />Repeat</Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
