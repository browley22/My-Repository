/**
 * Run AI evaluation for a submission and persist fitScore + explanation fields.
 * Used by: POST /api/submissions/[submissionId]/evaluate and after resume upload.
 * Only runs when both job description and resume text are available; does not overwrite on skip.
 */

import type { PrismaClient } from "@prisma/client";
import { evaluateSubmission, type EvaluationResult } from "@/lib/evaluateSubmission";
import { createEventPayload } from "@/lib/create-event";

export type RunEvaluationResult =
  | { success: true; evaluation: EvaluationResult }
  | { success: false; skipped: string };

/**
 * Load submission, run evaluateSubmission (same logic as "candidate added"), persist to Submission.
 * Returns { success: false, skipped } when JD or resume text is missing (does not update submission).
 */
export async function runEvaluationForSubmission(
  prisma: PrismaClient,
  submissionId: string
): Promise<RunEvaluationResult> {
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
    return { success: false, skipped: "Submission not found" };
  }

  const resumeText =
    submission.candidate.resumeText ??
    (submission.candidate as { summary?: string | null }).summary ??
    null;
  const jobDescription = submission.requisition.jobDescription || null;

  const hasResume = typeof resumeText === "string" && resumeText.trim().length > 0;
  const hasJd = typeof jobDescription === "string" && jobDescription.trim().length > 0;
  if (!hasJd || !hasResume) {
    return {
      success: false,
      skipped: !hasJd ? "Missing job description" : "Missing resume text",
    };
  }

  const recruiterNotes = [
    ...submission.messages.map((m) => m.body),
    ...submission.events
      .map((e) => e.note)
      .filter((n): n is string => n !== null && n !== undefined),
  ]
    .filter((n) => n && n.length > 0)
    .join("\n\n");

  const evaluation = evaluateSubmission({
    resumeText,
    jobDescription,
    recruiterNotes: recruiterNotes || undefined,
  });

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

  return { success: true, evaluation };
}
