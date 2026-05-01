import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getClientForSession } from "../../resolve-client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function ClientRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: requisitionId } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <h1>You are not logged in</h1>
        <a href="/api/auth/signin">Go to Sign In</a>
      </div>
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "CLIENT") {
    return (
      <div style={{ padding: 40 }}>
        <h1>Access denied</h1>
        <p>This page is for client users only.</p>
      </div>
    );
  }

  const { client } = await getClientForSession(session);
  if (!client) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Role</h1>
        <p>No client record found for this login.</p>
      </div>
    );
  }

  const requisition = await prisma.requisition.findFirst({
    where: {
      id: requisitionId,
      clientId: client.id,
    },
  });

  if (!requisition) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Role not found</h1>
        <p>This role doesn’t exist or you don’t have access to it.</p>
        <Link href="/client/requisitions" style={{ fontSize: 14, color: "#0369a1" }}>
          ← Back to roles
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/client/requisitions"
          style={{ fontSize: 13, color: "#64748b", textDecoration: "none", marginBottom: 8, display: "inline-block" }}
        >
          ← Back to roles
        </Link>
        <h1 style={{ margin: "8px 0 0 0", fontSize: 22, fontWeight: 600, color: "#111827" }}>
          {requisition.title}
        </h1>
        {requisition.location && (
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
            {requisition.location}
          </p>
        )}
      </div>
      <div
        style={{
          padding: 32,
          border: "1px dashed #e2e8f0",
          borderRadius: 10,
          textAlign: "center",
          color: "#64748b",
          fontSize: 14,
        }}
      >
        Role workspace coming next.
      </div>
    </div>
  );
}
