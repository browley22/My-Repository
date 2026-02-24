import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

/** AGENCY-only: update candidate contact and set contactManuallyOverridden = true. */
export async function PATCH(
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
  if (!candidateId || typeof candidateId !== "string") {
    return NextResponse.json(
      { error: "Missing candidate id" },
      { status: 400 }
    );
  }

  let body: { email?: unknown; phone?: unknown; linkedinUrl?: unknown; location?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body?.email === undefined || body?.email === null ? undefined : typeof body.email === "string" ? body.email.trim() || null : undefined;
  const phone = body?.phone === undefined || body?.phone === null ? undefined : typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const linkedinUrl = body?.linkedinUrl === undefined || body?.linkedinUrl === null ? undefined : typeof body.linkedinUrl === "string" ? body.linkedinUrl.trim() || null : undefined;
  const location = body?.location === undefined || body?.location === null ? undefined : typeof body.location === "string" ? body.location.trim() || null : undefined;

  const data: { email?: string | null; phone?: string | null; linkedinUrl?: string | null; location?: string | null; contactManuallyOverridden: boolean } = {
    contactManuallyOverridden: true,
  };
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (linkedinUrl !== undefined) data.linkedinUrl = linkedinUrl;
  if (location !== undefined) data.location = location;

  try {
    const updatedCandidate = await prisma.candidate.update({
      where: { id: candidateId },
      data,
    });
    return NextResponse.json(
      { candidate: updatedCandidate },
      { status: 200 }
    );
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined;
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }
    const safeMessage =
      err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : err != null
          ? String(err)
          : "Unknown error";
    console.error("Update candidate contact failed:", err);
    return NextResponse.json(
      { error: "Failed to update contact", detail: safeMessage },
      { status: 500 }
    );
  }
}
