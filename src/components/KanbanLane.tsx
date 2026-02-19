"use client";

import * as React from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { getSubmissionOwnerName } from "@/lib/submission-owner";

type Submission = {
  id: string;
  status: string;
  events?: any[];
  messages?: {
    id: string;
    body: string;
    fromRole: "CLIENT" | "AGENCY";
    createdAt?: string | null;
  }[];

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
  onCardClick?: (e: React.MouseEvent<HTMLElement>, submission: Submission) => void;
  onBeforeJumpToStale?: () => void;
  now: number;
  role?: "CLIENT" | "AGENCY";
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
};

function prettyStatus(s?: string | null) {
  if (!s) return "";
  return String(s)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Priority score from existing signals: +2 stale, +2 client requested info, +1 recent client activity, +1 unassigned, +1 interview/offer stage. */
function getSubmissionPriorityScore(submission: Submission): number {
  let score = 0;
  const latestTransition = submission.events
    ?.filter((e: any) => e.type === "STATUS_CHANGE" && e.fromStatus && e.toStatus)
    ?.sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
  const lastChange = latestTransition?.createdAt ? new Date(latestTransition.createdAt).getTime() : Date.now();
  const minutesOld = (Date.now() - lastChange) / (1000 * 60);
  if (minutesOld >= 5) score += 2;
  const hasNeedInfo = submission.events?.some((e: any) => e.type === "QUESTION" && e.note?.includes("Client needs more information"));
  if (hasNeedInfo) score += 2;
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const recentClientMsg = submission.messages?.some((m) => m.fromRole === "CLIENT" && m.createdAt && new Date(m.createdAt).getTime() >= threeDaysAgo);
  const recentClientEvent = submission.events?.some((e: any) => {
    if (e.type !== "QUESTION" || !e.note) return false;
    const isClient = (e.note as string).includes("Client marked") || (e.note as string).includes("Client needs more information") || (e.note as string).includes("Client requested interview");
    return isClient && e.createdAt && new Date(e.createdAt).getTime() >= threeDaysAgo;
  });
  if (recentClientMsg || recentClientEvent) score += 1;
  if (getSubmissionOwnerName(submission) === "") score += 1;
  if (["INTERVIEW_REQUESTED", "OFFER_PENDING", "OFFERED"].includes(submission.status)) score += 1;
  return score;
}

function DraggableCard({
  submission,
  onClick,
  role,
  isSelected,
  onToggleSelect,
}: {
  submission: Submission;
  onClick?: (e: React.MouseEvent<HTMLElement>, submission: Submission) => void;
  role?: "CLIENT" | "AGENCY";
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
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

  // Find the STATUS_CHANGE event that moved submission to its current status
  const currentStatusTransition = submission.events
    ?.filter(
      (e: any) =>
        e.type === "STATUS_CHANGE" &&
        e.toStatus === submission.status &&
        e.fromStatus &&
        e.toStatus
    )
    ?.sort(
      (a: any, b: any) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    )[0];

  const stageAgeMs = currentStatusTransition?.createdAt
    ? Date.now() - new Date(currentStatusTransition.createdAt).getTime()
    : 0;

  const stageAgeDays = Math.floor(stageAgeMs / (1000 * 60 * 60 * 24));
  const stageAgeWeeks = Math.floor(stageAgeDays / 7);

  let stageAgingText = "";
  if (stageAgeWeeks > 0) {
    stageAgingText = `${stageAgeWeeks} week${stageAgeWeeks > 1 ? "s" : ""}`;
  } else if (stageAgeDays > 0) {
    stageAgingText = `${stageAgeDays} day${stageAgeDays > 1 ? "s" : ""}`;
  } else {
    const stageAgeHours = Math.floor(stageAgeMs / (1000 * 60 * 60));
    if (stageAgeHours > 0) {
      stageAgingText = `${stageAgeHours} hour${stageAgeHours > 1 ? "s" : ""}`;
    } else {
      const stageAgeMinutes = Math.floor(stageAgeMs / (1000 * 60));
      stageAgingText = `${stageAgeMinutes} min${stageAgeMinutes !== 1 ? "s" : ""}`;
    }
  }

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

  // Age thresholds: fresh < 4h, watch 4h–48h, stale >= 48h
  const FOUR_HOURS_MIN = 4 * 60;
  const FORTY_EIGHT_HOURS_MIN = 48 * 60;
  const isStale = minutes >= FORTY_EIGHT_HOURS_MIN;
  const isWatch = minutes >= FOUR_HOURS_MIN && minutes < FORTY_EIGHT_HOURS_MIN;

  let agingBorder = "1px solid #e5e7eb";
  if (minutes >= FORTY_EIGHT_HOURS_MIN) agingBorder = "2px solid #ef4444"; // red
  else if (isWatch) agingBorder = "2px solid #f59e0b"; // amber

  // Check if client left a message/question without AGENCY reply
  const hasUnansweredClientMessage = React.useMemo(() => {
    if (!submission.messages || submission.messages.length === 0) return false;
    const sortedMessages = [...submission.messages].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
    );
    const lastMessage = sortedMessages[0];
    return lastMessage.fromRole === "CLIENT";
  }, [submission.messages]);

  // Check if client marked "Need info"
  const hasNeedInfoEvent = React.useMemo(() => {
    if (!submission.events) return false;
    return submission.events.some(
      (e: any) =>
        e.type === "QUESTION" &&
        e.note?.includes("Client needs more information")
    );
  }, [submission.events]);

  // Find most recent client decision (Interested, Pass, or Need info)
  const latestDecision = React.useMemo(() => {
    if (!submission.events) return null;
    const decisionEvents = submission.events
      .filter((e: any) => e.type === "QUESTION" && e.note)
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );

    for (const event of decisionEvents) {
      const note = event.note || "";
      if (note.includes("Client marked candidate as Interested")) {
        return "Interested";
      }
      if (note.includes("Client marked candidate as Pass")) {
        return "Pass";
      }
      if (note.includes("Client needs more information")) {
        return "Needs info";
      }
    }
    return null;
  }, [submission.events]);

  // Check for recent client activity (within last 3 days)
  const hasRecentClientActivity = React.useMemo(() => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

    // Check recent client messages
    if (submission.messages && submission.messages.length > 0) {
      const recentClientMessage = submission.messages.find((m) => {
        if (m.fromRole !== "CLIENT") return false;
        const msgTime = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        return msgTime >= threeDaysAgo;
      });
      if (recentClientMessage) return true;
    }

    // Check recent client decision events
    if (submission.events && submission.events.length > 0) {
      const recentClientEvent = submission.events.find((e: any) => {
        if (e.type !== "QUESTION" || !e.note) return false;
        const note = e.note || "";
        const isClientDecision =
          note.includes("Client marked") ||
          note.includes("Client needs more information") ||
          note.includes("Client requested interview");
        if (!isClientDecision) return false;
        const eventTime = e.createdAt
          ? new Date(e.createdAt).getTime()
          : 0;
        return eventTime >= threeDaysAgo;
      });
      if (recentClientEvent) return true;
    }

    return false;
  }, [submission.messages, submission.events]);

  const needsAttention = isStale || hasUnansweredClientMessage || hasNeedInfoEvent;

  const hasOwner = getSubmissionOwnerName(submission) !== "";
  const priorityScore = getSubmissionPriorityScore(submission);
  const isHighPriority = priorityScore >= 3;

  // Check if submission is at risk
  const isAtRisk = React.useMemo(() => {
    // Stale beyond threshold
    if (isStale) return true;

    // Client requested info but no response yet
    if (hasNeedInfoEvent) return true;

    // Long time since last activity (7+ days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Check most recent event
    if (submission.events && submission.events.length > 0) {
      const sortedEvents = [...submission.events].sort(
        (a: any, b: any) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
      const mostRecentEvent = sortedEvents[0];
      if (mostRecentEvent?.createdAt) {
        const eventTime = new Date(mostRecentEvent.createdAt).getTime();
        if (eventTime < sevenDaysAgo) return true;
      }
    }

    // Check most recent message
    if (submission.messages && submission.messages.length > 0) {
      const sortedMessages = [...submission.messages].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );
      const mostRecentMessage = sortedMessages[0];
      if (mostRecentMessage?.createdAt) {
        const msgTime = new Date(mostRecentMessage.createdAt).getTime();
        if (msgTime < sevenDaysAgo) return true;
      }
    }

    return false;
  }, [isStale, hasNeedInfoEvent, submission.events, submission.messages]);

  // Determine next step hint (wording by role for client view)
  const nextStepHint = React.useMemo(() => {
    if (isStale) {
      return role === "CLIENT" ? "Reply or take action" : "Follow up with client";
    }
    if (submission.status === "INTERVIEW_REQUESTED") {
      return "Schedule interview";
    }
    if (submission.status === "OFFER_PENDING" || submission.status === "OFFERED") {
      return "Prepare offer";
    }
    if (hasRecentClientActivity) {
      return "Review update";
    }
    return null;
  }, [isStale, submission.status, hasRecentClientActivity, role]);

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: "box-shadow 120ms ease, transform 120ms ease",
    background: isStale ? "#fef2f2" : isAtRisk || isWatch ? "#fffbeb" : "#f0fdf4",
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
      onClick={(e) => {
        if (isDragging) return;
        onClick?.(e, submission);
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
      {onToggleSelect && role === "AGENCY" && (
        <div
          onClick={(e) => { e.stopPropagation(); onToggleSelect(submission.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: "absolute", top: 6, right: 6, zIndex: 1 }}
        >
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => {}}
            style={{ width: 14, height: 14, cursor: "pointer" }}
          />
        </div>
      )}
      {role !== "CLIENT" && isAtRisk && !needsAttention && (
        <div
          style={{
            position: "absolute",
            top: 26,
            right: 6,
            background: "#f59e0b",
            color: "#fff",
            fontSize: 9,
            padding: "2px 5px",
            borderRadius: 999,
            fontWeight: 600,
          }}
          title="At risk"
        >
          ⚠ At Risk
        </div>
      )}
      {isStale && (
  <div
    style={{
      position: "absolute",
      top: 26,
      right: 6,
      background: "#ef4444",
      color: "#fff",
      fontSize: 10,
      padding: "2px 6px",
      borderRadius: 999,
      fontWeight: 600,
    }}
  >
    {role === "CLIENT" ? "Needs follow-up" : "Needs Attention"}
  </div>
)}
      {role !== "CLIENT" && !hasOwner && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            background: "#6b7280",
            color: "#fff",
            fontSize: 9,
            padding: "2px 5px",
            borderRadius: 999,
            fontWeight: 600,
          }}
          title="No owner assigned"
        >
          Unassigned
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
          <div style={{ display: "flex", alignItems: "center" }}>
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

          <div style={{ fontSize: 11, color: "#c4c4c4", marginTop: 2 }}>
            Last updated: {lastUpdatedText}
          </div>
          {stageAgingText && (
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, fontStyle: "italic" }}>
              In this stage: {stageAgingText}
            </div>
          )}
          {nextStepHint && (
            <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 3, fontWeight: 500 }}>
              → {nextStepHint}
            </div>
          )}
          {latestDecision && (
            <div
              style={{
                fontSize: 10,
                color: latestDecision === "Interested" ? "#16a34a" : latestDecision === "Pass" ? "#dc2626" : "#f59e0b",
                marginTop: 4,
                fontWeight: 500,
              }}
            >
              {latestDecision}
            </div>
          )}
          {isStale && (
            <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4, fontStyle: "italic" }}>
              Follow up needed
            </div>
          )}
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

