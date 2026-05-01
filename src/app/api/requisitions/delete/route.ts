import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id =
      typeof body?.id === "string"
        ? body.id.trim()
        : typeof body?.requisitionId === "string"
          ? body.requisitionId.trim()
          : undefined;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await prisma.requisition.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("REQUISITION_DELETE_ERROR", err);
    return NextResponse.json(
      {
        error: "Delete failed",
        message:
          err instanceof Error ? err.message : err != null ? String(err) : "Unknown error",
      },
      { status: 500 }
    );
  }
}
