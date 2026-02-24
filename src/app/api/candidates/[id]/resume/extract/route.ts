import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { runEvaluationForSubmission } from "@/lib/runSubmissionEvaluation";
import { applyContactFromResumeText } from "@/lib/parseContactFromResume";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/** POST: extract text from existing .docx file and save to candidate.resumeText */
export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role?: string }).role !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await Promise.resolve(ctx.params);
  const candidateId = params?.id;
  if (!candidateId) {
    return NextResponse.json({ error: "Missing candidate id" }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, resumeUrl: true },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  const resumeUrl = candidate.resumeUrl;
  if (!resumeUrl || typeof resumeUrl !== "string") {
    return NextResponse.json(
      { error: "No resume file linked to this candidate" },
      { status: 400 }
    );
  }

  const normalized = path.normalize(resumeUrl).replace(/^\//, "");
  if (normalized.startsWith("..") || normalized.includes("..")) {
    return NextResponse.json({ error: "Invalid resume path" }, { status: 400 });
  }
  const filePath = path.join(process.cwd(), "public", normalized);

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Resume extract readFile failed:", err);
    return NextResponse.json(
      { error: "Could not read resume file", detail: msg },
      { status: 500 }
    );
  }

  const ext = path.extname(normalized).toLowerCase();
  if (ext !== ".docx" && ext !== ".doc") {
    return NextResponse.json(
      { error: "Preview extraction only supported for .docx files", detail: `File type: ${ext}` },
      { status: 400 }
    );
  }

  let text: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    text = (result?.value ?? "").trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Resume extract mammoth failed:", err);
    return NextResponse.json(
      { error: "Text extraction failed", detail: msg },
      { status: 500 }
    );
  }

  try {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeText: text.length > 0 ? text : null, resumeTextUpdatedAt: new Date() },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Resume extract candidate update failed:", err);
    return NextResponse.json(
      { error: "Failed to save extracted text", detail: msg },
      { status: 500 }
    );
  }

  if (text.length > 0) {
    try {
      await applyContactFromResumeText(prisma, candidateId, text);
    } catch (err) {
      console.warn("Resume extract contact auto-fill failed:", err);
    }
  }

  // Auto-run AI evaluation for every submission of this candidate when resume text was saved.
  const submissions = await prisma.submission.findMany({
    where: { candidateId },
    select: { id: true },
  });
  const submissionCount = submissions.length;
  let evaluation: {
    submissionCount: number;
    evaluatedCount: number;
    evaluatedSubmissionIds: string[];
    errors?: { submissionId: string; message: string }[];
    reason?: string;
  } = {
    submissionCount,
    evaluatedCount: 0,
    evaluatedSubmissionIds: [],
  };

  if (text.length === 0) {
    evaluation.reason = "empty_resume_text";
  } else {
    const errors: { submissionId: string; message: string }[] = [];
    for (const sub of submissions) {
      try {
        const evalResult = await runEvaluationForSubmission(prisma, sub.id);
        if (evalResult.success) {
          evaluation.evaluatedSubmissionIds.push(sub.id);
        } else {
          console.info(`[resume-extract] Skip evaluation for submission ${sub.id}: ${evalResult.skipped}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[resume-extract] Evaluation failed for submission ${sub.id}:`, err);
        errors.push({ submissionId: sub.id, message });
      }
    }
    evaluation.evaluatedCount = evaluation.evaluatedSubmissionIds.length;
    if (errors.length > 0) evaluation.errors = errors;
  }

  return NextResponse.json(
    {
      ok: true,
      resumeTextLength: text.length,
      resumeText: text,
      evaluation,
    },
    { status: 200 }
  );
}
