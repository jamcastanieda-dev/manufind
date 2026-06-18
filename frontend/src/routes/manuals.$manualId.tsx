import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, FileWarning, Loader2, Search } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Manual, type ManualHighlightBox } from "@/lib/api";

type TextSegment = {
  type: "text" | "highlight";
  value: string;
};

type ViewerTextItem = {
  id: string;
  left: number;
  top: number;
  fontSize: number;
  angle: number;
  segments: TextSegment[];
};

const searchSchema = z.object({
  page: z.coerce.number().int().positive().optional().catch(1),
  q: z.string().optional().catch(""),
});

export const Route = createFileRoute("/manuals/$manualId")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Manual Viewer — MTCE Manual Search" }] }),
  component: ManualViewerPage,
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSegments(text: string, query: string): TextSegment[] {
  if (!query.trim()) return [{ type: "text", value: text }];

  const matcher = new RegExp(`(${escapeRegExp(query)})`, "gi");
  const parts = text.split(matcher).filter(Boolean);

  if (parts.length === 0) return [{ type: "text", value: text }];

  return parts.map((part) => ({
    type: part.toLowerCase() === query.toLowerCase() ? "highlight" : "text",
    value: part,
  }));
}

function hasHighlight(segments: TextSegment[]) {
  return segments.some((segment) => segment.type === "highlight");
}

