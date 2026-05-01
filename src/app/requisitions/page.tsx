import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import Link from "next/link";

export default async function RequisitionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div style={{ padding: 40 }}>
        <p>Please log in.</p>
        <a href="/api/auth/signin">Sign in</a>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 600 }}>
        Requisitions
      </h1>
      <p style={{ margin: "0 0 24px 0", fontSize: 14, color: "#64748b" }}>
        View and manage requisitions. Open requisitions are listed on the
        dashboard.
      </p>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          padding: 24,
          maxWidth: 640,
        }}
      >
        <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
          <Link
            href="/dashboard"
            style={{ color: "#0369a1", textDecoration: "none" }}
          >
            View open requisitions on the Dashboard →
          </Link>
        </p>
        <p style={{ marginTop: 16, marginBottom: 0 }}>
          <Link
            href="/dashboard"
            style={{ color: "#0369a1", textDecoration: "none", fontSize: 14 }}
          >
            ← Back to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
