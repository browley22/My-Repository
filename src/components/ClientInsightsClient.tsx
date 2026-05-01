"use client";

import * as React from "react";
import Link from "next/link";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString();
}

type AccountTabId =
  | "PERFORMANCE"
  | "CONSULTANTS"
  | "JOB_ORDERS"
  | "RENEWALS"
  | "KEY_STAKEHOLDERS"
  | "SIGNALS"
  | "OPPORTUNITIES"
  | "RISK"
  | "BRIEFING";

const DEFAULT_TABS: { tabId: AccountTabId; label: string }[] = [
  { tabId: "PERFORMANCE", label: "Performance" },
  { tabId: "CONSULTANTS", label: "Consultants" },
  { tabId: "JOB_ORDERS", label: "Job Orders" },
  { tabId: "RENEWALS", label: "Renewals" },
  { tabId: "KEY_STAKEHOLDERS", label: "Key Stakeholders" },
  { tabId: "SIGNALS", label: "Signals" },
  { tabId: "OPPORTUNITIES", label: "Opportunities" },
  { tabId: "RISK", label: "Risk" },
  { tabId: "BRIEFING", label: "Briefing" },
];

type Props = {
  clientName: string;
  clientId: string;
  summary: {
    totalRequisitions: number;
    openRequisitions: number;
    placements: number;
    winRate: number | null;
    totalOffers: number;
  };
  openRequisitions: { id: string; title: string }[];
  pastRequisitions: { id: string; title: string }[];
  recentActivity: { id: string; description: string; timestamp: number }[];
};

type PulseResponse = "up" | "ok" | "down";

type EngagementPulse = {
  consultantName: string;
  clientName: string;
  pulseSchedule: string; // e.g. "Weekly", "Bi-weekly", "Monthly"
  response: PulseResponse;
  timestamp: number;
};

type PulseCadence = "weekly" | "biweekly" | "monthly";

type EngagementPulseSettings = {
  cadence: PulseCadence;
  automationEnabled: boolean;
  nextPulseAt: number | null;
};

type SortableTabProps = {
  tab: AccountTabId;
  label: string;
  selected: boolean;
  base: CSSProperties;
  activeStyle: CSSProperties;
  inactiveStyle: CSSProperties;
  hoverStyle: CSSProperties;
  isHovered: boolean;
  onClick: (tab: AccountTabId) => void;
  onHoverChange: (tab: AccountTabId | null) => void;
};

function SortableTab({
  tab,
  label,
  selected,
  base,
  activeStyle,
  inactiveStyle,
  hoverStyle,
  isHovered,
  onClick,
  onHoverChange,
}: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab,
  });

  const wrapperStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? "grabbing" : "grab",
  };

  const buttonStyle: CSSProperties = {
    ...base,
    ...(selected ? activeStyle : inactiveStyle),
    ...(!selected && isHovered ? hoverStyle : {}),
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };

  const handleStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    paddingInline: 2,
    cursor: isDragging ? "grabbing" : "grab",
    color: "#94a3b8",
    fontSize: 10,
  };

  return (
    <div ref={setNodeRef} style={wrapperStyle}>
      <button
        type="button"
        onClick={() => onClick(tab)}
        onMouseEnter={() => onHoverChange(tab)}
        onMouseLeave={() => onHoverChange(null)}
        style={buttonStyle}
      >
        <span>{label}</span>
        <span {...attributes} {...listeners} style={handleStyle} aria-label="Reorder tab">
          ⋮⋮
        </span>
      </button>
    </div>
  );
}

const AI_SUMMARY_PLACEHOLDER =
  "Relationship stable. Engagement steady. Two consultants nearing renewal. Recommend proactive check-in.";

// Simple labels used across the header/status area.
const ENGAGEMENT_LABEL = "Stable";
const RISK_LABEL = "—";
const ACCOUNT_STATUS_LABEL = "Healthy";

type CSSProperties = React.CSSProperties;

const hoverBg = "#eff6ff";
const hoverBorder = "#bfdbfe";

const pillBase: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  background: "#f8fafc",
  color: "#475569",
};

const pillInteractive: CSSProperties = {
  cursor: "pointer",
  userSelect: "none",
  transition: "background 120ms ease, border-color 120ms ease",
};

