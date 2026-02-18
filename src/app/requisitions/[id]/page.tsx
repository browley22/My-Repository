import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import RequisitionBoardClient from "@/components/RequisitionBoardClient";

const prisma = new PrismaClient();

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
},
},
client: true,
},
});

if (!requisition) {
return <div>Requisition not found.</div>;
}

const columns = [
"SUBMITTED",
"UNDER_REVIEW",
"INTERVIEW_REQUESTED",
"OFFER_PENDING",
"OFFERED",
"DECLINED",
"CLOSED",
] as const;

return (
<div style={{ padding: 40 }}> <h1>{requisition.title}</h1> <p>Client: {requisition.client.name}</p>

```
  <hr />

  <h2>Submissions</h2>

  <RequisitionBoardClient
    role={role}
    requisitionId={requisition.id}
    columns={columns as unknown as string[]}
    submissions={requisition.submissions as any}

    onMove={async (submissionId: string, newStatus: string) => {

      "use server";

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
            create: {
              type: "STATUS_CHANGE",
              fromStatus: fromStatus as any,
              toStatus,
              note: `Moved from ${fromStatus} to ${newStatus}`,
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onRequestInterview={async (submissionId: string) => {
      "use server";

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: "INTERVIEW_REQUESTED" as any,
          events: {
            create: {
              type: "QUESTION",
              note: "Client requested interview",
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onDecline={async (submissionId: string) => {
      "use server";

      // 1) read current status so we can set fromStatus
      const existing = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { status: true },
      });

      const fromStatus = existing?.status;
      const toStatus = "DECLINED" as any;

      // 2) update submission + 3) write DecisionEvent with from/to
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: toStatus,
          events: {
            create: {
              type: "STATUS_CHANGE",
              note: "Client declined candidate",
              fromStatus,
              toStatus,
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}

    onAddFeedback={async (submissionId: string, note: string) => {
      "use server";

      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          events: {
            create: {
              type: "QUESTION",
              note,
            },
          },
        },
      });

      revalidatePath(`/requisitions/${requisition.id}`);
    }}
  />

  <br />
  <a href="/">Back to Dashboard</a>
</div>
);
}
