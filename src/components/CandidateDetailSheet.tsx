"use client";

import * as React from "react";

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString();
}

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

type SubmissionLike = {
  id: string;
  status: string;
  candidate?: CandidateLike | null;
  events?: any[];
};

export default function CandidateDetailSheet({
  open,
  onOpenChange,
  submission,
  onRequestInterview,
  onDecline,
  onAddFeedback,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: SubmissionLike | null;
  onRequestInterview: (submissionId: string) => void | Promise<void>;
  onDecline: (submissionId: string) => void | Promise<void>;
  onAddFeedback: (submissionId: string, note: string) => void | Promise<void>;
}) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<null | "interview" | "decline" | "feedback">(null);

  // reset note when opening a different submission
  React.useEffect(() => {
    if (open) setNote("");
  }, [open, submission?.id]);

  if (!submission) return null;

  const c = submission.candidate;
  const name = c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown candidate";
  const subtitle = c ? [c.title, c.location].filter(Boolean).join(" • ") : "";

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={() => onOpenChange(false)}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b p-4">
          <div>
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
            <p className="mt-1 text-sm text-gray-600">
              Status: <span className="font-medium">{submission.status}</span>
            </p>
          </div>

          <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => onOpenChange(false)}>
            Close
          </button>
        </div>

        <div className="space-y-6 p-4">
          {/* Actions */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Actions</h3>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("interview");
                  await onRequestInterview(submission.id);
                  setBusy(null);
                }}
              >
                Request Interview
              </button>

              <button
                className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("decline");
                  await onDecline(submission.id);
                  setBusy(null);
                  onOpenChange(false);
                }}
              >
                Decline
              </button>
            </div>

            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-700">Feedback</div>
              <textarea
                className="mt-2 w-full rounded-md border p-2 text-sm"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note for the agency/recruiter (e.g., 'Strong fit—please schedule interview')"
              />
              <button
                className="mt-2 rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={busy !== null || note.trim().length === 0}
                onClick={async () => {
                  setBusy("feedback");
                  await onAddFeedback(submission.id, note.trim());
                  setNote("");
                  setBusy(null);
                }}
              >
                Send Feedback
              </button>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Contact</h3>
            <div className="mt-2 space-y-1 text-sm text-gray-800">
              {c?.email ? <div>Email: {c.email}</div> : <div className="text-gray-400">Email: —</div>}
              {c?.phone ? <div>Phone: {c.phone}</div> : <div className="text-gray-400">Phone: —</div>}
            </div>
          </section>

          {/* Summary */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Summary</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{c?.summary || "—"}</p>
          </section>

          {/* Activity Timeline */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Activity</h3>

            <div className="mt-2 space-y-2 text-sm">
              {submission.events && submission.events.length > 0 ? (
                submission.events
                  .slice()
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )
                  .map((e: any) => (
                    <div key={e.id} className="rounded-md border p-2 bg-gray-50 text-gray-800">
                      <div className="font-medium">
                        {e.type === "STATUS_CHANGE"
                          ? "Status changed"
                          : e.type === "QUESTION"
                          ? "Note"
                          : e.type}
                      </div>

                      {e.note && (
                        <div className="text-gray-600">
                          {e.note
                            .replaceAll("SUBMITTED", "Submitted")
                            .replaceAll("UNDER_REVIEW", "Under Review")
                            .replaceAll("INTERVIEW_REQUESTED", "Interview Requested")
                            .replaceAll("OFFER_PENDING", "Offer Pending")
                            .replaceAll("OFFERED", "Offered")
                            .replaceAll("DECLINED", "Declined")
                            .replaceAll("CLOSED", "Closed")}
                        </div>
                      )}

                      <div className="text-xs text-gray-400">{formatTimeAgo(e.createdAt)}</div>
                    </div>
                  ))
              ) : (
                <div className="text-gray-400">No activity yet.</div>
              )}
            </div>
          </section>

          {/* Resume */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Resume</h3>
            <div className="mt-2">
              {c?.resumeUrl ? (
                <a className="text-sm underline" href={c.resumeUrl} target="_blank" rel="noreferrer">
                  Open resume
                </a>
              ) : (
                <p className="text-sm text-gray-400">No resume uploaded yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
