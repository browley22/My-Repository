import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const prisma = new PrismaClient();

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

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
    return NextResponse.json(
      { error: "Failed to create upload directory" },
      { status: 500 }
    );
  }

  const filePath = path.join(dir, safeName);
  const buffer = Buffer.from(await blob.arrayBuffer());

  try {
    await writeFile(filePath, buffer);
  } catch (err) {
    console.error("Resume upload writeFile:", err);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }

  const resumeUrl = `/uploads/resumes/${safeName}`;

  try {
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl },
    });
  } catch (err) {
    console.error("Resume update candidate:", err);
    return NextResponse.json(
      { error: "Failed to update candidate" },
      { status: 500 }
    );
  }

  return NextResponse.json({ resumeUrl });
}
