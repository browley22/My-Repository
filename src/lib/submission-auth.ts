import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type Role = "CLIENT" | "AGENCY";

/** Session-like object (e.g. from getServerSession) with optional role/clientId on user. */
type SessionLike = { user?: { role?: string; clientId?: string; [k: string]: unknown } } | null;

/**
 * Asserts the user is authenticated, has access to the submission
 * (CLIENT: submission's requisition belongs to user's client; AGENCY: allowed),
 * and optionally that their role is allowed for the action.
 * Throws a clear error on failure.
 */
export async function assertCanAccessSubmission(
  session: unknown,
  submissionId: string,
  options?: { allowedRoles?: Role[] }
): Promise<{ submission: { id: string; requisitionId: string; requisition: { clientId: string } }; role: Role }> {
  const s = session as SessionLike;
  if (!s?.user) {
    throw new Error("Unauthorized: not authenticated");
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, requisitionId: true, requisition: { select: { clientId: true } } },
  });

  if (!submission) {
    throw new Error("Not found: submission");
  }

  const role = (s.user as { role?: string }).role as Role;
  const userClientId = (s.user as { clientId?: string }).clientId;

  if (role === "CLIENT") {
    if (!userClientId || userClientId !== submission.requisition.clientId) {
      throw new Error("Forbidden: you do not have access to this submission");
    }
  }

  if (options?.allowedRoles && !options.allowedRoles.includes(role)) {
    throw new Error("Forbidden: your role is not allowed for this action");
  }

  return { submission, role };
}

/** Asserts the user can access a requisition by clientId (e.g. for page load). */
export function assertCanAccessRequisition(
  session: unknown,
  requisitionClientId: string
): void {
  const s = session as SessionLike;
  if (!s?.user) {
    throw new Error("Unauthorized: not authenticated");
  }
  const role = (s.user as { role?: string }).role as Role;
  const userClientId = (s.user as { clientId?: string }).clientId;
  if (role === "CLIENT") {
    if (!userClientId || userClientId !== requisitionClientId) {
      throw new Error("Forbidden: you do not have access to this requisition");
    }
  }
}
