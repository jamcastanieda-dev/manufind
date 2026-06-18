import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MTCE Manual Search" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title="Settings" description="Manage your profile and preferences." />

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Personal account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">MH</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">M. Hassan</p>
              <Badge variant="outline" className="mt-1">Technician</Badge>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Name</Label><Input defaultValue="M. Hassan" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" defaultValue="m.hassan@mtce.local" /></div>
            <div className="space-y-2"><Label>Role</Label><Input defaultValue="Technician" disabled /></div>
            <div className="space-y-2"><Label>Department</Label><Input defaultValue="Machining Bay 1" /></div>
          </div>
          <Button>Save changes</Button>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>App preferences</CardTitle>
          <CardDescription>Tune the experience to your workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrefRow label="Compact tables" hint="Show more rows per screen." />
          <PrefRow label="Show confidence scores" hint="Display match % on search results." defaultChecked />
          <PrefRow label="Auto-open preview" hint="Open preview panel on first result." defaultChecked />
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Choose what you want to hear about.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PrefRow label="New cases assigned to me" defaultChecked />
          <PrefRow label="Manual indexing completed" defaultChecked />
          <PrefRow label="Weekly maintenance summary" />
        </CardContent>
      </Card>
    </div>
  );
}

function PrefRow({ label, hint, defaultChecked }: { label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-card p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
