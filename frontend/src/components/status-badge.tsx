import { cn } from "@/lib/utils";
import type { MachineStatus, CasePriority, CaseStatus, ManualIndexStatus } from "@/lib/api";

const machineMap: Record<MachineStatus, string> = {
  Running: "bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20",
  Idle: "bg-muted text-muted-foreground border-border",
  Maintenance: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30",
  Offline: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityMap: Record<CasePriority, string> = {
  Low: "bg-muted text-muted-foreground border-border",
  Medium: "bg-[color:var(--info)]/10 text-[color:var(--info)] border-[color:var(--info)]/20",
  High: "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30",
  Critical: "bg-destructive/10 text-destructive border-destructive/20",
};

const caseMap: Record<CaseStatus, string> = {
  Open: "bg-[color:var(--info)]/10 text-[color:var(--info)] border-[color:var(--info)]/20",
  "In Progress": "bg-[color:var(--warning)]/15 text-[color:var(--warning-foreground)] border-[color:var(--warning)]/30",
  Resolved: "bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20",
};

const manualMap: Record<ManualIndexStatus, string> = {
  Indexed: "bg-[color:var(--success)]/10 text-[color:var(--success)] border-[color:var(--success)]/20",
  Processing: "bg-[color:var(--info)]/10 text-[color:var(--info)] border-[color:var(--info)]/20",
  Failed: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({
  kind,
  value,
}: {
  kind: "machine" | "priority" | "case" | "manual";
  value: string;
}) {
  const map =
    kind === "machine" ? machineMap : kind === "priority" ? priorityMap : kind === "case" ? caseMap : manualMap;
  const cls = (map as Record<string, string>)[value] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {value}
    </span>
  );
}
