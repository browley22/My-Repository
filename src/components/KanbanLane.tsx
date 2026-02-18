"use client";

import * as React from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type Submission = {
  id: string;
  status: string;
  events?: any[];

  candidate: {
    id?: string;
    firstName: string;
    lastName: string;
    title?: string | null;
    location?: string | null;
    email?: string | null;
    phone?: string | null;
    summary?: string | null;
    resumeUrl?: string | null;
  };
};

type Props = {
  columns: string[];
  submissions: Submission[];
  onMove: (id: string, newStatus: string) => Promise<void>;
  onCardClick?: (submission: Submission) => void;
  now: number;
};

function prettyStatus(s?: string | null) {
  if (!s) return "";
  return String(s)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DraggableCard({
  submission,
  onClick,
}: {
  submission: Submission;
  onClick?: (submission: Submission) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: submission.id,
    });

  const fullName = `${submission.candidate.firstName} ${submission.candidate.lastName}`;

  const latestTransition = submission.events
    ?.filter(
      (e: any) => e.type === "STATUS_CHANGE" && e.fromStatus && e.toStatus
    )
    ?.sort(
      (a: any, b: any) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    )[0];

  const lastChange = latestTransition?.createdAt
    ? new Date(latestTransition.createdAt).getTime()
    : Date.now();

  const lastUpdatedText = new Date(lastChange).toLocaleString();

  const diffMs = Date.now() - lastChange;

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let agingText = "";
  if (days > 0) agingText = `${days} day${days > 1 ? "s" : ""}`;
  else if (hours > 0) agingText = `${hours} hour${hours > 1 ? "s" : ""}`;
  else agingText = `${minutes} minute${minutes > 1 ? "s" : ""}`;

  // Dev thresholds (minutes) so you can SEE it working
  let agingBorder = "1px solid #e5e7eb";
  if (minutes >= 5) agingBorder = "2px solid #ef4444"; // red
  else if (minutes >= 2) agingBorder = "2px solid #f59e0b"; // amber

  const isStale = minutes >= 5;

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: "box-shadow 120ms ease, transform 120ms ease",
    background: isStale ? "#fef2f2" : "#f9fafb",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    border: agingBorder,
    boxShadow: isDragging ? "0 8px 20px rgba(0,0,0,0.08)" : "none",
    opacity: isDragging ? 0.85 : 1,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-stale={isStale ? "true" : "false"}
      onClick={() => {
        if (isDragging) return;
        onClick?.(submission);
      }}
      onMouseEnter={(e) => {
        if (isDragging) return;
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 6px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          isDragging ? "0 8px 20px rgba(0,0,0,0.08)" : "none";
      }}      
    >
      {isStale && (
  <div
    style={{
      position: "absolute",
      top: 6,
      right: 6,
      background: "#ef4444",
      color: "#fff",
      fontSize: 10,
      padding: "2px 6px",
      borderRadius: 999,
      fontWeight: 600,
    }}
  >
    Stale
  </div>
)}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <button
          type="button"
          style={{
            all: "unset",
            cursor: "pointer",
            flex: 1,
            display: "block",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
              }}
            >
              {(submission.candidate.firstName?.[0] ?? "").toUpperCase()}
              {(submission.candidate.lastName?.[0] ?? "").toUpperCase()}
            </div>
            <div style={{ fontWeight: 600 }}>{fullName}</div>
          </div>
          {submission.candidate.title && (
  <div style={{ fontSize: 12, color: "#6b7280" }}>
    {submission.candidate.title}
  </div>
)}

{submission.candidate.location && (
  <div style={{ fontSize: 12, color: "#9ca3af" }}>
    📍 {submission.candidate.location}
  </div>
)}

{submission.candidate.email && (
  <div
    style={{
      fontSize: 12,
      color: "#9ca3af",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 180,
    }}
    title={submission.candidate.email}
  >
    ✉️{" "}
    <a
      href={`mailto:${submission.candidate.email}`}
      style={{ color: "inherit", textDecoration: "underline" }}
      onClick={(e) => e.stopPropagation()}
    >
      {submission.candidate.email}
    </a>
  </div>
)}

{submission.candidate.phone && (
  <div style={{ fontSize: 12, color: "#9ca3af" }}>
    📞{" "}
    <a
      href={`tel:${submission.candidate.phone}`}
      style={{ color: "inherit", textDecoration: "underline" }}
      onClick={(e) => e.stopPropagation()}
    >
      {submission.candidate.phone}
    </a>
  </div>
)}

{submission.candidate.summary && (
  <div
    style={{
      fontSize: 12,
      color: "#6b7280",
      marginTop: 4,
      overflow: "hidden",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
    }}
  >
    {submission.candidate.summary}
  </div>
)}

          {latestTransition?.fromStatus && latestTransition?.toStatus && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {prettyStatus(latestTransition.fromStatus)} →{" "}
              {prettyStatus(latestTransition.toStatus)}
            </div>
          )}

          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            {agingText}
          </div>

          <div style={{ fontSize: 11, color: "#c4c4c4", marginTop: 2 }}>
            Last updated: {lastUpdatedText}
          </div>
          <div style={{ fontSize: 11, color: "#c4c4c4", marginTop: 2 }}>
  Status: {prettyStatus(submission.status)}
</div>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {submission.candidate.resumeUrl && (
            <a
              href={submission.candidate.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                textDecoration: "none",
                fontSize: 14,
                cursor: "pointer",
              }}
              title="Open resume"
            >
              📄
            </a>
          )}

          <div
            {...listeners}
            {...attributes}
            title="Drag"
            style={{
              cursor: "grab",
              userSelect: "none",
              padding: "4px 6px",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#6b7280",
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ⋮⋮
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  status,
  submissions,
  onCardClick,
}: {
  status: string;
  submissions: Submission[];
  onCardClick?: (submission: Submission) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 240,
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 12,
        background: isOver ? "#f3f4f6" : "#fff",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        {prettyStatus(status)} ({submissions.length})
      </h3>

      {submissions.map((sub) => (
        <DraggableCard key={sub.id} submission={sub} onClick={onCardClick} />
      ))}
    </div>
  );
}

