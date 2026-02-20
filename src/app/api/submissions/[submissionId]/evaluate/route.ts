import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { assertCanAccessSubmission } from "@/lib/submission-auth";
import { evaluateSubmission } from "@/lib/evaluateSubmission";
import { createEventPayload } from "@/lib/create-event";

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

  // Load submission with candidate and requisition
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      candidate: true,
      requisition: true,
      messages: {
        where: { fromRole: "AGENCY" },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      events: {
        where: { type: "QUESTION" },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!submission) {
    return NextResponse.json(
      { error: "Submission not found" },
      { status: 404 }
    );
  }

  // Extract resume text from candidate summary
  const resumeText = submission.candidate.summary || null;

  // Extract job description
  const jobDescription = submission.requisition.jobDescription || null;

  // Extract recruiter notes from messages and events
  const recruiterNotes = [
    ...submission.messages.map((m) => m.body),
    ...submission.events
      .map((e) => e.note)
      .filter((n): n is string => n !== null && n !== undefined),
  ]
    .filter((n) => n && n.length > 0)
    .join("\n\n");

  // Run evaluation
  const evaluation = evaluateSubmission({
    resumeText,
    jobDescription,
    recruiterNotes: recruiterNotes || undefined,
  });

  // Persist results
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      fitScore: evaluation.fitScore,
      fitSummary: evaluation.fitSummary,
      strengths: evaluation.strengths,
      gaps: evaluation.gaps,
      sellingPoints: evaluation.sellingPoints,
      objectionsAndRebuttals: evaluation.objectionsAndRebuttals,
      confidence: evaluation.confidence,
      evaluatedAt: new Date(),
      events: {
        create: createEventPayload({
          type: "AI_EVALUATION",
          note: `Fit ${evaluation.fitScore}%`,
          actorRole: "AGENCY",
        }),
      },
    },
  });

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
