import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import DashboardClient from "@/components/DashboardClient";
import ClientPortalDashboard from "@/components/ClientPortalDashboard";

const prisma = new PrismaClient();

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

export default async function Home() {
  console.log("Prisma Client Loaded");
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>You are not logged in</h1>
        <a href="/api/auth/signin">Go to Sign In</a>
      </div>
    );
  }

  const role = (session.user as { role?: string }).role as "CLIENT" | "AGENCY" | undefined;

  if (role === "CLIENT") {
    const clientId = (session.user as { clientId?: string }).clientId;
    if (!clientId) {
      return (
        <div style={{ padding: 40 }}>
          <h1>Client dashboard</h1>
          <p>Client context not found for your account.</p>
        </div>
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        requisitions: {
          include: {
            submissions: {
              where: {
                candidate: {
                  is: {
                    isLiveForClient: true,
                  },
                },
              },
              include: {
                candidate: true,
                events: true,
                messages: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      return (
        <div style={{ padding: 40 }}>
          <h1>Client dashboard</h1>
          <p>Client not found.</p>
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

    // Helper: last activity for a submission (events/messages or createdAt)
    const getSubmissionLastActivity = (s: any): Date | null => {
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

    // A. Role cards
    const roleCards = client.requisitions.map((req) => {
      const subs = req.submissions;
      // Mapping assumptions:
      // - Ready for Review: statuses SUBMITTED or UNDER_REVIEW (client needs initial decision)
      // - Interviewing: INTERVIEW_REQUESTED or OFFER_PENDING (interview/offer in progress)
      // - Awaiting Decision: OFFER_PENDING or OFFERED (client decision needed on offer)
      const readyCount = subs.filter(
        (s) => s.status === "SUBMITTED" || s.status === "UNDER_REVIEW"
      ).length;
      const interviewingCount = subs.filter(
        (s) => s.status === "INTERVIEW_REQUESTED" || s.status === "OFFER_PENDING"
      ).length;
      const awaitingDecisionCount = subs.filter(
        (s) => s.status === "OFFER_PENDING" || s.status === "OFFERED"
      ).length;
      const lastActivity = subs
        .map((s) => getSubmissionLastActivity(s))
        .filter(Boolean) as Date[];
      const lastActivityDate =
        lastActivity.length > 0 ? new Date(Math.max(...lastActivity.map((d) => d.getTime()))) : null;

      return {
        id: req.id,
        title: req.title,
        readyCount,
        interviewingCount,
        awaitingDecisionCount,
        lastActivityText: formatTimeAgo(lastActivityDate),
      };
    });

    // B. Review queue – submissions needing review
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

    const reviewQueue = awaitingReview.slice(0, 5).map(({ submission, requisitionId, requisitionTitle }) => {
      const c = submission.candidate as any;
      const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "—";
      const submittedAt = getSubmissionLastActivity(submission);
      const fitScore = (submission as any).fitScore as number | null | undefined;
      let matchText: string | null = null;
      if (typeof fitScore === "number") {
        if (fitScore >= 80) matchText = "High";
        else if (fitScore >= 60) matchText = "Medium";
        else matchText = "Low";
      }
      return {
        submissionId: submission.id as string,
        requisitionId,
        roleTitle: requisitionTitle,
        candidateName: name,
        submittedAtText: formatTimeAgo(submittedAt),
        matchText,
      };
    });

    // C. Snapshot metrics
    const activeRoles = client.requisitions.length;
    const candidatesReviewed = allLiveSubs.filter(
      ({ submission }) =>
        submission.status !== "SUBMITTED" && submission.status !== "UNDER_REVIEW"
    ).length;
    const interviewsActive = allLiveSubs.filter(
      ({ submission }) =>
        submission.status === "INTERVIEW_REQUESTED" || submission.status === "OFFER_PENDING"
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

    // D. Recent activity (events/messages)
    type ActivityItem = {
      id: string;
      ts: number;
      description: string;
    };
    const activityItems: ActivityItem[] = [];

    for (const req of client.requisitions) {
      for (const s of req.submissions as any[]) {
        const c = s.candidate as any;
        const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "Candidate";

        for (const e of s.events ?? []) {
          if (!e.createdAt) continue;
          const ts = new Date(e.createdAt).getTime();
          if (e.type === "STATUS_CHANGE") {
            activityItems.push({
              id: `event-${e.id}`,
              ts,
              description: `Status update for ${name} (${req.title}): ${e.fromStatus} → ${e.toStatus}`,
            });
          } else if (e.type === "REQUEST_INTERVIEW") {
            activityItems.push({
              id: `event-${e.id}`,
              ts,
              description: `Interview requested for ${name} (${req.title}).`,
            });
          } else if (e.type === "MAKE_OFFER") {
            activityItems.push({
              id: `event-${e.id}`,
              ts,
              description: `Offer activity for ${name} (${req.title}).`,
            });
          } else {
            activityItems.push({
              id: `event-${e.id}`,
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
          const who = m.fromRole === "CLIENT" ? "You" : "Agency";
          activityItems.push({
            id: `msg-${m.id}`,
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

    // E. Priority action banner
    let priorityTitle = "All caught up";
    let priorityDescription = "No candidates awaiting immediate action.";
    let priorityCtaLabel = "View roles";
    let priorityCtaHref = "/requisitions";

    if (awaitingReview.length > 0) {
      const first = awaitingReview[0];
      priorityTitle = "Review candidates";
      priorityDescription = "You have candidates awaiting your review.";
      priorityCtaLabel = "Review candidates";
      priorityCtaHref = `/requisitions/${first.requisitionId}`;
    } else if (interviewsActive > 0) {
      const interviewing = allLiveSubs.find(
        ({ submission }) =>
          submission.status === "INTERVIEW_REQUESTED" || submission.status === "OFFER_PENDING"
      );
      priorityTitle = "View interviews";
      priorityDescription = "Interviews are in progress. Check upcoming candidates.";
      priorityCtaLabel = "View interviews";
      priorityCtaHref = interviewing
        ? `/requisitions/${interviewing.requisitionId}`
        : "/requisitions";
    }

    const priority = {
      title: priorityTitle,
      description: priorityDescription,
      ctaLabel: priorityCtaLabel,
      ctaHref: priorityCtaHref,
    };

    return (
      <ClientPortalDashboard
        clientName={client.name}
        priority={priority}
        roleCards={roleCards}
        reviewQueue={reviewQueue}
        snapshot={snapshot}
        activity={recentActivity}
      />
    );
  }

  // Default AGENCY dashboard (existing behavior)
  const requisitions = await prisma.requisition.findMany({
    include: {
      client: true,
      submissions: { select: { status: true } },
    },
    orderBy: [
      { client: { name: "asc" } },
      { title: "asc" },
    ],
  });

  // Open = has at least one submission not CLOSED/DECLINED, or no submissions yet
  const openRequisitions = requisitions.filter(
    (req) =>
      req.submissions.length === 0 ||
      req.submissions.some((s) => s.status !== "CLOSED" && s.status !== "DECLINED")
  );

  const byClient = openRequisitions.reduce(
    (acc, req) => {
      const id = req.client.id;
      if (!acc[id]) {
        acc[id] = { clientId: id, clientName: req.client.name, requisitions: [] };
      }
      acc[id].requisitions.push({ id: req.id, title: req.title });
      return acc;
    },
    {} as Record<string, { clientId: string; clientName: string; requisitions: { id: string; title: string }[] }>
  );
  const clientGroups = Object.values(byClient);

  return (
    <DashboardClient
      clientGroups={clientGroups}
      userEmail={session.user?.email ?? ""}
      userRole={(session.user as { role?: string })?.role ?? ""}
    />
  );
}
