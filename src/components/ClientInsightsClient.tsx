"use client";

import * as React from "react";
import Link from "next/link";

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
  | "Overview"
  | "Consultants"
  | "Job Orders"
  | "Renewals"
  | "KEY_STAKEHOLDERS"
  | "Signals"
  | "Briefing";

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
  const [accountTab, setAccountTab] = React.useState<AccountTabId>("Overview");

  const [consultantsOpenSection, setConsultantsOpenSection] = React.useState<"current" | "previous" | null>("current");
  const [jobOrdersOpenSection, setJobOrdersOpenSection] = React.useState<"current" | "previous" | null>("current");
  const [showBriefing, setShowBriefing] = React.useState(false);
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);

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

  const accountTabs: AccountTabId[] = [
    "Overview",
    "Consultants",
    "Job Orders",
    "Renewals",
    "KEY_STAKEHOLDERS",
    "Signals",
    "Briefing",
  ];

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
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: "1px solid #e2e8f0",
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
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onMouseEnter={() => setHoverKey("btn-checkin")}
                onMouseLeave={() => setHoverKey(null)}
                style={pillStyle("btn-checkin", {
                  borderRadius: 6,
                })}
              >
              Schedule check-in
            </button>
            <button
              type="button"
              onMouseEnter={() => setHoverKey("btn-risks")}
              onMouseLeave={() => setHoverKey(null)}
              style={pillStyle("btn-risks", {
                borderRadius: 6,
              })}
            >
              View risks
            </button>
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {accountTabs.map((tab) => {
            const selected = tab === accountTab;
            const key = `tab-${tab}`;
            const isHovered = hoveredTab === tab;

            const label = tab === "KEY_STAKEHOLDERS" ? "Key Stakeholders" : tab;

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
              <button
                key={tab}
                type="button"
                onClick={() => setAccountTab(tab)}
                onMouseEnter={() => setHoveredTab(tab)}
                onMouseLeave={() => setHoveredTab(null)}
                style={{
                  ...base,
                  ...(selected ? activeStyle : inactiveStyle),
                  ...(!selected && isHovered ? hoverStyle : {}),
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview tab */}
      {accountTab === "Overview" && (
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
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  ...pillBase,
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 11, color: "#64748b" }}>Account Status</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                  {ACCOUNT_STATUS_LABEL}
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  Engagement: {ENGAGEMENT_LABEL} · Risk: {RISK_LABEL}
                </span>
              </div>
            </div>

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
      {accountTab === "Consultants" && (
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
      {accountTab === "Job Orders" && (
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
      {accountTab === "Renewals" && (
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
      {accountTab === "Signals" && (
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

      {/* Briefing tab */}
      {accountTab === "Briefing" && (
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
