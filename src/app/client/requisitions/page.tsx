import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getClientForSession } from "../resolve-client";

export default async function ClientRequisitionsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>You are not logged in</h1>
        <a href="/api/auth/signin">Go to Sign In</a>
      </div>
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "CLIENT") {
    return (
      <div style={{ padding: 40 }}>
        <h1>Access denied</h1>
        <p>This page is for client users only.</p>
      </div>
    );
  }

  const { client, usedDemoFallback } = await getClientForSession(session);
  const userEmail = session.user?.email ?? null;

  if (!client) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Roles</h1>
        <p style={{ marginBottom: 8 }}>
          No client record found for this login yet.
        </p>
        {userEmail && (
          <p style={{ fontSize: 13, color: "#64748b" }}>
            Tried with email: {userEmail}
          </p>
        )}
      </div>
    );
  }

  const requisitions = client.requisitions;

  return (
    <div style={{ padding: 40 }}>
      {usedDemoFallback && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 16px",
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Demo mode: using first client record because this login isn’t linked yet.
        </div>
      )}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#111827" }}>
          Your roles
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
          {client.name} · {requisitions.length} role{requisitions.length !== 1 ? "s" : ""}
        </p>
      </header>

      {requisitions.length === 0 ? (
        <div
          style={{
            padding: 32,
            border: "1px dashed #e2e8f0",
            borderRadius: 10,
            textAlign: "center",
            color: "#64748b",
            fontSize: 14,
          }}
        >
          No roles yet. New roles will appear here when they’re set up.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {requisitions.map((req) => {
            const liveCount = req.submissions.length;
            const readyCount = req.submissions.filter(
              (s) =>
                s.status === "SUBMITTED" || s.status === "UNDER_REVIEW"
            ).length;
            const interviewingCount = req.submissions.filter(
              (s) =>
                s.status === "INTERVIEW_REQUESTED" ||
                s.status === "OFFER_PENDING"
            ).length;
            return (
              <Link
                key={req.id}
                href={`/client/requisitions/${req.id}`}
                style={{
                  display: "block",
                  padding: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  background: "#fff",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#111827" }}>
                  {req.title}
                </h3>
                {req.location && (
                  <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
                    {req.location}
                  </p>
                )}
                <div style={{ fontSize: 13, color: "#475569" }}>
                  <span>{liveCount} candidate{liveCount !== 1 ? "s" : ""} shared</span>
                  {readyCount > 0 && (
                    <span style={{ marginLeft: 12 }}> · {readyCount} awaiting review</span>
                  )}
                  {interviewingCount > 0 && (
                    <span style={{ marginLeft: 12 }}> · {interviewingCount} in progress</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
