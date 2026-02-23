import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import RequisitionBoardClient from "@/components/RequisitionBoardClient";
import { assertCanAccessSubmission, assertCanAccessRequisition } from "@/lib/submission-auth";
import { createEventPayload } from "@/lib/create-event";
import { ensureSubmissionOwnerIfNone } from "@/lib/submission-owner";
import JobDescriptionModal from "@/components/JobDescriptionModal";

const prisma = new PrismaClient();

// Placeholder hook for wiring in resume URLs without schema changes.
// If your Candidate model or another service exposes resume information
// (e.g. resumeUrl or a storage key), this helper is the single place to map
// that into the candidate.resumeUrl field used by the UI.
function getCandidateResumeUrl(candidate: any): string | null {
  // Example, if you later add a field or external lookup:
  // return candidate.resumeUrl ?? generateSignedUrl(candidate.resumeKey);
  return (candidate && candidate.resumeUrl) || null;
}

export default async function RequisitionPage({
params,
}: {
params: { id: string };
}) {
const session = await getServerSession(authOptions);

if (!session?.user) {
return <div>Please log in.</div>;
}

const role = (session.user as any)?.role as "CLIENT" | "AGENCY";

const { id } = params;

if (!id) {
return <div>Missing requisition id.</div>;
}

const requisition = await prisma.requisition.findUnique({
where: { id },
include: {
submissions: {
include: {
candidate: true,
events: true,
messages: {
orderBy: { createdAt: "desc" },
},
},
},
client: true,
},
});

if (!requisition) {
return <div>Requisition not found.</div>;
}

// Enrich candidate objects with resumeUrl for the client UI, without schema changes.
const submissionsWithResume = requisition.submissions.map((s: any) => ({
  ...s,
  candidate: s.candidate
    ? {
        ...s.candidate,
        resumeUrl: getCandidateResumeUrl(s.candidate),
      }
    : s.candidate,
}));

try {
  assertCanAccessRequisition(session, requisition.clientId);
} catch {
  return <div>Access denied.</div>;
}

const agencyColumns = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW_REQUESTED",
  "OFFER_PENDING",
  "OFFERED",
  "CLOSED",
  "DECLINED",
] as const;

// CLIENT: do not show a separate "Submitted to Client" column; map those submissions into "Submitted".
const clientColumns = [
  "SUBMITTED",
  "INTERVIEW_REQUESTED",
  "OFFER_PENDING",
  "OFFERED",
  "CLOSED",
  "DECLINED",
] as const;

const columns = (role === "AGENCY" ? agencyColumns : clientColumns) as readonly string[];

