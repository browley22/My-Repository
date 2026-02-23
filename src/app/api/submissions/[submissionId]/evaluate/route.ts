import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { assertCanAccessSubmission } from "@/lib/submission-auth";
import { runEvaluationForSubmission } from "@/lib/runSubmissionEvaluation";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/** AGENCY-only: evaluate a submission's fit using AI/heuristic analysis. */
export async function POST(
  request: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const submissionId = params?.submissionId;
  if (!submissionId) {
    return NextResponse.json(
      { error: "Missing submission id" },
      { status: 400 }
    );
  }

  try {
    await assertCanAccessSubmission(session, submissionId, {
      allowedRoles: ["AGENCY"],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const result = await runEvaluationForSubmission(prisma, submissionId);

  if (!result.success) {
    return NextResponse.json(
      { error: "Evaluation skipped", detail: result.skipped },
      { status: 400 }
    );
  }

  const { evaluation } = result;
  return NextResponse.json(
    {
      evaluation: {
        fitScore: evaluation.fitScore,
        fitSummary: evaluation.fitSummary,
        strengths: evaluation.strengths,
        gaps: evaluation.gaps,
        sellingPoints: evaluation.sellingPoints,
        objectionsAndRebuttals: evaluation.objectionsAndRebuttals,
        confidence: evaluation.confidence,
        evaluatedAt: new Date().toISOString(),
      },
    },
    { status: 200 }
  );
}
