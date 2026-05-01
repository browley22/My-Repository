import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "demo1234";
const AGENCY_EMAIL = "agency@demo.com";
const CLIENT_EMAIL = "client@demo.com";
const CLIENT_NAME = "Demo Client";
const REQUISITION_TITLE = "Demo Role";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const agencyUser = await prisma.user.upsert({
    where: { email: AGENCY_EMAIL },
    create: {
      email: AGENCY_EMAIL,
      role: "AGENCY",
      passwordHash,
    },
    update: { passwordHash },
  });

  let clientRecord = await prisma.client.findFirst({
    where: { name: CLIENT_NAME },
  });
  if (!clientRecord) {
    clientRecord = await prisma.client.create({
      data: {
        name: CLIENT_NAME,
        status: "ACTIVE",
      },
    });
  }

  const clientUser = await prisma.user.upsert({
    where: { email: CLIENT_EMAIL },
    create: {
      email: CLIENT_EMAIL,
      role: "CLIENT",
      clientId: clientRecord.id,
      passwordHash,
    },
    update: {
      passwordHash,
      clientId: clientRecord.id,
    },
  });

  let requisition = await prisma.requisition.findFirst({
    where: { clientId: clientRecord.id, title: REQUISITION_TITLE },
  });
  if (!requisition) {
    requisition = await prisma.requisition.create({
      data: {
        clientId: clientRecord.id,
        title: REQUISITION_TITLE,
        location: "Remote",
      },
    });
  }

  const candidateA = await prisma.candidate.upsert({
    where: { id: "dev-demo-candidate-a" },
    create: {
      id: "dev-demo-candidate-a",
      firstName: "Demo",
      lastName: "Candidate A",
      title: "Engineer",
      isLiveForClient: true,
    },
    update: { isLiveForClient: true },
  });

  const candidateB = await prisma.candidate.upsert({
    where: { id: "dev-demo-candidate-b" },
    create: {
      id: "dev-demo-candidate-b",
      firstName: "Demo",
      lastName: "Candidate B",
      title: "Designer",
      isLiveForClient: false,
    },
    update: { isLiveForClient: false },
  });

  const existingSubA = await prisma.submission.findFirst({
    where: { requisitionId: requisition.id, candidateId: candidateA.id },
  });
  if (!existingSubA) {
    await prisma.submission.create({
      data: {
        requisitionId: requisition.id,
        candidateId: candidateA.id,
        status: "SUBMITTED",
      },
    });
  }

  const existingSubB = await prisma.submission.findFirst({
    where: { requisitionId: requisition.id, candidateId: candidateB.id },
  });
  if (!existingSubB) {
    await prisma.submission.create({
      data: {
        requisitionId: requisition.id,
        candidateId: candidateB.id,
        status: "SUBMITTED",
      },
    });
  }

  return NextResponse.json({
    ok: true,
    agencyEmail: AGENCY_EMAIL,
    clientEmail: CLIENT_EMAIL,
    password: DEMO_PASSWORD,
  });
}
