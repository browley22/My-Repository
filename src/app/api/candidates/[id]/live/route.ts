import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/** AGENCY-only: mark candidate LIVE/NOT LIVE for the client. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if ((session.user as { role?: string }).role !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const candidateId = params?.id;
    if (!candidateId || typeof candidateId !== "string") {
      return NextResponse.json(
        { error: "Missing candidate id" },
        { status: 400 }
      );
    }

    let body: { isLive?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    if (typeof body.isLive !== "boolean") {
      return NextResponse.json(
        { error: "isLive must be a boolean" },
        { status: 400 }
      );
    }

    const existing = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    const isLive = body.isLive;
    const userId = (session.user as { id?: string }).id ?? null;

    const data: {
      isLiveForClient: boolean;
      liveAt?: Date | null;
      liveByUserId?: string | null;
    } = {
      isLiveForClient: isLive,
    };

    if (isLive) {
      data.liveAt = new Date();
      data.liveByUserId = userId;
    } else {
      data.liveAt = null;
      data.liveByUserId = null;
    }

    const updatedCandidate = await prisma.candidate.update({
      where: { id: candidateId },
      data,
    });

    return NextResponse.json(
      { candidate: updatedCandidate },
      { status: 200 }
    );
  } catch (err) {
    console.error("Set candidate LIVE failed:", err);
    const anyErr = err as { name?: unknown; message?: unknown; code?: unknown } | undefined;
    const debug: { name?: string; message?: string; code?: unknown } = {};
    if (anyErr && typeof anyErr.name === "string") debug.name = anyErr.name;
    if (anyErr && typeof anyErr.message === "string") debug.message = anyErr.message;
    if (anyErr && "code" in (anyErr as object)) debug.code = anyErr.code;
    return NextResponse.json(
      {
        error: "Server error",
        debug,
      },
      { status: 500 }
    );
  }
}

