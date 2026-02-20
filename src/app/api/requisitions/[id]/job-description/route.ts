import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { assertCanAccessRequisition } from "@/lib/submission-auth";
import type { Session } from "next-auth";

const prisma = new PrismaClient();

export const runtime = "nodejs";

type AccessResult =
  | { error: NextResponse }
  | { requisition: { id: string; clientId: string } };

async function ensureAccess(
  session: Session | null,
  requisitionId: string
): Promise<AccessResult> {
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const requisition = await prisma.requisition.findUnique({
    where: { id: requisitionId },
    select: { id: true, clientId: true },
  });
  if (!requisition) {
    return { error: NextResponse.json({ error: "Requisition not found" }, { status: 404 }) };
  }
  try {
    assertCanAccessRequisition(session, requisition.clientId);
  } catch {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { requisition };
}

function updatedResponse(requisition: { id: string; jobDescription: string | null; jobDescriptionUpdatedAt: Date | null }) {
  return NextResponse.json({
    id: requisition.id,
    jobDescription: requisition.jobDescription,
    jobDescriptionUpdatedAt: requisition.jobDescriptionUpdatedAt?.toISOString() ?? null,
  });
}

/** PUT: update job description from JSON body { jobDescription: string } */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const requisitionId = params?.id;
  if (!requisitionId) {
    return NextResponse.json({ error: "Missing requisition id" }, { status: 400 });
  }
  const access = await ensureAccess(session, requisitionId);
  if ("error" in access) return access.error;

  let body: { jobDescription?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const jobDescription = typeof body.jobDescription === "string" ? body.jobDescription : "";
  const updated = await prisma.requisition.update({
    where: { id: requisitionId },
    data: {
      jobDescription: jobDescription || null,
      jobDescriptionUpdatedAt: new Date(),
    },
    select: { id: true, jobDescription: true, jobDescriptionUpdatedAt: true },
  });
  return updatedResponse(updated);
}

/** POST: multipart/form-data with a text file; extract text and save as job description */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const requisitionId = params?.id;
  if (!requisitionId) {
    return NextResponse.json({ error: "Missing requisition id" }, { status: 400 });
  }
  const access = await ensureAccess(session, requisitionId);
  if ("error" in access) return access.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
  }
  const type = file.type?.toLowerCase() ?? "";
  const isText = type.startsWith("text/") || type === "application/octet-stream";
  if (!isText) {
    return NextResponse.json(
      { error: "Only text/plain (or .txt/.md) files are supported" },
      { status: 400 }
    );
  }
  let text: string;
  try {
    const buf = await file.arrayBuffer();
    text = new TextDecoder("utf-8").decode(buf);
  } catch {
    return NextResponse.json({ error: "Failed to read file as text" }, { status: 400 });
  }
  const jobDescription = text.trim() || null;
  const updated = await prisma.requisition.update({
    where: { id: requisitionId },
    data: {
      jobDescription,
      jobDescriptionUpdatedAt: new Date(),
    },
    select: { id: true, jobDescription: true, jobDescriptionUpdatedAt: true },
  });
  return updatedResponse(updated);
}
