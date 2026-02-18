import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

    await prisma.submission.update({
      where: { id },
      data: {
        status: "INTERVIEW_REQUESTED",
        events: {
          create: {
            type: "REQUEST_INTERVIEW",
          },
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

    await prisma.submission.update({
      where: { id },
      data: {
        status: "OFFER_PENDING",
        events: {
          create: {
            type: "MAKE_OFFER",
            note: "Offer requested by client",
          },
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

    const reason = String(formData.get("reason") || "OTHER");
    const note = String(formData.get("note") || "").trim();

    await prisma.submission.update({
      where: { id },
      data: {
        status: "DECLINED",
        events: {
          create: {
            type: "DECLINE",
            declineReason: reason as any,
            note: note || "Declined by client",
          },
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

      <br />
      <a href={`/requisitions/${submission.requisitionId}`}>Back to Requisition</a>
    </div>
  );
}
