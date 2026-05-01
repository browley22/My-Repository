import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";
import DashboardClient from "@/components/DashboardClient";

const prisma = new PrismaClient();

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>You are not logged in</h1>
        <a href="/api/auth/signin">Go to Sign In</a>
      </div>
    );
  }

  const role = (session.user as { role?: string })?.role;
  if (role === "CLIENT") {
    redirect("/client/dashboard");
  }

  const requisitions = await prisma.requisition.findMany({
    include: {
      client: true,
      submissions: { select: { status: true } },
    },
    orderBy: [
      { client: { name: "asc" } },
      { title: "asc" },
    ],
  });

  const openRequisitions = requisitions.filter(
    (req) =>
      req.submissions.length === 0 ||
      req.submissions.some((s) => s.status !== "CLOSED" && s.status !== "DECLINED")
  );

  const byClient = openRequisitions.reduce(
    (acc, req) => {
      const id = req.client.id;
      if (!acc[id]) {
        acc[id] = { clientId: id, clientName: req.client.name, requisitions: [] };
      }
      acc[id].requisitions.push({ id: req.id, title: req.title });
      return acc;
    },
    {} as Record<string, { clientId: string; clientName: string; requisitions: { id: string; title: string }[] }>
  );
  const clientGroups = Object.values(byClient);

  return (
    <DashboardClient
      clientGroups={clientGroups}
      userEmail={session.user?.email ?? ""}
      userRole={(session.user as { role?: string })?.role ?? ""}
    />
  );
}
