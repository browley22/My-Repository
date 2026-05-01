import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { requisitions: true } } },
  });

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, status } = body as { name?: string; status?: string };
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  }

  const normalizedStatus = (status ?? "ACTIVE").trim().toUpperCase();
  if (normalizedStatus !== "ACTIVE" && normalizedStatus !== "INACTIVE") {
    return NextResponse.json({ error: "Status must be ACTIVE or INACTIVE." }, { status: 400 });
  }

  try {
    const client = await prisma.client.create({
      data: {
        name: trimmed,
        status: normalizedStatus,
      },
    });
    return NextResponse.json(
      {
        client: {
          ...client,
          _count: { requisitions: 0 },
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A client with that name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create client." }, { status: 500 });
  }
}

