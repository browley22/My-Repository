import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const candidate = await prisma.candidate.findFirst();

    if (!candidate) {
      return NextResponse.json(
        { ok: false, error: "NotFound", message: "No candidates found" },
        { status: 404 }
      );
    }

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { contactManuallyOverridden: true },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
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

