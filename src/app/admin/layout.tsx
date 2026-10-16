import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentAdminAccess } from "@/lib/admin-access.server";
import AdminClientBoundary from "./admin-client-boundary";
import AdminSkeleton from "./admin-skeleton";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Chrome receives safe request-time data; every protected page guards its own
// reads because layouts and pages can execute in parallel in the App Router.
async function AdminChrome({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAdminAccess();
  return <AdminClientBoundary initialAccess={access}>{children}</AdminClientBoundary>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminChrome>{children}</AdminChrome>
    </Suspense>
  );
}