/** Today's date for display (e.g. "Feb 25") */
function formatToday(): string {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ClientInsightsClient({
  clientName,
  clientId,
  summary,
  openRequisitions,
  pastRequisitions,
  recentActivity,
}: Props) {
  const [accountTab, setAccountTab] = React.useState<AccountTabId>("PERFORMANCE");

  const [consultantsOpenSection, setConsultantsOpenSection] = React.useState<"current" | "previous" | null>("current");
  const [jobOrdersOpenSection, setJobOrdersOpenSection] = React.useState<"current" | "previous" | null>("current");
  const [showBriefing, setShowBriefing] = React.useState(false);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);
  const [healthExpanded, setHealthExpanded] = React.useState(false);
  const [orderedTabs, setOrderedTabs] = React.useState<AccountTabId[]>(
    DEFAULT_TABS.map((t) => t.tabId)
  );

  // Local-only hybrid pulse configuration (no persistence yet).
  const [pulseSettings, setPulseSettings] = React.useState<EngagementPulseSettings>({
    cadence: "weekly",
    automationEnabled: true,
    nextPulseAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  const pillStyle = (key: string, extra?: CSSProperties): CSSProperties => ({
    ...pillBase,
    ...pillInteractive,
    ...(hoverKey === key
      ? {
          background: hoverBg,
          borderColor: hoverBorder,
        }
      : {}),
    ...(extra || {}),
  });

  // Derive light-weight attention signals from existing data, then backfill with placeholders.
  const attentionSignals: string[] = [];
  if (openRequisitions.length > 0) {
    attentionSignals.push(
      `${openRequisitions.length} open job order${openRequisitions.length > 1 ? "s" : ""} — keep pipeline warm`
    );
  }
  if (recentActivity.length === 0) {
    attentionSignals.push("No recent activity — consider a touchpoint");
  }
  if (summary.placements > 0) {
    attentionSignals.push(
      `${summary.placements} placement${summary.placements > 1 ? "s" : ""} delivered — maintain momentum`
    );
  }
  const attentionPlaceholders = [
    "Renewal coming up — needs conversation",
    "No meaningful client touch in -- days",
    "Hiring activity trending --",
  ];
  for (let i = 0; attentionSignals.length < 3 && i < attentionPlaceholders.length; i += 1) {
    attentionSignals.push(attentionPlaceholders[i]);
  }

  const healthBg =
    ACCOUNT_STATUS_LABEL === "Healthy"
      ? "#ecfdf3" // green-50
      : ACCOUNT_STATUS_LABEL === "Watch"
      ? "#fffbeb" // yellow-50
      : ACCOUNT_STATUS_LABEL === "At Risk"
      ? "#fef2f2" // red-50
      : "#f8fafc";

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("client360_tab_order");
      if (raw) {
        const stored = JSON.parse(raw) as AccountTabId[];
        const base: AccountTabId[] = DEFAULT_TABS.map((t) => t.tabId);
        const inStoredOrder = stored.filter((id) => base.includes(id));
        const missing = base.filter((id) => !stored.includes(id));
        const merged = [...inStoredOrder, ...missing];
        setOrderedTabs(merged);
        if (merged.length > 0) {
          setAccountTab(merged[0]);
        }
      }
    } catch {
      // ignore bad localStorage
    }
  }, [clientId]);

  const handleTabDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setOrderedTabs((tabs) => {
        const oldIndex = tabs.indexOf(active.id as AccountTabId);
        const newIndex = tabs.indexOf(over.id as AccountTabId);
        if (oldIndex === -1 || newIndex === -1) return tabs;
        const next = arrayMove(tabs, oldIndex, newIndex);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem("client360_tab_order", JSON.stringify(next));
          } catch {
            // ignore write errors
          }
        }
        return next;
      });
    },
    []
  );

  const engagementRightColumn = (
    <div
      className="client360-engagement-right"
      style={{
        position: "sticky",
        top: 88,
        alignSelf: "flex-start",
        display: "grid",
        gap: 12,
      }}
    >
      <section
        style={{
          padding: "12px 14px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}
      >
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#64748b",
            margin: "0 0 8px 0",
          }}
        >
          Engagement Pulse
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>Current sentiment</span>
            <span style={{ fontWeight: 500, color: "#0f172a" }}>--</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>Last feedback</span>
            <span style={{ fontWeight: 500, color: "#0f172a" }}>--</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>Next pulse</span>
            <span style={{ fontWeight: 500, color: "#0f172a" }}>
              {pulseSettings.automationEnabled && pulseSettings.nextPulseAt
                ? new Date(pulseSettings.nextPulseAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "Paused"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#64748b" }}>Automation</span>
            <button
              type="button"
              onClick={() =>
                setPulseSettings((prev) => ({
                  ...prev,
                  automationEnabled: !prev.automationEnabled,
                }))
              }
              onMouseEnter={() => setHoverKey("pulse-automation-tab")}
              onMouseLeave={() => setHoverKey(null)}
              style={pillStyle("pulse-automation-tab", {
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
              })}
            >
              {pulseSettings.automationEnabled ? "On (auto)" : "Paused"}
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          padding: "12px 14px",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}
      >
        <h3 style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
          Engagement Pulse Timeline
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
          No engagement pulses recorded yet.
        </p>
      </section>
    </div>
  );

  const accountTabs: AccountTabId[] = DEFAULT_TABS.map((t) => t.tabId);

  return (
    <>
      {/* A) Thin header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          paddingBottom: 8,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#111827" }}>
            Client 360 — {clientName}
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, marginBottom: 0 }}>Agency-only view</p>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "#64748b",
            textDecoration: "none",
            cursor: "default",
          }}
        >
          View in CRM ↗
        </span>
      </div>

      {/* Account Health Banner */}
      <div
        style={{
          marginTop: 8,
          marginBottom: 16,
          borderRadius: 8,
          background: healthBg,
          border: "1px solid rgba(148, 163, 184, 0.35)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setHealthExpanded((prev) => !prev)}
          style={{
            width: "100%",
            padding: "10px 14px",
            border: "none",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, textAlign: "left" }}>
            <span style={{ fontSize: 11, color: "#64748b" }}>Account Status</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
              {ACCOUNT_STATUS_LABEL}
            </span>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              Overall relationship health based on recent activity and delivery.
            </span>
          </div>
          <span
            aria-hidden="true"
            style={{
              fontSize: 12,
              color: "#64748b",
              marginLeft: 12,
            }}
          >
            {healthExpanded ? "▾" : "▸"}
          </span>
        </button>
        <div
          style={{
            maxHeight: healthExpanded ? 160 : 0,
            opacity: healthExpanded ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 200ms ease, opacity 160ms ease",
          }}
        >
          <div style={{ padding: healthExpanded ? "4px 14px 10px" : "0 14px", fontSize: 12, color: "#0f172a" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Why this status</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li style={{ marginBottom: 2 }}>
                Recent activity:{" "}
                {recentActivity.length === 0 ? "no recent client touches detected." : "recent interactions logged."}
              </li>
              <li style={{ marginBottom: 2 }}>
                Open demand: {openRequisitions.length} open role
                {openRequisitions.length === 1 ? "" : "s"} indicating ongoing partnership.
              </li>
              <li>
                Delivery track record: {summary.placements > 0 ? "placements delivered for this client." : "no placements yet; early-stage account."}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* B) Single Narrative Insight Strip — AI Summary card */}
      <div
        style={{
          padding: "16px 20px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "0 0 8px 0" }}>AI Summary</h2>
            <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.5, margin: "0 0 12px 0" }}>
              {AI_SUMMARY_PLACEHOLDER}
            </p>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              Health: — · Last touch: {recentActivity.length > 0 ? formatTimeAgo(recentActivity[0].timestamp) : "—"} · Next milestone: —
            </div>
          </div>
        </div>
      </div>
      {/* Account details tabs */}
      <div
        style={{
          borderBottom: "1px solid #e2e8f0",
          marginBottom: 16,
          marginTop: 4,
        }}
      >
        <DndContext collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
          <SortableContext items={orderedTabs} strategy={horizontalListSortingStrategy}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {orderedTabs.map((tabId) => {
                const tabDef = DEFAULT_TABS.find((t) => t.tabId === tabId);
                if (!tabDef) return null;
                const selected = tabId === accountTab;
                const key = `tab-${tabId}`;
                const isHovered = hoveredTab === tabId;
                const label = tabDef.label;

                const base: CSSProperties = {
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 120ms ease, border-color 120ms ease",
                  borderWidth: 1,
                  borderStyle: "solid",
                };

                const activeStyle: CSSProperties = {
                  background: "#f1f5f9",
                  borderColor: "#e2e8f0",
                  color: "#0f172a",
                  fontWeight: 600,
                };

                const inactiveStyle: CSSProperties = {
                  background: "transparent",
                  borderColor: "transparent",
                  color: "#64748b",
                  fontWeight: 400,
                };

                const hoverStyle: CSSProperties = {
                  background: hoverBg,
                  borderColor: hoverBorder,
                };

                return (
                  <SortableTab
                    key={key}
                    tab={tabId}
                    label={label}
                    selected={selected}
                    base={base}
                    activeStyle={activeStyle}
                    inactiveStyle={inactiveStyle}
                    hoverStyle={hoverStyle}
                    isHovered={isHovered}
                    onClick={setAccountTab}
                    onHoverChange={setHoveredTab}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Performance tab (formerly Overview) */}
      {accountTab === "PERFORMANCE" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          {/* Left: Account status + Performance snapshot + light context */}
          <div>
            {/* Performance: 4 compact stat blocks (one calm band) */}
            <section
              className="client360-perf"
              style={{
                marginTop: 20,
                padding: "14px 16px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3 style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 12px 0" }}>
                Performance
              </h3>
              <div
                className="client360-perf-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 16,
                }}
              >
                {/* 1) Pipeline Velocity — TODO: needs submission + interview timestamps (last 90 days) */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Pipeline Velocity</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>—</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    Avg time from submit → interview (last 90 days)
                  </div>
                </div>
                {/* 2) Win Rate — from summary.winRate when available */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Win Rate</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>
                    {summary.winRate != null ? `${summary.winRate}%` : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    Placements / offers
                  </div>
                </div>
                {/* 3) Hiring Forecast — TODO: needs req volume trend (last 6 months) */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Hiring Forecast</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>—</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>
                    Based on req volume trend (last 6 months)
                  </div>
                </div>
                {/* 4) Today — client-side date; last sync placeholder unless updatedAt/fetchedAt available */}
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Today</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{formatToday()}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>Last sync: —</div>
                </div>
              </div>
            </section>

          </div>

          {/* Right: Engagement (sticky) */}
          {engagementRightColumn}
        </div>
      )}

      {/* Consultants tab */}
      {accountTab === "CONSULTANTS" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            {/* Consultants accordion: Current */}
            <section
              style={{
                marginBottom: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setConsultantsOpenSection((curr) => (curr === "current" ? null : "current"))
                }
                onMouseEnter={() => setHoverKey("consultants-current")}
                onMouseLeave={() => setHoverKey(null)}
                style={pillStyle("consultants-current", {
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                })}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Current consultants on billing
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    0
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {consultantsOpenSection === "current" ? "▾" : "▸"}
                </span>
              </button>
              {consultantsOpenSection === "current" && (
                <div style={{ padding: "8px 12px 10px" }}>
                  {/* Existing content, kept as-is */}
                  <p style={{ fontSize: 13, color: "#64748b" }}>Coming soon.</p>
                </div>
              )}
            </section>

            {/* Consultants accordion: Previous */}
            <section
              style={{
                marginBottom: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setConsultantsOpenSection((curr) => (curr === "previous" ? null : "previous"))
                }
                onMouseEnter={() => setHoverKey("consultants-previous")}
                onMouseLeave={() => setHoverKey(null)}
                style={pillStyle("consultants-previous", {
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                })}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Previous consultants on billing
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    0
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {consultantsOpenSection === "previous" ? "▾" : "▸"}
                </span>
              </button>
              {consultantsOpenSection === "previous" && (
                <div style={{ padding: "8px 12px 10px" }}>
                  {/* Existing content, kept as-is */}
                  <p style={{ fontSize: 13, color: "#64748b" }}>Coming soon.</p>
                </div>
              )}
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Job Orders tab */}
      {accountTab === "JOB_ORDERS" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            {/* Job Orders accordion: Current job orders */}
            <section
              style={{
                marginBottom: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setJobOrdersOpenSection((curr) => (curr === "current" ? null : "current"))
                }
                onMouseEnter={() => setHoverKey("jobs-current")}
                onMouseLeave={() => setHoverKey(null)}
                style={pillStyle("jobs-current", {
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                })}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Current job orders
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {openRequisitions.length}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {jobOrdersOpenSection === "current" ? "▾" : "▸"}
                </span>
              </button>
              {jobOrdersOpenSection === "current" && (
                <div style={{ padding: "8px 12px 10px" }}>
                  {/* Existing content, kept as-is */}
                  {openRequisitions.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {openRequisitions.map((r) => (
                        <li key={r.id} style={{ marginBottom: 4 }}>
                          <Link
                            href={`/requisitions/${r.id}`}
                            style={{ color: "#0369a1", textDecoration: "none", fontSize: 13 }}
                          >
                            {r.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 13, color: "#64748b" }}>No open requisitions.</p>
                  )}
                </div>
              )}
            </section>

            {/* Job Orders accordion: Previous job orders */}
            <section
              style={{
                marginBottom: 12,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setJobOrdersOpenSection((curr) => (curr === "previous" ? null : "previous"))
                }
                onMouseEnter={() => setHoverKey("jobs-previous")}
                onMouseLeave={() => setHoverKey(null)}
                style={pillStyle("jobs-previous", {
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "transparent",
                })}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Previous job orders
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "#f8fafc",
                      color: "#64748b",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {pastRequisitions.length}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {jobOrdersOpenSection === "previous" ? "▾" : "▸"}
                </span>
              </button>
              {jobOrdersOpenSection === "previous" && (
                <div style={{ padding: "8px 12px 10px" }}>
                  {/* Existing content, kept as-is */}
                  {pastRequisitions.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {pastRequisitions.map((r) => (
                        <li key={r.id} style={{ marginBottom: 4 }}>
                          <Link
                            href={`/requisitions/${r.id}`}
                            style={{ color: "#0369a1", textDecoration: "none", fontSize: 13 }}
                          >
                            {r.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ fontSize: 13, color: "#64748b" }}>No closed requisitions.</p>
                  )}
                </div>
              )}
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Renewals tab */}
      {accountTab === "RENEWALS" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  margin: "0 0 8px 0",
                  color: "#111827",
                }}
              >
                Renewal Timeline
              </h2>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>No renewal dates available.</p>
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Risk tab */}
      {accountTab === "RISK" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                Risk Overview
              </h3>
              <p style={{ fontSize: 12, color: "#475569", margin: "0 0 8px 0" }}>
                Risk level:{" "}
                <span style={{ fontWeight: 600 }}>
                  {summary.placements > 0 ? "Medium" : "Low"}
                </span>
              </p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 12px 0" }}>
                Last updated: {formatToday()}
              </p>
              <div style={{ fontSize: 12, color: "#0f172a" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Risk signals</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 10,
                        background: "#fef3c7",
                        color: "#92400e",
                        marginRight: 6,
                      }}
                    >
                      MED
                    </span>
                    Limited recent activity — consider a proactive touchpoint.
                  </li>
                  <li style={{ marginBottom: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 10,
                        background: "#dcfce7",
                        color: "#166534",
                        marginRight: 6,
                      }}
                    >
                      LOW
                    </span>
                    Stable placements delivered; relationship appears steady.
                  </li>
                  <li>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 10,
                        background: "#fee2e2",
                        color: "#b91c1c",
                        marginRight: 6,
                      }}
                    >
                      HIGH
                    </span>
                    Renewal timing unclear — align on contract extensions early.
                  </li>
                </ul>
              </div>
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Key Stakeholders tab */}
      {accountTab === "KEY_STAKEHOLDERS" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div>
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                Key Stakeholders
              </h3>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>No stakeholders captured yet.</p>
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Signals tab */}
      {accountTab === "SIGNALS" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            {/* Attention Signals */}
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3 style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
                Attention Signals
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155" }}>
                {attentionSignals.slice(0, 3).map((signal, index) => (
                  <li key={index} style={{ marginBottom: 4 }}>
                    {signal}
                  </li>
                ))}
              </ul>
            </section>

            {/* Hiring Signals */}
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3 style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 8px 0" }}>
                Hiring Signals
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#334155" }}>
                <li style={{ marginBottom: 4 }}>Req volume: --</li>
                <li style={{ marginBottom: 4 }}>Interview velocity: --</li>
                <li>60-day outlook: --</li>
              </ul>
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Opportunities tab */}
      {accountTab === "OPPORTUNITIES" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            {/* AI Opportunity Highlights */}
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                AI Opportunity Highlights
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#0f172a" }}>
                <li style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>Renewal expansion on data team</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    Renewal timing and open data roles suggest appetite for additional consultants.
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 10,
                        background: "#dcfce7",
                        color: "#166534",
                      }}
                    >
                      HIGH
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Suggested action: propose 1–2 additional analysts tied to upcoming projects.
                    </span>
                  </div>
                </li>
                <li style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>Leadership visibility session</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    Recent stakeholder changes create a window to re-introduce your team’s impact.
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 10,
                        background: "#fef3c7",
                        color: "#92400e",
                      }}
                    >
                      MED
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Suggested action: share a short outcomes recap with new leaders.
                    </span>
                  </div>
                </li>
                <li>
                  <div style={{ fontWeight: 600 }}>Backfill + pipeline bundling</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                    Historic attrition plus open reqs signal demand for a deeper bench on key roles.
                  </div>
                  <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 6px",
                        borderRadius: 999,
                        fontSize: 10,
                        background: "#e5e7eb",
                        color: "#374151",
                      }}
                    >
                      LOW
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Suggested action: package 3–4 pre-vetted profiles as a flexible bench.
                    </span>
                  </div>
                </li>
              </ul>
            </section>

            {/* Connection Map */}
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                Connection Map
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#0f172a" }}>
                <li style={{ marginBottom: 4 }}>
                  Industry & demand: hiring trend in analytics + digital projects → higher project load next
                  quarter.
                </li>
                <li style={{ marginBottom: 4 }}>
                  CRM notes: last exec review highlighted delivery quality and openness to broader partnership.
                </li>
                <li style={{ marginBottom: 4 }}>
                  Your services: strong fit for analytics pods, project managers, and adoption/change resources.
                </li>
                <li>
                  Bridge: bundle staffing + light consulting to de-risk upcoming initiatives.
                </li>
              </ul>
            </section>

            {/* Recommended Plays */}
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h3
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#64748b",
                  margin: "0 0 8px 0",
                }}
              >
                Recommended Plays
              </h3>
              <div style={{ display: "grid", gap: 8, fontSize: 12, color: "#0f172a" }}>
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Expansion lane</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Trigger: renewals + strong delivery; Pitch: add a small squad to de-risk roadmap.
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Next step: draft a 2–3 slide expansion concept.
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>New role wedge</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Trigger: emerging initiatives; Pitch: pilot 1 specialist for a critical upcoming project.
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Next step: identify 1–2 high-fit candidates and outline a 60-day pilot.
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>Consulting upsell</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    Trigger: recurring process gaps; Pitch: short consulting engagement to tune intake + delivery.
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Next step: sketch a lightweight 4–6 week engagement outline.
                  </div>
                </div>
              </div>
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Briefing tab */}
      {accountTab === "BRIEFING" && (
        <div
          className="client360-two-col"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 360px)",
            gap: 24,
            alignItems: "flex-start",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              marginBottom: 24,
            }}
          >
            <section
              style={{
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px 0",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Briefing Outline
              </h2>
              <div style={{ display: "grid", gap: 12, fontSize: 12, color: "#0f172a" }}>
                <section>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Talking points
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Confirm current engagement health and recent wins.</li>
                    <li>Review open roles and upcoming demand signals.</li>
                    <li>Align on renewal and extension opportunities.</li>
                  </ul>
                </section>
                <section>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Risks to address
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Unclear visibility into renewal timelines.</li>
                    <li>Potential gaps between hiring expectations and pipeline.</li>
                  </ul>
                </section>
                <section>
                  <h3
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                    }}
                  >
                    Questions to ask
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>How are we tracking against your near-term hiring priorities?</li>
                    <li>Where do you see the highest risk roles over the next 60 days?</li>
                    <li>How can we make collaboration easier for your team?</li>
                  </ul>
                </section>
              </div>
            </section>
          </div>
          {engagementRightColumn}
        </div>
      )}

      {/* Prepare Briefing modal */}
      {showBriefing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
          }}
          onClick={() => setShowBriefing(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 40px rgba(15,23,42,0.15)",
              padding: "16px 18px 18px",
              fontSize: 13,
              color: "#0f172a",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                Prepare Briefing
              </h2>
              <button
                type="button"
                onClick={() => setShowBriefing(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
                aria-label="Close briefing"
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <section>
                <h3
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  Talking points
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Confirm current engagement health and recent wins.</li>
                  <li>Review open roles and upcoming demand signals.</li>
                  <li>Align on renewal and extension opportunities.</li>
                </ul>
              </section>
              <section>
                <h3
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  Risks to address
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Unclear visibility into renewal timelines.</li>
                  <li>Potential gaps between hiring expectations and pipeline.</li>
                </ul>
              </section>
              <section>
                <h3
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  Questions to ask
                </h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>How are we tracking against your near-term hiring priorities?</li>
                  <li>Where do you see the highest risk roles over the next 60 days?</li>
                  <li>How can we make collaboration easier for your team?</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .client360-engagement-right {
          max-width: 360px;
        }
        @media (max-width: 768px) {
          .client360-two-col {
            grid-template-columns: 1fr !important;
          }
          .client360-perf-grid {
            grid-template-columns: 1fr !important;
          }
          .client360-engagement-right {
            position: static !important;
            margin-top: 16px;
          }
        }
      `}</style>
    </>
  );
}