export default function KanbanLane({
  columns,
  submissions,
  onMove,
  onCardClick,
}: Props) {
  const [sortMode, setSortMode] = React.useState<"OLDEST" | "NEWEST">("OLDEST");
  const [staleOnly, setStaleOnly] = React.useState(false);


  const staleCount = submissions.filter((s) => {
    const latest = s.events
      ?.filter((e: any) => e.type === "STATUS_CHANGE")
      ?.sort(
        (a: any, b: any) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      )[0];

    const lastChange = latest?.createdAt
      ? new Date(latest.createdAt).getTime()
      : Date.now();

    const minutesOld = (Date.now() - lastChange) / (1000 * 60);
    return minutesOld >= 5;
  }).length;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const submissionId = active.id as string;
    const newStatus = over.id as string;

    const current = submissions.find((s) => s.id === submissionId);
    if (current?.status === newStatus) return;

    await onMove(submissionId, newStatus);
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
          {submissions.length} candidates total • {staleCount} stale
          {staleOnly && " • filtered"}
        </div>

        {staleOnly && (
          <button
            onClick={() => setStaleOnly(false)}
            style={{
              padding: 0,
              border: "none",
              background: "transparent",
              color: "#2563eb",
              cursor: "pointer",
              fontSize: 12,
              textDecoration: "underline",
              marginBottom: 6,
              display: "block",
            }}
          >
            Clear filter
          </button>
        )}

        <button
          onClick={() => {
            const cards = Array.from(
              document.querySelectorAll('[data-stale="true"]')
            ) as HTMLElement[];

            if (!cards.length) return;

            const scroller = document.getElementById("kanbanScroller") as HTMLDivElement | null;
            if (!scroller) return;

            // pick the first stale card that is "to the right" of current scroll, otherwise wrap to first
            const next =
              cards.find((card) => {
                const cardLeftInsideScroller = card.offsetLeft;
                return cardLeftInsideScroller > scroller.scrollLeft + 10;
              }) || cards[0];

            next.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
            marginRight: 8,
          }}
        >
          Jump to next stale
        </button>

        <button
          onClick={() => setSortMode((m) => (m === "OLDEST" ? "NEWEST" : "OLDEST"))}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Sort: {sortMode === "OLDEST" ? "Oldest first" : "Newest first"}
        </button>

        <button
          onClick={() => setStaleOnly((s) => !s)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: staleOnly ? "#fee2e2" : "#fff",
            cursor: "pointer",
            fontSize: 12,
            marginLeft: 8,
          }}
        >
          {staleOnly ? "Showing stale only" : "Filter: Stale only"}
        </button>
      </div>

      {!staleOnly && staleCount > 0 && (
        <div
          onClick={() => {
            const card = document.querySelector(
              '[data-stale="true"]'
            ) as HTMLElement | null;
            const scroller = document.getElementById(
              "kanbanScroller"
            ) as HTMLDivElement | null;

            if (!card || !scroller) return;

            const scrollerRect = scroller.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();

            const cardLeftInsideScroller =
              cardRect.left - scrollerRect.left + scroller.scrollLeft;

            const targetLeft =
              cardLeftInsideScroller -
              scroller.clientWidth / 2 +
              cardRect.width / 2;

            scroller.scrollTo({ left: targetLeft, behavior: "smooth" });

            card.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
          }}
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ⚠ {staleCount} candidate{staleCount > 1 ? "s" : ""} need attention
          <span style={{ fontWeight: 400, marginLeft: 8, color: "#7f1d1d" }}>
            (click to jump)
          </span>
        </div>
      )}

      <div
        id="kanbanScroller"
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          maxWidth: "100vw",
        }}
      >
        {columns.map((status) => (
          <DroppableColumn
            key={status}
            status={status}
            submissions={submissions
              .filter((s) => {
                if (s.status !== status) return false;
                if (!staleOnly) return true;

                const latest = s.events
                  ?.filter((e: any) => e.type === "STATUS_CHANGE")
                  ?.sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt ?? 0).getTime() -
                      new Date(a.createdAt ?? 0).getTime()
                  )[0];

                const lastChange = latest?.createdAt
                  ? new Date(latest.createdAt).getTime()
                  : Date.now();

                const minutesOld = (Date.now() - lastChange) / (1000 * 60);

                return minutesOld >= 5;
              })
              
              .sort((a, b) => {
                const aLatest = a.events
                  ?.filter((e: any) => e.type === "STATUS_CHANGE")
                  ?.sort(
                    (x: any, y: any) =>
                      new Date(y.createdAt ?? 0).getTime() -
                      new Date(x.createdAt ?? 0).getTime()
                  )[0];

                const bLatest = b.events
                  ?.filter((e: any) => e.type === "STATUS_CHANGE")
                  ?.sort(
                    (x: any, y: any) =>
                      new Date(y.createdAt ?? 0).getTime() -
                      new Date(x.createdAt ?? 0).getTime()
                  )[0];

                const aTime = aLatest?.createdAt
                  ? new Date(aLatest.createdAt).getTime()
                  : Date.now();
                const bTime = bLatest?.createdAt
                  ? new Date(bLatest.createdAt).getTime()
                  : Date.now();

                return sortMode === "OLDEST" ? aTime - bTime : bTime - aTime;
              })}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
