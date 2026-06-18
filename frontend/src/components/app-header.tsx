import { useQuery } from "@tanstack/react-query";
import { Bell, Search, Command } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";

export function AppHeader() {
  const { data, isError } = useQuery({ queryKey: ["health"], queryFn: api.health, retry: 1, refetchInterval: 30000 });
  const live = !isError && data?.status === "Connected";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:px-8">
      <SidebarTrigger className="-ml-1" />
      <div className="hidden h-6 w-px bg-border sm:block" />
      <div className="relative ml-auto w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search machines, manuals, cases…"
          className="h-9 border-border bg-card pl-9 pr-14 focus-visible:ring-1"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <Command className="h-2.5 w-2.5" />K
        </kbd>
      </div>
      <div className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 md:inline-flex ${live ? "border-[color:var(--success)]/25 bg-[color:var(--success)]/10" : "border-destructive/25 bg-destructive/10"}`}>
        <span className="relative flex h-1.5 w-1.5">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-60" />}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${live ? "bg-[color:var(--success)]" : "bg-destructive"}`} />
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.15em] ${live ? "text-[color:var(--success)]" : "text-destructive"}`}>
          {live ? "API live" : "API off"}
        </span>
      </div>
      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
        <Bell className="h-4.5 w-4.5" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-1.5">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-ink text-ink-foreground text-[11px] font-semibold">MH</AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight md:block">
              <div className="text-xs font-medium">M. Hassan</div>
              <div className="font-mono text-[10px] text-muted-foreground">Technician</div>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
