import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import Link from "next/link";

export default async function ProductivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div style={{ padding: 40 }}>
        <p>Please log in.</p>
        <a href="/api/auth/signin">Sign in</a>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 600 }}>
        Productivity
      </h1>
      <p style={{ margin: "0 0 24px 0", fontSize: 14, color: "#64748b" }}>
        Coming soon. Recruiter productivity metrics (submissions, interviews,
        offers, placements) will appear here.
      </p>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          padding: 24,
          maxWidth: 640,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>
                Recruiter
              </th>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>
                Submissions
              </th>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>
                Placements
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={3} style={{ padding: "24px 0", color: "#64748b" }}>
                No data to display yet.
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 16, marginBottom: 0 }}>
          <Link
            href="/dashboard"
            style={{ color: "#0369a1", textDecoration: "none", fontSize: 14 }}
          >
            ← Back to Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
