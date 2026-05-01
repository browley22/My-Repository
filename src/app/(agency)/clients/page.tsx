import { getServerSession } from "next-auth";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import ClientsPageClient from "@/components/ClientsPageClient";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div style={{ padding: 40 }}>
        <p>Please log in.</p>
        <a href="/api/auth/signin">Sign in</a>
      </div>
    );
  }

  return <ClientsPageClient />;
}

