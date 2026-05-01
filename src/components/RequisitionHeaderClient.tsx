"use client";

import * as React from "react";
import InlineEditableText from "@/components/ui/InlineEditableText";
import JobDescriptionModal from "@/components/JobDescriptionModal";

type Props = {
  requisitionId: string;
  initialTitle: string;
  clientName: string;
  jobDescription: string | null;
  role: "CLIENT" | "AGENCY";
};

export default function RequisitionHeaderClient({
  requisitionId,
  initialTitle,
  clientName,
  jobDescription,
  role,
}: Props) {
  const [title, setTitle] = React.useState(initialTitle);

  const handleTitleSave = React.useCallback(
    async (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (!trimmed) {
        throw new Error("Title is required.");
      }

      const previous = title;
      setTitle(trimmed);
      try {
        const res = await fetch(`/api/requisitions/${requisitionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to update title");
        }
        if (data.requisition?.title) {
          setTitle(data.requisition.title);
        }
      } catch (err) {
        setTitle(previous);
        throw err instanceof Error
          ? err
          : new Error("Failed to update title");
      }
    },
    [requisitionId, title]
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {role === "AGENCY" ? (
            <InlineEditableText
              value={title}
              onSave={handleTitleSave}
            />
          ) : (
            <span style={{ fontWeight: 600 }}>{title}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <JobDescriptionModal
            title={title}
            requisitionId={requisitionId}
            jobDescription={jobDescription}
          />
          <span style={{ fontSize: 12, color: "#64748b" }}>View JD</span>
        </div>
      </div>
      <p style={{ marginTop: 0, marginBottom: 16 }}>Client: {clientName}</p>
    </>
  );
}

