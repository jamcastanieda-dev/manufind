import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Cog,
  BookOpen,
  Search,
  UploadCloud,
  AlertTriangle,
  History,
  Settings as SettingsIcon,
  Wrench,
  Activity,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const workspaceNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Search Manuals", url: "/search", icon: Search },
  { title: "Machines", url: "/machines", icon: Cog },
  { title: "Manuals", url: "/manuals", icon: BookOpen },
];

const opsNav = [
  { title: "Upload Manual", url: "/upload", icon: UploadCloud },
  { title: "Cases / Concerns", url: "/cases", icon: AlertTriangle },
  { title: "Search History", url: "/history", icon: History },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => (url === "/" ? pathname === "/" : pathname.startsWith(url));

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Wrench className="h-4.5 w-4.5" strokeWidth={2.25} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[color:var(--success)] ring-2 ring-sidebar" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
              MTCE Manual
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/60">
              v1.0 · live
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceNav.map((item) => (
                <NavItem key={item.url} item={item} active={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/50">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {opsNav.map((item) => (
                <NavItem key={item.url} item={item} active={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/40 p-2.5 text-xs group-data-[collapsible=icon]:hidden">
          <Activity className="h-3.5 w-3.5 text-[color:var(--success)]" />
          <div className="flex-1">
            <p className="font-medium text-sidebar-accent-foreground">All systems normal</p>
            <p className="font-mono text-[10px] text-sidebar-foreground/60">API · 38ms · uptime 99.98%</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { title: string; url: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:font-medium hover:bg-sidebar-accent/60"
      >
        <Link to={item.url} className="flex items-center gap-2.5">
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
          {active && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary group-data-[collapsible=icon]:hidden" />
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
