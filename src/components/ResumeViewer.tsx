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

const btnSecondary = {
  padding: "8px 14px",
  fontSize: 14,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer" as const,
  color: "#374151",
  textDecoration: "none" as const,
};

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
  const autoExtractDoneRef = React.useRef(false);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) {
      setLocalResumeText(null);
      setExtractError(null);
      autoExtractDoneRef.current = false;
    }
  }, [open]);

  const resumeText = localResumeText ?? resumeTextProp;
  const hasText = typeof resumeText === "string" && resumeText.trim().length > 0;
  const isPdf = resumeUrl ? isPdfUrl(resumeUrl) : false;
  const isDocx = resumeUrl ? isDocxUrl(resumeUrl) : false;
  const shouldAutoExtract = open && !hasText && !!candidateId && !!resumeUrl && isDocx;

  const runExtract = React.useCallback(async () => {
    if (!candidateId) return;
    setExtractError(null);
    setExtractLoading(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/resume/extract`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExtractError("Couldn't generate preview");
        return;
      }
      const text = typeof data?.resumeText === "string" ? data.resumeText : "";
      setLocalResumeText(text);
      onPreviewGenerated?.(text);
    } catch {
      setExtractError("Couldn't generate preview");
    } finally {
      setExtractLoading(false);
    }
  }, [candidateId, onPreviewGenerated]);

  React.useEffect(() => {
    if (!shouldAutoExtract || autoExtractDoneRef.current) return;
    autoExtractDoneRef.current = true;
    runExtract();
  }, [shouldAutoExtract, runExtract]);

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

  const title = candidateName ? `Resume: ${candidateName}` : "Resume";

  let body: React.ReactNode;
  if (extractLoading && !hasText) {
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "32px 24px", color: "#6b7280", fontSize: 14 }}>
        <span style={{ width: 20, height: 20, border: "2px solid #e5e7eb", borderTopColor: "#111827", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Preparing preview…
      </div>
    );
  } else if (hasText) {
    body = (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          background: "#f9fafb",
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          minHeight: 200,
          maxWidth: "100%",
          lineHeight: 1.6,
        }}
      >
        <pre style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>
          {resumeText}
        </pre>
      </div>
    );
  } else if (resumeUrl && isPdf) {
    body = (
      <>
        <div style={{ flex: 1, minHeight: 300, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#f9fafb" }}>
          <iframe src={resumeUrl} title="Resume preview" style={{ width: "100%", height: "100%", minHeight: 400, border: 0 }} />
        </div>
      </>
    );
  } else if (resumeUrl) {
    body = (
      <div style={{ padding: "32px 24px", textAlign: "center" }}>
        {extractError ? (
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Couldn&apos;t generate preview.</p>
        ) : (
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Preview not available for this file type.</p>
        )}
        <p style={{ fontSize: 13, color: "#9ca3af" }}>Use Download or Open in new tab above.</p>
      </div>
    );
  } else {
    body = <p style={{ padding: 24, fontSize: 14, color: "#6b7280" }}>No resume available.</p>;
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
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
                gap: 12,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827", flex: "1 1 auto", minWidth: 0 }}>
                {title}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {resumeUrl && (
                  <>
                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnSecondary }}>
                      Open in new tab
                    </a>
                    <button type="button" onClick={handleDownload} style={btnSecondary}>
                      Download
                    </button>
                  </>
                )}
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
            </div>
            <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {body}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
