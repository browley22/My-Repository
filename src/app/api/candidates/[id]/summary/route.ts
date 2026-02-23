import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const candidateId = params?.id;
  if (!candidateId || typeof candidateId !== "string") {
    return NextResponse.json(
      { error: "Missing candidateId" },
      { status: 400 }
    );
  }

  let body: { summaryText?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const summaryText = body?.summaryText;
  const clean = String(summaryText ?? "").trim();
  if (!clean || clean.length < 20) {
    return NextResponse.json(
      { error: "Summary is empty/too short", detail: "Minimum 20 characters required." },
      { status: 400 }
    );
  }

  try {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        candidateSummaryText: clean,
        candidateSummaryUpdatedAt: new Date(),
      } as Prisma.CandidateUpdateInput,
    });
    return NextResponse.json(
      { ok: true, summaryText: clean },
      { status: 200 }
    );
  } catch (err) {
    const safeMessage =
      err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : err != null
          ? String(err)
          : "Unknown error";
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    const detail = code === "P2025" ? "Candidate not found." : safeMessage;
    console.error("Update candidate summary failed:", err);
    return NextResponse.json(
      { error: "Failed to update candidate summary", detail, code: code ?? undefined },
      { status: 500 }
    );
  }
}
