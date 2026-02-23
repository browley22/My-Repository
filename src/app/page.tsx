import Link from "next/link";
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

  // Group requisitions by client (id) for stable keys and client link
  const byClient = requisitions.reduce((acc, req) => {
    const id = req.client.id;
    if (!acc[id]) {
      acc[id] = { clientId: id, clientName: req.client.name, requisitions: [] };
    }
    acc[id].requisitions.push(req);
    return acc;
  }, {} as Record<string, { clientId: string; clientName: string; requisitions: typeof requisitions }>);
  const clientGroups = Object.values(byClient);

  return (
    <div style={{ padding: 40 }}>
      <style>{`.client-name-link:hover { text-decoration: underline; }`}</style>
      <h1>CVRenova Dashboard</h1>
      <p>Logged in as: {session.user?.email}</p>
      <p>Role: {(session.user as any)?.role}</p>

      <hr />

      <h2>Requisitions</h2>

      {clientGroups.map(({ clientId, clientName, requisitions: companyRequisitions }) => (
        <div key={clientId} style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
            <Link
              href={`/clients/${clientId}`}
              style={{
                color: "#0369a1",
                textDecoration: "none",
                fontWeight: 600,
              }}
              className="client-name-link"
            >
              {clientName}
            </Link>
          </h3>
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
