import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import { assertCanAccessRequisition } from "@/lib/submission-auth";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/** PUT: update job description from JSON body { jobDescription: string } */
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params?.id;
  const session = await getServerSession(authOptions);

  console.log("[JD PUT] id=", id, "session=", !!session);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing requisition id" }, { status: 400 });
  }

  const requisition = await prisma.requisition.findUnique({
    where: { id },
    select: { id: true, clientId: true },
  });
  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }
  try {
    assertCanAccessRequisition(session, requisition.clientId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { jobDescription?: unknown };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[JD PUT] body parse failed", e);
    return NextResponse.json({ error: "Invalid JSON body", detail: String(e) }, { status: 400 });
  }
  const jobDescription =
    typeof body.jobDescription === "string" ? body.jobDescription.trim() : "";
  console.log("[JD PUT] length=", jobDescription.length);

  try {
    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        jobDescription: jobDescription || null,
        jobDescriptionUpdatedAt: new Date(),
      },
      select: { id: true, jobDescription: true },
    });
    return NextResponse.json({
      id: updated.id,
      jobDescription: updated.jobDescription ?? null,
    });
  } catch (error) {
    console.error("[JD PUT] error", error);
    return NextResponse.json(
      {
        error: "Failed to update job description",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/** POST: multipart/form-data with a text file; extract text and save as job description */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = params?.id;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing requisition id" }, { status: 400 });
  }
  const requisition = await prisma.requisition.findUnique({
    where: { id },
    select: { id: true, clientId: true },
  });
  if (!requisition) {
    return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
  }
  try {
    assertCanAccessRequisition(session, requisition.clientId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
  }
  const type = (file as File).type?.toLowerCase() ?? "";
  const isText = type.startsWith("text/") || type === "application/octet-stream";
  if (!isText) {
    return NextResponse.json(
      { error: "Only text/plain (or .txt/.md) files are supported" },
      { status: 400 }
    );
  }
  let text: string;
  try {
    const buf = await (file as File).arrayBuffer();
    text = new TextDecoder("utf-8").decode(buf);
  } catch {
    return NextResponse.json({ error: "Failed to read file as text" }, { status: 400 });
  }
  const jobDescription = text.trim() || null;
  try {
    const updated = await prisma.requisition.update({
      where: { id },
      data: {
        jobDescription,
        jobDescriptionUpdatedAt: new Date(),
      },
      select: { id: true, jobDescription: true },
    });
    return NextResponse.json({
      id: updated.id,
      jobDescription: updated.jobDescription ?? null,
    });
  } catch (error) {
    console.error("[JD POST] error", error);
    return NextResponse.json(
      {
        error: "Failed to update job description",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
