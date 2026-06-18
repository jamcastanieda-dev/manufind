import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/manuals")({
  component: ManualsLayout,
});

function ManualsLayout() {
  return <Outlet />;
}
