"use client";

import * as React from "react";
import Link from "next/link";
import type { PeekLane } from "@/app/api/requisitions/[id]/peek/route";

type ReqItem = { id: string; title: string };
type ClientGroup = { clientId: string; clientName: string; requisitions: ReqItem[] };

type IntakePromptState = {
  open: boolean;
  title: string;
  file?: File;
};

const HIDE_DELAY_MS = 120;
const PREVIEW_MAX_HEIGHT = 280;

function InlineReqPreview({
  lanes,
  loading,
}: {
  lanes: PeekLane[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: expanded ? PREVIEW_MAX_HEIGHT : 0,
        opacity: expanded ? 1 : 0,
        transition: "max-height 220ms ease-out, opacity 180ms ease-out",
      }}
    >
      <div
        style={{
          marginTop: 6,
          padding: "10px 12px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          fontSize: 12,
          color: "#0f172a",
        }}
      >
        {loading ? (
          <div style={{ color: "#64748b", padding: "4px 0" }}>Loading…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lanes.map((lane) => (
              <div key={lane.status}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ color: "#64748b" }}>{lane.label}</span>
                  <span style={{ fontWeight: 600, color: "#0f172a" }}>{lane.count}</span>
                </div>
                {lane.candidates.length > 0 && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                    {lane.candidates.slice(0, 2).map((c) => c.name).join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardClient({
  clientGroups,
  userEmail,
  userRole,
}: {
  clientGroups: ClientGroup[];
  userEmail?: string;
  userRole?: string;
}) {
  const [hoveredReqId, setHoveredReqId] = React.useState<string | null>(null);
  const [peekCache, setPeekCache] = React.useState<Record<string, { lanes: PeekLane[] }>>({});
  const [loadingReqId, setLoadingReqId] = React.useState<string | null>(null);
  const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [groups, setGroups] = React.useState<ClientGroup[]>(clientGroups);
  const [intakeHover, setIntakeHover] = React.useState(false);
  const [intakeError, setIntakeError] = React.useState<string | null>(null);
  const [intakePrompt, setIntakePrompt] = React.useState<IntakePromptState | null>(null);
  const [promptTitle, setPromptTitle] = React.useState("");
  const [promptClientName, setPromptClientName] = React.useState("");
  const [promptSubmitting, setPromptSubmitting] = React.useState(false);
  const [trashHover, setTrashHover] = React.useState(false);
  const [trashMouseHover, setTrashMouseHover] = React.useState(false);
  const intakeBaseRef = React.useRef<ClientGroup[] | null>(null);

  const refreshOpenRequisitions = React.useCallback(async () => {
    window.location.reload();
  }, []);

  React.useEffect(() => {
    setGroups(clientGroups);
  }, [clientGroups]);

  const clearHideTimeout = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = React.useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      hideTimeoutRef.current = null;
      setHoveredReqId(null);
    }, HIDE_DELAY_MS);
  }, [clearHideTimeout]);

  // Fetch peek when hoveredReqId is set and not cached
  React.useEffect(() => {
    if (!hoveredReqId) return;
    if (peekCache[hoveredReqId]) return;

    let cancelled = false;
    setLoadingReqId(hoveredReqId);
    fetch(`/api/requisitions/${hoveredReqId}/peek`)
      .then((res) => {
        if (!res.ok) throw new Error("Peek failed");
        return res.json();
      })
      .then((data: { lanes: PeekLane[] }) => {
        if (!cancelled) {
          setPeekCache((prev) => ({ ...prev, [hoveredReqId!]: { lanes: data.lanes } }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPeekCache((prev) => ({ ...prev, [hoveredReqId!]: { lanes: [] } }));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReqId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hoveredReqId, peekCache]);

  const handleHoverZoneEnter = React.useCallback(
    (reqId: string) => {
      clearHideTimeout();
      setHoveredReqId(reqId);
    },
    [clearHideTimeout]
  );

  const handleHoverZoneLeave = React.useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  React.useEffect(() => () => clearHideTimeout(), [clearHideTimeout]);

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#f8fafc",
    padding: 16,
    flex: 1,
    minWidth: 240,
  };

  const isFileDrag = (dt: DataTransfer | null): boolean => {
    if (!dt) return false;
    if (dt.files && dt.files.length > 0) return true;
    const types = Array.from(dt.types || []);
    return types.includes("Files");
  };

  const parseDropPayload = (
    event: React.DragEvent<HTMLButtonElement | HTMLDivElement>
  ): { title: string; clientName?: string } | null => {
    const dt = event.dataTransfer;
    if (!dt) return null;

    console.log("DT_TYPES", Array.from(dt.types || []));

    const json = dt.getData("application/json");
    if (json) {
      try {
        const parsed = JSON.parse(json) as {
          title?: string;
          jobTitle?: string;
          clientName?: string;
          client?: { name?: string };
        };
        const title = (parsed.title || parsed.jobTitle || "").trim();
        const clientName =
          (parsed.clientName || parsed.client?.name || "").trim() || undefined;
        if (title) {
          return { title, clientName };
        }
      } catch {
        // fall through to text/plain
      }
    }

    const text = dt.getData("text/plain");
    if (!text) return null;
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    const title = lines[0];
    let clientName: string | undefined;
    for (const line of lines) {
      const m = /^client:\s*(.+)$/i.exec(line);
      if (m && m[1].trim()) {
        clientName = m[1].trim();
        break;
      }
    }
    if (title) {
      return { title, clientName };
    }

    const uriList = dt.getData("text/uri-list");
    if (uriList) {
      const first = uriList.split(/\r?\n/)[0]?.trim();
      if (first) {
        return { title: first };
      }
    }

    return null;
  };

  const submitIntake = React.useCallback(
    async (title: string, clientName: string): Promise<boolean> => {
      const trimmedTitle = title.trim();
      const trimmedClient = clientName.trim();
      if (!trimmedTitle) {
        setIntakeError("Position title is required.");
        return false;
      }
      if (!trimmedClient) {
        setIntakeError("Client name is required.");
        return false;
      }

      setIntakeError(null);
      intakeBaseRef.current = groups;
      const base = intakeBaseRef.current ?? groups;
      const lowerName = trimmedClient.toLowerCase();

      // Optimistic UI based on existing data
      let optimistic: ClientGroup[];
      const existing = base.find((g) => g.clientName.toLowerCase() === lowerName);
      if (existing) {
        const tempId = `temp-${Date.now()}`;
        optimistic = base.map((g) =>
          g.clientId === existing.clientId
            ? {
                ...g,
                requisitions: [...g.requisitions, { id: tempId, title: trimmedTitle }],
              }
            : g
        );
      } else {
        const tempClientId = `temp-client-${Date.now()}`;
        optimistic = [
          ...base,
          {
            clientId: tempClientId,
            clientName: trimmedClient,
            requisitions: [{ id: `temp-${Date.now()}`, title: trimmedTitle }],
          },
        ];
      }
      setGroups(optimistic);

      try {
        console.log("INTAKE_BEFORE_FETCH", { trimmedTitle, trimmedClient });
        const res = await fetch("/api/requisitions/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle, clientName: trimmedClient }),
        });
        console.log("INTAKE_AFTER_FETCH", res.status);
        const raw = await res.text();
        console.log("INTAKE_STATUS", res.status);
        console.log("INTAKE_RAW_BODY", raw);
        let data: any = {};
        try {
          if (raw) data = JSON.parse(raw);
        } catch {
          // ignore JSON parse errors; we'll fall back to raw text if needed
        }
        if (!res.ok) {
          const msg =
            data?.message || data?.error || raw || "Unknown error";
          setIntakeError(`Intake failed (${res.status}): ${msg}`);
          setGroups(base);
          return false;
        }
        const client = data.client as { id: string; name: string } | undefined;
        const requisition = data.requisition as { id: string; title: string } | undefined;
        if (!client || !requisition) {
          setGroups(base);
          setIntakeError("Unexpected response from server.");
          return false;
        }

        const finalGroups: ClientGroup[] = (() => {
          const existingById = base.find((g) => g.clientId === client.id);
          const lower = client.name.toLowerCase();
          const existingByName = base.find((g) => g.clientName.toLowerCase() === lower);
          const target = existingById || existingByName;
          const entry: ReqItem = { id: requisition.id, title: requisition.title };
          if (target) {
            return base.map((g) =>
              g.clientId === target.clientId
                ? { ...g, requisitions: [...g.requisitions, entry] }
                : g
            );
          }
          return [
            ...base,
            { clientId: client.id, clientName: client.name, requisitions: [entry] },
          ];
        })();
        setGroups(finalGroups);
        return true;
      } catch (err) {
        setGroups(base);
        setIntakeError(
          err instanceof Error ? err.message : "Failed to create position."
        );
        return false;
      }
    },
    [groups]
  );

  const handleIntake = React.useCallback(
    (parsed: { title: string; clientName?: string } | null) => {
      console.log("handleIntake", parsed);
      setIntakeError(null);
      if (!parsed || !parsed.title || !parsed.title.trim()) {
        setIntakeError("Couldn\u2019t read position data from drop.");
        return;
      }
      const title = parsed.title.trim();
      const clientName = (parsed.clientName || "").trim();
      if (!clientName) {
        setIntakePrompt({ open: true, title });
        setPromptTitle(title);
        setPromptClientName("");
        return;
      }
      void submitIntake(title, clientName);
    },
    [submitIntake]
  );

  const handleIntakeDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      setIntakeHover(false);
      setIntakeError(null);

      const dt = event.dataTransfer;

      console.log("INTAKE_DROP_HANDLER_V2");
      console.log("DROP_TYPES", Array.from(dt?.types || []));
      console.log("DROP_FILES_LEN", dt?.files?.length || 0);

      if (dt?.files && dt.files.length > 0) {
        const file = dt.files[0];

        console.log("INTAKE_FILE_DROP", {
          name: file.name,
          type: file.type,
          size: file.size,
        });

        const baseTitle =
          file.name.replace(/\.[^/.]+$/, "").trim() || "New Position";

        setIntakePrompt({ open: true, title: baseTitle, file });
        setPromptTitle(baseTitle);
        setPromptClientName("");

        return;
      }

      const parsed = parseDropPayload(event);
      console.log("Add Position drop payload:", parsed);

      if (!parsed || !parsed.title || !parsed.title.trim()) {
        setIntakeError("Couldn\u2019t read position data from drop.");
        return;
      }

      const title = parsed.title.trim();
      const clientName = (parsed.clientName || "").trim();

      if (!clientName) {
        setIntakePrompt({ open: true, title });
        setPromptClientName("");
        return;
      }

      void submitIntake(title, clientName);
    },
    [parseDropPayload, submitIntake]
  );

  const handleTrashDrop = React.useCallback(
    async (event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setTrashHover(false);

      const dt = event.dataTransfer;
      if (!dt) return;

      let id: string | undefined;
      const json = dt.getData("application/json");
      if (json) {
        try {
          const parsed = JSON.parse(json) as { id?: string };
          if (parsed?.id) {
            id = parsed.id;
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      if (!id) {
        return;
      }

      const ok = window.confirm("Move requisition to trash (delete)?");
      if (!ok) return;

      console.log("TRASH_DELETE_ID", id);

      const attempts: { label: string; doRequest: () => Promise<Response> }[] = [
        {
          label: "DELETE_QUERY",
          doRequest: () =>
            fetch(`/api/requisitions?id=${encodeURIComponent(id!)}`, {
              method: "DELETE",
            }),
        },
        {
          label: "POST_DELETE_ID",
          doRequest: () =>
            fetch("/api/requisitions/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            }),
        },
        {
          label: "POST_DELETE_REQUISITIONID",
          doRequest: () =>
            fetch("/api/requisitions/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requisitionId: id }),
            }),
        },
      ];

      for (const attempt of attempts) {
        try {
          const res = await attempt.doRequest();
          const text = await res.text();
          // eslint-disable-next-line no-console
          console.log("TRASH_DELETE_ATTEMPT", attempt.label, res.status, text);
          if (res.ok) {
            await refreshOpenRequisitions();
            return;
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log(
            "TRASH_DELETE_ATTEMPT",
            attempt.label,
            "network_error",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      alert("Delete failed (no delete endpoint found). Check API routes.");
    },
    [refreshOpenRequisitions]
  );

  const handlePromptSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      e?.stopPropagation?.();

      if (!intakePrompt) return;
      if (promptSubmitting) return;

      setPromptSubmitting(true);

      try {
        console.log("HANDLE_PROMPT_SUBMIT_FIRED", {
          hasFile: !!intakePrompt.file,
          title: promptTitle,
          clientName: promptClientName,
        });

        if (intakePrompt.file) {
          const formData = new FormData();
          formData.append("file", intakePrompt.file);
          formData.append("title", promptTitle || intakePrompt.title);
          formData.append("clientName", promptClientName || "");

          const res = await fetch("/api/requisitions/intake-file", {
            method: "POST",
            body: formData,
          });

          const text = await res.text();
          console.log("INTAKE_FILE_API_RESPONSE", res.status, text);

          if (!res.ok) {
            throw new Error(text || `Upload failed (${res.status})`);
          }

          await refreshOpenRequisitions();

          setIntakePrompt(null);
          setPromptTitle("");
          setPromptClientName("");
          return;
        }
      } finally {
        setPromptSubmitting(false);
      }
    },
    [intakePrompt, promptTitle, promptClientName, promptSubmitting, refreshOpenRequisitions]
  );

  return (
    <div style={{ padding: 40 }}>
      <style>{`.client-name-link:hover { text-decoration: underline; }`}</style>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#111827" }}>
          CVRenova Dashboard
        </h1>
      </header>

      {/* Clients snapshot + Productivity shortcut cards */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
            Clients snapshot
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
            <li>Total Active Clients: —</li>
            <li>Clients with Active Reqs: —</li>
            <li>Clients w/ Billing Consultants (no reqs): —</li>
          </ul>
          <p style={{ marginTop: 12, marginBottom: 0 }}>
            <Link
              href="/clients"
              style={{ fontSize: 14, color: "#0369a1", textDecoration: "none" }}
            >
              View all clients →
            </Link>
          </p>
        </div>
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 600, color: "#0f172a" }}>
            Recruiter Productivity
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
            See submissions, interviews, offers, placements by recruiter.
          </p>
          <p style={{ marginTop: 12, marginBottom: 0 }}>
            <Link
              href="/productivity"
              style={{ fontSize: 14, color: "#0369a1", textDecoration: "none" }}
            >
              View productivity →
            </Link>
          </p>
        </div>
      </div>

      {intakePrompt?.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxWidth: 360,
              boxShadow:
                "0 20px 25px -5px rgba(15,23,42,0.1), 0 10px 10px -5px rgba(15,23,42,0.04)",
              border: "1px solid #e2e8f0",
            }}
          >
            <h3
              style={{
                margin: "0 0 8px 0",
                fontSize: 16,
                fontWeight: 600,
                color: "#0f172a",
              }}
            >
              Add position
            </h3>
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: 13,
                color: "#64748b",
              }}
            >
              Provide a title and client name for the new position.
            </p>
            <form onSubmit={handlePromptSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    marginBottom: 4,
                    color: "#0f172a",
                  }}
                >
                  Title
                </label>
                <input
                  value={promptTitle}
                  onChange={(e) => setPromptTitle(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: 14,
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    marginBottom: 4,
                    color: "#0f172a",
                  }}
                >
                  Client name
                </label>
                <input
                  value={promptClientName}
                  onChange={(e) => setPromptClientName(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    fontSize: 14,
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>
              {intakePrompt?.file && (
                <div
                  style={{
                    marginBottom: 12,
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  Attached JD file:{" "}
                  <span style={{ fontWeight: 500, color: "#0f172a" }}>
                    {intakePrompt.file.name}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!promptSubmitting) {
                      setIntakePrompt(null);
                      setPromptClientName("");
                    }
                  }}
                  style={{
                    fontSize: 13,
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePromptSubmit}
                  disabled={promptSubmitting}
                  style={{
                    fontSize: 13,
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: "1px solid #0ea5e9",
                    background: promptSubmitting ? "#e0f2fe" : "#0ea5e9",
                    color: "#0f172a",
                    cursor: promptSubmitting ? "default" : "pointer",
                  }}
                >
                  {promptSubmitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
            if (isFileDrag(e.dataTransfer) && !intakeHover) {
              setIntakeHover(true);
            }
          }
        }}
        onDragEnter={(e) => {
          if (isFileDrag(e.dataTransfer) && !intakeHover) {
            setIntakeHover(true);
          }
        }}
        onDragLeave={(e) => {
          const current = e.currentTarget;
          const related = e.relatedTarget as Node | null;
          if (!related || !current.contains(related)) {
            setIntakeHover(false);
          }
        }}
        onDrop={handleIntakeDrop}
        style={{ position: "relative", marginBottom: 24 }}
      >
        {intakeHover && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 12,
              border: "2px dashed #0ea5e9",
              background: "rgba(14,165,233,0.08)",
              pointerEvents: "none",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: "#0369a1",
              fontWeight: 600,
            }}
          >
            Drop job description or position here
          </div>
        )}
        <div
          style={{
            marginTop: 0,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>Open Requisitions</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              style={{
                fontSize: 13,
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid " + (intakeHover ? "#0ea5e9" : "#e2e8f0"),
                background: intakeHover ? "#e0f2fe" : "#fff",
                color: "#0369a1",
                cursor: "pointer",
                transition: "background 120ms ease-out, border-color 120ms ease-out",
              }}
            >
              Add Position
            </button>
            <button
              type="button"
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                if (!trashHover) setTrashHover(true);
              }}
              onDragEnter={(e) => {
                if (!trashHover) setTrashHover(true);
              }}
              onDragLeave={(e) => {
                const current = e.currentTarget;
                const related = e.relatedTarget as Node | null;
                if (!related || !current.contains(related)) {
                  setTrashHover(false);
                }
              }}
              onMouseEnter={() => setTrashMouseHover(true)}
              onMouseLeave={() => {
                setTrashMouseHover(false);
              }}
              onDrop={handleTrashDrop}
              style={{
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 8,
                border:
                  trashHover
                    ? "2px solid #ea580c"
                    : "1px solid #e2e8f0",
                background: trashHover
                  ? "#ffedd5"
                  : trashMouseHover
                    ? "#f1f5f9"
                    : "#f8fafc",
                color: "#b45309",
                cursor: "pointer",
                transition: "background 120ms ease-out, border-color 120ms ease-out",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span aria-hidden>🗑</span>
              Trash
            </button>
          </div>
        </div>
      </div>
      {intakeError && (
        <div
          style={{
            marginBottom: 8,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 12,
          }}
        >
          {intakeError}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {/* Left: requisition list */} 
        <div style={{ flex: 1, minWidth: 520, maxWidth: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {groups.map(({ clientId, clientName, requisitions }) => (
              <div key={clientId}>
                <h3 style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
                  <Link
                    href={`/clients/${clientId}`}
                    style={{ color: "#0369a1", textDecoration: "none", fontWeight: 600 }}
                    className="client-name-link"
                  >
                    {clientName}
                  </Link>
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, listStyle: "none" }}>
                  {requisitions.map((req) => (
                    <li key={req.id} style={{ marginBottom: 4 }}>
                      <div
                        draggable={true}
                        onDragStart={(e) => {
                          const payload = {
                            id: req.id,
                            title: req.title,
                            clientName,
                          };
                          console.log("REAL_REQ_DRAGSTART", payload);
                          if (e.dataTransfer) {
                            e.dataTransfer.clearData();
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify(payload)
                            );
                            e.dataTransfer.setData(
                              "text/plain",
                              `Title: ${req.title}\nClient: ${clientName}`
                            );
                            e.dataTransfer.effectAllowed = "copy";
                          }
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                        }}
                        onMouseEnter={() => handleHoverZoneEnter(req.id)}
                        onMouseLeave={handleHoverZoneLeave}
                      >
                        <Link
                          href={`/requisitions/${req.id}`}
                          draggable={false}
                          style={{ textDecoration: "none", color: "#0369a1", fontSize: 14 }}
                        >
                          {req.title}
                        </Link>
                        {hoveredReqId === req.id && (
                          <InlineReqPreview
                            lanes={peekCache[req.id]?.lanes ?? []}
                            loading={loadingReqId === req.id}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
