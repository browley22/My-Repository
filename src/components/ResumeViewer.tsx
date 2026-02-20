"use client";

import * as React from "react";
import { createPortal } from "react-dom";

function isPdfUrl(url: string): boolean {
  if (!url) return false;
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".pdf");
}

function isDocxUrl(url: string): boolean {
  if (!url) return false;
  const p = url.split("?")[0].toLowerCase();
  return p.endsWith(".docx") || p.endsWith(".doc");
}

export default function ResumeViewer({
  open,
  onClose,
  resumeUrl,
  resumeFilename,
  candidateName,
  resumeText: resumeTextProp,
  candidateId,
  onPreviewGenerated,
}: {
  open: boolean;
  onClose: () => void;
  resumeUrl: string | null;
  resumeFilename?: string | null;
  candidateName?: string | null;
  resumeText?: string | null;
  candidateId?: string | null;
  onPreviewGenerated?: (text: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [localResumeText, setLocalResumeText] = React.useState<string | null>(null);
  const [extractLoading, setExtractLoading] = React.useState(false);
  const [extractError, setExtractError] = React.useState<string | null>(null);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) {
      setLocalResumeText(null);
      setExtractError(null);
    }
  }, [open]);

  const resumeText = localResumeText ?? resumeTextProp;
  const hasText = typeof resumeText === "string" && resumeText.trim().length > 0;
  const isPdf = resumeUrl ? isPdfUrl(resumeUrl) : false;
  const isDocx = resumeUrl ? isDocxUrl(resumeUrl) : false;
  const canGeneratePreview = !hasText && !!candidateId && !!resumeUrl && isDocx;
  const title = candidateName ? `Resume: ${candidateName}` : "Resume";
  const subtitle = hasText ? " (Extracted text preview)" : null;

  const handleGeneratePreview = React.useCallback(async () => {
    if (!candidateId) return;
    setExtractError(null);
    setExtractLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/resume/extract`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error && data?.detail ? `${data.error} — ${data.detail}` : data?.error || "Extraction failed";
        setExtractError(msg);
        return;
      }
      const text = typeof data?.resumeText === "string" ? data.resumeText : "";
      setLocalResumeText(text);
      onPreviewGenerated?.(text);
    } finally {
      setExtractLoading(false);
    }
  }, [candidateId, onPreviewGenerated]);

  const handleDownload = React.useCallback(() => {
    if (!resumeUrl) return;
    const a = document.createElement("a");
    a.href = resumeUrl;
    a.download = resumeFilename || "resume.pdf";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [resumeUrl, resumeFilename]);

  let content: React.ReactNode;
  if (hasText) {
    content = (
      <>
        <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", minHeight: 200 }}>
          <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {resumeText}
          </pre>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {resumeUrl && (
            <>
              <a href={resumeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#2563eb", textDecoration: "underline" }}>
                Open in new tab
              </a>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: "8px 16px",
                  fontSize: 14,
                  border: "1px solid #d1d5db",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  color: "#374151",
                }}
              >
                Download
              </button>
            </>
          )}
        </div>
      </>
    );
  } else if (resumeUrl && isPdf) {
    content = (
      <>
        <div style={{ flex: 1, minHeight: 300, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
          <iframe
            src={resumeUrl}
            title="Resume preview"
            style={{ width: "100%", height: "100%", minHeight: 400, border: 0 }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <a href={resumeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#2563eb", textDecoration: "underline" }}>
            Open in new tab
          </a>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              color: "#374151",
            }}
          >
            Download
          </button>
        </div>
      </>
    );
  } else if (resumeUrl) {
    content = (
      <>
        <p style={{ fontSize: 14, color: "#6b7280" }}>Preview not available for this file type yet.</p>
        {canGeneratePreview && (
          <p style={{ marginTop: 8, fontSize: 13 }}>
            <button
              type="button"
              onClick={handleGeneratePreview}
              disabled={extractLoading}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: extractLoading ? "not-allowed" : "pointer",
                color: "#2563eb",
                textDecoration: "underline",
                fontSize: 13,
              }}
            >
              {extractLoading ? "Extracting…" : "Extract text (for old uploads)"}
            </button>
            {extractError && <span style={{ marginLeft: 8, color: "#dc2626" }}>{extractError}</span>}
          </p>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          <a href={resumeUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, color: "#2563eb", textDecoration: "underline" }}>
            Open in new tab
          </a>
          <a
            href={resumeUrl}
            download={resumeFilename || true}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              color: "#374151",
              textDecoration: "none",
            }}
          >
            Download
          </a>
        </div>
      </>
    );
  } else {
    content = <p style={{ fontSize: 14, color: "#6b7280" }}>No resume available.</p>;
  }

  return mounted && open
    ? createPortal(
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
          onClick={onClose}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              maxWidth: 700,
              maxHeight: "85vh",
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
              {title}
              {subtitle && <span style={{ fontSize: 14, fontWeight: 400, color: "#6b7280" }}>{subtitle}</span>}
            </h2>
              <button
                type="button"
                onClick={onClose}
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
            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              {content}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
