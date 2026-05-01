import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const candidate = await prisma.candidate.findFirst({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        linkedinUrl: true,
        location: true,
        contactManuallyOverridden: true,
        createdAt: true,
        // Include updatedAt if it exists on the model; Prisma will ignore if not present.
        // @ts-expect-error updatedAt may not exist on Candidate in this schema
        updatedAt: true,
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { ok: false, error: "NotFound", message: "No candidates found" },
        { status: 404 }
      );
    }

    return NextResponse.json(candidate, { status: 200 });
  } catch (err) {
    const anyErr = err as { name?: unknown; message?: unknown };
    return NextResponse.json(
      {
        ok: false,
        error: typeof anyErr?.name === "string" ? anyErr.name : "Error",
        message: typeof anyErr?.message === "string" ? anyErr.message : String(err),
      },
      { status: 500 }
    );
  }
}

