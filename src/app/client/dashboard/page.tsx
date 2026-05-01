import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ClientPortalDashboard from "@/components/ClientPortalDashboard";
import { getClientForSession } from "../resolve-client";

function formatTimeAgo(date: Date | null): string {
  if (!date) return "—";
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default async function ClientDashboardPage() {
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
        <h1>Client dashboard</h1>
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

  const allLiveSubs = client.requisitions.flatMap((req) =>
    req.submissions.map((s) => ({
      submission: s,
      requisitionId: req.id,
      requisitionTitle: req.title,
    }))
  );

  const getSubmissionLastActivity = (s: {
    createdAt?: Date | null;
    events?: { createdAt?: Date | null }[];
    messages?: { createdAt?: Date | null }[];
  }): Date | null => {
    const times: number[] = [];
    if (s.createdAt) times.push(new Date(s.createdAt).getTime());
    for (const e of s.events ?? []) {
      if (e.createdAt) times.push(new Date(e.createdAt).getTime());
    }
    for (const m of s.messages ?? []) {
      if (m.createdAt) times.push(new Date(m.createdAt).getTime());
    }
    if (!times.length) return null;
    return new Date(Math.max(...times));
  };

  const roleCards = client.requisitions
    .slice(0, 6)
    .map((req) => {
      const subs = req.submissions;
      const readyCount = subs.filter(
        (s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW"
      ).length;
      const interviewingCount = subs.filter(
        (s) =>
          s.status === "INTERVIEW_REQUESTED" || s.status === "OFFER_PENDING"
      ).length;
      const awaitingDecisionCount = subs.filter(
        (s) => s.status === "OFFER_PENDING" || s.status === "OFFERED"
      ).length;
      const lastActivity = subs
        .map((s) => getSubmissionLastActivity(s))
        .filter(Boolean) as Date[];
      const lastActivityDate =
        lastActivity.length > 0
          ? new Date(Math.max(...lastActivity.map((d) => d.getTime())))
          : null;

      return {
        id: req.id,
        title: req.title,
        readyCount,
        interviewingCount,
        awaitingDecisionCount,
        lastActivityText: formatTimeAgo(lastActivityDate),
      };
    });

  const awaitingReview = allLiveSubs
    .filter(
      ({ submission }) =>
        submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW"
    )
    .sort((a, b) => {
      const aDate = getSubmissionLastActivity(a.submission) ?? new Date(0);
      const bDate = getSubmissionLastActivity(b.submission) ?? new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

  const reviewQueue = awaitingReview.slice(0, 5).map(
    ({
      submission,
      requisitionId,
      requisitionTitle,
    }: {
      submission: {
        id: string;
        candidate: { firstName?: string | null; lastName?: string | null };
        fitScore?: number | null;
      };
      requisitionId: string;
      requisitionTitle: string;
    }) => {
      const c = submission.candidate as { firstName?: string; lastName?: string };
      const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "—";
      const submittedAt = getSubmissionLastActivity(submission);
      const fitScore = submission.fitScore;
      let matchText: string | null = null;
      if (typeof fitScore === "number") {
        if (fitScore >= 80) matchText = "High";
        else if (fitScore >= 60) matchText = "Medium";
        else matchText = "Low";
      }
      return {
        submissionId: submission.id,
        requisitionId,
        roleTitle: requisitionTitle,
        candidateName: name,
        submittedAtText: formatTimeAgo(submittedAt),
        matchText,
      };
    }
  );

  const activeRoles = client.requisitions.length;
  const candidatesReviewed = allLiveSubs.filter(
    ({ submission }) =>
      submission.status !== "SUBMITTED" && submission.status !== "UNDER_REVIEW"
  ).length;
  const interviewsActive = allLiveSubs.filter(
    ({ submission }) =>
      submission.status === "INTERVIEW_REQUESTED" ||
      submission.status === "OFFER_PENDING"
  ).length;
  const offersPending = allLiveSubs.filter(
    ({ submission }) => submission.status === "OFFER_PENDING"
  ).length;

  const snapshot = {
    activeRoles,
    candidatesReviewed,
    interviewsActive,
    offersPending,
  };

  type ActivityItem = {
    id: string;
    ts: number;
    description: string;
  };
  const activityItems: ActivityItem[] = [];

  for (const req of client.requisitions) {
    for (const s of req.submissions) {
      const c = s.candidate as { firstName?: string; lastName?: string };
      const name =
        [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "Candidate";

      for (const e of s.events ?? []) {
        if (!e.createdAt) continue;
        const ts = new Date(e.createdAt).getTime();
        const ev = e as {
          id: string;
          type?: string;
          fromStatus?: string;
          toStatus?: string;
        };
        if (ev.type === "STATUS_CHANGE") {
          activityItems.push({
            id: `event-${ev.id}`,
            ts,
            description: `Status update for ${name} (${req.title}): ${ev.fromStatus ?? "—"} → ${ev.toStatus ?? "—"}`,
          });
        } else if (ev.type === "REQUEST_INTERVIEW") {
          activityItems.push({
            id: `event-${ev.id}`,
            ts,
            description: `Interview requested for ${name} (${req.title}).`,
          });
        } else if (ev.type === "MAKE_OFFER") {
          activityItems.push({
            id: `event-${ev.id}`,
            ts,
            description: `Offer activity for ${name} (${req.title}).`,
          });
        } else {
          activityItems.push({
            id: `event-${ev.id}`,
            ts,
            description: `Activity on ${name} (${req.title}).`,
          });
        }
      }

      for (const m of s.messages ?? []) {
        if (!m.createdAt) continue;
        const ts = new Date(m.createdAt).getTime();
        const body = (m.body as string) || "";
        const snippet = body.length > 80 ? `${body.slice(0, 77)}…` : body;
        const who = (m as { fromRole?: string }).fromRole === "CLIENT" ? "You" : "Agency";
        activityItems.push({
          id: `msg-${(m as { id: string }).id}`,
          ts,
          description: `${who} commented on ${name} (${req.title}): ${snippet}`,
        });
      }
    }
  }

  const recentActivity = activityItems
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      timestampText: formatTimeAgo(new Date(item.ts)),
      description: item.description,
    }));

  let priorityTitle = "All caught up";
  let priorityDescription = "No candidates awaiting immediate action.";
  let priorityCtaLabel = "View roles";
  let priorityCtaHref = "/client/requisitions";

  if (awaitingReview.length > 0) {
    const first = awaitingReview[0];
    priorityTitle = "Review candidates";
    priorityDescription = "You have candidates awaiting your review.";
    priorityCtaLabel = "Review candidates";
    priorityCtaHref = `/client/requisitions/${first.requisitionId}`;
  } else if (interviewsActive > 0) {
    const interviewing = allLiveSubs.find(
      ({ submission }) =>
        submission.status === "INTERVIEW_REQUESTED" ||
        submission.status === "OFFER_PENDING"
    );
    priorityTitle = "View interviews";
    priorityDescription = "Interviews are in progress. Check upcoming candidates.";
    priorityCtaLabel = "View interviews";
    priorityCtaHref = interviewing
      ? `/client/requisitions/${interviewing.requisitionId}`
      : "/client/requisitions";
  }

  const priority = {
    title: priorityTitle,
    description: priorityDescription,
    ctaLabel: priorityCtaLabel,
    ctaHref: priorityCtaHref,
  };

  return (
    <>
      {usedDemoFallback && (
        <div
          style={{
            padding: "10px 24px",
            background: "#fef3c7",
            borderBottom: "1px solid #f59e0b",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Demo mode: using first client record because this login isn’t linked yet.
        </div>
      )}
      <ClientPortalDashboard
        clientName={client.name}
        priority={priority}
        roleCards={roleCards}
        reviewQueue={reviewQueue}
        snapshot={snapshot}
        activity={recentActivity}
      />
    </>
  );
}
