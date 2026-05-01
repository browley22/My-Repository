import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    if (role !== "AGENCY") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const clientName = String(form.get("clientName") || "").trim();
    const file = form.get("file") as File | null;

    if (!title) {
      return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
    }
    if (!clientName) {
      return NextResponse.json(
        { error: "CLIENT_NAME_REQUIRED" },
        { status: 400 }
      );
    }

    // For now we don't persist the file; it is only used to seed the title.
    // eslint-disable-next-line no-console
    console.log("INTAKE_FILE_REQUEST", {
      title,
      clientName,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file && "size" in file ? (file as any).size : undefined,
    });

    const trimmedClientName = clientName.trim();
    const normalized = trimmedClientName.toLowerCase();

    let client = await prisma.client.findFirst({
      where: {
        name: {
          equals: trimmedClientName,
        },
      },
    });

    if (!client) {
      const candidates = await prisma.client.findMany({
        select: { id: true, name: true, status: true },
      });
      const existing = candidates.find(
        (c) => (c.name || "").trim().toLowerCase() === normalized
      );
      if (existing) {
        client = existing as typeof client;
      }
    }

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: trimmedClientName,
          status: "ACTIVE",
        },
      });
    }

    const requisition = await prisma.requisition.create({
      data: {
        clientId: client.id,
        title,
      },
    });

    return NextResponse.json({
      client,
      requisition,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("INTAKE_FILE_ERROR", err);
    return NextResponse.json(
      {
        error: "INTAKE_FILE_500",
        message:
          err instanceof Error ? err.message : err != null ? String(err) : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}

