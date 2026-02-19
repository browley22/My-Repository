import { PrismaClient } from "@prisma/client";
import { createEventPayload } from "@/lib/create-event";

const prisma = new PrismaClient();

/** Submission with events (type, note, createdAt). */
type SubmissionWithEvents = {
  events?: { type: string; note?: string | null; createdAt?: string | null }[];
};

/**
 * Derives current owner from submission events (latest QUESTION with note "[OWNER] <name>").
 * No schema field; owner is stored as event note prefix.
 */
export function getSubmissionOwnerName(submission: SubmissionWithEvents): string {
  if (!submission.events?.length) return "";
  const prefix = "[OWNER] ";
  const ownerEvents = submission.events
    .filter((e) => e.type === "QUESTION" && e.note?.includes(prefix))
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  const latest = ownerEvents[0];
  if (!latest?.note) return "";
  const idx = latest.note.indexOf(prefix);
  return latest.note.slice(idx + prefix.length).trim();
}

/**
 * If submission has no owner and current user is AGENCY, set owner to current user (name or email).
 * Call after an AGENCY user first interacts (move, feedback, resolve, message).
 */
export async function ensureSubmissionOwnerIfNone(
  submissionId: string,
  session: { user?: { role?: string; name?: string | null; email?: string | null; [k: string]: unknown } } | null
): Promise<void> {
  if (!session?.user || (session.user as { role?: string }).role !== "AGENCY") return;
  const name = String((session.user as { name?: string }).name ?? (session.user as { email?: string }).email ?? "").trim();
  if (!name) return;
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, events: { select: { type: true, note: true, createdAt: true } } },
  });
  if (!submission || getSubmissionOwnerName(submission) !== "") return;
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      events: {
        create: createEventPayload({ type: "QUESTION", note: `[OWNER] ${name}`, actorRole: "AGENCY" }),
      },
    },
  });
}
