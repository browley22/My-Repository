import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import ClientInsightsClient from "@/components/ClientInsightsClient";

const prisma = new PrismaClient();

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted to AM",
  UNDER_REVIEW: "Submitted to Client",
  INTERVIEW_REQUESTED: "Interview",
  OFFER_PENDING: "Interview Scheduled",
  OFFERED: "Offer",
  CLOSED: "Hired",
  DECLINED: "Declined",
};

function formatStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ClientPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return <div style={{ padding: 40 }}>Please log in.</div>;
  }

  const role = (session.user as { role?: string })?.role as "CLIENT" | "AGENCY" | undefined;
  if (role === "CLIENT") {
    return (
      <div style={{ padding: 40 }}>
        <h1>Not authorized</h1>
        <p>Client Insights is only available to Agency users.</p>
        <Link href="/" style={{ color: "#0369a1" }}>Back to Dashboard</Link>
      </div>
    );
  }

  const clientId = params?.id;
  if (!clientId) {
    return <div style={{ padding: 40 }}>Missing client id.</div>;
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      requisitions: {
        include: {
          submissions: {
            include: {
              candidate: { select: { id: true, firstName: true, lastName: true } },
              events: { orderBy: { createdAt: "desc" } },
              messages: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });

  if (!client) {
    return (
      <div style={{ padding: 40 }}>
        <p>Client not found.</p>
        <Link href="/" style={{ color: "#0369a1" }}>Back to Dashboard</Link>
      </div>
    );
  }

  const allSubmissions = client.requisitions.flatMap((r) =>
    r.submissions.map((s) => ({ ...s, requisitionTitle: r.title, requisitionId: r.id }))
  );
  const totalRequisitions = client.requisitions.length;
  const openRequisitions = client.requisitions.filter((r) =>
    r.submissions.some((s) => s.status !== "CLOSED" && s.status !== "DECLINED")
  ).length;
  const placements = allSubmissions.filter((s) => s.status === "CLOSED").length;
  const totalOffers = allSubmissions.filter((s) => s.status === "OFFERED" || s.status === "CLOSED").length;
  const winRate = totalOffers > 0 ? Math.round((placements / totalOffers) * 100) : null;

  // Build recent activity (latest 10 across all submissions)
  const activityItems: Array<{ id: string; description: string; timestamp: number }> = [];
  for (const sub of allSubmissions) {
    const candidateName = sub.candidate
      ? `${sub.candidate.firstName} ${sub.candidate.lastName}`
      : "Unknown";
    for (const e of sub.events ?? []) {
      let desc = "";
      if (e.type === "STATUS_CHANGE") {
        const from = formatStatusLabel((e.fromStatus as string) ?? "");
        const to = formatStatusLabel((e.toStatus as string) ?? "");
        desc = `${candidateName}: ${from} → ${to}`;
        if (e.note) desc += ` (${e.note})`;
      } else if (e.type === "REQUEST_INTERVIEW") {
        desc = `${candidateName}: Interview requested`;
        if (e.note) desc += ` - ${e.note}`;
      } else if (e.type === "MAKE_OFFER") {
        desc = `${candidateName}: Offer made`;
        if (e.note) desc += ` - ${e.note}`;
      } else if (e.type === "DECLINE") {
        desc = `${candidateName}: Declined`;
        if (e.note) desc += ` - ${e.note}`;
      } else if (e.type === "QUESTION") {
        desc = `${candidateName}: ${e.note || "Note"}`;
      } else if (e.type === "AI_EVALUATION") {
        desc = `${candidateName}: ${e.note || "Evaluated"}`;
      }
      if (desc && e.createdAt) {
        activityItems.push({
          id: `event-${e.id}`,
          description: desc,
          timestamp: new Date(e.createdAt).getTime(),
        });
      }
    }
    for (const m of sub.messages ?? []) {
      const roleLabel = m.fromRole === "CLIENT" ? "Client" : "Agency";
      activityItems.push({
        id: `message-${m.id}`,
        description: `${candidateName}: ${roleLabel} - ${(m.body ?? "").slice(0, 80)}${(m.body?.length ?? 0) > 80 ? "…" : ""}`,
        timestamp: m.createdAt ? new Date(m.createdAt).getTime() : 0,
      });
    }
  }
  activityItems.sort((a, b) => b.timestamp - a.timestamp);
  const recentActivity = activityItems.slice(0, 10);

  const openReqs = client.requisitions.filter((r) =>
    r.submissions.some((s) => s.status !== "CLOSED" && s.status !== "DECLINED")
  );
  const pastReqs = client.requisitions.filter((r) =>
    r.submissions.length > 0 && r.submissions.every((s) => s.status === "CLOSED" || s.status === "DECLINED")
  );

  return (
    <div style={{ padding: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#0369a1", textDecoration: "none", fontSize: 14 }}>
          ← Back to Dashboard
        </Link>
      </div>
      <ClientInsightsClient
        clientName={client.name}
        clientId={client.id}
        summary={{
          totalRequisitions,
          openRequisitions,
          placements,
          winRate,
          totalOffers,
        }}
        openRequisitions={openReqs.map((r) => ({ id: r.id, title: r.title }))}
        pastRequisitions={pastReqs.map((r) => ({ id: r.id, title: r.title }))}
        recentActivity={recentActivity}
      />
    </div>
  );
}
