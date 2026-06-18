import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Cog,
  BookOpen,
  AlertTriangle,
  Search,
  Database,
  ArrowUpRight,
  TrendingUp,
  Zap,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MTCE Manual Search" },
      { name: "description", content: "Overview of machines, manuals, and open maintenance cases." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });

  const machines = data?.machines ?? [];
  const manuals = data?.manuals ?? [];
  const cases = data?.cases ?? [];
  const searchHistory = data?.searchHistory ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const openCases = cases.filter((c) => c.status !== "Resolved").length;
  const critical = cases.filter((c) => c.priority === "Critical" && c.status !== "Resolved").length;

  const stats = [
    { label: "Machines", value: machines.length, delta: "+", trend: "records", icon: Cog },
    { label: "Manuals", value: manuals.length, delta: "+", trend: "library", icon: BookOpen },
    { label: "Indexed PDFs", value: manuals.filter((m) => m.status === "Indexed").length, delta: "live", trend: "searchable", icon: Database },
    { label: "Open cases", value: openCases, delta: critical > 0 ? `${critical} critical` : "stable", trend: "active", icon: AlertTriangle },
    { label: "Searches", value: searchHistory.length, delta: "saved", trend: "history", icon: Search },
    { label: "API", value: isError ? "Off" : "On", delta: "FastAPI", trend: "SQLite", icon: TrendingUp },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <PageHeader
        eyebrow="Control room · Maintenance"
        title="Good morning, Maintenance Team."
        description="Search any machine manual instantly, monitor equipment status, and resolve concerns before they become downtime."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/cases">
                <AlertTriangle className="mr-2 h-4 w-4" />
                {openCases} open cases
              </Link>
            </Button>
            <Button asChild>
              <Link to="/search">
                <Search className="mr-2 h-4 w-4" /> Search manuals
              </Link>
            </Button>
          </>
        }
      />

      {isLoading && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard from FastAPI…
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[var(--shadow-card)]">
          <CardContent className="p-4 text-sm text-destructive">
            Could not connect to the FastAPI backend. Start it with <code>fastapi dev main.py</code> in the backend folder.
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden border-border bg-ink text-ink-foreground shadow-[var(--shadow-elevated)]">
        <div className="bg-grid absolute inset-0 opacity-30" aria-hidden />
        <div
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
          aria-hidden
        />
        <CardContent className="relative grid gap-6 p-8 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-foreground/60">
              <Zap className="h-3 w-3 text-primary" />
              Quick search
            </div>
            <h2 className="font-display text-2xl font-semibold leading-tight md:text-3xl">
              Find an error code, part, or procedure across{" "}
              <span className="text-primary">{manuals.length} manuals</span>
              <br className="hidden md:block" /> using your FastAPI search endpoint.
            </h2>
            <div className="flex flex-wrap gap-2 pt-1">
              {["E-204", "spindle lubrication", "light curtain", "MOVL command"].map((t) => (
                <Link
                  key={t}
                  to="/search"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-ink-foreground/85 transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 self-center">
            <HeroStat label="Critical" value={critical} accent="destructive" />
            <HeroStat label="In progress" value={cases.filter((c) => c.status === "In Progress").length} accent="warning" />
            <HeroStat label="Running" value={machines.filter((m) => m.status === "Running").length} accent="success" />
            <HeroStat label="Offline" value={machines.filter((m) => m.status === "Offline").length} accent="muted" />
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="group bg-card p-5 transition-colors hover:bg-accent/40">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {s.label}
              </span>
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="mt-3 font-display text-3xl font-semibold tabular text-foreground">{s.value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className="font-mono font-medium text-primary tabular">{s.delta}</span>
              <span className="text-muted-foreground">{s.trend}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <div className="flex items-end justify-between border-b pb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Fleet
                </div>
                <h3 className="mt-1 font-display text-lg font-semibold">Machine status</h3>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link to="/machines">
                  View all <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {machines.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className="group flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-elevated)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{m.model}</span>
                        <span className="opacity-50">·</span>
                        <span className="truncate">{m.department}</span>
                      </div>
                    </div>
                    <StatusBadge kind="machine" value={m.status} />
                  </div>
                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                    <div className="flex gap-3 text-muted-foreground">
                      <span><span className="tabular font-medium text-foreground">{m.manualsCount}</span> manuals</span>
                      <span><span className="tabular font-medium text-foreground">{m.openCases}</span> cases</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Details →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            <div className="border-b pb-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Stream</div>
              <h3 className="mt-1 font-display text-lg font-semibold">Recent activity</h3>
            </div>
            <ol className="relative mt-4 space-y-5 border-l border-dashed border-border pl-5">
              {recentActivity.map((a) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[1.43rem] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-card" />
                  <p className="leading-snug text-foreground">{a.text}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{a.time}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "destructive" | "warning" | "success" | "muted";
}) {
  const accentClass = {
    destructive: "text-destructive",
    warning: "text-[color:var(--warning)]",
    success: "text-[color:var(--success)]",
    muted: "text-ink-foreground/60",
  }[accent];
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-foreground/60">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold tabular ${accentClass}`}>{value}</div>
    </div>
  );
}
