"use client";

import * as React from "react";
import Link from "next/link";
import InlineEditableText from "@/components/ui/InlineEditableText";

type ClientRow = {
  id: string;
  name: string;
  status: string;
  _count: { requisitions: number };
};

export default function ClientsPageClient() {
  const [clients, setClients] = React.useState<ClientRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState("ACTIVE");
  const [submitting, setSubmitting] = React.useState(false);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const loadClients = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load clients");
      }
      const data = (await res.json()) as { clients: ClientRow[] };
      setClients(data.clients);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRename = React.useCallback(
    async (clientId: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        throw new Error("Client name is required.");
      }

      const previous = clients;
      // Optimistic update
      setClients((current) =>
        current.map((c) => (c.id === clientId ? { ...c, name: trimmed } : c))
      );

      try {
        const res = await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to update client name");
        }
        if (data.client) {
          setClients((current) =>
            current.map((c) =>
              c.id === clientId
                ? {
                    ...c,
                    name: data.client.name ?? trimmed,
                    status: data.client.status ?? c.status,
                    _count:
                      data.client._count && data.client._count.requisitions != null
                        ? { requisitions: data.client._count.requisitions }
                        : c._count,
                  }
                : c
            )
          );
        }
      } catch (err) {
        setClients(previous);
        throw err instanceof Error
          ? err
          : new Error("Failed to update client name");
      }
    },
    [clients]
  );

  React.useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Client name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to create client");
      }
      setName("");
      setStatus("ACTIVE");
      setShowForm(false);
      setMessage("Client created.");
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (client: ClientRow) => {
    if (client.status === "INACTIVE") return;
    const confirmArchive = window.confirm(
      client._count.requisitions > 0
        ? "Archive this client? Existing requisitions will remain linked."
        : "Archive this client?"
    );
    if (!confirmArchive) return;

    setArchivingId(client.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to archive client");
      }
      setMessage("Client archived.");
      await loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive client");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 600 }}>Clients</h1>
      <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#64748b" }}>
        Manage client accounts and see which ones have active requisitions.
      </p>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={{
            fontSize: 13,
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#fff",
            color: "#0369a1",
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "Add Client"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: 24,
            padding: 16,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            maxWidth: 480,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              Client name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: "100%",
                fontSize: 14,
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                fontSize: 14,
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid #cbd5e1",
              }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting}
            style={{
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: submitting ? "#e5e7eb" : "#fff",
              color: "#0369a1",
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting ? "Saving..." : "Save client"}
          </button>
        </form>
      )}

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          background: "#f8fafc",
          padding: 24,
          maxWidth: 800,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>Client</th>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>
                Active Reqs
              </th>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: "16px 0", color: "#64748b" }}>
                  Loading clients…
                </td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "16px 0", color: "#64748b" }}>
                  No clients yet. Add your first client above.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 0" }}>
                    <Link
                      href={`/clients/${client.id}`}
                      style={{ color: "#0369a1", textDecoration: "none" }}
                    >
                      <InlineEditableText
                        value={client.name}
                        onSave={(newName) => handleRename(client.id, newName)}
                      />
                    </Link>
                  </td>
                  <td style={{ padding: "8px 0", color: "#475569" }}>{client.status}</td>
                  <td style={{ padding: "8px 0", color: "#475569" }}>
                    {client._count.requisitions}
                  </td>
                  <td style={{ padding: "8px 0" }}>
                    <button
                      type="button"
                      onClick={() => handleArchive(client)}
                      disabled={archivingId === client.id}
                      style={{
                        fontSize: 13,
                        padding: "4px 10px",
                        borderRadius: 999,
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        color: "#64748b",
                        cursor: archivingId === client.id ? "default" : "pointer",
                      }}
                    >
                      {client.status === "INACTIVE"
                        ? "Archived"
                        : archivingId === client.id
                        ? "Archiving…"
                        : "Archive"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 16, marginBottom: 0 }}>
        <Link href="/dashboard" style={{ color: "#0369a1", textDecoration: "none", fontSize: 14 }}>
          ← Back to Dashboard
        </Link>
      </p>
    </div>
  );
}

