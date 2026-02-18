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
  });

  return (
    <div style={{ padding: 40 }}>
      <h1>CVRenova Dashboard</h1>
      <p>Logged in as: {session.user?.email}</p>
      <p>Role: {(session.user as any)?.role}</p>

      <hr />

      <h2>Requisitions</h2>

      <ul>
        {requisitions.map((req) => (
          <li key={req.id}>
            <a href={`/requisitions/${req.id}`}>
              <strong>{req.title}</strong> — {req.client.name}
            </a>
          </li>
        ))}
      </ul>

      <br />
      <a href="/api/auth/signout">Sign Out</a>
    </div>
  );
}
