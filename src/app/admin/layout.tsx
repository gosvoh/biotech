import { Suspense } from "react";
import AdminClientBoundary from "./admin-client-boundary";
import AdminSkeleton from "./admin-skeleton";

// Authorization lives in each page via `requireAdminPage()`, not here: in the
// App Router a layout and its pages render in parallel, so a layout-only guard
// cannot stop a page from querying the database. The layout only sets up the
// Ant Design runtime (registry, locale, message/notification context) and the
// admin navigation shell (chrome only — no auth).
//
// The antd subtree is rendered client-only inside `AdminClientBoundary` to avoid
// an unstyled flash (see that file). The Suspense boundary covers the dynamic,
// request-time data the pages read (auth/db) under `cacheComponents`; its
// fallback is the same skeleton the boundary shows before mount, so the loading
// state is seamless.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminClientBoundary>{children}</AdminClientBoundary>
    </Suspense>
  );
}
