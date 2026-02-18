"use client";

import { useEffect, useState } from "react";
import * as React from "react";
import KanbanLane from "@/components/KanbanLane";
import CandidateDetailSheet from "@/components/CandidateDetailSheet";

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
};

export default function RequisitionBoardClient({
  role,
  requisitionId,
  columns,
  submissions,
  onMove,
  onRequestInterview,
  onDecline,
  onAddFeedback,
}: {
  role: "CLIENT" | "AGENCY";
  requisitionId: string;
  columns: string[];
  submissions: SubmissionLike[];
  onMove: (submissionId: string, newStatus: string) => void | Promise<void>;
  onRequestInterview: (submissionId: string) => void | Promise<void>;
  onDecline: (submissionId: string) => void | Promise<void>;
  onAddFeedback: (submissionId: string, note: string) => void | Promise<void>;
}) {
  // ✅ Correct placement — inside function body
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    React.useState<SubmissionLike | null>(null);

  const handleCardClick = (submission: SubmissionLike) => {
    setSelectedSubmission(submission);
    setDetailOpen(true);
  };

  return (
    <>
      <KanbanLane
        columns={columns}
        submissions={submissions as any}
        onMove={onMove as any}
        onCardClick={handleCardClick as any}
        now={now}
      />

      <CandidateDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        submission={selectedSubmission as any}
        onRequestInterview={onRequestInterview as any}
        onDecline={onDecline as any}
        onAddFeedback={onAddFeedback as any}
      />
    </>
  );
}

