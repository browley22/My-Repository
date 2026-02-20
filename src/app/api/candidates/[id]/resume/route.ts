import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import mammoth from "mammoth";

const prisma = new PrismaClient();

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const runtime = "nodejs";

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

  const candidateId = params?.id;
  if (!candidateId) {
    return NextResponse.json(
      { error: "Missing candidate id" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Missing or invalid file field" },
      { status: 400 }
    );
  }

  const blob = file as Blob;
  const type = blob.type;
  const originalName = (file as File).name || "resume";
  const ext = path.extname(originalName).toLowerCase();
  const allowedByMime = ALLOWED_TYPES.includes(type);
  const allowedByExt = [".pdf", ".doc", ".docx"].includes(ext);
  if (!allowedByMime && !allowedByExt) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: PDF, DOC, DOCX" },
      { status: 400 }
    );
  }

  if (blob.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Max 10MB." },
      { status: 400 }
    );
  }

  const saveExt = [".pdf", ".doc", ".docx"].includes(ext) ? ext : (type === "application/pdf" ? ".pdf" : ".doc");
  const safeName = `${candidateId}-${Date.now()}${saveExt}`;
  const dir = path.join(process.cwd(), "public", "uploads", "resumes");

  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    console.error("Resume upload mkdir:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to create upload directory", detail: msg },
      { status: 500 }
    );
  }

  const filePath = path.join(dir, safeName);
  const buffer = Buffer.from(await blob.arrayBuffer());

  try {
    await writeFile(filePath, buffer);
  } catch (err) {
    console.error("Resume upload writeFile:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to save file", detail: msg },
      { status: 500 }
    );
  }

  const resumeUrl = `/uploads/resumes/${safeName}`;

  const existing = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Candidate not found", detail: candidateId },
      { status: 404 }
    );
  }

  try {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl },
    });
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message) : String(err);
    console.error("Candidate update failed", err);
    return NextResponse.json(
      { error: "Candidate update failed", detail: message },
      { status: 500 }
    );
  }

  let resumeText: string | null = null;
  let warning: string | undefined;
  const isDocx = ext === ".docx" || ext === ".doc" || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || type === "application/msword";
  if (isDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = (result?.value ?? "").trim();
      if (text.length > 0) {
        resumeText = text;
        await prisma.candidate.update({
          where: { id: candidateId },
          data: { resumeText, resumeTextUpdatedAt: new Date() },
        });
      }
    } catch (err) {
      console.warn("Resume DOCX text extraction failed (upload succeeded):", err);
      warning = "Text extraction failed; file saved. Preview may be unavailable.";
    }
  }

  const payload: { resumeUrl: string; resumeText?: string | null; warning?: string } = { resumeUrl };
  if (resumeText != null) payload.resumeText = resumeText;
  if (warning) payload.warning = warning;
  return NextResponse.json(payload, { status: 200 });
}
