import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertCanAccessSubmission, assertCanAccessRequisition } from "@/lib/submission-auth";
import { createEventPayload } from "@/lib/create-event";
import { ensureSubmissionOwnerIfNone } from "@/lib/submission-owner";

const prisma = new PrismaClient();

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session) return <div>Please log in.</div>;

  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      candidate: true,
      requisition: { include: { client: true } },
      events: { orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!submission) return <div>Submission not found.</div>;

  try {
    assertCanAccessRequisition(session, submission.requisition.clientId);
  } catch {
    return <div>Access denied.</div>;
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>
        {submission.candidate.firstName} {submission.candidate.lastName}
      </h1>

      <p>
        Requisition: <strong>{submission.requisition.title}</strong> —{" "}
        {submission.requisition.client.name}
      </p>

      <p>Status: {submission.status}</p>

      <form
 
  action={async () => {
    "use server";
    const session = await getServerSession(authOptions);
    await assertCanAccessSubmission(session, id, { allowedRoles: ["CLIENT"] });

    await prisma.submission.update({
      where: { id },
      data: {
        status: "INTERVIEW_REQUESTED",
        events: {
          create: createEventPayload({
            type: "REQUEST_INTERVIEW",
            note: "Client requested interview",
            actorRole: "CLIENT",
          }),
        },
      },
    });

    revalidatePath(`/submissions/${id}`);
  }}
>
  <button
    type="submit"
    style={{
      marginTop: 20,
      padding: "8px 16px",
      background: "#2563eb",
      color: "white",
      border: "none",
      cursor: "pointer",
    }}
  >
    Request Interview
  </button>
</form>

<form
  action={async () => {
    "use server";
    const session = await getServerSession(authOptions);
    await assertCanAccessSubmission(session, id, { allowedRoles: ["CLIENT"] });

    await prisma.submission.update({
      where: { id },
      data: {
        status: "OFFER_PENDING",
        events: {
          create: createEventPayload({
            type: "MAKE_OFFER",
            note: "Offer requested by client",
            actorRole: "CLIENT",
          }),
        },
      },
    });
    revalidatePath(`/submissions/${id}`);
  }}
>
  <button
    type="submit"
    style={{
      marginTop: 12,
      padding: "8px 16px",
      background: "#16a34a",
      color: "white",
      border: "none",
      cursor: "pointer",
    }}
  >
    Make Offer
  </button>
</form>

<form
  action={async (formData) => {
    "use server";
    const session = await getServerSession(authOptions);
    await assertCanAccessSubmission(session, id, { allowedRoles: ["CLIENT"] });

    const reason = String(formData.get("reason") || "OTHER");
    const note = String(formData.get("note") || "").trim();
    const current = await prisma.submission.findUnique({ where: { id }, select: { status: true } });
    const fromStatus = current?.status;

    await prisma.submission.update({
      where: { id },
      data: {
        status: "DECLINED",
        events: {
          create: createEventPayload({
            type: "DECLINE",
            fromStatus,
            toStatus: "DECLINED",
            note: note || "Declined by client",
            actorRole: "CLIENT",
            declineReason: reason,
          }),
        },
      },
    });

    revalidatePath(`/submissions/${id}`);
  }}
  style={{ marginTop: 12 }}
>
  <label style={{ display: "block", marginBottom: 6 }}>
    Decline reason
  </label>

  <select name="reason" defaultValue="OTHER" style={{ padding: 8 }}>
    <option value="SKILL_MISMATCH">Skill mismatch</option>
    <option value="RATE_TOO_HIGH">Rate too high</option>
    <option value="NOT_AVAILABLE">Not available</option>
    <option value="CULTURE_FIT">Culture fit</option>
    <option value="OTHER">Other</option>
  </select>

  <div style={{ marginTop: 10 }}>
    <label style={{ display: "block", marginBottom: 6 }}>
      Note (optional)
    </label>
    <input
      name="note"
      placeholder="Add context for the recruiter..."
      style={{ padding: 8, width: 360 }}
    />
  </div>

  <button
    type="submit"
    style={{
      marginTop: 12,
      padding: "8px 16px",
      background: "#dc2626",
      color: "white",
      border: "none",
      cursor: "pointer",
      display: "inline-block",
    }}
  >
    Decline
  </button>
</form>

      <hr />

      <h2>Decision History</h2>
      {submission.events.length === 0 ? (
        <p>No decisions yet.</p>
      ) : (
        <ul>
          {submission.events.map((e) => (
            <li key={e.id}>
              {e.type}
              {e.declineReason ? ` (${e.declineReason})` : ""}
              {e.note ? ` — ${e.note}` : ""}
            </li>
          ))}
        </ul>
      )}

      <hr />

      <h2>Messages</h2>
      {submission.messages.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <ul>
          {submission.messages.map((m) => (
            <li key={m.id}>
              <strong>{m.fromRole}:</strong> {m.body}
            </li>
          ))}
        </ul>
      )}

      <form
        action={async (formData) => {
          "use server";
          const session = await getServerSession(authOptions);
          const body = String(formData.get("body") || "").trim();
          if (!body) return;

          const { role } = await assertCanAccessSubmission(session, id);

          await prisma.message.create({
            data: {
              submissionId: id,
              fromRole: role as any,
              body,
            },
          });

          await ensureSubmissionOwnerIfNone(id, session);
          revalidatePath(`/submissions/${id}`);
        }}
        style={{ marginTop: 16 }}
      >
        <label style={{ display: "block", marginBottom: 6 }}>
          Add message
        </label>
        <textarea
          name="body"
          placeholder="Ask a question or leave a note for your counterpart..."
          rows={3}
          style={{ width: 360, padding: 8, fontFamily: "inherit", fontSize: 14 }}
        />
        <div style={{ marginTop: 8 }}>
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              background: "#4b5563",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </form>

      <br />
      <a href={`/requisitions/${submission.requisitionId}`}>Back to Requisition</a>
    </div>
  );
}
