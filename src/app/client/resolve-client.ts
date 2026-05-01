import type { Session } from "next-auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requisitionsInclude = {
  requisitions: {
    include: {
      submissions: {
        where: {
          candidate: {
            is: { isLiveForClient: true },
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
} as const;

export type ResolvedClient = Awaited<
  ReturnType<typeof getClientForSession>
>["client"];

/**
 * Resolves the Client record for a CLIENT session. Does not check role; caller must ensure role === "CLIENT".
 * Fallback order: 1) session.user.clientId, 2) User by session.user.email -> user.client, 3) first Client in DB (demo).
 */
export async function getClientForSession(session: Session | null): Promise<{
  client: ResolvedClient;
  usedDemoFallback: boolean;
}> {
  if (!session?.user) {
    return { client: null, usedDemoFallback: false };
  }

  const sessionClientId = (session.user as { clientId?: string }).clientId;
  const userEmail = session.user?.email ?? null;

  let client: ResolvedClient = null;
  let usedDemoFallback = false;

  if (sessionClientId) {
    client = await prisma.client.findUnique({
      where: { id: sessionClientId },
      include: requisitionsInclude,
    });
  }

  if (!client && userEmail) {
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        client: {
          include: requisitionsInclude,
        },
      },
    });
    if (user?.client) {
      client = user.client;
    }
  }

  if (!client) {
    client = await prisma.client.findFirst({
      orderBy: { createdAt: "desc" },
      include: requisitionsInclude,
    });
    if (client) {
      usedDemoFallback = true;
    }
  }

  return { client, usedDemoFallback };
}
