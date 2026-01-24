import DashboardLayout from "~/components/layout/LayoutCore";
import { Outlet } from "react-router";

export default function AppLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
