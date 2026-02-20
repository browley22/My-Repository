import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import path from "path";
import mammoth from "mammoth";

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
      data: { resumeText: text.length > 0 ? text : null },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Resume extract candidate update failed:", err);
    return NextResponse.json(
      { error: "Failed to save extracted text", detail: msg },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, resumeTextLength: text.length, resumeText: text },
    { status: 200 }
  );
}
