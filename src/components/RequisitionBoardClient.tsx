"use client";

import { useEffect, useState } from "react";
import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import KanbanLane from "@/components/KanbanLane";
import CandidateDetailSheet from "@/components/CandidateDetailSheet";
import ResumeViewer from "@/components/ResumeViewer";
import { getSubmissionOwnerName } from "@/lib/submission-owner";

type CandidateLike = {
  id: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
  resumeUrl?: string | null;
  resumeText?: string | null;
};

type DecisionEventLike = {
  id: string;
  type: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  createdAt?: string | null;
};

type SubmissionLike = {
  id: string;
  status: string;
  candidate?: CandidateLike | null;
  events?: DecisionEventLike[];
  messages?: {
    id: string;
    body: string;
    fromRole: "CLIENT" | "AGENCY";
    createdAt?: string | null;
  }[];
  fitScore?: number | null;
  fitSummary?: string | null;
  strengths?: string[] | null;
  gaps?: string[] | null;
  sellingPoints?: string[] | null;
  objectionsAndRebuttals?: { objection: string; rebuttal: string }[] | null;
  confidence?: number | null;
  evaluatedAt?: string | null;
};

export default function RequisitionBoardClient({
  role,
  requisitionId,
  requisitionTitle,
  columns,
  submissions,
  onMove,
  onRequestInterview,
  onDecline,
  onAddFeedback,
  onMarkInterested,
  onMarkPass,
  onNeedInfo,
  onMakeOffer,
  onOfferAccepted,
  onOfferDeclined,
  onMarkOpenQuestionResolved,
  onSetOwner,
  onSetOwnerWithHandoff,
  onBulkMarkFollowUpDone,
  onBulkSendNudge,
  currentUserDisplayName,
}: {
  role: "CLIENT" | "AGENCY";
  requisitionId: string;
  requisitionTitle: string;
  columns: string[];
  submissions: SubmissionLike[];
  onMove: (submissionId: string, newStatus: string) => void | Promise<void>;
  onRequestInterview: (submissionId: string) => void | Promise<void>;
  onDecline: (submissionId: string) => void | Promise<void>;
  onAddFeedback: (submissionId: string, note: string) => void | Promise<void>;
  onMarkInterested: (submissionId: string) => void | Promise<void>;
  onMarkPass: (submissionId: string) => void | Promise<void>;
  onNeedInfo: (submissionId: string) => void | Promise<void>;
  onMakeOffer: (submissionId: string) => void | Promise<void>;
  onOfferAccepted: (submissionId: string) => void | Promise<void>;
  onOfferDeclined: (submissionId: string) => void | Promise<void>;
  onMarkOpenQuestionResolved?: (submissionId: string, note?: string) => void | Promise<void>;
  onSetOwner?: (submissionId: string, ownerName: string) => void | Promise<void>;
  onSetOwnerWithHandoff?: (submissionId: string, ownerName: string) => void | Promise<void>;
  onBulkMarkFollowUpDone?: (submissionIds: string[]) => void | Promise<void>;
  onBulkSendNudge?: (submissionIds: string[]) => void | Promise<void>;
  currentUserDisplayName?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(Date.now());
  const [mounted, setMounted] = useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [newCandidateModalOpen, setNewCandidateModalOpen] = React.useState(false);
  const [newCandidateTab, setNewCandidateTab] = React.useState<"quick" | "resume">("quick");
  const [quickFirstName, setQuickFirstName] = React.useState("");
  const [quickLastName, setQuickLastName] = React.useState("");
  const [quickEmail, setQuickEmail] = React.useState("");
  const [quickPhone, setQuickPhone] = React.useState("");
  const [quickTitle, setQuickTitle] = React.useState("");
  const [newCandidateBusy, setNewCandidateBusy] = React.useState(false);
  const [newCandidateError, setNewCandidateError] = React.useState<string | null>(null);
  const [resumeFile, setResumeFile] = React.useState<File | null>(null);
  const [resumeUploadStatus, setResumeUploadStatus] = React.useState<string | null>(null);

  const handleMove = React.useCallback(
    async (submissionId: string, newStatus: string) => {
      if (role !== "AGENCY") return;
      setActionError(null);
      try {
        await onMove(submissionId, newStatus);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Action not allowed");
      }
    },
    [role, onMove]
  );

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    React.useState<SubmissionLike | null>(null);
  const [anchorRect, setAnchorRect] = React.useState<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  } | null>(null);
  const [resumeViewer, setResumeViewer] = React.useState<{
    open: boolean;
    url: string | null;
    candidateName?: string | null;
    filename?: string | null;
    resumeText?: string | null;
    candidateId?: string | null;
  }>({ open: false, url: null });
  const [weeklyUpdateOpen, setWeeklyUpdateOpen] = React.useState(false);
  const [weeklyUpdateTemplate, setWeeklyUpdateTemplate] = React.useState<"Internal" | "Client">("Internal");
  const [weeklyUpdateClientName, setWeeklyUpdateClientName] = React.useState("");
  const [weeklyUpdateOwnerName, setWeeklyUpdateOwnerName] = React.useState("");
  const [filterNeedsAttentionOnly, setFilterNeedsAttentionOnly] = React.useState(false);
  const [filterOpenQuestionsOnly, setFilterOpenQuestionsOnly] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState<string>("ALL");
  const [filterSearchQuery, setFilterSearchQuery] = React.useState("");
  const [queueView, setQueueView] = React.useState<"ALL" | "MY_QUEUE" | "UNASSIGNED">("ALL");
  const [selectedSubmissionIds, setSelectedSubmissionIds] = React.useState<Set<string>>(new Set());
  const [boardMode, setBoardMode] = React.useState<"BOARD" | "TRIAGE">("BOARD");
  const [triageSort, setTriageSort] = React.useState<"DEFAULT" | "PRIORITY" | "AGE" | "LAST_CLIENT">("DEFAULT");
  const [quickNoteRowId, setQuickNoteRowId] = React.useState<string | null>(null);
  const [quickNoteText, setQuickNoteText] = React.useState("");
  const [editingOwnerRowId, setEditingOwnerRowId] = React.useState<string | null>(null);
  const [editingOwnerValue, setEditingOwnerValue] = React.useState("");
  const [bottleneckDrilldownOpen, setBottleneckDrilldownOpen] = React.useState(false);
  const [selectedBottleneckOwner, setSelectedBottleneckOwner] = React.useState<string | null>(null);
  const [bottleneckCopied, setBottleneckCopied] = React.useState(false);
  const scrollToOwnerRef = React.useRef<HTMLDivElement | null>(null);
  const insightsButtonRef = React.useRef<HTMLDivElement | null>(null);
  const insightsPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const viewButtonRef = React.useRef<HTMLDivElement | null>(null);
  const viewPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const quickViewsButtonRef = React.useRef<HTMLDivElement | null>(null);
  const quickViewsPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const modeButtonRef = React.useRef<HTMLDivElement | null>(null);
  const modePopoverRef = React.useRef<HTMLDivElement | null>(null);
  const bottleneckButtonRef = React.useRef<HTMLDivElement | null>(null);
  const bottleneckPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const rankSummaryButtonRef = React.useRef<HTMLDivElement | null>(null);
  const rankSummaryPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const suggestionsButtonRef = React.useRef<HTMLDivElement | null>(null);
  const suggestionsPopoverRef = React.useRef<HTMLDivElement | null>(null);
  const [insightsTab, setInsightsTab] = React.useState<"Recent Activity" | "Today" | "Pipeline Velocity" | "Win Rate" | "Hiring Forecast">("Today");
  type ToolbarDropdown = "insights" | "view" | "quickViews" | "mode" | "bottleneck" | "ranksummary" | "suggestions";
  const [toolbarOpen, setToolbarOpen] = React.useState<ToolbarDropdown | null>(null);
  const insightsOpen = toolbarOpen === "insights";
  React.useEffect(() => {
    if (selectedBottleneckOwner && scrollToOwnerRef.current) scrollToOwnerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedBottleneckOwner]);
  React.useEffect(() => {
    if (toolbarOpen === null) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const pairs: [React.RefObject<HTMLDivElement | null>, React.RefObject<HTMLDivElement | null>][] = [
        [insightsButtonRef, insightsPopoverRef],
        [viewButtonRef, viewPopoverRef],
        [quickViewsButtonRef, quickViewsPopoverRef],
        [modeButtonRef, modePopoverRef],
        [bottleneckButtonRef, bottleneckPopoverRef],
        [rankSummaryButtonRef, rankSummaryPopoverRef],
        [suggestionsButtonRef, suggestionsPopoverRef],
      ];
      const isInside = pairs.some(([btn, pop]) => btn.current?.contains(target) || pop.current?.contains(target));
      if (!isInside) setToolbarOpen(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [toolbarOpen]);

  const handleCardClick = (
    e: React.MouseEvent<HTMLElement>,
    submission: SubmissionLike
  ) => {
    if (selectedSubmission?.id === submission.id) {
      setDetailOpen(false);
      setAnchorRect(null);
      setSelectedSubmission(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchorRect({
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    });
    setSelectedSubmission(submission);
    setDetailOpen(true);
  };

  // Compute today summary counts
  const todaySummary = React.useMemo(() => {
    let staleCount = 0;
    let recentClientActivityCount = 0;
    let awaitingDecisionCount = 0;

    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;

    submissions.forEach((sub) => {
      // Check if stale (no STATUS_CHANGE for 5+ minutes)
      const latestTransition = sub.events
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

      const minutes = Math.floor((Date.now() - lastChange) / (1000 * 60));
      if (minutes >= 5) {
        staleCount++;
      }

      // Check recent client activity
      if (sub.messages && sub.messages.length > 0) {
        const recentClientMessage = sub.messages.find((m) => {
          if (m.fromRole !== "CLIENT") return false;
          const msgTime = m.createdAt ? new Date(m.createdAt).getTime() : 0;
          return msgTime >= threeDaysAgo;
        });
        if (recentClientMessage) {
          recentClientActivityCount++;
        }
      }

      if (sub.events && sub.events.length > 0) {
        const recentClientEvent = sub.events.find((e: any) => {
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
        if (recentClientEvent && !recentClientActivityCount) {
          recentClientActivityCount++;
        }
      }

      // Check awaiting decision (in review stages)
      if (
        sub.status === "UNDER_REVIEW" ||
        sub.status === "INTERVIEW_REQUESTED" ||
        sub.status === "OFFER_PENDING"
      ) {
        awaitingDecisionCount++;
      }
    });

    return {
      staleCount,
      recentClientActivityCount,
      awaitingDecisionCount,
    };
  }, [submissions]);

  // Compute pipeline summary counts
  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    submissions.forEach((sub) => {
      const status = sub.status || "UNKNOWN";
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [submissions]);

  const bottleneck = React.useMemo((): { status: string; avgDays: number; count: number; filterValue: string; label: string; oldestSubmissions: { sub: SubmissionLike; ageMs: number }[]; bottleneckByOwner: { owner: string; count: number; avgAgeMs: number }[]; trend: string | null; severity: "severe" | "moderate" | null } | { notEnoughData: true } | null => {
    if (submissions.length < 2) return { notEnoughData: true };
    const MS_PER_DAY = 24 * 60 * 60 * 1000; // 86400000
    const now = Date.now();
    const getStageAgeMs = (sub: SubmissionLike): number => {
      const currentStatusTransition = (sub.events || [])
        .filter((e: any) => e.type === "STATUS_CHANGE" && e.toStatus === sub.status && e.fromStatus && e.toStatus)
        .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      let t = currentStatusTransition?.createdAt ? new Date(currentStatusTransition.createdAt).getTime() : 0;
      if (!t || !Number.isFinite(t)) {
        const raw = (sub as any).updatedAt ?? (sub as any).createdAt;
        t = raw ? new Date(raw).getTime() : 0;
      }
      if (!t || !Number.isFinite(t)) return 0;
      const age = now - t;
      return Number.isFinite(age) && age >= 0 ? age : 0;
    };
    const byStatus: Record<string, { totalMs: number; count: number }> = {};
    submissions.forEach((sub) => {
      const status = String(sub.status || "UNKNOWN");
      if (!byStatus[status]) byStatus[status] = { totalMs: 0, count: 0 };
      const ageMs = getStageAgeMs(sub);
      if (!Number.isFinite(ageMs)) return;
      byStatus[status].totalMs += ageMs;
      byStatus[status].count += 1;
    });
    const entries = Object.entries(byStatus).filter(([, v]) => v.count > 0);
    if (entries.length === 0) return { notEnoughData: true };
    let best = { status: entries[0][0], avgDays: entries[0][1].totalMs / entries[0][1].count / MS_PER_DAY, count: entries[0][1].count };
    for (let i = 1; i < entries.length; i++) {
      const [status, { totalMs, count }] = entries[i];
      const avgDays = totalMs / count / MS_PER_DAY;
      if (avgDays > best.avgDays) best = { status, avgDays, count };
    }
    const filterValue = best.status === "OFFER_PENDING" || best.status === "OFFERED" ? "OFFER" : best.status;
    const statusToLabel: Record<string, string> = {
      SUBMITTED: "Submitted",
      UNDER_REVIEW: "Under Review",
      INTERVIEW_REQUESTED: "Interview",
      OFFER_PENDING: "Offer",
      OFFERED: "Offer",
      CLOSED: "Hired",
      DECLINED: "Declined",
    };
    const label = statusToLabel[best.status] ?? best.status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    const inStage = submissions.filter((s) => s.status === best.status);
    const withAge = inStage.map((s) => ({ sub: s, ageMs: getStageAgeMs(s) })).filter((x) => Number.isFinite(x.ageMs));
    withAge.sort((a, b) => b.ageMs - a.ageMs);
    const oldestSubmissions = withAge.slice(0, 10).map((x) => ({ sub: x.sub, ageMs: x.ageMs }));
    const byOwner: Record<string, { totalMs: number; count: number }> = {};
    inStage.forEach((s) => {
      const owner = getSubmissionOwnerName(s as any) || "Unassigned";
      if (!byOwner[owner]) byOwner[owner] = { totalMs: 0, count: 0 };
      const ageMs = getStageAgeMs(s);
      if (Number.isFinite(ageMs)) { byOwner[owner].totalMs += ageMs; byOwner[owner].count += 1; }
    });
    const bottleneckByOwner = Object.entries(byOwner).map(([owner, v]) => ({
      owner,
      count: v.count,
      avgAgeMs: v.count > 0 ? v.totalMs / v.count : 0,
    }));
    const sevenDaysMs = 7 * MS_PER_DAY;
    let trend: string | null = null;
    if (inStage.length > 0) {
      let sum7dAgo = 0;
      let n7d = 0;
      inStage.forEach((s) => {
        const ageMs = getStageAgeMs(s);
        if (!Number.isFinite(ageMs)) return;
        const age7dAgoMs = Math.max(0, ageMs - sevenDaysMs);
        sum7dAgo += age7dAgoMs;
        n7d += 1;
      });
      if (n7d > 0) {
        const avgNowDays = best.avgDays;
        const avg7dAgoDays = sum7dAgo / n7d / MS_PER_DAY;
        if (avg7dAgoDays === 0 && avgNowDays === 0) trend = "→ stable (7d)";
        else if (avg7dAgoDays === 0 && avgNowDays > 0) trend = "↑ worsening (7d)";
        else if (avgNowDays >= avg7dAgoDays * 1.1) trend = "↑ worsening (7d)";
        else if (avgNowDays <= avg7dAgoDays * 0.9) trend = "↓ improving (7d)";
        else trend = "→ stable (7d)";
      }
    }
    const severity = best.avgDays >= 7 || best.count >= 10 ? "severe" : best.avgDays >= 3 || best.count >= 5 ? "moderate" : null;
    return { status: best.status, avgDays: best.avgDays, count: best.count, filterValue, label, oldestSubmissions, bottleneckByOwner, trend, severity };
  }, [submissions]);

  const formatStatusLabel = (status: string) => {
    return status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Build unified activity feed
  const activityFeed = React.useMemo(() => {
    const items: Array<{
      id: string;
      type: "event" | "message";
      description: string;
      timestamp: number;
      candidateName?: string;
    }> = [];

    submissions.forEach((sub) => {
      const candidateName = sub.candidate
        ? `${sub.candidate.firstName} ${sub.candidate.lastName}`
        : "Unknown";

      // Add events
      if (sub.events) {
        sub.events.forEach((e: any) => {
          let description = "";
          if (e.type === "STATUS_CHANGE") {
            const from = formatStatusLabel(e.fromStatus || "");
            const to = formatStatusLabel(e.toStatus || "");
            description = `${candidateName}: ${from} → ${to}`;
            if (e.note) description += ` (${e.note})`;
          } else if (e.type === "REQUEST_INTERVIEW") {
            description = `${candidateName}: Interview requested`;
            if (e.note) description += ` - ${e.note}`;
          } else if (e.type === "MAKE_OFFER") {
            description = `${candidateName}: Offer made`;
            if (e.note) description += ` - ${e.note}`;
          } else if (e.type === "DECLINE") {
            description = `${candidateName}: Declined`;
            if (e.note) description += ` - ${e.note}`;
          } else if (e.type === "QUESTION") {
            description = `${candidateName}: ${e.note || "Note"}`;
          }

          if (description && e.createdAt) {
            items.push({
              id: `event-${e.id}`,
              type: "event",
              description,
              timestamp: new Date(e.createdAt).getTime(),
              candidateName,
            });
          }
        });
      }

      // Add messages
      if (sub.messages) {
        sub.messages.forEach((m) => {
          const roleLabel = m.fromRole === "CLIENT" ? "Client" : "Agency";
          items.push({
            id: `message-${m.id}`,
            type: "message",
            description: `${candidateName}: ${roleLabel} - ${m.body}`,
            timestamp: m.createdAt ? new Date(m.createdAt).getTime() : 0,
            candidateName,
          });
        });
      }
    });

    // Sort by timestamp descending and limit to 15 items
    return items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 15);
  }, [submissions]);

  const notifications = React.useMemo(
    () =>
      activityFeed
        .filter((item) => {
          const descLower = item.description.toLowerCase();
          // Client messages or decisions, interview + offer actions
          return (
            descLower.includes("client -") ||
            descLower.includes("client marked") ||
            descLower.includes("interview requested") ||
            descLower.includes("offer")
          );
        })
        .slice(0, 5),
    [activityFeed]
  );

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  // Generate suggestions based on existing data
  const suggestions = React.useMemo(() => {
    const items: string[] = [];

    // Count unanswered client messages and need info events
    let unansweredCount = 0;
    submissions.forEach((sub) => {
      if (sub.messages && sub.messages.length > 0) {
        const sortedMessages = [...sub.messages].sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime()
        );
        if (sortedMessages[0]?.fromRole === "CLIENT") {
          unansweredCount++;
        }
      }
      if (sub.events) {
        const hasNeedInfo = sub.events.some(
          (e: any) =>
            e.type === "QUESTION" &&
            e.note?.includes("Client needs more information")
        );
        if (hasNeedInfo) unansweredCount++;
      }
    });

    // Count candidates stuck in early stages
    let stuckCount = 0;
    submissions.forEach((sub) => {
      if (
        sub.status === "SUBMITTED" ||
        sub.status === "UNDER_REVIEW"
      ) {
        // Check if stuck (no activity in 2+ days)
        const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
        let hasRecentActivity = false;
        if (sub.events && sub.events.length > 0) {
          const mostRecent = sub.events
            .sort(
              (a: any, b: any) =>
                new Date(b.createdAt ?? 0).getTime() -
                new Date(a.createdAt ?? 0).getTime()
            )[0];
          if (mostRecent?.createdAt) {
            const eventTime = new Date(mostRecent.createdAt).getTime();
            hasRecentActivity = eventTime >= twoDaysAgo;
          }
        }
        if (!hasRecentActivity) stuckCount++;
      }
    });

    // Build suggestions (wording by role: avoid "stale" for CLIENT)
    if (todaySummary.staleCount > 0) {
      items.push(role === "CLIENT"
        ? `Follow up on ${todaySummary.staleCount} submission${todaySummary.staleCount > 1 ? "s" : ""} needing attention`
        : `Follow up with client on ${todaySummary.staleCount} stale submission${todaySummary.staleCount > 1 ? "s" : ""}`);
    }
    if (unansweredCount > 0) {
      items.push(`Respond to ${unansweredCount} client question${unansweredCount > 1 ? "s" : ""}`);
    }
    if (todaySummary.recentClientActivityCount > 0) {
      items.push(`Review ${todaySummary.recentClientActivityCount} submission${todaySummary.recentClientActivityCount > 1 ? "s" : ""} with recent client activity`);
    }
    if (stuckCount > 0) {
      items.push(`Move ${stuckCount} candidate${stuckCount > 1 ? "s" : ""} forward from early stages`);
    }

    return items;
  }, [submissions, todaySummary, role]);

  // Calculate pipeline velocity (average time in stages)
  const pipelineVelocity = React.useMemo(() => {
    const stageTimes: Record<string, number[]> = {};

    submissions.forEach((sub) => {
      if (!sub.events) return;

      // Find all STATUS_CHANGE events for this submission
      const statusChanges = sub.events
        .filter((e: any) => e.type === "STATUS_CHANGE" && e.fromStatus && e.toStatus)
        .sort(
          (a: any, b: any) =>
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime()
        );

      // Calculate time spent in each stage
      for (let i = 0; i < statusChanges.length; i++) {
        const change = statusChanges[i];
        const fromStatus = change.fromStatus as string;
        const enterTime = new Date(change.createdAt ?? 0).getTime();

        // Find when they left this stage (next STATUS_CHANGE)
        const nextChange = statusChanges[i + 1];
        const exitTime = nextChange
          ? new Date(nextChange.createdAt ?? 0).getTime()
          : Date.now(); // Still in this stage, use current time

        const timeInStage = exitTime - enterTime;
        const daysInStage = timeInStage / (1000 * 60 * 60 * 24);

        if (!stageTimes[fromStatus]) {
          stageTimes[fromStatus] = [];
        }
        stageTimes[fromStatus].push(daysInStage);
      }
    });

    // Calculate averages
    const averages: Record<string, number> = {};
    Object.keys(stageTimes).forEach((status) => {
      const times = stageTimes[status];
      if (times.length > 0) {
        const sum = times.reduce((a, b) => a + b, 0);
        averages[status] = sum / times.length;
      }
    });

    return averages;
  }, [submissions]);

  // Calculate client responsiveness
  const clientResponsiveness = React.useMemo(() => {
    let totalResponseTime = 0;
    let responseCount = 0;

    submissions.forEach((sub) => {
      // Find submission creation time (earliest event or message)
      let submissionTime = Date.now();
      if (sub.events && sub.events.length > 0) {
        const earliestEvent = sub.events
          .filter((e: any) => e.createdAt)
          .sort(
            (a: any, b: any) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime()
          )[0];
        if (earliestEvent?.createdAt) {
          submissionTime = new Date(earliestEvent.createdAt).getTime();
        }
      }
      if (sub.messages && sub.messages.length > 0) {
        const earliestMessage = sub.messages
          .filter((m) => m.createdAt)
          .sort(
            (a, b) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime()
          )[0];
        if (earliestMessage?.createdAt) {
          const msgTime = new Date(earliestMessage.createdAt).getTime();
          if (msgTime < submissionTime) {
            submissionTime = msgTime;
          }
        }
      }

      // Find first client activity
      let firstClientActivityTime: number | null = null;

      // Check messages from client
      if (sub.messages && sub.messages.length > 0) {
        const clientMessages = sub.messages.filter((m) => m.fromRole === "CLIENT" && m.createdAt);
        if (clientMessages.length > 0) {
          const earliestClientMsg = clientMessages.sort(
            (a, b) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime()
          )[0];
          if (earliestClientMsg?.createdAt) {
            firstClientActivityTime = new Date(earliestClientMsg.createdAt).getTime();
          }
        }
      }

      // Check client decision events
      if (sub.events && sub.events.length > 0) {
        const clientEvents = sub.events.filter((e: any) => {
          if (!e.createdAt) return false;
          if (e.type === "QUESTION" && e.note) {
            const note = e.note || "";
            return (
              note.includes("Client marked") ||
              note.includes("Client needs more information") ||
              note.includes("Client requested interview")
            );
          }
          return false;
        });

        if (clientEvents.length > 0) {
          const earliestClientEvent = clientEvents.sort(
            (a: any, b: any) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime()
          )[0];
          if (earliestClientEvent?.createdAt) {
            const eventTime = new Date(earliestClientEvent.createdAt).getTime();
            if (!firstClientActivityTime || eventTime < firstClientActivityTime) {
              firstClientActivityTime = eventTime;
            }
          }
        }
      }

      // Calculate response time if we found client activity
      if (firstClientActivityTime && firstClientActivityTime > submissionTime) {
        const responseTimeHours = (firstClientActivityTime - submissionTime) / (1000 * 60 * 60);
        totalResponseTime += responseTimeHours;
        responseCount++;
      }
    });

    if (responseCount === 0) return null;

    const avgResponseHours = totalResponseTime / responseCount;
    const avgResponseDays = avgResponseHours / 24;

    // Classify: < 1 day = responsive, >= 1 day = slow
    return avgResponseDays < 1 ? "Responsive client" : "Slow to respond";
  }, [submissions]);

  // Calculate pipeline momentum
  const pipelineMomentum = React.useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    let activityLast24h = 0;
    let activityLast3Days = 0;
    let activityLast7Days = 0;

    submissions.forEach((sub) => {
      // Count events in time windows
      if (sub.events) {
        sub.events.forEach((e: any) => {
          if (!e.createdAt) return;
          const eventTime = new Date(e.createdAt).getTime();
          if (eventTime >= oneDayAgo) activityLast24h++;
          if (eventTime >= threeDaysAgo) activityLast3Days++;
          if (eventTime >= sevenDaysAgo) activityLast7Days++;
        });
      }

      // Count messages in time windows
      if (sub.messages) {
        sub.messages.forEach((m) => {
          if (!m.createdAt) return;
          const msgTime = new Date(m.createdAt).getTime();
          if (msgTime >= oneDayAgo) activityLast24h++;
          if (msgTime >= threeDaysAgo) activityLast3Days++;
          if (msgTime >= sevenDaysAgo) activityLast7Days++;
        });
      }
    });

    // Classify momentum
    if (activityLast24h >= 3) {
      return "Active pipeline";
    } else if (activityLast3Days >= 5) {
      return "Slowing down";
    } else if (activityLast7Days === 0) {
      return "Stalled";
    } else {
      return "Slowing down";
    }
  }, [submissions]);

  // Calculate win rate
  const winRate = React.useMemo(() => {
    let hiresCount = 0;
    let offersCount = 0;

    submissions.forEach((sub) => {
      // Count hires (CLOSED status)
      if (sub.status === "CLOSED") {
        hiresCount++;
      }

      // Count offers (OFFER_PENDING or OFFERED status, or submissions that reached offer stage)
      if (sub.status === "OFFER_PENDING" || sub.status === "OFFERED") {
        offersCount++;
      } else {
        // Check if submission ever reached offer stage via events
        if (sub.events) {
          const reachedOffer = sub.events.some(
            (e: any) =>
              e.type === "MAKE_OFFER" ||
              (e.type === "STATUS_CHANGE" &&
                (e.toStatus === "OFFER_PENDING" || e.toStatus === "OFFERED"))
          );
          if (reachedOffer) {
            offersCount++;
          }
        }
      }
    });

    // Use offers if available, otherwise use total submissions
    const denominator = offersCount > 0 ? offersCount : submissions.length;
    if (denominator === 0) return null;

    const rate = (hiresCount / denominator) * 100;
    return {
      rate: rate.toFixed(1),
      hires: hiresCount,
      total: denominator,
    };
  }, [submissions]);

  // Calculate time-to-fill (avg time from first activity to hire)
  const timeToFill = React.useMemo(() => {
    const fillTimes: number[] = [];

    submissions.forEach((sub) => {
      if (sub.status !== "CLOSED") return;

      // Find hire time (when moved to CLOSED)
      let hireTime: number | null = null;
      if (sub.events) {
        const closedEvent = sub.events.find(
          (e: any) =>
            e.type === "STATUS_CHANGE" && e.toStatus === "CLOSED" && e.createdAt
        );
        if (closedEvent?.createdAt) {
          hireTime = new Date(closedEvent.createdAt).getTime();
        }
      }
      if (!hireTime) return;

      // Find earliest activity (proxy for submission start)
      let startTime = hireTime;
      if (sub.events && sub.events.length > 0) {
        const earliestEvent = sub.events
          .filter((e: any) => e.createdAt)
          .sort(
            (a: any, b: any) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime()
          )[0];
        if (earliestEvent?.createdAt) {
          const t = new Date(earliestEvent.createdAt).getTime();
          if (t < startTime) startTime = t;
        }
      }
      if (sub.messages && sub.messages.length > 0) {
        const earliestMessage = sub.messages
          .filter((m) => m.createdAt)
          .sort(
            (a, b) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime()
          )[0];
        if (earliestMessage?.createdAt) {
          const t = new Date(earliestMessage.createdAt).getTime();
          if (t < startTime) startTime = t;
        }
      }

      const daysToFill = (hireTime - startTime) / (1000 * 60 * 60 * 24);
      if (daysToFill >= 0) fillTimes.push(daysToFill);
    });

    if (fillTimes.length === 0) return null;

    const avgDays = fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length;
    return {
      avgDays,
      hireCount: fillTimes.length,
    };
  }, [submissions]);

  // Hiring forecast: submissions in late stages (interview, offer)
  const hiringForecast = React.useMemo(() => {
    const lateStageCount = submissions.filter(
      (sub) =>
        sub.status === "INTERVIEW_REQUESTED" ||
        sub.status === "OFFER_PENDING" ||
        sub.status === "OFFERED"
    ).length;
    return lateStageCount > 0 ? lateStageCount : null;
  }, [submissions]);

  const inOfferCount = (statusCounts["OFFER_PENDING"] || 0) + (statusCounts["OFFERED"] || 0);

  const openQuestionsWithSubmission = React.useMemo(() => {
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    return submissions
      .map((sub) => {
        const name = sub.candidate ? `${sub.candidate.firstName} ${sub.candidate.lastName}`.trim() : "Unknown";
        let include = false;
        let summary = "";
        const clientQuestions = (sub.events || []).filter((e: any) => {
          if (e.type !== "QUESTION" || !e.createdAt) return false;
          if (new Date(e.createdAt).getTime() < fourteenDaysAgo) return false;
          const note = String((e as any).note || "");
          if (!note.includes("Client")) return false;
          return true;
        }).sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        const hasNeedInfo = (sub.events || []).some((e: any) => e.type === "QUESTION" && (e as any).note?.includes("Client needs more information"));
        const sortedMessages = (sub.messages || []).sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        const lastMsg = sortedMessages[0];
        const lastFromClientUnanswered = lastMsg?.fromRole === "CLIENT";
        if (clientQuestions.length > 0) {
          include = true;
          summary = String((clientQuestions[0] as any).note || "").replace(/\s+/g, " ").slice(0, 60);
          if (summary.length >= 60) summary += "...";
        }
        if (hasNeedInfo && !summary) summary = "Client requested more information";
        if (hasNeedInfo) include = true;
        if (lastFromClientUnanswered) {
          include = true;
          if (!summary && lastMsg?.body) summary = lastMsg.body.replace(/\s+/g, " ").slice(0, 60) + (lastMsg.body.length > 60 ? "..." : "");
          if (!summary) summary = "Awaiting our reply to client";
        }
        if (!include) return null;
        const hasResolved = (sub.events || []).some((e: any) => e.type === "QUESTION" && String((e as any).note || "").startsWith("[RESOLVED]"));
        if (hasResolved) return null;
        return { name, summary: summary || "Client follow-up", submission: sub };
      })
      .filter((x): x is { name: string; summary: string; submission: SubmissionLike } => x !== null);
  }, [submissions]);

  const needAttentionIds = React.useMemo(() => {
    const now = Date.now();
    const set = new Set<string>();
    submissions.forEach((sub) => {
      let score = 0;
      const latestTransition = sub.events
        ?.filter((e: any) => e.type === "STATUS_CHANGE" && e.createdAt)
        ?.sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      const lastChange = latestTransition?.createdAt ? new Date(latestTransition.createdAt).getTime() : now;
      if ((now - lastChange) / (1000 * 60) >= 5) score += 2;
      if (sub.events?.some((e: any) => e.type === "QUESTION" && (e as any).note?.includes("Client needs more information"))) score += 2;
      const lastMsg = sub.messages?.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      if (lastMsg?.fromRole === "CLIENT") score += 2;
      if (score > 0) set.add(sub.id);
    });
    return set;
  }, [submissions]);

  const openQuestionIds = React.useMemo(() => new Set(openQuestionsWithSubmission.map((q) => q.submission.id)), [openQuestionsWithSubmission]);

  const filteredSubmissions = React.useMemo(() => {
    let list = submissions;
    if (role === "AGENCY") {
      if (queueView === "MY_QUEUE" && currentUserDisplayName) list = list.filter((s) => getSubmissionOwnerName(s) === currentUserDisplayName);
      else if (queueView === "UNASSIGNED") list = list.filter((s) => getSubmissionOwnerName(s) === "");
    }
    if (filterNeedsAttentionOnly) list = list.filter((s) => needAttentionIds.has(s.id));
    if (filterNeedsAttentionOnly && currentUserDisplayName) list = list.filter((s) => getSubmissionOwnerName(s) === currentUserDisplayName);
    if (filterOpenQuestionsOnly) list = list.filter((s) => openQuestionIds.has(s.id));
    if (filterStatus !== "ALL") {
      if (filterStatus === "OFFER") list = list.filter((s) => s.status === "OFFER_PENDING" || s.status === "OFFERED");
      else list = list.filter((s) => s.status === filterStatus);
    }
    const q = filterSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const name = `${s.candidate?.firstName ?? ""} ${s.candidate?.lastName ?? ""}`.trim().toLowerCase();
        if (name.includes(q)) return true;
        const inMessage = s.messages?.some((m) => m.body && m.body.toLowerCase().includes(q));
        return !!inMessage;
      });
    }
    return list;
  }, [submissions, role, queueView, currentUserDisplayName, filterNeedsAttentionOnly, filterOpenQuestionsOnly, filterStatus, filterSearchQuery, needAttentionIds, openQuestionIds]);

  // AI rank per requisition: 1 = best fitScore, only for submissions with fitScore
  const rankBySubmissionId = React.useMemo(() => {
    const withScore = submissions.filter((s) => s.fitScore != null);
    const sorted = [...withScore].sort((a, b) => {
      const scoreA = a.fitScore ?? 0;
      const scoreB = b.fitScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = new Date((a as any).evaluatedAt ?? (a as any).updatedAt ?? (a as any).createdAt ?? 0).getTime();
      const timeB = new Date((b as any).evaluatedAt ?? (b as any).updatedAt ?? (b as any).createdAt ?? 0).getTime();
      return timeB - timeA;
    });
    const map = new Map<string, number>();
    sorted.forEach((s, i) => map.set(s.id, i + 1));
    return map;
  }, [submissions]);

  // Ranked list for Rank Summary tab (same order as rankBySubmissionId)
  const rankedSubmissionsForSummary = React.useMemo(() => {
    const withScore = submissions.filter((s) => s.fitScore != null);
    return [...withScore].sort((a, b) => {
      const scoreA = a.fitScore ?? 0;
      const scoreB = b.fitScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = new Date((a as any).evaluatedAt ?? (a as any).updatedAt ?? (a as any).createdAt ?? 0).getTime();
      const timeB = new Date((b as any).evaluatedAt ?? (b as any).updatedAt ?? (b as any).createdAt ?? 0).getTime();
      return timeB - timeA;
    });
  }, [submissions]);
  const notYetEvaluatedSubmissions = React.useMemo(
    () => submissions.filter((s) => s.fitScore == null),
    [submissions]
  );

  const getNextStatus = (status: string): string | null => {
    const map: Record<string, string> = {
      SUBMITTED: "UNDER_REVIEW",
      UNDER_REVIEW: "INTERVIEW_REQUESTED",
      INTERVIEW_REQUESTED: "OFFER_PENDING",
      OFFER_PENDING: "OFFERED",
      OFFERED: "CLOSED",
    };
    return map[status] ?? null;
  };

  const triageRows = React.useMemo(() => {
    const fmtAge = (ms: number): string => {
      if (!ms || ms < 0) return "—";
      const minutes = Math.floor(ms / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const weeks = Math.floor(days / 7);
      if (weeks > 0) return `${weeks}w`;
      if (days > 0) return `${days}d`;
      if (hours > 0) return `${hours}h`;
      return `${minutes}m`;
    };

    const getPriorityScore = (sub: SubmissionLike): number => {
      let score = 0;
      const latestTransition = sub.events
        ?.filter((e: any) => e.type === "STATUS_CHANGE" && e.fromStatus && e.toStatus)
        ?.sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      const lastChange = latestTransition?.createdAt ? new Date(latestTransition.createdAt).getTime() : now;
      if ((now - lastChange) / (1000 * 60) >= 5) score += 2;
      const hasNeedInfo = sub.events?.some((e: any) => e.type === "QUESTION" && (e as any).note?.includes("Client needs more information"));
      if (hasNeedInfo) score += 2;
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
      const lastClientActivityAt = (() => {
        const latestClientMsg = (sub.messages || [])
          .filter((m) => m.fromRole === "CLIENT" && m.createdAt)
          .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
        const latestClientEvent = (sub.events || [])
          .filter((e: any) => e.type === "QUESTION" && (e as any).note)
          .filter((e: any) => {
            const note = String((e as any).note || "");
            return note.includes("Client marked") || note.includes("Client needs more information") || note.includes("Client requested interview");
          })
          .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
        const msgTime = latestClientMsg?.createdAt ? new Date(latestClientMsg.createdAt).getTime() : 0;
        const eventTime = latestClientEvent?.createdAt ? new Date(latestClientEvent.createdAt).getTime() : 0;
        return Math.max(msgTime, eventTime);
      })();
      if (lastClientActivityAt && lastClientActivityAt >= threeDaysAgo) score += 1;
      if (getSubmissionOwnerName(sub as any) === "") score += 1;
      if (["INTERVIEW_REQUESTED", "OFFER_PENDING", "OFFERED"].includes(String(sub.status))) score += 1;
      return score;
    };

    const getStageAgeMs = (sub: SubmissionLike): number => {
      const currentStatusTransition = (sub.events || [])
        .filter((e: any) => e.type === "STATUS_CHANGE" && e.toStatus === sub.status && e.fromStatus && e.toStatus)
        .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      const t = currentStatusTransition?.createdAt ? new Date(currentStatusTransition.createdAt).getTime() : 0;
      return t ? now - t : 0;
    };

    const getLastClientActivityAt = (sub: SubmissionLike): number => {
      const latestClientMsg = (sub.messages || [])
        .filter((m) => m.fromRole === "CLIENT" && m.createdAt)
        .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      const latestClientEvent = (sub.events || [])
        .filter((e: any) => e.type === "QUESTION" && (e as any).note)
        .filter((e: any) => {
          const note = String((e as any).note || "");
          return note.includes("Client marked") || note.includes("Client needs more information") || note.includes("Client requested interview");
        })
        .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      const msgTime = latestClientMsg?.createdAt ? new Date(latestClientMsg.createdAt).getTime() : 0;
      const eventTime = latestClientEvent?.createdAt ? new Date(latestClientEvent.createdAt).getTime() : 0;
      return Math.max(msgTime, eventTime);
    };

    const statusLabel = (s: string) =>
      String(s)
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const rows = filteredSubmissions.map((sub) => {
      const name = `${sub.candidate?.firstName ?? ""} ${sub.candidate?.lastName ?? ""}`.trim();
      const priorityScore = getPriorityScore(sub);
      const stageAgeMs = getStageAgeMs(sub);
      const lastClientAt = getLastClientActivityAt(sub);
      const ownerName = getSubmissionOwnerName(sub as any);
      return {
        id: sub.id,
        submission: sub,
        name,
        status: String(sub.status),
        statusText: statusLabel(String(sub.status)),
        priorityScore,
        priorityText: priorityScore >= 3 ? "High" : "Normal",
        stageAgeMs,
        stageAgeText: fmtAge(stageAgeMs),
        lastClientAt,
        lastClientText: lastClientAt ? fmtAge(now - lastClientAt) : "—",
        ownerName,
      };
    });

    rows.sort((a, b) => {
      if (triageSort === "AGE") return b.stageAgeMs - a.stageAgeMs;
      if (triageSort === "PRIORITY") return b.priorityScore - a.priorityScore;
      if (triageSort === "LAST_CLIENT") return b.lastClientAt - a.lastClientAt;
      // DEFAULT: Priority desc, then Age desc
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (b.stageAgeMs !== a.stageAgeMs) return b.stageAgeMs - a.stageAgeMs;
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [filteredSubmissions, now, triageSort]);

  const getWeeklyUpdateText = (template: "Internal" | "Client", openQuestions: { name: string; summary: string }[]): string => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const avgTimeToFillStr = timeToFill
      ? timeToFill.avgDays < 1
        ? `${Math.round(timeToFill.avgDays * 24)} hrs`
        : `${timeToFill.avgDays.toFixed(1)} days`
      : "—";

    // What's changed (last 7 days)
    let eventsLast7 = 0;
    let messagesLast7 = 0;
    submissions.forEach((sub) => {
      sub.events?.forEach((e: any) => {
        if (e.createdAt && new Date(e.createdAt).getTime() >= sevenDaysAgo) eventsLast7++;
      });
      sub.messages?.forEach((m) => {
        if (m.createdAt && new Date(m.createdAt).getTime() >= sevenDaysAgo) messagesLast7++;
      });
    });
    const changesLine =
      eventsLast7 === 0 && messagesLast7 === 0
        ? "No activity in the last 7 days."
        : `Last 7 days: ${eventsLast7} event(s), ${messagesLast7} message(s).`;

    // Top 3 needing attention (stale, need info, unanswered client)
    const needAttention = submissions
      .map((sub) => {
        let score = 0;
        let reason = "";
        const latestTransition = sub.events
          ?.filter((e: any) => e.type === "STATUS_CHANGE" && e.createdAt)
          ?.sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
        const lastChange = latestTransition?.createdAt ? new Date(latestTransition.createdAt).getTime() : now;
        const stale = (now - lastChange) / (1000 * 60) >= 5;
        if (stale) {
          score += 2;
          reason = "stale";
        }
        const hasNeedInfo = sub.events?.some((e: any) => e.type === "QUESTION" && (e as any).note?.includes("Client needs more information"));
        if (hasNeedInfo) {
          score += 2;
          reason = reason ? `${reason}, needs info` : "needs info";
        }
        const lastMsg = sub.messages?.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
        if (lastMsg?.fromRole === "CLIENT") {
          score += 2;
          reason = reason ? `${reason}, unanswered client` : "unanswered client";
        }
        const name = sub.candidate ? `${sub.candidate.firstName} ${sub.candidate.lastName}`.trim() : "Unknown";
        return { sub, score, reason, name, hasNeedInfo, lastMsgFromClient: !!lastMsg?.fromRole && lastMsg.fromRole === "CLIENT" };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // Top 3 positive momentum (recent Interested / interview / offer in last 7 days)
    const positive = submissions
      .map((sub) => {
        let latestPositive = 0;
        sub.events?.forEach((e: any) => {
          if (!e.createdAt) return;
          const t = new Date(e.createdAt).getTime();
          if (t < sevenDaysAgo) return;
          if (e.type === "REQUEST_INTERVIEW" || e.type === "MAKE_OFFER") latestPositive = Math.max(latestPositive, t);
          if (e.type === "QUESTION" && (e as any).note?.includes("Client marked candidate as Interested")) latestPositive = Math.max(latestPositive, t);
        });
        const name = sub.candidate ? `${sub.candidate.firstName} ${sub.candidate.lastName}`.trim() : "Unknown";
        return { name, latestPositive };
      })
      .filter((x) => x.latestPositive > 0)
      .sort((a, b) => b.latestPositive - a.latestPositive)
      .slice(0, 3);

    // Candidates ready for action (interview scheduling or offer) — for Client template
    const readyForInterview = submissions.filter((s) => s.status === "INTERVIEW_REQUESTED");
    const inOffer = submissions.filter((s) => s.status === "OFFER_PENDING" || s.status === "OFFERED");
    const suggestedActions = suggestions.slice(0, 4);

    if (template === "Client") {
      const summaryLines: string[] = [];
      summaryLines.push(`${requisitionTitle} — brief update.`);
      summaryLines.push(`We have ${submissions.length} candidates in the pipeline; ${statusCounts["INTERVIEW_REQUESTED"] || 0} in interview coordination and ${inOfferCount} in offer discussion.`);
      if (eventsLast7 > 0 || messagesLast7 > 0) {
        summaryLines.push(`This past week there has been activity on the role; we’re following up where needed.`);
      }
      summaryLines.push(`Below are items that would benefit from your input when convenient.`);

      const readyLines: string[] = [];
      readyForInterview.forEach((s) => {
        const name = s.candidate ? `${s.candidate.firstName} ${s.candidate.lastName}`.trim() : "Unknown";
        readyLines.push(`• ${name} — ready for interview scheduling`);
      });
      inOffer.forEach((s) => {
        const name = s.candidate ? `${s.candidate.firstName} ${s.candidate.lastName}`.trim() : "Unknown";
        readyLines.push(`• ${name} — offer pending your decision`);
      });
      if (readyLines.length === 0 && positive.length > 0) {
        positive.forEach((x) => readyLines.push(`• ${x.name} — recent positive progress`));
      }

      const questionsLines: string[] = [];
      needAttention.forEach((x) => {
        if (x.hasNeedInfo) questionsLines.push(`• ${x.name} — we’d appreciate a bit more detail when you have a moment`);
        else if (x.lastMsgFromClient) questionsLines.push(`• ${x.name} — following up on your last message`);
        else questionsLines.push(`• ${x.name} — awaiting your input when convenient`);
      });

      const clientGreeting = weeklyUpdateClientName.trim() ? `Hi ${weeklyUpdateClientName.trim()},` : null;
      const lines = [
        `WEEKLY UPDATE: ${requisitionTitle}`,
        `Generated: ${new Date().toISOString()}`,
        ...(clientGreeting ? ["", clientGreeting] : []),
        "",
        "--- BRIEF SUMMARY ---",
        ...summaryLines.slice(0, 4),
        "",
        "--- CANDIDATES READY FOR YOUR ACTION ---",
        ...(readyLines.length ? readyLines : ["None at this time."]),
        "",
        "--- QUESTIONS FOR YOU ---",
        ...(questionsLines.length ? questionsLines : ["None at this time."]),
        "",
        "--- OPEN QUESTIONS ---",
        ...(openQuestions.length ? openQuestions.map((q) => `• ${q.name} — ${q.summary}`) : ["None at this time."]),
      ];
      return lines.join("\n");
    }

    // Internal template
    const ownerLine = weeklyUpdateOwnerName.trim() ? `Owner: ${weeklyUpdateOwnerName.trim()}` : null;
    const lines = [
      `WEEKLY UPDATE: ${requisitionTitle}`,
      `Generated: ${new Date().toISOString()}`,
      ...(ownerLine ? [ownerLine] : []),
      "",
      "--- HEADLINE STATS ---",
      `Total submissions: ${submissions.length}`,
      `In Interview: ${statusCounts["INTERVIEW_REQUESTED"] || 0}`,
      `In Offer: ${inOfferCount}`,
      `Hired: ${statusCounts["CLOSED"] || 0}`,
      `Win rate: ${winRate ? `${winRate.rate}%` : "—"}`,
      `Avg time to fill: ${avgTimeToFillStr}`,
      `Pipeline momentum: ${pipelineMomentum}`,
      `Client responsiveness: ${clientResponsiveness ?? "—"}`,
      "",
      "--- WHAT'S CHANGED (LAST 7 DAYS) ---",
      changesLine,
      "",
      "--- TOP 3 NEEDING ATTENTION ---",
      ...(needAttention.length ? needAttention.map((x) => `• ${x.name} (${x.reason})`) : ["None"]),
      "",
      "--- TOP 3 POSITIVE MOMENTUM ---",
      ...(positive.length ? positive.map((x) => `• ${x.name}`) : ["None"]),
      "",
      "--- SUGGESTED NEXT ACTIONS ---",
      ...(suggestedActions.length ? suggestedActions.map((s) => `• ${s}`) : ["None"]),
      "",
      "--- OPEN QUESTIONS ---",
      ...(openQuestions.length ? openQuestions.map((q) => `• ${q.name} — ${q.summary}`) : ["None"]),
    ];
    return lines.join("\n");
  };

  const handleCopySummary = () => {
    const timestamp = new Date().toISOString();
    const avgTimeToFillStr = timeToFill
      ? timeToFill.avgDays < 1
        ? `${Math.round(timeToFill.avgDays * 24)} hrs`
        : `${timeToFill.avgDays.toFixed(1)} days`
      : "—";
    const text = [
      requisitionTitle,
      `Snapshot: ${timestamp}`,
      "",
      "Executive Summary",
      `Total submissions: ${submissions.length}`,
      `In Interview: ${statusCounts["INTERVIEW_REQUESTED"] || 0}`,
      `In Offer: ${inOfferCount}`,
      `Hired: ${statusCounts["CLOSED"] || 0}`,
      `Win rate: ${winRate ? `${winRate.rate}%` : "—"}`,
      `Avg time to fill: ${avgTimeToFillStr}`,
      `Pipeline momentum: ${pipelineMomentum}`,
      `Client responsiveness: ${clientResponsiveness ?? "—"}`,
    ].join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleDownloadCSV = () => {
    const escape = (s: string) => (s.includes(",") || s.includes('"') || s.includes("\n") ? `"${String(s).replace(/"/g, '""')}"` : s);
    const staleHeader = role === "CLIENT" ? "Needs follow-up" : "Stale";
    const rows: string[][] = [
      ["Candidate name", "Current status", "Last activity time", "Last client decision", staleHeader],
    ];

    submissions.forEach((sub) => {
      const candidateName = sub.candidate
        ? `${sub.candidate.firstName ?? ""} ${sub.candidate.lastName ?? ""}`.trim() || "Unknown"
        : "Unknown";

      let lastActivityTime = "";
      const allTimes: number[] = [];
      if (sub.events) {
        sub.events.forEach((e: any) => {
          if (e.createdAt) allTimes.push(new Date(e.createdAt).getTime());
        });
      }
      if (sub.messages) {
        sub.messages.forEach((m) => {
          if (m.createdAt) allTimes.push(new Date(m.createdAt).getTime());
        });
      }
      if (allTimes.length > 0) {
        const last = Math.max(...allTimes);
        lastActivityTime = new Date(last).toISOString();
      }

      let lastClientDecision = "";
      if (sub.events) {
        const clientEvents = sub.events
          .filter((e: any) => {
            if (e.type !== "QUESTION" || !e.note) return false;
            const n = (e.note || "").toLowerCase();
            return n.includes("client marked") || n.includes("client needs") || n.includes("client requested");
          })
          .sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        if (clientEvents.length > 0 && (clientEvents[0] as any).note) {
          lastClientDecision = String((clientEvents[0] as any).note).slice(0, 80);
        }
      }
      if (!lastClientDecision && sub.messages) {
        const clientMsgs = sub.messages.filter((m) => m.fromRole === "CLIENT").sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        if (clientMsgs.length > 0 && clientMsgs[0].body) lastClientDecision = clientMsgs[0].body.slice(0, 80);
      }

      const latestTransition = sub.events
        ?.filter((e: any) => e.type === "STATUS_CHANGE" && e.createdAt)
        ?.sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
      const lastChange = latestTransition?.createdAt ? new Date(latestTransition.createdAt).getTime() : Date.now();
      const stale = (Date.now() - lastChange) / (1000 * 60) >= 5;

      rows.push([candidateName, sub.status, lastActivityTime, lastClientDecision, stale ? "true" : "false"]);
    });

    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `requisition-${requisitionId}-submissions.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickViewPresets = [
    { id: "all" as const, label: "All", set: () => { setFilterNeedsAttentionOnly(false); setFilterOpenQuestionsOnly(false); setFilterStatus("ALL"); setFilterSearchQuery(""); } },
    { id: "my-day" as const, label: "My Day", set: () => { setFilterNeedsAttentionOnly(true); setFilterOpenQuestionsOnly(false); setFilterStatus("ALL"); setFilterSearchQuery(""); } },
    { id: "open-questions" as const, label: "Open Questions", set: () => { setFilterNeedsAttentionOnly(false); setFilterOpenQuestionsOnly(true); setFilterStatus("ALL"); setFilterSearchQuery(""); } },
    { id: "interviews" as const, label: "Interviews", set: () => { setFilterNeedsAttentionOnly(false); setFilterOpenQuestionsOnly(false); setFilterStatus("INTERVIEW_REQUESTED"); setFilterSearchQuery(""); } },
    { id: "offers" as const, label: "Offers", set: () => { setFilterNeedsAttentionOnly(false); setFilterOpenQuestionsOnly(false); setFilterStatus("OFFER"); setFilterSearchQuery(""); } },
  ];

  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: "#fff", borderBottom: "1px solid #e2e8f0", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.06)", marginBottom: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <div ref={insightsButtonRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setToolbarOpen((v) => (v === "insights" ? null : "insights")); setInsightsTab("Today"); }}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              marginBottom: "-1px",
              background: insightsOpen ? "#e0f2fe" : "#fff",
              color: insightsOpen ? "#0369a1" : "#475569",
              cursor: "pointer",
              fontWeight: insightsOpen ? 600 : 400,
            }}
          >
            Insights
          </button>
          {insightsOpen && (
            <div
              ref={insightsPopoverRef}
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: 4,
                minWidth: 320,
                maxWidth: 420,
                maxHeight: "min(70vh, 480px)",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 8px 0", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {(["Recent Activity", "Today", "Pipeline Velocity", "Win Rate", "Hiring Forecast"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInsightsTab(tab)}
                    style={{
                      padding: "6px 10px",
                      fontSize: 11,
                      border: "none",
                      borderRadius: 6,
                      background: insightsTab === tab ? "#e0f2fe" : "transparent",
                      color: insightsTab === tab ? "#0369a1" : "#64748b",
                      cursor: "pointer",
                      fontWeight: insightsTab === tab ? 600 : 400,
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                {insightsTab === "Recent Activity" && (
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    <div style={{ fontWeight: 600, color: "#111827", marginBottom: 12, fontSize: 14 }}>Recent Activity</div>
                    {notifications.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#111827", fontWeight: 500 }}>
                          <span>🔔 Notifications ({notifications.length})</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {notifications.map((item) => (
                            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: "#374151" }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</span>
                              <span style={{ color: "#9ca3af", flexShrink: 0 }}>{formatTimeAgo(item.timestamp)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {activityFeed.map((item) => (
                        <div key={item.id} style={{ fontSize: 12, color: "#374151", padding: "6px 8px", background: "#f9fafb", borderRadius: 4 }}>
                          <div>{item.description}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{formatTimeAgo(item.timestamp)}</div>
                        </div>
                      ))}
                    </div>
                    {activityFeed.length === 0 && notifications.length === 0 && <div style={{ color: "#64748b" }}>No recent activity.</div>}
                  </div>
                )}
                {insightsTab === "Today" && (
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    <div style={{ fontWeight: 600, color: "#0369a1", marginBottom: 4 }}>Today</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>Summary of today&apos;s activity</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#6b7280" }}>{todaySummary.staleCount} need follow-up</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#6b7280" }}>{todaySummary.recentClientActivityCount} have recent client activity</span></div>
                      {role === "AGENCY" && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#6b7280" }}>{todaySummary.staleCount} are stale</span></div>}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#6b7280" }}>{todaySummary.awaitingDecisionCount} awaiting decision</span></div>
                    </div>
                    {clientResponsiveness && (
                      <div style={{ marginTop: 12, padding: "10px 14px", background: clientResponsiveness === "Responsive client" ? "#f0fdf4" : "#fef2f2", border: clientResponsiveness === "Responsive client" ? "1px solid #86efac" : "1px solid #fecaca", borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: clientResponsiveness === "Responsive client" ? "#166534" : "#991b1b", fontSize: 13 }}>{clientResponsiveness === "Responsive client" ? "✓" : "⚠"} {clientResponsiveness}</div>
                      </div>
                    )}
                  </div>
                )}
                {insightsTab === "Pipeline Velocity" && (
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
                      {columns.map((status) => (
                        <div key={status} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: "#6b7280", fontWeight: 500 }}>{formatStatusLabel(status)}:</span>
                          <span style={{ color: "#111827", fontWeight: 600 }}>{statusCounts[status] || 0}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pipelineMomentum === "Active pipeline" ? "#16a34a" : pipelineMomentum === "Slowing down" ? "#f59e0b" : "#dc2626" }}>● {pipelineMomentum}</span>
                    </div>
                    {Object.keys(pipelineVelocity).length > 0 && (
                      <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, marginBottom: 12, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: "#166534", marginBottom: 6, fontSize: 13 }}>Pipeline Velocity</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: "#15803d" }}>
                          {Object.entries(pipelineVelocity).map(([status, avgDays]) => (
                            <div key={status}>Avg time in {formatStatusLabel(status).toLowerCase()}: <span style={{ fontWeight: 600 }}>{avgDays < 1 ? `${Math.round(avgDays * 24)} hrs` : `${avgDays.toFixed(1)} days`}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {timeToFill && (
                      <div style={{ padding: "10px 14px", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: "#5b21b6", fontSize: 13 }}>Avg time to fill: <span style={{ fontWeight: 600 }}>{timeToFill.avgDays < 1 ? `${Math.round(timeToFill.avgDays * 24)} hrs` : `${timeToFill.avgDays.toFixed(1)} days`}</span><span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>({timeToFill.hireCount} hire{timeToFill.hireCount !== 1 ? "s" : ""})</span></div>
                      </div>
                    )}
                  </div>
                )}
                {insightsTab === "Win Rate" && (
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    {winRate ? (
                      <div style={{ padding: "10px 14px", background: "#f0f9ff", border: "1px solid #93c5fd", borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: "#1e40af", fontSize: 13, marginBottom: 4 }}>Win Rate</div>
                        <div style={{ color: "#1e3a8a", fontSize: 14 }}><span style={{ fontWeight: 600, fontSize: 16 }}>{winRate.rate}%</span><span style={{ fontSize: 11, color: "#64748b", marginLeft: 8 }}>({winRate.hires} hire{winRate.hires !== 1 ? "s" : ""} / {winRate.total} offer{winRate.total !== 1 ? "s" : ""})</span></div>
                      </div>
                    ) : <div style={{ color: "#64748b" }}>No win rate data yet.</div>}
                  </div>
                )}
                {insightsTab === "Hiring Forecast" && (
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    {hiringForecast !== null ? (
                      <div style={{ padding: "10px 14px", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: "#047857", fontSize: 13 }}>Estimated hires: {hiringForecast}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>(in interview or offer stage)</div>
                      </div>
                    ) : <div style={{ color: "#64748b" }}>No hiring forecast yet.</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {role === "AGENCY" && (
          <div ref={viewButtonRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setToolbarOpen((v) => (v === "view" ? null : "view"))}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                border: "1px solid #e2e8f0",
                borderBottom: "none",
                borderRadius: "6px 6px 0 0",
                marginBottom: "-1px",
                background: toolbarOpen === "view" ? "#e0f2fe" : "#fff",
                color: toolbarOpen === "view" ? "#0369a1" : "#475569",
                cursor: "pointer",
                fontWeight: toolbarOpen === "view" ? 600 : 400,
              }}
            >
              View
            </button>
            {toolbarOpen === "view" && (
              <div
                ref={viewPopoverRef}
                style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 160, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, padding: 8 }}
              >
                {(["ALL", "MY_QUEUE", "UNASSIGNED"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => { setQueueView(view); setToolbarOpen(null); }}
                    style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: 12, border: "none", borderRadius: 6, background: queueView === view ? "#e0f2fe" : "transparent", color: queueView === view ? "#0369a1" : "#475569", cursor: "pointer", fontWeight: queueView === view ? 600 : 400, textAlign: "left" }}
                  >
                    {view === "ALL" ? "All" : view === "MY_QUEUE" ? "My Queue" : "Unassigned"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={quickViewsButtonRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setToolbarOpen((v) => (v === "quickViews" ? null : "quickViews"))}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              marginBottom: "-1px",
              background: toolbarOpen === "quickViews" ? "#e0f2fe" : "#fff",
              color: toolbarOpen === "quickViews" ? "#0369a1" : "#475569",
              cursor: "pointer",
              fontWeight: toolbarOpen === "quickViews" ? 600 : 400,
            }}
          >
            Quick Views
          </button>
          {toolbarOpen === "quickViews" && (
            <div
              ref={quickViewsPopoverRef}
              style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 180, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, padding: 8 }}
            >
              {quickViewPresets.map((preset) => {
                const isActive =
                  (preset.id === "all" && !filterNeedsAttentionOnly && !filterOpenQuestionsOnly && filterStatus === "ALL" && !filterSearchQuery) ||
                  (preset.id === "my-day" && filterNeedsAttentionOnly && !filterOpenQuestionsOnly && filterStatus === "ALL" && !filterSearchQuery) ||
                  (preset.id === "open-questions" && !filterNeedsAttentionOnly && filterOpenQuestionsOnly && filterStatus === "ALL" && !filterSearchQuery) ||
                  (preset.id === "interviews" && !filterNeedsAttentionOnly && !filterOpenQuestionsOnly && filterStatus === "INTERVIEW_REQUESTED" && !filterSearchQuery) ||
                  (preset.id === "offers" && !filterNeedsAttentionOnly && !filterOpenQuestionsOnly && filterStatus === "OFFER" && !filterSearchQuery);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => { preset.set(); setToolbarOpen(null); }}
                    style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: 12, border: "none", borderRadius: 6, background: isActive ? "#e0f2fe" : "transparent", color: isActive ? "#0369a1" : "#475569", cursor: "pointer", fontWeight: isActive ? 600 : 400, textAlign: "left" }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div ref={modeButtonRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setToolbarOpen((v) => (v === "mode" ? null : "mode"))}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              marginBottom: "-1px",
              background: toolbarOpen === "mode" ? "#e0f2fe" : "#fff",
              color: toolbarOpen === "mode" ? "#0369a1" : "#475569",
              cursor: "pointer",
              fontWeight: toolbarOpen === "mode" ? 600 : 400,
            }}
          >
            Mode
          </button>
          {toolbarOpen === "mode" && (
            <div
              ref={modePopoverRef}
              style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 200, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, padding: 8 }}
            >
              {([{ id: "BOARD" as const, label: "Board" }, { id: "TRIAGE" as const, label: "Triage" }]).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setBoardMode(m.id); if (m.id !== "BOARD") setSelectedSubmissionIds(new Set()); setToolbarOpen(null); }}
                  style={{ display: "block", width: "100%", padding: "6px 10px", fontSize: 12, border: "none", borderRadius: 6, background: boardMode === m.id ? "#e0f2fe" : "transparent", color: boardMode === m.id ? "#0369a1" : "#475569", cursor: "pointer", fontWeight: boardMode === m.id ? 600 : 400, textAlign: "left" }}
                >
                  {m.label}
                </button>
              ))}
              {boardMode === "TRIAGE" && (
                <label style={{ display: "block", marginTop: 8, paddingTop: 8, borderTop: "1px solid #e2e8f0", fontSize: 12 }}>
                  <span style={{ color: "#64748b", display: "block", marginBottom: 4 }}>Sort</span>
                  <select
                    value={triageSort}
                    onChange={(e) => setTriageSort(e.target.value as "DEFAULT" | "PRIORITY" | "AGE" | "LAST_CLIENT")}
                    style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", color: "#334155" }}
                  >
                    <option value="DEFAULT">Priority → Age</option>
                    <option value="PRIORITY">Priority</option>
                    <option value="AGE">Age in stage</option>
                    <option value="LAST_CLIENT">Last client activity</option>
                  </select>
                </label>
              )}
            </div>
          )}
        </div>

        <div ref={bottleneckButtonRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setToolbarOpen((v) => (v === "bottleneck" ? null : "bottleneck"))}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              marginBottom: "-1px",
              background: toolbarOpen === "bottleneck" ? "#e0f2fe" : "#fff",
              color: toolbarOpen === "bottleneck" ? "#0369a1" : "#475569",
              cursor: "pointer",
              fontWeight: toolbarOpen === "bottleneck" ? 600 : 400,
            }}
          >
            Bottleneck{bottleneck && !("notEnoughData" in bottleneck) ? " ⚠" : ""}
          </button>
          {toolbarOpen === "bottleneck" && (
            <div
              ref={bottleneckPopoverRef}
              style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 360, maxWidth: 480, maxHeight: "min(70vh, 420px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
                {(bottleneck && "notEnoughData" in bottleneck) ? (
                  <div style={{ fontSize: 12, color: "#64748b" }}><strong>Bottleneck:</strong> Not enough data yet</div>
                ) : bottleneck ? (
                  <>
                    <div style={{ marginBottom: 10, fontSize: 12, color: "#92400e", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <strong>Bottleneck:</strong>
                      {bottleneck.severity && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 999, background: bottleneck.severity === "severe" ? "#fef2f2" : "#fffbeb", color: bottleneck.severity === "severe" ? "#b91c1c" : "#b45309", border: bottleneck.severity === "severe" ? "1px solid #fecaca" : "1px solid #fde68a" }}>{bottleneck.severity === "severe" ? "Severe" : "Moderate"}</span>
                      )}
                      {bottleneck.label} (avg {bottleneck.avgDays < 1 ? "< 1 day" : bottleneck.avgDays % 1 === 0 ? `${Math.round(bottleneck.avgDays)} days` : `${bottleneck.avgDays.toFixed(1)} days`}) — {bottleneck.count} candidate{bottleneck.count !== 1 ? "s" : ""} waiting
                      {bottleneck.trend && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{bottleneck.trend}</span>}
                      {bottleneckCopied && <span style={{ fontSize: 11, color: "#16a34a" }}>Copied!</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      <button
                        type="button"
                        onClick={async () => {
                          const avgText = bottleneck.avgDays < 1 ? "< 1 day" : bottleneck.avgDays % 1 === 0 ? `${Math.round(bottleneck.avgDays)} days` : `${bottleneck.avgDays.toFixed(1)} days`;
                          const text = `Bottleneck: ${bottleneck.label} (avg ${avgText}) — ${bottleneck.count} candidate${bottleneck.count !== 1 ? "s" : ""} waiting`;
                          try {
                            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); } else { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
                            setBottleneckCopied(true); setTimeout(() => setBottleneckCopied(false), 1500);
                          } catch { /* ignore */ }
                        }}
                        style={{ padding: "4px 8px", fontSize: 11, border: "1px solid #d97706", background: "#fff", color: "#92400e", cursor: "pointer", borderRadius: 4 }}
                        title="Copy bottleneck summary"
                      >Copy</button>
                      <button type="button" onClick={() => { setFilterStatus(bottleneck.filterValue); setToolbarOpen(null); }} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #d97706", background: "#fff", color: "#92400e", cursor: "pointer", fontWeight: 600 }}>Show only this stage</button>
                      <button type="button" onClick={() => setBottleneckDrilldownOpen((v) => !v)} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #d97706", background: "#fff", color: "#92400e", cursor: "pointer" }}>View oldest</button>
                      <button
                        type="button"
                        onClick={() => {
                          const scroller = document.getElementById("kanbanScroller");
                          if (scroller) { const col = scroller.querySelector(`[data-status="${bottleneck.status}"]`); if (col) col.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }); }
                          setFilterStatus(bottleneck.filterValue); setBoardMode("TRIAGE"); setFilterNeedsAttentionOnly(true); setToolbarOpen(null);
                        }}
                        style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #d97706", background: "#fff", color: "#92400e", cursor: "pointer" }}
                      >Focus bottleneck</button>
                    </div>
                    {bottleneckDrilldownOpen && bottleneck.oldestSubmissions && bottleneck.oldestSubmissions.length > 0 && (
                      <div style={{ padding: "10px 0", borderTop: "1px solid #fde68a", fontSize: 12 }}>
                        {bottleneck.bottleneckByOwner && bottleneck.bottleneckByOwner.length > 0 && (
                          <>
                            <div style={{ marginBottom: 8, color: "#92400e", fontWeight: 600 }}>By owner</div>
                            <div style={{ display: "table", width: "100%", marginBottom: 12, borderCollapse: "collapse" }}>
                              <div style={{ display: "table-row", borderBottom: "1px solid #fde68a" }}>
                                <div style={{ display: "table-cell", padding: "4px 8px 4px 0", fontWeight: 600, color: "#92400e" }}>Owner</div>
                                <div style={{ display: "table-cell", padding: "4px 8px", fontWeight: 600, color: "#92400e" }}>Candidates waiting</div>
                                <div style={{ display: "table-cell", padding: "4px 8px", fontWeight: 600, color: "#92400e" }}>Avg age-in-stage</div>
                              </div>
                              {bottleneck.bottleneckByOwner.map(({ owner, count, avgAgeMs }) => {
                                const ageStr = (() => { if (!avgAgeMs || avgAgeMs < 0) return "—"; const minutes = Math.floor(avgAgeMs / (1000 * 60)); const hours = Math.floor(minutes / 60); const days = Math.floor(hours / 24); const weeks = Math.floor(days / 7); if (weeks > 0) return `${weeks}w`; if (days > 0) return `${days}d`; if (hours > 0) return `${hours}h`; return `${minutes}m`; })();
                                return (
                                  <div key={owner} role="button" tabIndex={0} onClick={() => { setFilterStatus(bottleneck.filterValue); if (owner === "Unassigned") setQueueView("UNASSIGNED"); else if (owner === currentUserDisplayName) setQueueView("MY_QUEUE"); else setSelectedBottleneckOwner(owner); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLDivElement).click(); } }} style={{ display: "table-row", cursor: "pointer", color: "#334155" }}>
                                    <div style={{ display: "table-cell", padding: "4px 8px 4px 0", borderBottom: "1px solid #fde68a" }}>{owner}</div>
                                    <div style={{ display: "table-cell", padding: "4px 8px", borderBottom: "1px solid #fde68a" }}>{count}</div>
                                    <div style={{ display: "table-cell", padding: "4px 8px", borderBottom: "1px solid #fde68a" }}>{ageStr}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                        <div style={{ marginBottom: 8, color: "#92400e", fontWeight: 600 }}>Oldest in stage (up to 10)</div>
                        {bottleneck.oldestSubmissions.map(({ sub, ageMs }, idx) => {
                          const name = `${sub.candidate?.firstName ?? ""} ${sub.candidate?.lastName ?? ""}`.trim() || "—";
                          const ownerKey = getSubmissionOwnerName(sub as any) || "Unassigned";
                          const ageStr = (() => { if (!ageMs || ageMs < 0) return "—"; const minutes = Math.floor(ageMs / (1000 * 60)); const hours = Math.floor(minutes / 60); const days = Math.floor(hours / 24); const weeks = Math.floor(days / 7); if (weeks > 0) return `${weeks}w`; if (days > 0) return `${days}d`; if (hours > 0) return `${hours}h`; return `${minutes}m`; })();
                          const needsAttention = needAttentionIds.has(sub.id);
                          const isHighlighted = selectedBottleneckOwner !== null && ownerKey === selectedBottleneckOwner;
                          const isFirstForOwner = selectedBottleneckOwner === ownerKey && bottleneck.oldestSubmissions.findIndex((x) => (getSubmissionOwnerName(x.sub as any) || "Unassigned") === ownerKey) === idx;
                          const stuckHint = (() => {
                            const isUnassigned = !getSubmissionOwnerName(sub as any);
                            const items: { t: number; kind: "event" | "message"; type?: string; fromRole?: string; note?: string }[] = [];
                            (sub.events || []).forEach((e: any) => { const t = e.createdAt ? new Date(e.createdAt).getTime() : 0; if (t) items.push({ t, kind: "event", type: e.type, note: e.note }); });
                            (sub.messages || []).forEach((m: any) => { const t = m.createdAt ? new Date(m.createdAt).getTime() : 0; if (t) items.push({ t, kind: "message", fromRole: m.fromRole }); });
                            if (items.length === 0) return isUnassigned ? "Unassigned" : null;
                            const last = items.sort((a, b) => b.t - a.t)[0];
                            const now = Date.now();
                            const daysSince = (now - last.t) / (24 * 60 * 60 * 1000);
                            const isClient = last.kind === "message" ? last.fromRole === "CLIENT" : (last.note || "").startsWith("[CLIENT]");
                            if (isUnassigned) return "Unassigned";
                            if (isClient) return "Waiting on client";
                            if (daysSince >= 2) return `No activity in ${Math.floor(daysSince)} days`;
                            if (last.kind === "message") return "Last action: Message";
                            if (last.type === "STATUS_CHANGE") return "Last action: Status change";
                            if (last.type === "QUESTION") return "Last action: Decision";
                            return "Last action: Decision";
                          })();
                          return (
                            <div key={sub.id} ref={isFirstForOwner ? scrollToOwnerRef : undefined} onClick={(e) => handleCardClick(e, sub)} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "6px 0", borderBottom: "1px solid #fde68a", cursor: "pointer", color: "#334155", background: isHighlighted ? "#fef3c7" : "transparent" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ minWidth: 120, fontWeight: 500 }}>{name}</span><span style={{ color: "#64748b", minWidth: 80 }}>{ownerKey || "—"}</span><span style={{ color: "#64748b" }}>{ageStr}</span>{needsAttention && <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 11 }}>Needs attention</span>}</div>
                              {stuckHint && <div style={{ fontSize: 10, color: "#94a3b8", marginLeft: 0 }}>{stuckHint}</div>}
                            </div>
                          );
                        })}
                        <button type="button" onClick={() => { setBottleneckDrilldownOpen(false); setSelectedBottleneckOwner(null); }} style={{ marginTop: 8, padding: 0, border: "none", background: "none", color: "#92400e", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>Close</button>
                      </div>
                    )}
                    {bottleneckDrilldownOpen && (!bottleneck.oldestSubmissions || bottleneck.oldestSubmissions.length === 0) && (
                      <div style={{ padding: "10px 0", borderTop: "1px solid #fde68a", fontSize: 12, color: "#64748b" }}>No submissions in this stage with age data. <button type="button" onClick={() => setBottleneckDrilldownOpen(false)} style={{ marginLeft: 8, padding: 0, border: "none", background: "none", color: "#92400e", cursor: "pointer", textDecoration: "underline" }}>Close</button></div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "#64748b" }}><strong>Bottleneck:</strong> Not enough data yet</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={rankSummaryButtonRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setToolbarOpen((v) => (v === "ranksummary" ? null : "ranksummary"))}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              marginBottom: "-1px",
              background: toolbarOpen === "ranksummary" ? "#e0f2fe" : "#fff",
              color: toolbarOpen === "ranksummary" ? "#0369a1" : "#475569",
              cursor: "pointer",
              fontWeight: toolbarOpen === "ranksummary" ? 600 : 400,
            }}
          >
            Rank Summary
          </button>
          {toolbarOpen === "ranksummary" && (
            <div
              ref={rankSummaryPopoverRef}
              style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 360, maxWidth: 480, maxHeight: "min(70vh, 420px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#334155", marginBottom: 10, fontSize: 14 }}>AI Match Rank Summary</div>
                {rankedSubmissionsForSummary.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rankedSubmissionsForSummary.map((sub) => {
                      const rank = rankBySubmissionId.get(sub.id);
                      const name = `${sub.candidate?.firstName ?? ""} ${sub.candidate?.lastName ?? ""}`.trim() || "—";
                      const strengths = Array.isArray(sub.strengths) ? sub.strengths : [];
                      const gaps = Array.isArray(sub.gaps) ? sub.gaps : [];
                      const sellingPoints = Array.isArray(sub.sellingPoints) ? sub.sellingPoints : [];
                      const confidence = sub.confidence != null ? Math.round(Number(sub.confidence) * 100) : null;
                      const topBadge = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
                      return (
                        <div
                          key={sub.id}
                          onClick={(e) => handleCardClick(e, sub)}
                          style={{ padding: 8, border: "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", background: "#fafafa" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            {topBadge && <span style={{ fontSize: 14 }}>{topBadge}</span>}
                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                              AI Match Rank #{rank} — {name}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                            Fit Score {sub.fitScore ?? "—"}/100
                            {confidence != null && ` · Confidence ${confidence}%`}
                          </div>
                          {(strengths.length > 0 || gaps.length > 0 || sellingPoints.length > 0) && (
                            <div style={{ fontSize: 11, color: "#475569", display: "flex", flexDirection: "column", gap: 2 }}>
                              {strengths.slice(0, 2).map((s, i) => (
                                <div key={i}>• Strengths: {s}</div>
                              ))}
                              {gaps.slice(0, 1).map((s, i) => (
                                <div key={i}>• Gaps/Risks: {s}</div>
                              ))}
                              {sellingPoints.slice(0, 1).map((s, i) => (
                                <div key={i}>• How to pitch: {s}</div>
                              ))}
                            </div>
                          )}
                          {sub.fitSummary && strengths.length === 0 && gaps.length === 0 && (
                            <div style={{ fontSize: 11, color: "#475569" }}>{sub.fitSummary}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>No candidates evaluated yet.</div>
                )}
                {notYetEvaluatedSubmissions.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#64748b", marginBottom: 6 }}>Not yet evaluated</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {notYetEvaluatedSubmissions.map((sub) => {
                        const name = `${sub.candidate?.firstName ?? ""} ${sub.candidate?.lastName ?? ""}`.trim() || "—";
                        return (
                          <div
                            key={sub.id}
                            onClick={(e) => handleCardClick(e, sub)}
                            style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer" }}
                          >
                            {name}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={suggestionsButtonRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setToolbarOpen((v) => (v === "suggestions" ? null : "suggestions"))}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              border: "1px solid #e2e8f0",
              borderBottom: "none",
              borderRadius: "6px 6px 0 0",
              marginBottom: "-1px",
              background: toolbarOpen === "suggestions" ? "#e0f2fe" : "#fff",
              color: toolbarOpen === "suggestions" ? "#0369a1" : "#475569",
              cursor: "pointer",
              fontWeight: toolbarOpen === "suggestions" ? 600 : 400,
            }}
          >
            Suggestions{suggestions.length > 0 ? " ⚠" : ""}
          </button>
          {toolbarOpen === "suggestions" && (
            <div
              ref={suggestionsPopoverRef}
              style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, minWidth: 280, maxWidth: 400, maxHeight: "min(60vh, 320px)", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden", display: "flex", flexDirection: "column" }}
            >
              <div style={{ padding: 12, overflowY: "auto", flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 8, fontSize: 14 }}>💡 Suggestions</div>
                {suggestions.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {suggestions.map((suggestion, idx) => (
                      <div key={idx} style={{ fontSize: 12, color: "#78350f", padding: "4px 0" }}>• {suggestion}</div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#64748b" }}>No suggestions right now.</div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <input
            type="text"
            value={filterSearchQuery}
            onChange={(e) => setFilterSearchQuery(e.target.value)}
            placeholder="Search candidates..."
            style={{ width: 160, padding: "5px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", color: "#334155" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={filterNeedsAttentionOnly} onChange={(e) => setFilterNeedsAttentionOnly(e.target.checked)} />
            <span style={{ color: "#475569" }}>{role === "CLIENT" ? "Need follow-up only" : "Needs Attention only"}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={filterOpenQuestionsOnly} onChange={(e) => setFilterOpenQuestionsOnly(e.target.checked)} />
            <span style={{ color: "#475569" }}>Open Questions only</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#64748b" }}>Status</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", color: "#334155" }}>
              <option value="ALL">All</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="INTERVIEW_REQUESTED">Interview</option>
              <option value="OFFER">Offer</option>
              <option value="CLOSED">Hired</option>
              <option value="DECLINED">Declined</option>
            </select>
          </label>
        </div>

        {role === "AGENCY" && (
          <button
            type="button"
            onClick={() => { setNewCandidateModalOpen(true); setNewCandidateTab("quick"); setNewCandidateError(null); setResumeFile(null); setResumeUploadStatus(null); }}
            style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #0ea5e9", borderRadius: 8, background: "#0ea5e9", color: "#fff", cursor: "pointer", fontWeight: 500 }}
          >
            + New Candidate
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 16px",
          padding: "8px 12px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 11,
          color: "#334155",
        }}
      >
        <span style={{ color: "#64748b", fontWeight: 600, marginRight: 4 }}>Summary</span>
        <span><span style={{ color: "#64748b" }}>Total</span> <strong>{submissions.length}</strong></span>
        <span><span style={{ color: "#64748b" }}>Interview</span> <strong>{statusCounts["INTERVIEW_REQUESTED"] || 0}</strong></span>
        <span><span style={{ color: "#64748b" }}>Offer</span> <strong>{inOfferCount}</strong></span>
        <span><span style={{ color: "#64748b" }}>Hired</span> <strong>{statusCounts["CLOSED"] || 0}</strong></span>
        <span><span style={{ color: "#64748b" }}>Win rate</span> <strong>{winRate ? `${winRate.rate}%` : "—"}</strong></span>
        <span><span style={{ color: "#64748b" }}>Time to fill</span> <strong>{timeToFill ? (timeToFill.avgDays < 1 ? `${Math.round(timeToFill.avgDays * 24)}h` : `${timeToFill.avgDays.toFixed(1)}d`) : "—"}</strong></span>
        <span><span style={{ color: "#64748b" }}>Momentum</span> <strong>{pipelineMomentum}</strong></span>
        <span><span style={{ color: "#64748b" }}>Client</span> <strong>{clientResponsiveness ?? "—"}</strong></span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={handleCopySummary} style={{ padding: "4px 8px", fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#475569" }}>Copy Summary</button>
          <button type="button" onClick={handleDownloadCSV} style={{ padding: "4px 8px", fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#475569" }}>Download CSV</button>
          <button type="button" onClick={() => setWeeklyUpdateOpen(true)} style={{ padding: "4px 8px", fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#475569" }}>Weekly Update</button>
        </div>
      </div>

      {newCandidateModalOpen && role === "AGENCY" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => !newCandidateBusy && setNewCandidateModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              width: "100%",
              maxWidth: 420,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>New Candidate</span>
              <button type="button" onClick={() => !newCandidateBusy && setNewCandidateModalOpen(false)} style={{ padding: "4px 8px", fontSize: 12, border: "none", background: "transparent", cursor: newCandidateBusy ? "not-allowed" : "pointer", color: "#64748b" }}>Cancel</button>
            </div>
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
              <button type="button" onClick={() => setNewCandidateTab("quick")} style={{ padding: "8px 14px", fontSize: 12, border: "none", borderBottom: newCandidateTab === "quick" ? "2px solid #0ea5e9" : "2px solid transparent", background: "none", cursor: "pointer", color: newCandidateTab === "quick" ? "#0369a1" : "#64748b", fontWeight: newCandidateTab === "quick" ? 600 : 400 }}>Quick Create</button>
              <button type="button" onClick={() => setNewCandidateTab("resume")} style={{ padding: "8px 14px", fontSize: 12, border: "none", borderBottom: newCandidateTab === "resume" ? "2px solid #0ea5e9" : "2px solid transparent", background: "none", cursor: "pointer", color: newCandidateTab === "resume" ? "#0369a1" : "#64748b", fontWeight: newCandidateTab === "resume" ? 600 : 400 }}>From Resume</button>
            </div>
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              {newCandidateTab === "quick" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ fontSize: 12, color: "#374151" }}>
                    First name *
                    <input type="text" value={quickFirstName} onChange={(e) => setQuickFirstName(e.target.value)} placeholder="First name" style={{ display: "block", marginTop: 4, width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#374151" }}>
                    Last name *
                    <input type="text" value={quickLastName} onChange={(e) => setQuickLastName(e.target.value)} placeholder="Last name" style={{ display: "block", marginTop: 4, width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#374151" }}>
                    Email (optional)
                    <input type="text" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} placeholder="Email" style={{ display: "block", marginTop: 4, width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#374151" }}>
                    Phone (optional)
                    <input type="text" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="Phone" style={{ display: "block", marginTop: 4, width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }} />
                  </label>
                  <label style={{ fontSize: 12, color: "#374151" }}>
                    Title (optional)
                    <input type="text" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="Title" style={{ display: "block", marginTop: 4, width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, boxSizing: "border-box" }} />
                  </label>
                  {newCandidateError && <p style={{ fontSize: 12, color: "#dc2626" }}>{newCandidateError}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => !newCandidateBusy && setNewCandidateModalOpen(false)} style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: newCandidateBusy ? "not-allowed" : "pointer" }}>Cancel</button>
                    <button
                      type="button"
                      disabled={newCandidateBusy || !quickFirstName.trim() || !quickLastName.trim()}
                      onClick={async () => {
                        setNewCandidateError(null);
                        setNewCandidateBusy(true);
                        try {
                          const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/requisitions/${requisitionId}/submissions/new`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              firstName: quickFirstName.trim(),
                              lastName: quickLastName.trim(),
                              email: quickEmail.trim() || undefined,
                              phone: quickPhone.trim() || undefined,
                              title: quickTitle.trim() || undefined,
                            }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) {
                            setNewCandidateError(typeof data?.error === "string" ? data.error : "Failed to create");
                            return;
                          }
                          setQuickFirstName(""); setQuickLastName(""); setQuickEmail(""); setQuickPhone(""); setQuickTitle("");
                          setNewCandidateModalOpen(false);
                          router.refresh();
                        } catch (e) {
                          setNewCandidateError(e instanceof Error ? e.message : "Failed to create");
                        } finally {
                          setNewCandidateBusy(false);
                        }
                      }}
                      style={{ padding: "6px 12px", fontSize: 12, border: "none", borderRadius: 6, background: "#0ea5e9", color: "#fff", cursor: newCandidateBusy ? "not-allowed" : "pointer", fontWeight: 500 }}
                    >
                      {newCandidateBusy ? "Creating…" : "Create"}
                    </button>
                  </div>
                </div>
              )}
              {newCandidateTab === "resume" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "#64748b" }}>Drop from File Explorer or choose file. PDF, DOC, or DOCX.</p>
                  <input type="file" id="new-candidate-resume" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) setResumeFile(f); e.target.value = ""; }} />
                  <div
                    style={{ border: "2px dashed #e2e8f0", borderRadius: 8, padding: 24, textAlign: "center", cursor: "pointer", background: resumeFile ? "#f0fdf4" : "#f8fafc" }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f && /\.(pdf|doc|docx)$/i.test(f.name)) setResumeFile(f); }}
                    onClick={() => document.getElementById("new-candidate-resume")?.click()}
                  >
                    {resumeFile ? <span style={{ fontSize: 12, color: "#16a34a" }}>{resumeFile.name}</span> : <span style={{ fontSize: 12, color: "#64748b" }}>Drop file or click to choose</span>}
                  </div>
                  {resumeUploadStatus && <p style={{ fontSize: 12, color: "#64748b" }}>{resumeUploadStatus}</p>}
                  {newCandidateError && <p style={{ fontSize: 12, color: "#dc2626" }}>{newCandidateError}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={() => !newCandidateBusy && setNewCandidateModalOpen(false)} style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: newCandidateBusy ? "not-allowed" : "pointer" }}>Cancel</button>
                    <button
                      type="button"
                      disabled={newCandidateBusy || !resumeFile}
                      onClick={async () => {
                        if (!resumeFile) return;
                        setNewCandidateError(null);
                        setNewCandidateBusy(true);
                        const nameFromFile = (() => { const base = resumeFile.name.replace(/\.(pdf|doc|docx)$/i, ""); const parts = base.split(/[\s_]+/).filter(Boolean); const first = parts[0] || "Candidate"; const last = parts.length > 1 ? parts[parts.length - 1] : "Candidate"; return { firstName: first, lastName: last }; })();
                        try {
                          setResumeUploadStatus("Creating candidate…");
                          const createRes = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/requisitions/${requisitionId}/submissions/new`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ firstName: nameFromFile.firstName, lastName: nameFromFile.lastName }),
                          });
                          const createData = await createRes.json().catch(() => ({}));
                          if (!createRes.ok) {
                            setNewCandidateError(typeof createData?.error === "string" ? createData.error : "Failed to create candidate");
                            return;
                          }
                          const candidateId = createData?.candidateId;
                          if (!candidateId) {
                            setNewCandidateError("No candidate id returned");
                            return;
                          }
                          setResumeUploadStatus("Uploading resume…");
                          const form = new FormData();
                          form.append("file", resumeFile);
                          const uploadRes = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/candidates/${candidateId}/resume`, { method: "POST", body: form });
                          if (!uploadRes.ok) {
                            const uploadData = await uploadRes.json().catch(() => ({}));
                            setNewCandidateError(typeof uploadData?.error === "string" ? uploadData.error : "Resume upload failed");
                            return;
                          }
                          setResumeFile(null);
                          setResumeUploadStatus(null);
                          setNewCandidateModalOpen(false);
                          router.refresh();
                        } catch (e) {
                          setNewCandidateError(e instanceof Error ? e.message : "Failed");
                        } finally {
                          setNewCandidateBusy(false);
                          setResumeUploadStatus(null);
                        }
                      }}
                      style={{ padding: "6px 12px", fontSize: 12, border: "none", borderRadius: 6, background: "#0ea5e9", color: "#fff", cursor: newCandidateBusy ? "not-allowed" : "pointer", fontWeight: 500 }}
                    >
                      {newCandidateBusy ? "Creating…" : "Create & upload"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {weeklyUpdateOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={() => setWeeklyUpdateOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              maxWidth: 560,
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Weekly Update</span>
              <select
                value={weeklyUpdateTemplate}
                onChange={(e) => setWeeklyUpdateTemplate(e.target.value as "Internal" | "Client")}
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#fff",
                  color: "#475569",
                }}
              >
                <option value="Internal">Internal</option>
                <option value="Client">Client</option>
              </select>
            </div>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#64748b" }}>Client contact</span>
                <input
                  type="text"
                  value={weeklyUpdateClientName}
                  onChange={(e) => setWeeklyUpdateClientName(e.target.value)}
                  placeholder="Optional"
                  style={{ width: 140, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#64748b" }}>Internal owner</span>
                <input
                  type="text"
                  value={weeklyUpdateOwnerName}
                  onChange={(e) => setWeeklyUpdateOwnerName(e.target.value)}
                  placeholder="Optional"
                  style={{ width: 140, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12 }}
                />
              </label>
            </div>
            <pre
              style={{
                flex: 1,
                margin: 0,
                padding: 16,
                fontSize: 12,
                fontFamily: "inherit",
                whiteSpace: "pre-wrap",
                overflow: "auto",
                color: "#334155",
              }}
            >
              {getWeeklyUpdateText(weeklyUpdateTemplate, openQuestionsWithSubmission)}
            </pre>
            {openQuestionsWithSubmission.length > 0 && (
              <div style={{ padding: "8px 16px", borderTop: "1px solid #e2e8f0", fontSize: 12 }}>
                <div style={{ color: "#64748b", marginBottom: 6 }}>Open Questions</div>
                {openQuestionsWithSubmission.map((q) => (
                  <div key={q.submission.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: "#334155" }}>{q.name} — {q.summary}</span>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(q.submission);
                          setDetailOpen(true);
                          setWeeklyUpdateOpen(false);
                        }}
                        style={{
                          padding: "2px 8px",
                          fontSize: 11,
                          border: "1px solid #e2e8f0",
                          borderRadius: 4,
                          background: "#fff",
                          cursor: "pointer",
                          color: "#475569",
                        }}
                      >
                        Reply
                      </button>
                      {onMarkOpenQuestionResolved && role === "AGENCY" && (
                        <button
                          type="button"
                          onClick={async () => {
                            await onMarkOpenQuestionResolved(q.submission.id, q.summary);
                            router.refresh();
                          }}
                          style={{
                            padding: "2px 8px",
                            fontSize: 11,
                            border: "1px solid #e2e8f0",
                            borderRadius: 4,
                            background: "#f1f5f9",
                            cursor: "pointer",
                            color: "#475569",
                          }}
                        >
                          Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(getWeeklyUpdateText(weeklyUpdateTemplate, openQuestionsWithSubmission)).catch(() => {});
                }}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#f1f5f9",
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                Copy Update
              </button>
              <button
                type="button"
                onClick={() => setWeeklyUpdateOpen(false)}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#fff",
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {boardMode === "BOARD" && role === "AGENCY" && selectedSubmissionIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
            padding: "8px 12px",
            background: "#f1f5f9",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <span style={{ color: "#475569" }}>{selectedSubmissionIds.size} selected</span>
          <button
            type="button"
            onClick={async () => {
              const ids = Array.from(selectedSubmissionIds);
              await onBulkMarkFollowUpDone?.(ids);
              setSelectedSubmissionIds(new Set());
            }}
            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
          >
            Mark Follow-up Done
          </button>
          <button
            type="button"
            onClick={async () => {
              const ids = Array.from(selectedSubmissionIds);
              await onBulkSendNudge?.(ids);
              setSelectedSubmissionIds(new Set());
            }}
            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
          >
            Send Nudge
          </button>
          <button
            type="button"
            onClick={() => setSelectedSubmissionIds(new Set())}
            style={{ padding: "4px 10px", fontSize: 12, color: "#64748b", border: "none", background: "none", cursor: "pointer" }}
          >
            Clear
          </button>
        </div>
      )}

      {actionError && (
        <div style={{ padding: "8px 12px", marginBottom: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#991b1b" }}>
          {actionError}
        </div>
      )}
      {boardMode === "BOARD" ? (
        <KanbanLane
          columns={columns}
          submissions={filteredSubmissions as any}
          rankBySubmissionId={rankBySubmissionId}
          onMove={handleMove as any}
          onCardClick={handleCardClick as any}
          onBeforeJumpToStale={() => {
            setDetailOpen(false);
            setAnchorRect(null);
          }}
          now={now}
          role={role}
          selectedIds={role === "AGENCY" ? selectedSubmissionIds : undefined}
          onToggleSelect={role === "AGENCY" ? (id) => setSelectedSubmissionIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }) : undefined}
          onMarkInterested={role === "CLIENT" ? onMarkInterested : undefined}
          onNeedInfo={role === "CLIENT" ? onNeedInfo : undefined}
          onRequestInterview={role === "CLIENT" ? onRequestInterview : undefined}
          onMakeOffer={role === "CLIENT" ? onMakeOffer : undefined}
          onOfferDeclined={role === "CLIENT" ? onOfferDeclined : undefined}
          onMarkPass={role === "CLIENT" ? onMarkPass : undefined}
          onAddFeedback={role === "CLIENT" ? onAddFeedback : undefined}
          onOpenResumeViewer={(url, candidateName, filename, resumeText, candidateId) => setResumeViewer({ open: true, url: url ?? null, candidateName, filename, resumeText, candidateId: candidateId ?? null })}
        />
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Candidate</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Priority</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Owner</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Age in stage</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Last client activity</th>
                <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {triageRows.map((r) => (
                <React.Fragment key={r.id}>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px" }}>{r.name || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{r.statusText}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ fontWeight: r.priorityText === "High" ? 700 : 500, color: r.priorityText === "High" ? "#b91c1c" : "#475569" }}>
                        {r.priorityText}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>
                      {role === "AGENCY" ? (
                        editingOwnerRowId === r.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="text"
                              value={editingOwnerValue}
                              onChange={(e) => setEditingOwnerValue(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  const v = editingOwnerValue.trim();
                                  if (v && onSetOwnerWithHandoff) {
                                    await onSetOwnerWithHandoff(r.id, v);
                                    setEditingOwnerRowId(null);
                                    setEditingOwnerValue("");
                                    router.refresh();
                                  }
                                } else if (e.key === "Escape") {
                                  setEditingOwnerRowId(null);
                                  setEditingOwnerValue("");
                                }
                              }}
                              autoFocus
                              style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 4, width: 120 }}
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const v = editingOwnerValue.trim();
                                if (v && onSetOwnerWithHandoff) {
                                  await onSetOwnerWithHandoff(r.id, v);
                                  setEditingOwnerRowId(null);
                                  setEditingOwnerValue("");
                                  router.refresh();
                                }
                              }}
                              style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#fff", cursor: "pointer" }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOwnerRowId(null);
                                setEditingOwnerValue("");
                              }}
                              style={{ padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => {
                              setEditingOwnerRowId(r.id);
                              setEditingOwnerValue(r.ownerName || "");
                            }}
                            style={{ cursor: "pointer", textDecoration: "underline", color: r.ownerName ? "#475569" : "#94a3b8" }}
                            title="Click to edit"
                          >
                            {r.ownerName || "Unassigned"}
                          </span>
                        )
                      ) : (
                        <span>{r.ownerName || "—"}</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{r.stageAgeText}</td>
                    <td style={{ padding: "10px 12px", color: "#475569" }}>{r.lastClientText}</td>
                    <td style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <button
                        type="button"
                        onClick={(e) => handleCardClick(e, r.submission)}
                        style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/submissions/${r.id}`)}
                        style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => { setQuickNoteRowId(r.id); setQuickNoteText(""); }}
                        style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                      >
                        Quick note
                      </button>
                      {getNextStatus(r.status) && role === "AGENCY" && (
                        <button
                          type="button"
                          onClick={async () => {
                            const next = getNextStatus(r.status);
                            if (next) { await handleMove(r.id, next); router.refresh(); }
                          }}
                          style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                        >
                          Move forward
                        </button>
                      )}
                    </td>
                  </tr>
                  {quickNoteRowId === r.id && (
                    <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                      <td colSpan={7} style={{ padding: "10px 12px" }}>
                        <textarea
                          value={quickNoteText}
                          onChange={(e) => setQuickNoteText(e.target.value)}
                          placeholder="Add a note..."
                          rows={2}
                          style={{ width: "100%", maxWidth: 400, padding: 8, fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 6 }}
                        />
                        <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={async () => {
                              const t = quickNoteText.trim();
                              if (t) await onAddFeedback(r.id, t);
                              setQuickNoteRowId(null);
                              setQuickNoteText("");
                              router.refresh();
                            }}
                            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #0ea5e9", background: "#0ea5e9", color: "#fff", cursor: "pointer" }}
                          >
                            Submit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setQuickNoteRowId(null); setQuickNoteText(""); }}
                            style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {triageRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "14px 12px", color: "#64748b" }}>
                    No submissions match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {mounted &&
        detailOpen &&
        selectedSubmission &&
        anchorRect &&
        createPortal(
          <CandidateDetailSheet
            open={detailOpen}
            onOpenChange={(open) => {
              setDetailOpen(open);
              if (!open) {
                setAnchorRect(null);
                setSelectedSubmission(null);
              }
            }}
            anchorRect={anchorRect}
            submission={selectedSubmission as any}
            candidateId={selectedSubmission?.candidate?.id ?? ""}
            role={role}
            onRequestInterview={onRequestInterview as any}
            onDecline={onDecline as any}
            onAddFeedback={onAddFeedback as any}
            onMarkInterested={async (id: string) => {
              await onMarkInterested(id);
            }}
            onMarkPass={async (id: string) => {
              await onMarkPass(id);
            }}
            onNeedInfo={async (id: string) => {
              await onNeedInfo(id);
            }}
            onMakeOffer={onMakeOffer as any}
            onOfferAccepted={onOfferAccepted as any}
            onOfferDeclined={onOfferDeclined as any}
            onSetOwner={
              onSetOwner
                ? async (id, name) => {
                    await onSetOwner(id, name);
                    router.refresh();
                  }
                : undefined
            }
            onOpenResumeViewer={(url, candidateName, filename, resumeText, candidateId) => setResumeViewer({ open: true, url: url ?? null, candidateName, filename, resumeText, candidateId: candidateId ?? null })}
          />,
          document.body
        )}

      {mounted &&
        resumeViewer.open &&
        (resumeViewer.url || resumeViewer.resumeText) &&
        createPortal(
          <ResumeViewer
            open={resumeViewer.open}
            onClose={() => setResumeViewer({ open: false, url: null, resumeText: null, candidateId: null })}
            resumeUrl={resumeViewer.url}
            resumeFilename={resumeViewer.filename}
            candidateName={resumeViewer.candidateName}
            resumeText={resumeViewer.resumeText}
            candidateId={resumeViewer.candidateId}
            onPreviewGenerated={(text) => setResumeViewer((prev) => ({ ...prev, resumeText: text }))}
          />,
          document.body
        )}
    </>
  );
}

