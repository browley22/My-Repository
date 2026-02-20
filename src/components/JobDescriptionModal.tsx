"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/** Read a File as text via FileReader; returns a promise that resolves with the text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

const ACCEPT = ".txt,.md,text/plain";

export default function JobDescriptionModal({
  title,
  requisitionId,
  jobDescription: initialJobDescription,
}: {
  title: string;
  requisitionId: string;
  jobDescription: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [jobDescription, setJobDescription] = React.useState<string | null>(initialJobDescription);
  const [editMode, setEditMode] = React.useState(false);
  const [textareaValue, setTextareaValue] = React.useState("");
  const [droppedFileName, setDroppedFileName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setJobDescription(initialJobDescription);
    setTextareaValue(initialJobDescription ?? "");
    if (!initialJobDescription) {
      setEditMode(true);
      setDroppedFileName(null);
    } else {
      setEditMode(false);
    }
  }, [initialJobDescription, open]);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      readFileAsText(file)
        .then((text) => {
          setTextareaValue(text);
          setDroppedFileName(file.name);
        })
        .catch(() => setSaveMessage("Could not read file."));
    },
    []
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFileAsText(file)
      .then((text) => {
        setTextareaValue(text);
        setDroppedFileName(file.name);
      })
      .catch(() => setSaveMessage("Could not read file."));
    e.target.value = "";
  }, []);

  const saveJd = React.useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    const url = `/api/requisitions/${requisitionId}/job-description`;
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: textareaValue }),
      });
      const raw = await res.text();
      const data = raw ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : {};
      if (!res.ok) {
        console.error("[Save JD] failure", { status: res.status, url, body: raw });
        const serverMsg = data.error || data.details || "Failed to save";
        const detail = data.detail ? ` — ${data.detail}` : "";
        setSaveMessage(`${serverMsg}${detail}`);
        return;
      }
      setJobDescription(data.jobDescription ?? null);
      setEditMode(false);
      setSaveMessage("JD saved");
      setDroppedFileName(null);
      setTimeout(() => setSaveMessage(null), 3000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [requisitionId, textareaValue, router]);

  const showEmptyState = !jobDescription && editMode;
  const showReadOnly = jobDescription && !editMode;
  const showEditArea = editMode;

  const panelContent = (
    <div
      style={{
        padding: "24px",
        overflowY: "auto",
        flex: 1,
      }}
    >
      {showEmptyState && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: "2px dashed #d1d5db",
              borderRadius: 8,
              padding: 24,
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 16,
              background: "#f9fafb",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <span style={{ fontSize: 14, color: "#6b7280" }}>
              Drag & drop JD (.txt) here or click to upload
            </span>
          </div>
          {droppedFileName && (
            <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>
              {droppedFileName}{" "}
              <button
                type="button"
                onClick={() => {
                  setDroppedFileName(null);
                  setTextareaValue("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#6b7280",
                  textDecoration: "underline",
                }}
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {showEditArea && (
        <>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
            {jobDescription ? "Edit job description" : "Or paste JD text"}
          </label>
          <textarea
            value={textareaValue}
            onChange={(e) => setTextareaValue(e.target.value)}
            placeholder="Paste or type job description…"
            rows={12}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 14,
              lineHeight: 1.5,
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={saveJd}
              disabled={saving}
              style={{
                padding: "8px 16px",
                background: saving ? "#9ca3af" : "#111827",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              {saving ? "Saving…" : "Save JD"}
            </button>
            {jobDescription && (
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setTextareaValue(jobDescription);
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "#6b7280",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            )}
            {saveMessage && (
              <span style={{ fontSize: 13, color: saveMessage === "JD saved" ? "#059669" : "#dc2626" }}>
                {saveMessage}
              </span>
            )}
          </div>
        </>
      )}

      {showReadOnly && (
        <>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#374151",
              whiteSpace: "pre-wrap",
            }}
          >
            {jobDescription}
          </div>
          <button
            type="button"
            onClick={() => {
              setEditMode(true);
              setTextareaValue(jobDescription);
            }}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "none",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              color: "#374151",
            }}
          >
            Edit
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: 24,
          fontWeight: 600,
          color: "#111827",
          textDecoration: "underline",
          textDecorationColor: "#d1d5db",
          textUnderlineOffset: 4,
        }}
      >
        {title}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                background: "white",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                maxWidth: 600,
                maxHeight: "80vh",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>
                  Job Description: {title}
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "#6b7280",
                    padding: 0,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
              {panelContent}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
