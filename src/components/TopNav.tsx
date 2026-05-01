"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/requisitions", label: "Requisitions" },
  { href: "/consultants", label: "Consultants" },
  { href: "/productivity", label: "Productivity" },
] as const;

export default function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 24px",
        borderBottom: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/" || pathname === "/dashboard"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#0369a1" : "#475569",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {status === "authenticated" && session?.user?.email && (
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Logged in as: {session.user.email}
          </span>
        )}
        <Link
          href="/api/auth/signout"
          style={{
            fontSize: 13,
            color: "#64748b",
            textDecoration: "none",
            padding: "6px 12px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            background: "#fff",
          }}
        >
          Sign out
        </Link>
      </div>
    </nav>
  );
}
