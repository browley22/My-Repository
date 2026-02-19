"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getSubmissionOwnerName } from "@/lib/submission-owner";

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
  messages?: {
    id: string;
    fromRole: "CLIENT" | "AGENCY";
    body: string;
    createdAt?: string;
  }[];
};

const POPOVER_WIDTH = 420;
const GAP = 12;

export default function CandidateDetailSheet({
  open,
  onOpenChange,
  anchorRect,
  submission,
  role,
  onRequestInterview,
  onDecline,
  onAddFeedback,
  onMarkInterested,
  onMarkPass,
  onNeedInfo,
  onMakeOffer,
  onOfferAccepted,
  onOfferDeclined,
  onSetOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRect: { left: number; right: number; top: number; bottom: number } | null;
  submission: SubmissionLike | null;
  role: "CLIENT" | "AGENCY";
  onRequestInterview: (submissionId: string) => void | Promise<void>;
  onDecline: (submissionId: string) => void | Promise<void>;
  onAddFeedback: (submissionId: string, note: string) => void | Promise<void>;
  onMarkInterested: (submissionId: string) => void | Promise<void>;
  onMarkPass: (submissionId: string) => void | Promise<void>;
  onNeedInfo: (submissionId: string) => void | Promise<void>;
  onMakeOffer: (submissionId: string) => void | Promise<void>;
  onOfferAccepted: (submissionId: string) => void | Promise<void>;
  onOfferDeclined: (submissionId: string) => void | Promise<void>;
  onSetOwner?: (submissionId: string, ownerName: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [ownerInput, setOwnerInput] = React.useState("");
  const [busy, setBusy] = React.useState<null | "interview" | "decline" | "feedback">(null);
  const [activeTab, setActiveTab] = React.useState<"WRITEUP" | "RESUME">("WRITEUP");
  const [resumeUploading, setResumeUploading] = React.useState(false);
  const [resumeError, setResumeError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const resumeInputRef = React.useRef<HTMLInputElement>(null);

  const RESUME_ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const uploadResumeFile = React.useCallback(
    async (file: File) => {
      const candidateId = submission?.candidate?.id;
      if (!candidateId) return;
      const valid =
        RESUME_ALLOWED_TYPES.includes(file.type) ||
        /\.(pdf|doc|docx)$/i.test(file.name);
      if (!valid) {
        setResumeError("Please upload a PDF, DOC, or DOCX file.");
        return;
      }
      setResumeError(null);
      setResumeUploading(true);
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`/api/candidates/${candidateId}/resume`, {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setResumeError(data.error || "Upload failed");
          return;
        }
        router.refresh();
      } catch {
        setResumeError("Upload failed");
      } finally {
        setResumeUploading(false);
      }
    },
    [submission?.candidate?.id, router]
  );

  function handleResumeDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!resumeUploading) setIsDragging(true);
  }
  function handleResumeDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }
  async function handleResumeDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (resumeUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadResumeFile(file);
  }

  // reset note and owner input when opening a different submission
  React.useEffect(() => {
    if (open) { setNote(""); setOwnerInput(""); }
  }, [open, submission?.id]);

  if (!submission) return null;

  const c = submission.candidate;
  const name = c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown candidate";
  const subtitle = c ? [c.title, c.location].filter(Boolean).join(" • ") : "";

  if (!open || !anchorRect) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const maxH = vh * 0.8;
  let left = anchorRect.right + GAP;
  if (left + POPOVER_WIDTH > vw) left = anchorRect.left - POPOVER_WIDTH - GAP;
  const top = Math.max(8, Math.min(anchorRect.top, vh - maxH - 8));

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: POPOVER_WIDTH,
        maxHeight: maxH,
        overflowY: "auto",
        zIndex: 10000,
        background: "white",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
      }}
      aria-hidden={!open}
    >
        <div className="flex items-start justify-between border-b p-4">
          <div>
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
            <p className="mt-1 text-sm text-gray-600">
              Status: <span className="font-medium">{submission.status}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Owner: <span className="font-medium">{getSubmissionOwnerName(submission) || "—"}</span>
            </p>
            {role === "AGENCY" && onSetOwner && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="Set owner name"
                  className="rounded border border-gray-300 px-2 py-1 text-sm w-40"
                />
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={!ownerInput.trim()}
                  onClick={async () => {
                    if (!ownerInput.trim()) return;
                    await onSetOwner(submission.id, ownerInput.trim());
                    setOwnerInput("");
                  }}
                >
                  Set
                </button>
              </div>
            )}
          </div>

          <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => onOpenChange(false)}>
            ✕
          </button>
        </div>

        {/* Tabs - Resume only; Write-up is under Summary */}
        <div className="border-b px-4 pt-2 flex gap-2 text-sm">
          <button
            type="button"
            className={`px-3 py-1 rounded-t-md border-b-2 ${
              activeTab === "RESUME"
                ? "border-sky-500 text-sky-700 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("RESUME")}
          >
            Resume
          </button>
        </div>

        {activeTab !== "RESUME" && (
        <div className="space-y-6 p-4">
          {/* Actions */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Actions</h3>

            <div className="mt-2 flex flex-wrap gap-2">
              {role === "CLIENT" && (
                <>
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
                      setBusy("interview");
                      await onMakeOffer(submission.id);
                      setBusy(null);
                    }}
                  >
                    Make offer
                  </button>

                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("interview");
                      await onOfferAccepted(submission.id);
                      setBusy(null);
                    }}
                  >
                    Offer accepted
                  </button>

                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("interview");
                      await onOfferDeclined(submission.id);
                      setBusy(null);
                    }}
                  >
                    Offer declined
                  </button>
                </>
              )}

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

              {role === "CLIENT" && (
                <>
                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("feedback");
                      await onMarkInterested(submission.id);
                      setBusy(null);
                    }}
                  >
                    Interested
                  </button>

                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("feedback");
                      await onMarkPass(submission.id);
                      setBusy(null);
                    }}
                  >
                    Pass
                  </button>

                  <button
                    className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy("feedback");
                      await onNeedInfo(submission.id);
                      setBusy(null);
                    }}
                  >
                    Need info
                  </button>
                </>
              )}
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
            <button
              type="button"
              className={`mt-2 px-3 py-1 rounded-t-md border-b-2 text-sm ${
                activeTab === "WRITEUP"
                  ? "border-sky-500 text-sky-700 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("WRITEUP")}
            >
              Write-up
            </button>
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

          {/* Messages */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Messages</h3>
            <div className="mt-2 space-y-2 text-sm">
              {submission.messages && submission.messages.length > 0 ? (
                submission.messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-md border bg-white p-2 text-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {m.fromRole === "CLIENT" ? "Client" : "Agency"}
                      </span>
                      {m.createdAt && (
                        <span className="text-xs text-gray-400">
                          {formatTimeAgo(m.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-gray-700">{m.body}</div>
                  </div>
                ))
              ) : (
                <div className="text-gray-400">No messages yet.</div>
              )}
            </div>
          </section>

          {/* Resume link (for context) */}
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
        )}

        {activeTab === "RESUME" && (
          <div className="p-4 h-[calc(100%-56px)] flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("WRITEUP")}
              className="self-start text-sm text-sky-600 hover:underline"
            >
              ← Write-up
            </button>
            {role === "AGENCY" && (
              <>
                <input
                  type="file"
                  ref={resumeInputRef}
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadResumeFile(f);
                    e.target.value = "";
                  }}
                />
                <div
                  tabIndex={0}
                  onDragEnter={handleResumeDragOver}
                  onDragOver={handleResumeDragOver}
                  onDragLeave={handleResumeDragLeave}
                  onDrop={handleResumeDrop}
                  style={{
                    border: isDragging ? "2px dashed #60a5fa" : "1px solid #e5e7eb",
                    background: isDragging ? "#eff6ff" : "#fff",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={resumeUploading}
                      onClick={() => resumeInputRef.current?.click()}
                      className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {resumeUploading ? "Uploading…" : c?.resumeUrl ? "Replace resume" : "Upload resume"}
                    </button>
                    {c?.resumeUrl && (
                      <a
                        href={c.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Download
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-gray-500">or drop PDF, DOC, or DOCX here</p>
                </div>
              </>
            )}
            {role !== "AGENCY" && c?.resumeUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={c.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                >
                  Download
                </a>
              </div>
            )}
            {role === "AGENCY" && resumeError && (
              <p className="text-sm text-red-600">{resumeError}</p>
            )}
            {c?.resumeUrl ? (
              c.resumeUrl.toLowerCase().endsWith(".pdf") ? (
                <div className="mt-2 flex-1 min-h-[200px] border rounded overflow-hidden bg-gray-50">
                  <iframe
                    src={c.resumeUrl}
                    title="Resume preview"
                    className="w-full h-full min-h-[300px] border-0"
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-2">Preview available for PDFs. Download to view.</p>
              )
            ) : (
              <p className="text-sm text-gray-400">No resume uploaded yet.</p>
            )}
          </div>
        )}
    </div>
  );
}
