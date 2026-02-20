"use client";

import * as React from "react";
import { createPortal } from "react-dom";

export default function JobDescriptionModal({
  title,
  jobDescription,
}: {
  title: string;
  jobDescription: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

      {mounted && open && createPortal(
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
            <div
              style={{
                padding: "24px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {jobDescription ? (
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
              ) : (
                <div style={{ fontSize: 14, color: "#9ca3af", fontStyle: "italic" }}>
                  No job description available.
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
