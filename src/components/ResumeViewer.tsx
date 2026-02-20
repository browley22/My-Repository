"use client";

import * as React from "react";
import { createPortal } from "react-dom";

function isPdfUrl(url: string): boolean {
  if (!url) return false;
  const path = url.split("?")[0].toLowerCase();
  return path.endsWith(".pdf");
}

export default function ResumeViewer({
  open,
  onClose,
  resumeUrl,
  resumeFilename,
  candidateName,
  resumeText,
}: {
  open: boolean;
  onClose: () => void;
  resumeUrl: string;
  resumeFilename?: string | null;
  candidateName?: string | null;
  resumeText?: string | null;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isPdf = isPdfUrl(resumeUrl);
  const title = candidateName ? `Resume: ${candidateName}` : "Resume";

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

  const content = !resumeUrl ? (
    <p style={{ fontSize: 14, color: "#6b7280" }}>No resume URL provided.</p>
  ) : isPdf ? (
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
  ) : resumeText ? (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
        <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {resumeText}
        </pre>
      </div>
      <div style={{ marginTop: 12 }}>
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
  ) : (
    <>
      <p style={{ fontSize: 14, color: "#6b7280" }}>Preview not available. Use Download.</p>
      <button
        type="button"
        onClick={handleDownload}
        style={{
          marginTop: 8,
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
  );

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
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111827" }}>{title}</h2>
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
