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

    // Auto-evaluate: at create time candidate has no resume yet; use jobDescription from requisition
    let evaluationQueued = true;
    try {
      const jobDescription = requisition.jobDescription ?? null;
      const evaluation = evaluateSubmission({
        resumeText: "",
        jobDescription: jobDescription || undefined,
        recruiterNotes: "",
      });
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
          events: {
            create: createEventPayload({
              type: "AI_EVALUATION",
              note: `Fit ${evaluation.fitScore}%`,
              actorRole: "AGENCY",
            }),
          },
        },
      });
      evaluationQueued = false;
    } catch (evalErr) {
      console.error("Auto-evaluate after submission create:", evalErr);
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
