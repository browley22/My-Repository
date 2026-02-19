import type { DecisionType, SubmissionStatus, DeclineReason } from "@prisma/client";

type EventPayload = {
  type: DecisionType;
  note: string;
  fromStatus?: SubmissionStatus;
  toStatus?: SubmissionStatus;
  declineReason?: DeclineReason;
};

/**
 * Builds a single event payload for use in events.create or events.create: [ ... ].
 * Note is standardized as [actorRole] <note> for consistent timeline and analytics.
 */
export function createEventPayload(params: {
  type: DecisionType;
  fromStatus?: SubmissionStatus | string;
  toStatus?: SubmissionStatus | string;
  note?: string;
  actorRole: "CLIENT" | "AGENCY";
  declineReason?: DeclineReason | string;
}): EventPayload {
  const { type, fromStatus, toStatus, note, actorRole, declineReason } = params;
  const noteStr = note != null && note !== "" ? `[${actorRole}] ${note}` : `[${actorRole}]`;
  const payload: EventPayload = {
    type: type as DecisionType,
    note: noteStr,
  };
  if (fromStatus != null) payload.fromStatus = fromStatus as SubmissionStatus;
  if (toStatus != null) payload.toStatus = toStatus as SubmissionStatus;
  if (declineReason != null) payload.declineReason = declineReason as DeclineReason;
  return payload;
}
