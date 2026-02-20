import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { evaluateSubmission } from "@/lib/evaluateSubmission";
import { createEventPayload } from "@/lib/create-event";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/** AGENCY-only: create a new candidate and submission for the requisition. Auto-evaluates fit and persists results. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requisitionId = params?.id;
  if (!requisitionId) {
    return NextResponse.json(
      { error: "Missing requisition id" },
      { status: 400 }
    );
  }

  const requisition = await prisma.requisition.findUnique({
    where: { id: requisitionId },
    select: { id: true, jobDescription: true },
  });
  if (!requisition) {
    return NextResponse.json(
      { error: "Requisition not found" },
      { status: 404 }
    );
  }

  let body: { firstName?: string; lastName?: string; email?: string; phone?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const firstName = typeof body.firstName === "string" && body.firstName.trim() ? body.firstName.trim() : null;
  const lastName = typeof body.lastName === "string" && body.lastName.trim() ? body.lastName.trim() : null;
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName are required" },
      { status: 400 }
    );
  }

  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

  try {
    const candidate = await prisma.candidate.create({
      data: {
        firstName,
        lastName,
        title: title ?? undefined,
      },
    });

    const submission = await prisma.submission.create({
      data: {
        requisitionId,
        candidateId: candidate.id,
        status: "SUBMITTED",
      },
    });

    // Temporary server logs for ranking debug
    const jobDescription = requisition.jobDescription ?? null;
    const jobDescriptionLength = jobDescription ? jobDescription.length : 0;
    const resumeText = ""; // at create time candidate has no resume yet
    const resumeTextLength = 0;
    console.log("[submission-create]", {
      requisitionId,
      candidateId: candidate.id,
      submissionId: submission.id,
      jobDescriptionExists: jobDescriptionLength > 0,
      jobDescriptionLength,
      resumeTextExists: resumeTextLength > 0,
      resumeTextLength,
    });

    // Auto-evaluate: persist fitScore so ranking works. Fallback to deterministic score if evaluation fails.
    let evaluationQueued = true;
    /** Deterministic fallback when evaluation fails or inputs missing (temporary). */
    const fallbackFitScore = (): number => {
      const jd = jobDescription || "";
      const words = jd.split(/\s+/).filter(Boolean).length;
      return Math.min(95, 30 + Math.min(words, 65));
    };

    try {
      const evaluation = evaluateSubmission({
        resumeText,
        jobDescription: jobDescription || undefined,
        recruiterNotes: "",
      });
      console.log("[submission-create] evaluation output fitScore:", evaluation.fitScore);

      // Persist evaluation fields first (no nested event) so fitScore is never lost
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          fitScore: evaluation.fitScore,
          fitSummary: evaluation.fitSummary,
          strengths: evaluation.strengths,
          gaps: evaluation.gaps,
          sellingPoints: evaluation.sellingPoints,
          objectionsAndRebuttals: evaluation.objectionsAndRebuttals,
          confidence: evaluation.confidence,
          evaluatedAt: new Date(),
        },
      });
      evaluationQueued = false;

      // Optional: create AI_EVALUATION event separately so it cannot break the fitScore update
      try {
        const payload = createEventPayload({
          type: "AI_EVALUATION",
          note: `Fit ${evaluation.fitScore}%`,
          actorRole: "AGENCY",
        });
        await prisma.decisionEvent.create({
          data: {
            submissionId: submission.id,
            type: payload.type,
            note: payload.note,
          },
        });
      } catch (eventErr) {
        console.error("[submission-create] AI_EVALUATION event create failed (fitScore already saved):", eventErr);
      }
    } catch (evalErr) {
      console.error("Auto-evaluate after submission create:", evalErr);
      const score = fallbackFitScore();
      console.log("[submission-create] using fallback fitScore:", score);
      await prisma.submission.update({
        where: { id: submission.id },
        data: { fitScore: score, evaluatedAt: new Date() },
      });
      evaluationQueued = false;
    }

    return NextResponse.json(
      { candidateId: candidate.id, submissionId: submission.id, evaluationQueued },
      { status: 200 }
    );
  } catch (err) {
    console.error("Create candidate/submission:", err);
    return NextResponse.json(
      { error: "Failed to create candidate or submission" },
      { status: 500 }
    );
  }
}
