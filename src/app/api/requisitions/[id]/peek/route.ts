import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { assertCanAccessRequisition } from "@/lib/submission-auth";
import { AGENCY_LANES, getLaneLabel } from "@/lib/requisition-lanes";

const prisma = new PrismaClient();

export type PeekLane = {
  status: string;
  label: string;
  count: number;
  candidates: { id: string; name: string }[];
};

export type PeekResponse = {
  lanes: PeekLane[];
};

/** GET: lane counts + top 2 candidate names per lane for Dashboard peek */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(ctx.params);
  const id = params?.id;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing requisition id" }, { status: 400 });
  }

  const requisition = await prisma.requisition.findUnique({
    where: { id },
    include: {
      submissions: {
        include: {
          candidate: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }
  try {
    assertCanAccessRequisition(session, requisition.clientId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const byStatus: Record<string, { id: string; name: string }[]> = {};
  for (const status of AGENCY_LANES) {
    byStatus[status] = [];
  }
  for (const sub of requisition.submissions) {
    const status = sub.status;
    if (!byStatus[status]) byStatus[status] = [];
    const name = sub.candidate
      ? `${sub.candidate.firstName} ${sub.candidate.lastName}`.trim() || "—"
      : "—";
    byStatus[status].push({ id: sub.candidateId, name });
  }

  const lanes: PeekLane[] = AGENCY_LANES.map((status) => {
    const list = byStatus[status] ?? [];
    const candidates = list.slice(0, 2);
    return {
      status,
      label: getLaneLabel(status),
      count: list.length,
      candidates,
    };
  });

  return NextResponse.json({ lanes } satisfies PeekResponse);
}
