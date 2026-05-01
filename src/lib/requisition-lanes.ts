/**
 * Shared lane/column config for requisition Kanban and Dashboard peek.
 * Keeps agency view lanes and display labels in one place.
 */

export const AGENCY_LANES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "INTERVIEW_REQUESTED",
  "OFFER_PENDING",
  "OFFERED",
  "CLOSED",
  "DECLINED",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted to AM",
  UNDER_REVIEW: "Submitted to Client",
  INTERVIEW_REQUESTED: "Interview",
  OFFER_PENDING: "Interview Scheduled",
  OFFERED: "Offer",
  CLOSED: "Hired",
  DECLINED: "Declined",
};

export function getLaneLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