/** Recent activity in last 7 days (events + messages) for submissions in this column. */
function getColumnActivityLabel(submissions: Submission[]): "High activity" | "Moderate" | "Low" {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const sub of submissions) {
    for (const e of sub.events || []) {
      const t = (e as any).createdAt ? new Date((e as any).createdAt).getTime() : 0;
      if (t >= sevenDaysAgo) count++;
    }
    for (const m of sub.messages || []) {
      const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      if (t >= sevenDaysAgo) count++;
    }
  }
  if (count >= 8) return "High activity";
  if (count >= 3) return "Moderate";
  return "Low";
}

function DroppableColumn({
  status,
  submissions,
  onCardClick,
  role,
  selectedIds,
  onToggleSelect,
}: {
  status: string;
  submissions: Submission[];
  onCardClick?: (e: React.MouseEvent<HTMLElement>, submission: Submission) => void;
  role?: "CLIENT" | "AGENCY";
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const activityLabel = getColumnActivityLabel(submissions);

  return (
    <div
      ref={setNodeRef}
      data-status={status}
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
      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2, marginBottom: 8 }}>
        {activityLabel}
      </div>

      {submissions.map((sub) => (
        <DraggableCard
          key={sub.id}
          submission={sub}
          onClick={onCardClick}
          role={role}
          isSelected={selectedIds?.has(sub.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

export default function KanbanLane({
  columns,
  submissions,
  onMove,
  onCardClick,
  onBeforeJumpToStale,
  role,
  selectedIds,
  onToggleSelect,
}: Props) {
  const [sortMode, setSortMode] = React.useState<"OLDEST" | "NEWEST" | "PRIORITY">("OLDEST");
  const [staleOnly, setStaleOnly] = React.useState(false);

  const isClient = role === "CLIENT";
  const staleLabel = isClient ? "need follow-up" : "stale";
  const FORTY_EIGHT_HOURS_MIN = 48 * 60;
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
    return minutesOld >= FORTY_EIGHT_HOURS_MIN;
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
          {submissions.length} candidates total • {staleCount} {staleLabel}
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
            onBeforeJumpToStale?.();
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
          Jump to next {isClient ? "needing follow-up" : "stale"}
        </button>

        <button
          onClick={() => setSortMode((m) => (m === "OLDEST" ? "NEWEST" : m === "NEWEST" ? "PRIORITY" : "OLDEST"))}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "#fff",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Sort: {sortMode === "OLDEST" ? "Oldest first" : sortMode === "NEWEST" ? "Newest first" : "By priority"}
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
          {staleOnly ? (isClient ? "Showing need follow-up only" : "Showing stale only") : (isClient ? "Filter: Need follow-up only" : "Filter: Stale only")}
        </button>
      </div>

      {!staleOnly && staleCount > 0 && (
        <div
          onClick={() => {
            onBeforeJumpToStale?.();
            const cards = Array.from(
              document.querySelectorAll('[data-stale="true"]')
            ) as HTMLElement[];

            if (!cards.length) return;

            const scroller = document.getElementById(
              "kanbanScroller"
            ) as HTMLDivElement | null;

            if (!scroller) return;

            const next =
              cards.find((card) => {
                const cardLeftInsideScroller = card.offsetLeft;
                return cardLeftInsideScroller > scroller.scrollLeft + 10;
              }) || cards[0];

            next.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center",
            });
          }}
          style={{
            marginBottom: 8,
            padding: "6px 10px",
            borderRadius: 999,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            fontSize: 11,
          }}
        >
          ⚠ {staleCount} candidate{staleCount > 1 ? "s" : ""} {isClient ? "need follow-up" : "need attention"}
          <span
            style={{
              fontWeight: 400,
              marginLeft: 8,
              color: "#7f1d1d",
              fontSize: 10,
            }}
          >
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
            role={role}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
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
                if (sortMode === "PRIORITY") {
                  return getSubmissionPriorityScore(b) - getSubmissionPriorityScore(a);
                }
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
