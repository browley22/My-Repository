import { getServerSession } from "next-auth";
import { authOptions } from "./api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>You are not logged in</h1>
        <a href="/api/auth/signin">Go to Sign In</a>
      </div>
    );
  }

  const requisitions = await prisma.requisition.findMany({
    include: { client: true },
    orderBy: [
      { client: { name: "asc" } },
      { title: "asc" },
    ],
  });

  // Group requisitions by company
  const requisitionsByCompany = requisitions.reduce((acc, req) => {
    const companyName = req.client.name;
    if (!acc[companyName]) {
      acc[companyName] = [];
    }
    acc[companyName].push(req);
    return acc;
  }, {} as Record<string, typeof requisitions>);

  return (
    <div style={{ padding: 40 }}>
      <h1>CVRenova Dashboard</h1>
      <p>Logged in as: {session.user?.email}</p>
      <p>Role: {(session.user as any)?.role}</p>

      <hr />

      <h2>Requisitions</h2>

      {Object.entries(requisitionsByCompany).map(([companyName, companyRequisitions]) => (
        <div key={companyName} style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>{companyName}</h3>
          <ul style={{ marginLeft: 20, marginTop: 0 }}>
            {companyRequisitions.map((req) => (
              <li key={req.id} style={{ marginBottom: 4 }}>
                <a href={`/requisitions/${req.id}`} style={{ textDecoration: "none", color: "#0369a1" }}>
                  {req.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <br />
      <a href="/api/auth/signout">Sign Out</a>
    </div>
  );
}
