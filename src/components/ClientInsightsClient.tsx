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

type TabId = "Recent Activity" | "Today" | "Pipeline Velocity" | "Win Rate" | "Hiring Forecast";

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

export default function ClientInsightsClient({
  clientName,
  clientId,
  summary,
  openRequisitions,
  pastRequisitions,
  recentActivity,
}: Props) {
  const [insightsTab, setInsightsTab] = React.useState<TabId>("Recent Activity");

  const tabs: TabId[] = ["Recent Activity", "Today", "Pipeline Velocity", "Win Rate", "Hiring Forecast"];

  return (
    <>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Client 360 — {clientName}</h1>
      <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>Agency-only view</p>

      {/* Executive Summary Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          padding: "12px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Total requisitions</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{summary.totalRequisitions}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Open requisitions</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{summary.openRequisitions}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>Placements</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{summary.placements}</span>
        </div>
        {summary.winRate != null && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>Win rate</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{summary.winRate}%</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>
              ({summary.placements} / {summary.totalOffers} offers)
            </span>
          </div>
        )}
      </div>

      {/* Sections: Current Orders, Past Orders, Consultants */}
      <div style={{ display: "grid", gap: 24, marginBottom: 32 }}>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Current Orders</h2>
          {openRequisitions.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {openRequisitions.map((r) => (
                <li key={r.id} style={{ marginBottom: 4 }}>
                  <Link href={`/requisitions/${r.id}`} style={{ color: "#0369a1", textDecoration: "none" }}>
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 14, color: "#64748b" }}>No open requisitions.</p>
          )}
        </section>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Past Orders</h2>
          {pastRequisitions.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {pastRequisitions.map((r) => (
                <li key={r.id} style={{ marginBottom: 4 }}>
                  <Link href={`/requisitions/${r.id}`} style={{ color: "#0369a1", textDecoration: "none" }}>
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 14, color: "#64748b" }}>No closed requisitions.</p>
          )}
        </section>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Current Consultants on Billing</h2>
          <p style={{ fontSize: 14, color: "#64748b" }}>Coming soon.</p>
        </section>
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Previous Consultants on Billing</h2>
          <p style={{ fontSize: 14, color: "#64748b" }}>Coming soon.</p>
        </section>
      </div>

      {/* Insights Tabs (match Requisition Insights style) */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "8px 8px 0",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          {tabs.map((tab) => (
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
        <div style={{ padding: 12, minHeight: 120 }}>
          {insightsTab === "Recent Activity" && (
            <div style={{ fontSize: 12, color: "#334155" }}>
              <div style={{ fontWeight: 600, color: "#111827", marginBottom: 12, fontSize: 14 }}>
                Recent Activity
              </div>
              {recentActivity.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        fontSize: 12,
                        color: "#374151",
                        padding: "6px 8px",
                        background: "#f9fafb",
                        borderRadius: 4,
                      }}
                    >
                      <div>{item.description}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        {formatTimeAgo(item.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>No recent activity.</div>
              )}
            </div>
          )}
          {insightsTab === "Today" && (
            <div style={{ fontSize: 12, color: "#334155" }}>
              <div style={{ fontWeight: 600, color: "#0369a1", marginBottom: 4 }}>Today</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>Summary of today&apos;s activity for this client.</div>
              <div style={{ marginTop: 8, padding: "10px 14px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12 }}>Placeholder — wire to client-level today metrics when needed.</p>
              </div>
            </div>
          )}
          {insightsTab === "Pipeline Velocity" && (
            <div style={{ fontSize: 12, color: "#334155" }}>
              <div style={{ fontWeight: 600, color: "#166534", marginBottom: 6, fontSize: 13 }}>Pipeline Velocity</div>
              <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12 }}>Placeholder — aggregate pipeline velocity across client requisitions.</p>
              </div>
            </div>
          )}
          {insightsTab === "Win Rate" && (
            <div style={{ fontSize: 12, color: "#334155" }}>
              <div style={{ fontWeight: 600, color: "#1e40af", fontSize: 13, marginBottom: 4 }}>Win Rate</div>
              <div style={{ padding: "10px 14px", background: "#f0f9ff", border: "1px solid #93c5fd", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12 }}>
                  Executive summary shows win rate above. Expand here with per-requisition breakdown when needed.
                </p>
              </div>
            </div>
          )}
          {insightsTab === "Hiring Forecast" && (
            <div style={{ fontSize: 12, color: "#334155" }}>
              <div style={{ fontWeight: 600, color: "#047857", fontSize: 13 }}>Hiring Forecast</div>
              <div style={{ padding: "10px 14px", background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 12 }}>Placeholder — estimated hires across client requisitions.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
