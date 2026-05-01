"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

/**
 * Renders the agency TopNav only when the current route is not under /client.
 * Client routes use their own layout (ClientTopNav) and must not see agency nav.
 */
export default function AppNavWrapper() {
  const pathname = usePathname();
  if (pathname === "/client" || pathname?.startsWith("/client/")) {
    return null;
  }
  return <TopNav />;
}
