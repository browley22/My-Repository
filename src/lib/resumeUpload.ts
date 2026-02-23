/**
 * Shared resume upload for candidate. Used by Candidate Detail Sheet (Resume tab)
 * and by Kanban card file drop (Agency). Same API: POST /api/candidates/[id]/resume.
 */

const RESUME_ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export type ResumeUploadResult =
  | { success: true; resumeUrl?: string; warning?: string }
  | { success: false; error: string };

/**
 * Upload a resume file for a candidate. Accepts PDF and DOC/DOCX (same as API).
 */
export async function uploadResumeFile(
  candidateId: string,
  file: File
): Promise<ResumeUploadResult> {
  const valid =
    RESUME_ALLOWED_TYPES.includes(file.type) ||
    /\.(pdf|doc|docx)$/i.test(file.name);
  if (!valid) {
    return { success: false, error: "Please upload a PDF, DOC, or DOCX file." };
  }

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/candidates/${candidateId}/resume`;
  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch(url, { method: "POST", body: form });
    const raw = await res.text();
    let data: {
      error?: string;
      detail?: string;
      resumeUrl?: string;
      warning?: string;
    } = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!res.ok) {
      const errMsg =
        typeof data?.error === "string" ? data.error : `Upload failed (${res.status})`;
      const detail =
        typeof data?.detail === "string" ? data.detail : raw || res.statusText;
      return {
        success: false,
        error: detail ? `${errMsg} — ${detail}` : errMsg,
      };
    }

    const resumeUrl =
      typeof data?.resumeUrl === "string" ? data.resumeUrl : undefined;
    if (resumeUrl) {
      return {
        success: true,
        resumeUrl,
        warning: typeof data?.warning === "string" ? data.warning : undefined,
      };
    }

    return {
      success: false,
      error: "Upload succeeded but server did not return resume URL.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch";
    return { success: false, error: `Upload failed: ${msg}` };
  }
}
