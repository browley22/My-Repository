import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

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
  if (!candidateId) {
    return NextResponse.json(
      { error: "Missing candidate id" },
      { status: 400 }
    );
  }

  let body: { summaryText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const raw = typeof body.summaryText === "string" ? body.summaryText : "";
  const summaryText = raw.trim();
  if (!summaryText || summaryText.length < 20) {
    return NextResponse.json(
      { error: "Summary too short", detail: "Minimum 20 characters required." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: { candidateSummaryText: summaryText },
      select: { id: true, candidateSummaryText: true },
    });
    return NextResponse.json(
      { candidateId: updated.id, summaryText: updated.candidateSummaryText },
      { status: 200 }
    );
  } catch (err) {
    console.error("Update candidate summary failed:", err);
    return NextResponse.json(
      { error: "Failed to update candidate summary" },
      { status: 500 }
    );
  }
}

