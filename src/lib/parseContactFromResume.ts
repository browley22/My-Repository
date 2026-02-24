/**
 * Parse contact info from resume text for auto-fill.
 * Used when saving resume text and contactManuallyOverridden is false.
 */

export type ParsedContact = {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Permissive US phone: digits, optional parens/dashes/dots/spaces
const PHONE_REGEX = /(?:\+?1[-.\s]*)?\(?[2-9]\d{2}\)?[-.\s]*\d{3}[-.\s]*\d{4}\b/g;
const LINKEDIN_URL_REGEX = /https?:\/\/(?:www\.)?linkedin\.com\/[^\s<>"']+/gi;
// Simple "City, ST" or "City, State" in first ~10 lines
const LOCATION_LINE_REGEX = /^[A-Za-z\s]+,\s*(?:[A-Z]{2}|[A-Za-z\s]+)$/m;

export function parseContactFromResumeText(resumeText: string): ParsedContact {
  const text = (resumeText || "").trim();
  const out: ParsedContact = { email: null, phone: null, linkedinUrl: null, location: null };
  if (!text) return out;

  const emailMatch = text.match(EMAIL_REGEX);
  if (emailMatch) out.email = emailMatch[0];

  const phoneMatches = text.match(PHONE_REGEX);
  if (phoneMatches && phoneMatches.length > 0) {
    out.phone = phoneMatches[0].replace(/\s+/g, " ").trim();
  }

  const linkedinMatches = text.match(LINKEDIN_URL_REGEX);
  if (linkedinMatches && linkedinMatches.length > 0) {
    out.linkedinUrl = linkedinMatches[0];
  }

  const firstLines = text.split(/\r?\n/).slice(0, 12).join("\n");
  const lines = firstLines.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 4 || trimmed.length > 80) continue;
    if (LOCATION_LINE_REGEX.test(trimmed) && !trimmed.toLowerCase().includes("email") && !trimmed.includes("@")) {
      out.location = trimmed;
      break;
    }
  }

  return out;
}

/** Update candidate contact from resume text only when contactManuallyOverridden is false. */
export async function applyContactFromResumeText(
  prisma: import("@prisma/client").PrismaClient,
  candidateId: string,
  resumeText: string
): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { contactManuallyOverridden: true },
  });
  if (!candidate || candidate.contactManuallyOverridden) return;
  const parsed = parseContactFromResumeText(resumeText);
  const data: { email?: string; phone?: string; linkedinUrl?: string; location?: string } = {};
  if (parsed.email != null) data.email = parsed.email;
  if (parsed.phone != null) data.phone = parsed.phone;
  if (parsed.linkedinUrl != null) data.linkedinUrl = parsed.linkedinUrl;
  if (parsed.location != null) data.location = parsed.location;
  if (Object.keys(data).length === 0) return;
  await prisma.candidate.update({
    where: { id: candidateId },
    data,
  });
}
