import { PrismaClient, Role, SubmissionStatus, DecisionType, DeclineReason } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
    datasourceUrl: "file:./dev.db",
});

async function main() {
  console.log("Seeding database...");

  // Clean database in safe order
  await prisma.decisionEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.requisition.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();

  // Create client
  const client = await prisma.client.create({
    data: {
      name: "Acme Co",
    },
  });

  // Create users
  const passwordHash = await bcrypt.hash("Demo123!", 10);

  const agencyUser = await prisma.user.create({
    data: {
      email: "agency@demo.com",
      name: "Agency Demo",
      role: Role.AGENCY,
      passwordHash,
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      email: "client@demo.com",
      name: "Client Demo",
      role: Role.CLIENT,
      clientId: client.id,
      passwordHash,
    },
  });

  // Create requisitions
  const req1 = await prisma.requisition.create({
    data: {
      clientId: client.id,
      title: "Data Analyst",
      location: "Columbus, OH",
    },
  });

  const req2 = await prisma.requisition.create({
    data: {
      clientId: client.id,
      title: "Project Manager",
      location: "Remote",
    },
  });

  // Create candidates
  await prisma.candidate.createMany({
    data: [
      {
        firstName: "Jason",
        lastName: "Miller",
        title: "Data Analyst",
        location: "Columbus, OH",
        yearsExp: 5,
        rate: "$60/hr",
        availability: "2 weeks",
      },
      {
        firstName: "Ava",
        lastName: "Nguyen",
        title: "Senior Data Analyst",
        location: "Remote",
        yearsExp: 8,
        rate: "$75/hr",
        availability: "Immediate",
      },
      {
        firstName: "Marcus",
        lastName: "Reed",
        title: "Project Manager",
        location: "Cincinnati, OH",
        yearsExp: 7,
        rate: "$85/hr",
        availability: "3 weeks",
      },
      {
        firstName: "Priya",
        lastName: "Shah",
        title: "Technical PM",
        location: "Remote",
        yearsExp: 10,
        rate: "$95/hr",
        availability: "Immediate",
      },
      {
        firstName: "Elena",
        lastName: "Garcia",
        title: "Business Analyst",
        location: "Columbus, OH",
        yearsExp: 4,
        rate: "$55/hr",
        availability: "1 week",
      },
      {
        firstName: "Noah",
        lastName: "Kim",
        title: "Data Analyst",
        location: "Remote",
        yearsExp: 3,
        rate: "$50/hr",
        availability: "Immediate",
      },
    ],
  });

  const allCandidates = await prisma.candidate.findMany();

  // Create submissions
  const submissions = await Promise.all([
    prisma.submission.create({
      data: {
        requisitionId: req1.id,
        candidateId: allCandidates[0].id,
        status: SubmissionStatus.SUBMITTED,
      },
    }),
    prisma.submission.create({
      data: {
        requisitionId: req1.id,
        candidateId: allCandidates[1].id,
        status: SubmissionStatus.UNDER_REVIEW,
      },
    }),
    prisma.submission.create({
      data: {
        requisitionId: req2.id,
        candidateId: allCandidates[2].id,
        status: SubmissionStatus.INTERVIEW_REQUESTED,
      },
    }),
    prisma.submission.create({
      data: {
        requisitionId: req2.id,
        candidateId: allCandidates[3].id,
        status: SubmissionStatus.OFFER_PENDING,
      },
    }),
    prisma.submission.create({
      data: {
        requisitionId: req1.id,
        candidateId: allCandidates[4].id,
        status: SubmissionStatus.DECLINED,
      },
    }),
    prisma.submission.create({
      data: {
        requisitionId: req2.id,
        candidateId: allCandidates[5].id,
        status: SubmissionStatus.SUBMITTED,
      },
    }),
  ]);

  // Add decision events
  await prisma.decisionEvent.createMany({
    data: [
      {
        submissionId: submissions[2].id,
        type: DecisionType.REQUEST_INTERVIEW,
      },
      {
        submissionId: submissions[3].id,
        type: DecisionType.MAKE_OFFER,
        note: "Prepare offer package",
      },
      {
        submissionId: submissions[4].id,
        type: DecisionType.DECLINE,
        declineReason: DeclineReason.SKILL_MISMATCH,
        note: "Need stronger stakeholder management experience",
      },
    ],
  });

  // Add messages
  await prisma.message.createMany({
    data: [
      {
        submissionId: submissions[2].id,
        fromRole: Role.CLIENT,
        body: "Can you confirm availability for next week?",
      },
      {
        submissionId: submissions[2].id,
        fromRole: Role.AGENCY,
        body: "Yes — candidate is available starting Monday.",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Demo users:");
  console.log("agency@demo.com / Demo123!");
  console.log("client@demo.com / Demo123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
