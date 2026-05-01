import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(ctx.params);
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: "Missing client id" }, { status: 400 });
  }

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
  const data: { name?: string; status?: string } = {};

  if (typeof name === "string") {
    const trimmed = name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Client name is required." }, { status: 400 });
    }
    data.name = trimmed;
  }

  if (typeof status === "string") {
    const normalized = status.trim().toUpperCase();
    if (normalized !== "ACTIVE" && normalized !== "INACTIVE") {
      return NextResponse.json(
        { error: "Status must be ACTIVE or INACTIVE." },
        { status: 400 }
      );
    }
    data.status = normalized;
  }

  if (!data.name && !data.status) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.client.update({
      where: { id },
      data,
      include: { _count: { select: { requisitions: true } } },
    });
    return NextResponse.json({ client: updated });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A client with that name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to update client." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(ctx.params);
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: "Missing client id" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "AGENCY") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { requisitions: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (existing._count.requisitions > 0) {
    return NextResponse.json(
      { error: "Client has requisitions and cannot be deleted. Archive instead." },
      { status: 400 }
    );
  }

  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true }, { status: 200 });
}