return (
<div style={{ padding: 40 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
    <JobDescriptionModal
    title={requisition.title}
    requisitionId={requisition.id}
    jobDescription={requisition.jobDescription || null}
  />
    <span style={{ fontSize: 12, color: "#64748b" }}>View JD</span>
  </div>
  <p style={{ marginTop: 0, marginBottom: 16 }}>Client: {requisition.client.name}</p>

  <hr />

  <RequisitionBoardClient
    role={role}
    requisitionId={requisition.id}
    requisitionTitle={requisition.title}
    columns={columns as unknown as string[]}
    submissions={submissionsWithResume as any}
    currentUserDisplayName={role === "AGENCY" ? ((session.user as any)?.name || (session.user as any)?.email) || undefined : undefined}

    onMove={async (submissionId: string, newStatus: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["AGENCY"] });

      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      if (!current) return;

      const fromStatus = current.status;
      const toStatus = newStatus as any;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: createEventPayload({
              type: "STATUS_CHANGE",
              fromStatus,
              toStatus,
              note: `Moved from ${fromStatus} to ${newStatus}`,
              actorRole: "AGENCY",
            }),
          },
        },
      });

      await ensureSubmissionOwnerIfNone(submissionId, session);
      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onRequestInterview={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["CLIENT"] });

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "INTERVIEW_REQUESTED" as any,
          events: {
            create: createEventPayload({
              type: "REQUEST_INTERVIEW",
              note: "Client requested interview",
              actorRole: role,
            }),
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Client requested interview",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onMakeOffer={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["CLIENT"] });

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "OFFER_PENDING" as any,
          events: {
            create: createEventPayload({
              type: "MAKE_OFFER",
              note: "Client wants to make an offer",
              actorRole: role,
            }),
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Client wants to make an offer",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onOfferAccepted={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId);

      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      if (!current) return;

      const fromStatus = current.status;
      const toStatus = "CLOSED" as any;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: createEventPayload({
              type: "STATUS_CHANGE",
              fromStatus,
              toStatus,
              note: "Offer accepted by candidate",
              actorRole: role,
            }),
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Offer accepted by candidate",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onOfferDeclined={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId);

      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      if (!current) return;

      const fromStatus = current.status;
      const toStatus = "DECLINED" as any;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: createEventPayload({
              type: "DECLINE",
              fromStatus,
              toStatus,
              note: "Offer declined by candidate",
              actorRole: role,
            }),
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Offer declined by candidate",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onDecline={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["CLIENT"] });

      const existing = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      const fromStatus = existing?.status;
      const toStatus = "DECLINED" as any;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: createEventPayload({
              type: "STATUS_CHANGE",
              fromStatus,
              toStatus,
              note: "Client declined candidate",
              actorRole: "CLIENT",
            }),
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onAddFeedback={async (submissionId: string, note: string) => {
      "use server";
      const trimmed = note.trim();
      if (!trimmed) return;

      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId);

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          events: {
            create: createEventPayload({
              type: "QUESTION",
              note: trimmed,
              actorRole: role,
            }),
          },
          messages: {
            create: {
              fromRole: role as any,
              body: trimmed,
            },
          },
        },
      });

      await ensureSubmissionOwnerIfNone(submissionId, session);
      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onMarkInterested={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["CLIENT"] });

      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      if (!current) return;

      const fromStatus = current.status;
      const toStatus = "UNDER_REVIEW" as any;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: [
              createEventPayload({
                type: "STATUS_CHANGE",
                fromStatus,
                toStatus,
                note: `Moved from ${fromStatus} to ${toStatus}`,
                actorRole: role,
              }),
              createEventPayload({
                type: "QUESTION",
                note: "Client marked candidate as Interested",
                actorRole: role,
              }),
            ],
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Client marked this candidate as Interested",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onMarkPass={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["CLIENT"] });

      const current = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      if (!current) return;

      const fromStatus = current.status;
      const toStatus = "DECLINED" as any;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: [
              createEventPayload({
                type: "STATUS_CHANGE",
                fromStatus,
                toStatus,
                note: `Moved from ${fromStatus} to ${toStatus}`,
                actorRole: role,
              }),
              createEventPayload({
                type: "QUESTION",
                note: "Client marked candidate as Pass",
                actorRole: role,
              }),
            ],
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Client marked this candidate as Pass",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onNeedInfo={async (submissionId: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      const { role } = await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["CLIENT"] });

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          events: {
            create: createEventPayload({
              type: "QUESTION",
              note: "Client needs more information on this candidate",
              actorRole: role,
            }),
          },
          messages: {
            create: {
              fromRole: role as any,
              body: "Client needs more information on this candidate",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onMarkOpenQuestionResolved={async (submissionId: string, note?: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["AGENCY"] });

      const resolvedNote = note?.trim() ? `[RESOLVED] ${note.trim()}` : "[RESOLVED] Open question resolved";

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          events: {
            create: createEventPayload({
              type: "QUESTION",
              note: resolvedNote,
              actorRole: "AGENCY",
            }),
          },
        },
      });

      await ensureSubmissionOwnerIfNone(submissionId, session);
      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onSetOwner={async (submissionId: string, ownerName: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["AGENCY"] });

      const name = ownerName.trim();
      if (!name) return;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          events: {
            create: createEventPayload({
              type: "QUESTION",
              note: `[OWNER] ${name}`,
              actorRole: "AGENCY",
            }),
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onSetOwnerWithHandoff={async (submissionId: string, ownerName: string) => {
      "use server";
      const session = await getServerSession(authOptions);
      await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["AGENCY"] });

      const name = ownerName.trim();
      if (!name) return;

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          events: {
            create: [
              createEventPayload({
                type: "QUESTION",
                note: `[OWNER] ${name}`,
                actorRole: "AGENCY",
              }),
              createEventPayload({
                type: "QUESTION",
                note: `[HANDOFF] Assigned to ${name}`,
                actorRole: "AGENCY",
              }),
            ],
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onBulkMarkFollowUpDone={async (submissionIds: string[]) => {
      "use server";
      const session = await getServerSession(authOptions);
      for (const submissionId of submissionIds) {
        try {
          await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["AGENCY"] });
          await prisma.submission.update({
            where: { id: submissionId },
            data: {
              events: {
                create: createEventPayload({ type: "QUESTION", note: "[FOLLOWUP DONE]", actorRole: "AGENCY" }),
              },
            },
          });
        } catch {
          /* skip unauthorized */
        }
      }
      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onBulkSendNudge={async (submissionIds: string[]) => {
      "use server";
      const session = await getServerSession(authOptions);
      const body = "Quick nudge: any update on this candidate?";
      for (const submissionId of submissionIds) {
        try {
          await assertCanAccessSubmission(session, submissionId, { allowedRoles: ["AGENCY"] });
          await prisma.message.create({
            data: { submissionId, fromRole: "AGENCY", body },
          });
        } catch {
          /* skip unauthorized */
        }
      }
      revalidatePath(`/requisitions/${requisition.id}`);
    }}
  />

  <br />
  <a href="/">Back to Dashboard</a>
</div>
);
}
