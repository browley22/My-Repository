"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getSubmissionOwnerName } from "@/lib/submission-owner";
import { uploadResumeFile as uploadResumeFileLib } from "@/lib/resumeUpload";

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
  linkedinUrl?: string | null;
  summary?: string | null;
  resumeUrl?: string | null;
  resumeText?: string | null;
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
  fitScore?: number | null;
  fitSummary?: string | null;
  strengths?: string[] | null;
  gaps?: string[] | null;
  sellingPoints?: string[] | null;
  objectionsAndRebuttals?: { objection: string; rebuttal: string }[] | null;
  confidence?: number | null;
  evaluatedAt?: string | null;
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
  onOpenResumeViewer,
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
  onOpenResumeViewer?: (url: string | null, candidateName?: string, filename?: string, resumeText?: string | null, candidateId?: string | null) => void;
}) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [ownerInput, setOwnerInput] = React.useState("");
  const [busy, setBusy] = React.useState<null | "interview" | "decline" | "feedback" | "evaluate">(null);
  const [activeTab, setActiveTab] = React.useState<"WRITEUP" | "RESUME" | "YOUR_DECISION">("RESUME");
  const [feedbackModalOpen, setFeedbackModalOpen] = React.useState(false);
  const [feedbackModalText, setFeedbackModalText] = React.useState("");
  const [feedbackSuccess, setFeedbackSuccess] = React.useState(false);
  const [evaluationLoading, setEvaluationLoading] = React.useState(false);
  const [evaluationError, setEvaluationError] = React.useState<string | null>(null);
  const [localEvaluation, setLocalEvaluation] = React.useState<{
    fitScore: number;
    fitSummary: string | null;
    strengths: string[] | null;
    gaps: string[] | null;
    sellingPoints: string[] | null;
    objectionsAndRebuttals: { objection: string; rebuttal: string }[] | null;
    confidence: number | null;
    evaluatedAt: string | null;
  } | null>(null);
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
  const [contactEditing, setContactEditing] = React.useState(false);
  const [contactSaveLoading, setContactSaveLoading] = React.useState(false);
  const [contactError, setContactError] = React.useState<string | null>(null);
  const [localContact, setLocalContact] = React.useState<{ email: string; phone: string; linkedinUrl: string; location: string } | null>(null);
  const [contactForm, setContactForm] = React.useState({ email: "", phone: "", linkedinUrl: "", location: "" });
  const resumeInputRef = React.useRef<HTMLInputElement>(null);
  const dropInFlightRef = React.useRef(false);
  const autoEvalAttemptedRef = React.useRef<Set<string>>(new Set());

  const effectiveCandidateId = submission?.candidate?.id ?? candidateId ?? null;
  const initialResumeUrl = submission?.candidate?.resumeUrl ?? null;
  const effectiveResumeUrl = localResumeUrl ?? initialResumeUrl;
  const candidateName = submission?.candidate ? [submission.candidate.firstName, submission.candidate.lastName].filter(Boolean).join(" ") : undefined;
  const resumeFilename = effectiveResumeUrl ? effectiveResumeUrl.split("/").pop() || undefined : undefined;
  const hasResume = !!effectiveResumeUrl || !!(typeof submission?.candidate?.resumeText === "string" && submission.candidate.resumeText.trim());

  React.useEffect(() => setLocalResumeUrl(null), [effectiveCandidateId]);
  React.useEffect(() => {
    setLocalContact(null);
    setContactEditing(false);
    setContactError(null);
  }, [effectiveCandidateId]);

  // Auto-evaluate when sheet opens for AGENCY if fitScore is missing and we have resume text (at most once per submission per page load).
  React.useEffect(() => {
    if (role !== "AGENCY" || !open || !submission?.id) return;
    const hasScore = submission.fitScore != null || localEvaluation != null;
    if (hasScore) return;
    const resumeText = submission?.candidate?.resumeText ?? submission?.candidate?.summary ?? null;
    const hasResumeText = typeof resumeText === "string" && resumeText.trim().length > 0;
    if (!hasResumeText) return;
    if (autoEvalAttemptedRef.current.has(submission.id)) return;
    autoEvalAttemptedRef.current.add(submission.id);
    setEvaluationError(null);
    setEvaluationLoading(true);
    setBusy("evaluate");
    (async () => {
      try {
        const res = await fetch(`/api/submissions/${submission.id}/evaluate`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setEvaluationError((data as { error?: string; detail?: string }).error ?? (data as { error?: string; detail?: string }).detail ?? "Evaluation failed");
          return;
        }
        const data = await res.json() as { evaluation?: typeof localEvaluation };
        if (data.evaluation) {
          setLocalEvaluation(data.evaluation);
          router.refresh();
        }
      } catch {
        setEvaluationError("Evaluation failed");
      } finally {
        setEvaluationLoading(false);
        setBusy(null);
      }
    })();
  }, [open, submission?.id, submission?.fitScore, submission?.candidate?.resumeText, submission?.candidate?.summary, role, localEvaluation]);

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

  const uploadResumeFile = React.useCallback(
    async (file: File) => {
      if (!effectiveCandidateId) {
        setResumeError("Missing candidate id — cannot upload resume.");
        setLastUploadStatus("Missing candidateId");
        return;
      }
      setResumeError(null);
      setResumeUploading(true);
      setLastUploadStatus("Uploading...");
      try {
        const result = await uploadResumeFileLib(effectiveCandidateId, file);
        if (result.success) {
          if (result.resumeUrl) setLocalResumeUrl(result.resumeUrl);
          setLastUploadStatus(result.warning ?? "Upload success");
          router.refresh();
        } else {
          setResumeError(result.error);
          setLastUploadStatus("Upload failed: " + result.error);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to upload";
        setResumeError(msg);
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

  // CLIENT: no "Your Decision" tab in popover; decisions live on card dropdown. Avoid broken state if activeTab is YOUR_DECISION.
  React.useEffect(() => {
    if (role === "CLIENT" && activeTab === "YOUR_DECISION") setActiveTab("RESUME");
  }, [role, activeTab]);

  // AGENCY: no Resume tab in panel; ensure we don't stay on RESUME.
  React.useEffect(() => {
    if (role === "AGENCY" && activeTab === "RESUME") setActiveTab("WRITEUP");
  }, [role, activeTab]);

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
            <section className="mt-2">
              <div className="w-full flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-700">Contact Information TEST</h3>
                </div>
                {role === "AGENCY" && (
                  <div
                    className="shrink-0 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {!contactEditing ? (
                      <button
                        type="button"
                        className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContactForm({
                            email: (localContact?.email ?? c?.email ?? "").trim(),
                            phone: (localContact?.phone ?? c?.phone ?? "").trim(),
                            linkedinUrl: (localContact?.linkedinUrl ?? c?.linkedinUrl ?? "").trim(),
                            location: (localContact?.location ?? c?.location ?? "").trim(),
                          });
                          setContactError(null);
                          setContactEditing(true);
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={contactSaveLoading}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!effectiveCandidateId) return;
                            setContactError(null);
                            setContactSaveLoading(true);
                            try {
                              const res = await fetch(`/api/candidates/${effectiveCandidateId}/contact`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  email: contactForm.email.trim() || null,
                                  phone: contactForm.phone.trim() || null,
                                  linkedinUrl: contactForm.linkedinUrl.trim() || null,
                                  location: contactForm.location.trim() || null,
                                }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                setContactError((data as { error?: string }).error ?? "Failed to save");
                                return;
                              }
                              const cand = (data as { candidate?: { email?: string | null; phone?: string | null; linkedinUrl?: string | null; location?: string | null } }).candidate;
                              if (cand) {
                                setLocalContact({
                                  email: cand.email ?? "",
                                  phone: cand.phone ?? "",
                                  linkedinUrl: cand.linkedinUrl ?? "",
                                  location: cand.location ?? "",
                                });
                              }
                              setContactEditing(false);
                              router.refresh();
                            } catch {
                              setContactError("Failed to save");
                            } finally {
                              setContactSaveLoading(false);
                            }
                          }}
                        >
                          {contactSaveLoading ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={contactSaveLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            setContactEditing(false);
                            setContactError(null);
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2 text-xs text-gray-500" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                {role === "AGENCY" && contactEditing ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Location</label>
                      <input
                        type="text"
                        value={contactForm.location}
                        onChange={(e) => setContactForm((f) => ({ ...f, location: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="City, ST"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Email</label>
                      <input
                        type="text"
                        value={contactForm.email}
                        onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Phone</label>
                      <input
                        type="text"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="Phone"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">LinkedIn</label>
                      <input
                        type="text"
                        value={contactForm.linkedinUrl}
                        onChange={(e) => setContactForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    {contactError && <p className="text-xs text-red-600">{contactError}</p>}
                  </>
                ) : (
                  <>
                    <div>📍 Location: {((localContact ?? c)?.location ?? "").trim() || "—"}</div>
                    <div>✉️ Email: {((localContact ?? c)?.email ?? "").trim() || "—"}</div>
                    <div>📞 Phone: {((localContact ?? c)?.phone ?? "").trim() || "—"}</div>
                    <div>LinkedIn: {(localContact ?? c)?.linkedinUrl?.trim() ? (
                      <a href={(localContact ?? c)?.linkedinUrl ?? ""} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">{(localContact ?? c)?.linkedinUrl}</a>
                    ) : (
                      "—"
                    )}</div>
                  </>
                )}
              </div>
            </section>
            {role !== "AGENCY" && (
            <p className="mt-2 text-sm text-gray-600">
              Status: <span className="font-medium">{submission.status}</span>
            </p>
            )}
            <div className="w-full flex items-center justify-between mt-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-700">Owner</h3>
              </div>
              {role === "AGENCY" && onSetOwner && (
                <div className="shrink-0 flex items-center gap-2">
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
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-medium">{getSubmissionOwnerName(submission) || "—"}</span>
            </p>
          </div>
        </div>

        {/* Tabs - CLIENT: Resume only (decisions on card dropdown). AGENCY: no tabs in panel. */}
        {role === "CLIENT" && (
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
        )}

        {(role === "AGENCY" || (activeTab !== "RESUME" && (role !== "CLIENT" || activeTab !== "YOUR_DECISION"))) && (
        <div className="space-y-6 p-4">
          {/* AI Fit - AGENCY only */}
          {role === "AGENCY" && (
          <section>
            <div className="w-full flex items-center justify-between mb-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-700">AI Fit</h3>
              </div>
              <div className="shrink-0 flex items-center gap-2">
              {(!submission?.evaluatedAt && !localEvaluation) ? (
                <button
                  type="button"
                  className="rounded-md bg-sky-600 text-white px-3 py-1.5 text-xs hover:bg-sky-700 disabled:opacity-50"
                  disabled={busy !== null || evaluationLoading}
                  onClick={async () => {
                    if (!submission?.id) return;
                    setEvaluationError(null);
                    setEvaluationLoading(true);
                    setBusy("evaluate");
                    try {
                      const res = await fetch(`/api/submissions/${submission.id}/evaluate`, {
                        method: "POST",
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        setEvaluationError(data.error || "Evaluation failed");
                        return;
                      }
                      const data = await res.json();
                      setLocalEvaluation(data.evaluation);
                      router.refresh();
                    } catch (err) {
                      setEvaluationError("Evaluation failed");
                    } finally {
                      setEvaluationLoading(false);
                      setBusy(null);
                    }
                  }}
                >
                  {evaluationLoading ? "Evaluating..." : "Evaluate Fit"}
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
                  disabled={busy !== null || evaluationLoading}
                  onClick={async () => {
                    if (!submission?.id) return;
                    setEvaluationError(null);
                    setEvaluationLoading(true);
                    setBusy("evaluate");
                    try {
                      const res = await fetch(`/api/submissions/${submission.id}/evaluate`, {
                        method: "POST",
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        setEvaluationError(data.error || "Evaluation failed");
                        return;
                      }
                      const data = await res.json();
                      setLocalEvaluation(data.evaluation);
                      router.refresh();
                    } catch (err) {
                      setEvaluationError("Evaluation failed");
                    } finally {
                      setEvaluationLoading(false);
                      setBusy(null);
                    }
                  }}
                >
                  {evaluationLoading ? "Re-running..." : "Re-run AI"}
                </button>
              )}
              </div>
            </div>
            {evaluationError && (
              <p className="mb-2 text-xs text-red-600">{evaluationError}</p>
            )}

            {(submission?.fitScore !== null && submission?.fitScore !== undefined) || localEvaluation ? (
              (() => {
                const evalData = localEvaluation || {
                  fitScore: submission?.fitScore ?? 0,
                  fitSummary: submission?.fitSummary ?? null,
                  strengths: submission?.strengths ?? null,
                  gaps: submission?.gaps ?? null,
                  sellingPoints: submission?.sellingPoints ?? null,
                  objectionsAndRebuttals: submission?.objectionsAndRebuttals ?? null,
                  confidence: submission?.confidence ?? null,
                  evaluatedAt: submission?.evaluatedAt ?? null,
                };
                const score = evalData.fitScore;
                const scoreColor = score >= 80 ? "text-green-700" : score >= 60 ? "text-blue-700" : "text-orange-700";
                const scoreBg = score >= 80 ? "bg-green-50 border-green-200" : score >= 60 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200";

                return (
                  <div className="mt-2 space-y-4">
                    {/* Score and Confidence */}
                    <div className={`rounded-md border p-3 ${scoreBg}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-gray-600 mb-1">Fit Score</div>
                          <div className={`text-2xl font-bold ${scoreColor}`}>{score}%</div>
                        </div>
                        {evalData.confidence !== null && (
                          <div className="text-right">
                            <div className="text-xs text-gray-600 mb-1">Confidence</div>
                            <div className="text-sm font-medium text-gray-700">
                              {Math.round((evalData.confidence ?? 0) * 100)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    {evalData.fitSummary && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Summary</div>
                        <p className="text-sm text-gray-800">{evalData.fitSummary}</p>
                      </div>
                    )}

                    {/* Strengths */}
                    {evalData.strengths && Array.isArray(evalData.strengths) && evalData.strengths.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Strengths</div>
                        <ul className="text-sm text-gray-800 space-y-1">
                          {evalData.strengths.map((s, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-green-600 mr-2">+</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gaps */}
                    {evalData.gaps && Array.isArray(evalData.gaps) && evalData.gaps.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Gaps</div>
                        <ul className="text-sm text-gray-800 space-y-1">
                          {evalData.gaps.map((g, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-orange-600 mr-2">−</span>
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Selling Points */}
                    {evalData.sellingPoints && Array.isArray(evalData.sellingPoints) && evalData.sellingPoints.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-1">Selling Points</div>
                        <ul className="text-sm text-gray-800 space-y-1">
                          {evalData.sellingPoints.map((sp, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-blue-600 mr-2">•</span>
                              <span>{sp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Objections & Rebuttals */}
                    {evalData.objectionsAndRebuttals && Array.isArray(evalData.objectionsAndRebuttals) && evalData.objectionsAndRebuttals.length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-gray-700 mb-2">Objections & Rebuttals</div>
                        <div className="space-y-3">
                          {evalData.objectionsAndRebuttals.map((or, i) => (
                            <div key={i} className="rounded-md border p-2 bg-gray-50">
                              <div className="text-xs font-medium text-red-700 mb-1">Objection:</div>
                              <div className="text-sm text-gray-800 mb-2">{or.objection}</div>
                              <div className="text-xs font-medium text-green-700 mb-1">Rebuttal:</div>
                              <div className="text-sm text-gray-800">{or.rebuttal}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evalData.evaluatedAt && (
                      <div className="text-xs text-gray-500">
                        Evaluated {formatTimeAgo(evalData.evaluatedAt)}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-gray-500 mt-2">
                No evaluation yet. Click "Evaluate Fit" to analyze candidate fit.
              </div>
            )}
          </section>
          )}

          {/* Activity Timeline - AGENCY: last 3 by default with Show more/less; CLIENT: last 5 with Show all (n)/Show less */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Activity</h3>

            <div className="mt-2 space-y-2 text-sm">
              {activity.length > 0 ? (
                <>
                  {(activityExpanded ? activity : activity.slice(0, role === "AGENCY" ? 3 : 5)).map((e: any) => (
                    <div key={e.id} className="rounded-md border p-2 bg-gray-50 text-gray-800">
                      <div className="font-medium">
                        {e.type === "STATUS_CHANGE"
                          ? "Status changed"
                          : e.type === "QUESTION"
                          ? "Note"
                          : e.type === "AI_EVALUATION"
                          ? "AI Evaluation"
                          : e.type}
                      </div>

                      {e.note && (
                        <div className="text-gray-600">
                          {e.note
                            .replaceAll("SUBMITTED", "Submitted to AM")
                            .replaceAll("UNDER_REVIEW", "Submitted to Client")
                            .replaceAll("INTERVIEW_REQUESTED", "Interview Requested")
                            .replaceAll("OFFER_PENDING", "Interview Scheduled")
                            .replaceAll("OFFERED", "Offered")
                            .replaceAll("DECLINED", "Declined")
                            .replaceAll("CLOSED", "Closed")}
                        </div>
                      )}

                      <div className="text-xs text-gray-400">{formatTimeAgo(e.createdAt)}</div>
                    </div>
                  ))}
                  {(role === "AGENCY" ? activity.length > 3 : activity.length > 5) && (
                    <button
                      type="button"
                      className="text-xs text-sky-600 hover:underline"
                      onClick={() => setActivityExpanded((v) => !v)}
                    >
                      {activityExpanded ? "Show less" : role === "AGENCY" ? "Show more" : `Show all (${activity.length})`}
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

          {/* Resume link (for context) - CLIENT only; AGENCY panel does not show this section */}
          {role !== "AGENCY" && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700">Resume</h3>
            <div className="mt-2">
              {hasResume ? (
                <button
                  type="button"
                  onClick={() => onOpenResumeViewer?.(effectiveResumeUrl ?? null, candidateName, resumeFilename, submission?.candidate?.resumeText ?? null, effectiveCandidateId ?? null)}
                  className="text-sm underline text-left bg-transparent border-none cursor-pointer p-0 text-sky-600 hover:text-sky-800"
                >
                  View resume
                </button>
              ) : (
                <p className="text-sm text-gray-400">No resume uploaded yet.</p>
              )}
            </div>
          </section>
          )}
        </div>
        )}

        {activeTab === "RESUME" && role !== "AGENCY" && (
          <div className="p-4 h-[calc(100%-56px)] flex flex-col gap-3">
            {hasResume ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenResumeViewer?.(effectiveResumeUrl ?? null, candidateName, resumeFilename, submission?.candidate?.resumeText ?? null, effectiveCandidateId ?? null)}
                  className="rounded-md border border-sky-500 bg-sky-50 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-100"
                >
                  View resume
                </button>
                <p className="text-sm text-gray-500">Open in-app viewer with preview and Download.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No resume uploaded yet.</p>
            )}
          </div>
        )}
    </div>
    </>
  );
}
