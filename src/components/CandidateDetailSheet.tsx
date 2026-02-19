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
const SHOW_DND_DEBUG = false;

export default function CandidateDetailSheet({
  open,
  onOpenChange,
  anchorRect,
  submission,
  candidateId,
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
  candidateId: string;
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
  const [lastDroppedName, setLastDroppedName] = React.useState<string | null>(null);
  const [dropEventCount, setDropEventCount] = React.useState(0);
  const [lastDropFileName, setLastDropFileName] = React.useState<string | null>(null);
  const [lastDropFileType, setLastDropFileType] = React.useState<string | null>(null);
  const [candidateIdDebug, setCandidateIdDebug] = React.useState<string | null>(null);
  const [lastUploadStatus, setLastUploadStatus] = React.useState("");
  const [dragOverCount, setDragOverCount] = React.useState(0);
  const [dropCount, setDropCount] = React.useState(0);
  const [lastEventTarget, setLastEventTarget] = React.useState("");
  const [localResumeUrl, setLocalResumeUrl] = React.useState<string | null>(null);
  const [activityExpanded, setActivityExpanded] = React.useState(false);
  const [messagesExpanded, setMessagesExpanded] = React.useState(false);
  const resumeInputRef = React.useRef<HTMLInputElement>(null);
  const dropInFlightRef = React.useRef(false);

  const effectiveCandidateId = submission?.candidate?.id ?? candidateId ?? null;
  const initialResumeUrl = submission?.candidate?.resumeUrl ?? null;
  const effectiveResumeUrl = localResumeUrl ?? initialResumeUrl;

  React.useEffect(() => setLocalResumeUrl(null), [effectiveCandidateId]);

  const activity = React.useMemo(() => {
    if (!submission?.events?.length) return [];
    return (submission.events as any[])
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [submission?.events]);

  const messages = React.useMemo(() => {
    if (!submission?.messages?.length) return [];
    return submission.messages
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [submission?.messages]);

  const RESUME_ALLOWED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const uploadResumeFile = React.useCallback(
    async (file: File) => {
      if (!effectiveCandidateId) {
        setResumeError("Missing candidate id — cannot upload resume.");
        setLastUploadStatus("Missing candidateId");
        return;
      }
      const url = `${window.location.origin}/api/candidates/${effectiveCandidateId}/resume`;
      console.log("Resume upload URL:", url);
      const valid =
        RESUME_ALLOWED_TYPES.includes(file.type) ||
        /\.(pdf|doc|docx)$/i.test(file.name);
      if (!valid) {
        setResumeError("Please upload a PDF, DOC, or DOCX file.");
        return;
      }
      setResumeError(null);
      setResumeUploading(true);
      setLastUploadStatus("Uploading...");
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(url, {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = typeof data?.error === "string" ? data.error : "Upload failed";
          const withDetail = typeof data?.detail === "string" ? `${errMsg} — ${data.detail}` : errMsg;
          setResumeError(withDetail);
          setLastUploadStatus("Upload failed: " + withDetail);
          return;
        }
        const resumeUrl = typeof data?.resumeUrl === "string" ? data.resumeUrl : null;
        if (resumeUrl) {
          setLocalResumeUrl(resumeUrl);
          setLastUploadStatus("Upload success");
        } else {
          setResumeError("Upload succeeded but server did not return resumeUrl");
          setLastUploadStatus("Upload succeeded but server did not return resumeUrl; keys: " + Object.keys(data || {}).join(", "));
        }
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to fetch";
        setResumeError(`Upload failed (${msg}): ${url}`);
        setLastUploadStatus("Upload failed: " + msg);
        console.error("Resume upload error:", err);
      } finally {
        setResumeUploading(false);
      }
    },
    [effectiveCandidateId, router]
  );

  function handleResumeDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
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
    setDropEventCount((n) => n + 1);
    setCandidateIdDebug(candidateId);
    console.log("DROP FIRED", {
      candidateId,
      hasFiles: e.dataTransfer.files?.length,
      hasItems: e.dataTransfer.items?.length,
    });
    if (resumeUploading) return;
    if (dropInFlightRef.current) return;
    dropInFlightRef.current = true;
    try {
      let file: File | null = null;
      if (e.dataTransfer.items?.length) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          if (item.kind === "file") {
            file = item.getAsFile();
            break;
          }
        }
      }
      if (!file && e.dataTransfer.files?.length) {
        file = e.dataTransfer.files[0];
      }
      if (!file) {
        setResumeError("No file detected. Drag-and-drop works from File Explorer. If you're dragging from email, download the attachment first (or use Choose File).");
        setLastDroppedName(null);
        setLastUploadStatus("No file detected");
        return;
      }
      setLastDropFileName(file.name);
      setLastDropFileType(file.type || "(empty)");
      console.log("Dropped file:", { name: file.name, type: file.type, size: file.size });
      setLastDroppedName(file.name);
      await uploadResumeFile(file);
    } finally {
      dropInFlightRef.current = false;
    }
  }

  // reset note and owner input when opening a different submission
  React.useEffect(() => {
    if (open) { setNote(""); setOwnerInput(""); }
  }, [open, submission?.id]);

  const isResumeTabActive = activeTab === "RESUME" && role === "AGENCY";
  React.useEffect(() => {
    if (!isResumeTabActive || role !== "AGENCY") return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverCount((c) => c + 1);
      const t = e.target as HTMLElement | null;
      setLastEventTarget(t?.tagName ?? "unknown");
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDropCount((c) => c + 1);
      setDropEventCount((n) => n + 1);
      setCandidateIdDebug(effectiveCandidateId);

      const dt = e.dataTransfer;
      if (!dt) {
        setLastUploadStatus("Drop: no dataTransfer");
        return;
      }

      let file: File | null = null;
      if (dt.items && dt.items.length) {
        for (const item of Array.from(dt.items)) {
          if (item.kind === "file") {
            file = item.getAsFile();
            break;
          }
        }
      }
      if (!file && dt.files && dt.files.length) file = dt.files[0];

      if (!file) {
        setLastUploadStatus("Drop: no file extracted");
        setLastDropFileName(null);
        setResumeError("No file detected. Drag-and-drop works from File Explorer. If you're dragging from email, download the attachment first (or use Choose File).");
        return;
      }

      if (!effectiveCandidateId) {
        setLastUploadStatus("Missing candidate id");
        setResumeError("Missing candidate id — cannot upload resume.");
        return;
      }

      setLastDropFileName(file.name);
      setLastUploadStatus("Drop: uploading...");
      await uploadResumeFile(file);
    };

    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);

    return () => {
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [isResumeTabActive, role, effectiveCandidateId, uploadResumeFile]);

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
    <>
      {SHOW_DND_DEBUG && isResumeTabActive && (
        <div
          style={{
            position: "fixed",
            top: 8,
            right: 8,
            zIndex: 10001,
            background: "#1e293b",
            color: "#e2e8f0",
            padding: "10px 14px",
            borderRadius: 8,
            fontFamily: "monospace",
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            whiteSpace: "pre-wrap",
            maxWidth: 320,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>DnD ACTIVE</div>
          <div>dragOver: {dragOverCount}</div>
          <div>drop: {dropCount}</div>
          <div>target: {lastEventTarget || "—"}</div>
          <div>file: {lastDropFileName ?? "none"}</div>
          <div>status: {lastUploadStatus || "—"}</div>
        </div>
      )}
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
            <div className="mt-1 text-xs text-gray-500 space-y-0.5">
              {c?.email && <div>Email: {c.email}</div>}
              {c?.phone && <div>Phone: {c.phone}</div>}
              {!c?.email && !c?.phone && <div>No contact info</div>}
            </div>
            <p className="mt-2 text-sm text-gray-600">
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
                className="mt-2 w-full rounded-md border border-gray-300 p-3 text-sm box-border"
                style={{ width: "100%", minHeight: 140 }}
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
              {activity.length > 0 ? (
                <>
                  {(activityExpanded ? activity : activity.slice(0, 5)).map((e: any) => (
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
                  ))}
                  {activity.length > 5 && (
                    <button
                      type="button"
                      className="text-xs text-sky-600 hover:underline"
                      onClick={() => setActivityExpanded((v) => !v)}
                    >
                      {activityExpanded ? "Show less" : `Show all (${activity.length})`}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-gray-400">No activity yet.</div>
              )}
            </div>
          </section>

          {/* Messages */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Messages</h3>
            <div className="mt-2 space-y-2 text-sm">
              {messages.length > 0 ? (
                <>
                  {(messagesExpanded ? messages : messages.slice(0, 5)).map((m) => (
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
                  ))}
                  {messages.length > 5 && (
                    <button
                      type="button"
                      className="text-xs text-sky-600 hover:underline"
                      onClick={() => setMessagesExpanded((v) => !v)}
                    >
                      {messagesExpanded ? "Show less" : `Show all (${messages.length})`}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-gray-400">No messages yet.</div>
              )}
            </div>
          </section>

          {/* Resume link (for context) */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Resume</h3>
            <div className="mt-2">
              {effectiveResumeUrl ? (
                <a className="text-sm underline" href={effectiveResumeUrl} target="_blank" rel="noreferrer">
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
                {effectiveCandidateId == null && (
                  <p className="text-sm text-red-600">Missing candidate id — cannot upload resume.</p>
                )}
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
                  onDragEnterCapture={handleResumeDragOver}
                  onDragOver={handleResumeDragOver}
                  onDragOverCapture={handleResumeDragOver}
                  onDragLeave={handleResumeDragLeave}
                  onDrop={handleResumeDrop}
                  onDropCapture={handleResumeDrop}
                  style={{
                    border: isDragging ? "2px dashed #60a5fa" : "1px dashed #e5e7eb",
                    background: isDragging ? "#eff6ff" : "#fff",
                    borderRadius: 10,
                    padding: 12,
                    minHeight: 90,
                    boxSizing: "border-box",
                    pointerEvents: "auto",
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={resumeUploading || !effectiveCandidateId}
                      onClick={() => resumeInputRef.current?.click()}
                      className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      {resumeUploading ? "Uploading…" : effectiveResumeUrl ? "Replace resume" : "Upload resume"}
                    </button>
                    {effectiveResumeUrl && (
                      <a
                        href={effectiveResumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                      >
                        Download
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!effectiveCandidateId) {
                          setLastUploadStatus("Test: no candidate id");
                          return;
                        }
                        const url = `${window.location.origin}/api/candidates/${effectiveCandidateId}/resume`;
                        try {
                          const res = await fetch(url, { method: "POST", body: new FormData() });
                          const text = await res.text();
                          let parsed: { error?: string } | null = null;
                          try {
                            parsed = JSON.parse(text);
                          } catch {
                            parsed = null;
                          }
                          const msg = parsed?.error ?? (text || res.statusText || String(res.status));
                          setLastUploadStatus(`Test: ${res.status} — ${msg}`);
                        } catch (e) {
                          setLastUploadStatus(`Test: failed — ${e instanceof Error ? e.message : "Failed to fetch"}`);
                        }
                      }}
                      className="rounded-md border border-amber-300 px-3 py-1 text-sm hover:bg-amber-50"
                    >
                      Test resume upload endpoint
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">or drop PDF, DOC, or DOCX here</p>
                </div>
                <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500" style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                  {"--------------------------------\nDROP DEBUG\nevents: "}{dropEventCount}
                  {"\ncandidateIdUsedForUpload: "}{effectiveCandidateId ?? "—"}
                  {"\nsubmissionId: "}{submission?.id ?? "—"}
                  {"\nfile: "}{lastDropFileName ?? "—"}
                  {"\ntype: "}{lastDropFileType ?? "—"}
                  {"\nstatus: "}{lastUploadStatus || "—"}
                  {"\n--------------------------------"}
                </div>
              </>
            )}
            {role !== "AGENCY" && effectiveResumeUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={effectiveResumeUrl}
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
            {effectiveResumeUrl ? (
              effectiveResumeUrl.toLowerCase().endsWith(".pdf") ? (
                <div className="mt-2 flex-1 min-h-[200px] border rounded overflow-hidden bg-gray-50">
                  <iframe
                    src={effectiveResumeUrl}
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
    </>
  );
}
