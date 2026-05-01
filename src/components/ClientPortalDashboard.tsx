import Link from "next/link";

type RoleCard = {
  id: string;
  title: string;
  readyCount: number;
  interviewingCount: number;
  awaitingDecisionCount: number;
  lastActivityText: string | null;
};

type ReviewItem = {
  submissionId: string;
  requisitionId: string;
  roleTitle: string;
  candidateName: string;
  submittedAtText: string;
  matchText: string | null;
};

type Snapshot = {
  activeRoles: number;
  candidatesReviewed: number;
  interviewsActive: number;
  offersPending: number;
};

type ActivityItem = {
  id: string;
  timestampText: string;
  description: string;
};

type PriorityAction = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

export default function ClientPortalDashboard({
  clientName,
  priority,
  roleCards,
  reviewQueue,
  snapshot,
  activity,
}: {
  clientName: string;
  priority: PriorityAction;
  roleCards: RoleCard[];
  reviewQueue: ReviewItem[];
  snapshot: Snapshot;
  activity: ActivityItem[];
}) {
  return (
    <div style={{ padding: 40 }}>
      {/* Header */}
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#111827" }}>
          Client Dashboard
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
          {clientName} · Hiring overview
        </p>
      </header>

      {/* 1) Priority Action Banner */}
      <section
        style={{
          marginBottom: 24,
          padding: "14px 16px",
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
            Welcome back
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
            {priority.title}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{priority.description}</p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Link
            href={priority.ctaHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #0f766e",
              background: "#0f766e",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {priority.ctaLabel}
          </Link>
        </div>
      </section>

      {/* 2) Your Open Roles */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
            Your Open Roles
          </h2>
          {roleCards.length > 6 && (
            <Link
              href="/requisitions"
              style={{ fontSize: 12, color: "#0369a1", textDecoration: "none" }}
            >
              View all roles →
            </Link>
          )}
        </div>
        {roleCards.length === 0 ? (
          <div
            style={{
              borderRadius: 8,
              border: "1px dashed #e5e7eb",
              padding: 16,
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            No open roles with LIVE candidates yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {roleCards.slice(0, 6).map((role) => (
              <div
                key={role.id}
                style={{
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#ffffff",
                  padding: 14,
                  fontSize: 13,
                  color: "#0f172a",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{role.title}</div>
                  <button
                    type="button"
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      color: "#0369a1",
                      cursor: "pointer",
                    }}
                  >
                    <Link
                      href={`/requisitions/${role.id}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      Open Role
                    </Link>
                  </button>
                </div>
                <div style={{ display: "grid", rowGap: 4, columnGap: 12, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Ready for Review:</span>{" "}
                    <span style={{ fontWeight: 600 }}>{role.readyCount}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Interviewing:</span>{" "}
                    <span style={{ fontWeight: 600 }}>{role.interviewingCount}</span>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Awaiting Decision:</span>{" "}
                    <span style={{ fontWeight: 600 }}>{role.awaitingDecisionCount}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                  Last activity: {role.lastActivityText ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3) Candidates Awaiting Your Review */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
          Candidates Awaiting Your Review
        </h2>
        {reviewQueue.length === 0 ? (
          <div
            style={{
              borderRadius: 8,
              border: "1px dashed #e5e7eb",
              padding: 16,
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            No candidates are currently awaiting your review.
          </div>
        ) : (
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 12,
              fontSize: 13,
            }}
          >
            {reviewQueue.slice(0, 5).map((item) => (
              <div
                key={item.submissionId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "6px 0",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    {item.candidateName || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{item.roleTitle}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    Submitted {item.submittedAtText}
                    {item.matchText && ` • AI match ${item.matchText}`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Link
                    href={`/requisitions/${item.requisitionId}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid #0369a1",
                      background: "#0369a1",
                      color: "#ffffff",
                      fontSize: 12,
                      textDecoration: "none",
                    }}
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4) Hiring Progress Snapshot */}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
          Hiring Progress Snapshot
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 12,
              fontSize: 13,
              color: "#0f172a",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Active roles</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{snapshot.activeRoles}</div>
          </div>
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 12,
              fontSize: 13,
              color: "#0f172a",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
              Candidates reviewed
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{snapshot.candidatesReviewed}</div>
          </div>
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 12,
              fontSize: 13,
              color: "#0f172a",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
              Interviews active
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{snapshot.interviewsActive}</div>
          </div>
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 12,
              fontSize: 13,
              color: "#0f172a",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>
              Offers pending
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{snapshot.offersPending}</div>
          </div>
        </div>
      </section>

      {/* 5) Recent Activity */}
      <section>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
          Recent Activity
        </h2>
        {activity.length === 0 ? (
          <div
            style={{
              borderRadius: 8,
              border: "1px dashed #e5e7eb",
              padding: 16,
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            No recent activity yet.
          </div>
        ) : (
          <div
            style={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#ffffff",
              padding: 12,
              fontSize: 13,
            }}
          >
            {activity.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "6px 0",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div style={{ color: "#0f172a" }}>{item.description}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.timestampText}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