function ManualViewerPage() {
  const navigate = useNavigate({ from: "/manuals/$manualId" });
  const { manualId } = Route.useParams();
  const search = Route.useSearch();
  const page = search.page ?? 1;
  const query = search.q ?? "";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [queryInput, setQueryInput] = useState(query);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  const [viewerText, setViewerText] = useState<ViewerTextItem[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);
  const [viewerError, setViewerError] = useState("");

  const { data: manual, isLoading, isError } = useQuery({
    queryKey: ["manual", manualId],
    queryFn: () => api.manual(Number(manualId)),
  });
  const { data: highlightData } = useQuery({
    queryKey: ["manual-highlights", manualId, page, query],
    queryFn: () => api.manualHighlights(Number(manualId), page, query),
    enabled: Boolean(manual?.filePath && query.trim()),
  });

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    let disposed = false;

    async function loadPdf(currentManual: Manual) {
      if (!currentManual.filePath) {
        setPdfDoc(null);
        setPageCount(0);
        setViewerText([]);
        setViewerError("");
        return;
      }

      try {
        setLoadingPdf(true);
        setViewerError("");

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const loadingTask = pdfjs.getDocument({
          url: api.manualFileUrl(currentManual.id),
          withCredentials: false,
        });

        const document = await loadingTask.promise;
        if (disposed) {
          await document.destroy();
          return;
        }

        setPdfDoc(document);
        setPageCount(document.numPages);
      } catch (error) {
        if (!disposed) {
          setPdfDoc(null);
          setPageCount(0);
          setViewerText([]);
          setViewerError(error instanceof Error ? error.message : "Could not load the manual PDF.");
        }
      } finally {
        if (!disposed) setLoadingPdf(false);
      }
    }

    if (manual) {
      loadPdf(manual);
    }

    return () => {
      disposed = true;
    };
  }, [manual]);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current || page < 1 || page > pageCount) return;

      try {
        setRenderingPage(true);
        setViewerError("");

        const pdfjs = await import("pdfjs-dist");
        const pdfPage = await pdfDoc.getPage(page);
        const viewport = pdfPage.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas rendering is not available in this browser.");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pdfPage.render({ canvasContext: context, viewport }).promise;
        const textContent = await pdfPage.getTextContent();
        const textItems = textContent.items
          .filter((item: any) => typeof item.str === "string" && item.str.trim().length > 0)
          .map((item: any, index: number) => {
            const tx = pdfjs.Util.transform(viewport.transform, item.transform);
            const fontSize = Math.hypot(tx[2], tx[3]);
            const angle = Math.atan2(tx[1], tx[0]);
            const left = tx[4];
            const top = tx[5] - fontSize;

            return {
              id: `${page}-${index}`,
              left,
              top,
              fontSize,
              angle,
              segments: buildSegments(item.str, query),
            };
          });

        if (!cancelled) {
          setViewerText(textItems);
        }
      } catch (error) {
        if (!cancelled) {
          setViewerText([]);
          setViewerError(error instanceof Error ? error.message : "Could not render this page.");
        }
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [page, pageCount, pdfDoc, query]);

  const goToPage = (nextPage: number) => {
    if (!pageCount) return;
    const safePage = Math.min(Math.max(nextPage, 1), pageCount);
    navigate({
      search: (prev) => ({
        ...prev,
        page: safePage,
        q: query || undefined,
      }),
      replace: safePage === page,
    });
  };

  const submitSearch = () => {
    navigate({
      search: (prev) => ({
        ...prev,
        page: 1,
        q: queryInput.trim() || undefined,
      }),
    });
  };

  const missingPdf = manual && !manual.filePath;
  const highlightBoxes: ManualHighlightBox[] = highlightData?.boxes ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title={manual?.title ?? "Manual Viewer"}
        description={manual ? `${manual.machineName} · ${manual.model}` : "Open a manual inside ManuFind and jump to the exact page."}
        actions={
          <Button variant="outline" asChild>
            <Link to="/manuals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Manuals
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base">Navigate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Search Highlight</div>
                <div className="flex gap-2">
                  <Input
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && submitSearch()}
                    placeholder="Find a word on the page"
                  />
                  <Button size="icon" onClick={submitSearch}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Search links from results open here with the page and highlighted term already selected.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Page</div>
                  <Badge variant="outline">
                    {pageCount ? `Page ${Math.min(page, pageCount)} of ${pageCount}` : "No pages"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => goToPage(page - 1)} disabled={page <= 1 || !pageCount}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => goToPage(page + 1)} disabled={!pageCount || page >= pageCount}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {query && (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950">
                  Highlighting matches for <span className="font-semibold">“{query}”</span>.
                </div>
              )}

              {manual && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>File: {manual.fileName}</div>
                  <div>Uploaded {new Date(manual.uploadDate).toLocaleDateString()}</div>
                  <div>Status: {manual.status}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>

        <section>
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-4 sm:p-6">
              {isLoading && (
                <div className="flex min-h-[520px] items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading manual details…
                </div>
              )}

              {!isLoading && isError && (
                <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 text-center">
                  <FileWarning className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="font-medium">Could not load this manual.</p>
                    <p className="text-sm text-muted-foreground">The selected manual was not found in the backend.</p>
                  </div>
                </div>
              )}

              {!isLoading && manual && missingPdf && (
                <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 text-center">
                  <FileWarning className="h-10 w-10 text-amber-500" />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">This demo manual has no uploaded PDF file.</p>
                    <p className="max-w-xl text-sm text-muted-foreground">
                      The seeded record is searchable, but the original document is not stored on the backend. Upload a real PDF from the
                      upload page to view it here with page navigation and highlights.
                    </p>
                  </div>
                  <Button asChild>
                    <Link to="/upload">Upload a Real Manual</Link>
                  </Button>
                </div>
              )}

              {!isLoading && manual && !missingPdf && (
                <div className="space-y-4">
                  {(loadingPdf || renderingPage) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {loadingPdf ? "Loading PDF…" : `Rendering page ${page}…`}
                    </div>
                  )}

                  {viewerError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {viewerError}
                    </div>
                  )}

                  <div className="overflow-auto rounded-2xl border bg-muted/20 p-3">
                    <div className="relative mx-auto w-fit">
                      <canvas ref={canvasRef} className="max-w-full rounded-lg bg-white shadow-sm" />
                      {highlightBoxes.length > 0 && (
                        <div className="pointer-events-none absolute inset-0 z-10">
                          {highlightBoxes.map((box, index) => (
                            <div
                              key={`${box.text}-${index}`}
                              className="absolute rounded bg-yellow-300/60 ring-1 ring-yellow-500/70"
                              style={{
                                left: `${box.leftRatio * 100}%`,
                                top: `${box.topRatio * 100}%`,
                                width: `${box.widthRatio * 100}%`,
                                height: `${box.heightRatio * 100}%`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {viewerText.length > 0 && (
                        <div className="pointer-events-none absolute inset-0 z-20">
                          {viewerText.map((item) => (
                            <span
                              key={item.id}
                              className={hasHighlight(item.segments) ? "absolute whitespace-pre" : "absolute whitespace-pre text-transparent"}
                              style={{
                                left: item.left,
                                top: item.top,
                                fontSize: item.fontSize,
                                transform: `rotate(${item.angle}rad)`,
                                transformOrigin: "left top",
                                lineHeight: 1,
                              }}
                            >
                              {item.segments.map((segment, index) =>
                                segment.type === "highlight" ? (
                                  <mark key={`${item.id}-${index}`} className="rounded bg-yellow-300/80 px-0.5 text-black">
                                    {segment.value}
                                  </mark>
                                ) : (
                                  <span key={`${item.id}-${index}`}>{segment.value}</span>
                                ),
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
