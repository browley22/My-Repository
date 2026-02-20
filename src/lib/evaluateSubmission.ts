/**
 * Placeholder evaluator function for AI Submission Evaluation.
 * Uses heuristic keyword matching and simple scoring logic.
 * Deterministic and safe - no external API calls.
 */

export type EvaluationResult = {
  fitScore: number; // 0-100
  fitSummary: string;
  strengths: string[];
  gaps: string[];
  sellingPoints: string[];
  objectionsAndRebuttals: { objection: string; rebuttal: string }[];
  confidence: number; // 0-1
};

export function evaluateSubmission({
  resumeText,
  jobDescription,
  recruiterNotes,
}: {
  resumeText: string | null | undefined;
  jobDescription: string | null | undefined;
  recruiterNotes?: string | null;
}): EvaluationResult {
  const resume = (resumeText || "").toLowerCase();
  const jd = (jobDescription || "").toLowerCase();
  const notes = (recruiterNotes || "").toLowerCase();
  const combinedText = `${resume} ${notes}`.trim();

  // Extract common keywords from JD
  const jdKeywords = extractKeywords(jd);
  const resumeKeywords = extractKeywords(combinedText);

  // Calculate keyword overlap
  const matchingKeywords = jdKeywords.filter((kw) => resumeKeywords.includes(kw));
  const keywordMatchRatio = jdKeywords.length > 0 ? matchingKeywords.length / jdKeywords.length : 0;

  // Extract years of experience if mentioned
  const yearsExpMatch = resume.match(/(\d+)\s*(?:years?|yrs?|yr)\s*(?:of\s*)?experience/i);
  const yearsExp = yearsExpMatch ? parseInt(yearsExpMatch[1], 10) : null;

  // Check for common tech/skills
  const techKeywords = [
    "javascript",
    "typescript",
    "react",
    "python",
    "java",
    "sql",
    "aws",
    "docker",
    "kubernetes",
    "node",
    "angular",
    "vue",
    "git",
    "ci/cd",
    "agile",
    "scrum",
  ];
  const techMatches = techKeywords.filter((tech) => combinedText.includes(tech));

  // Base score from keyword overlap (0-60 points)
  let score = Math.round(keywordMatchRatio * 60);

  // Bonus for tech matches (up to 20 points)
  score += Math.min(techMatches.length * 3, 20);

  // Bonus for years of experience mentioned (up to 10 points)
  if (yearsExp !== null) {
    if (yearsExp >= 5) score += 10;
    else if (yearsExp >= 3) score += 5;
    else if (yearsExp >= 1) score += 2;
  }

  // Bonus for recruiter notes (up to 10 points)
  if (notes.length > 20) {
    score += 10;
  } else if (notes.length > 0) {
    score += 5;
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // Generate strengths
  const strengths: string[] = [];
  if (techMatches.length > 0) {
    strengths.push(`Strong technical skills: ${techMatches.slice(0, 3).join(", ")}`);
  }
  if (yearsExp !== null && yearsExp >= 3) {
    strengths.push(`${yearsExp} years of relevant experience`);
  }
  if (matchingKeywords.length > 5) {
    strengths.push("Strong alignment with job requirements");
  }
  if (notes.length > 20) {
    strengths.push("Detailed recruiter notes indicate good fit");
  }
  if (strengths.length === 0) {
    strengths.push("Candidate profile matches basic requirements");
  }

  // Generate gaps
  const gaps: string[] = [];
  if (jdKeywords.length > matchingKeywords.length) {
    const missingKeywords = jdKeywords
      .filter((kw) => !resumeKeywords.includes(kw))
      .slice(0, 3);
    if (missingKeywords.length > 0) {
      gaps.push(`Missing keywords: ${missingKeywords.join(", ")}`);
    }
  }
  if (yearsExp === null) {
    gaps.push("Years of experience not clearly stated");
  }
  if (techMatches.length < 3 && jd.includes("experience")) {
    gaps.push("Limited technical skills mentioned");
  }
  if (gaps.length === 0) {
    gaps.push("Minor gaps may exist - review full profile");
  }

  // Generate selling points
  const sellingPoints: string[] = [];
  if (score >= 80) {
    sellingPoints.push("Excellent match with job requirements");
  } else if (score >= 60) {
    sellingPoints.push("Strong candidate with relevant experience");
  } else {
    sellingPoints.push("Candidate shows potential with some alignment");
  }
  if (techMatches.length > 0) {
    sellingPoints.push(`Proven expertise in ${techMatches[0]}`);
  }
  if (yearsExp !== null && yearsExp >= 5) {
    sellingPoints.push("Senior-level experience");
  }

  // Generate objections and rebuttals
  const objectionsAndRebuttals: { objection: string; rebuttal: string }[] = [];
  if (score < 70) {
    objectionsAndRebuttals.push({
      objection: "May not have all required skills",
      rebuttal: "Candidate demonstrates transferable skills and learning ability",
    });
  }
  if (yearsExp === null || (yearsExp !== null && yearsExp < 3)) {
    objectionsAndRebuttals.push({
      objection: "Limited years of experience",
      rebuttal: "Quality of experience matters more than duration; candidate shows strong potential",
    });
  }
  if (matchingKeywords.length < jdKeywords.length * 0.5) {
    objectionsAndRebuttals.push({
      objection: "Keyword match is below ideal",
      rebuttal: "Resume may not fully capture all skills; interview will clarify fit",
    });
  }

  // Generate summary
  let fitSummary = "";
  if (score >= 80) {
    fitSummary = `Strong candidate with ${score}% fit score. ${strengths[0] || "Good alignment with requirements"}.`;
  } else if (score >= 60) {
    fitSummary = `Good candidate with ${score}% fit score. ${strengths[0] || "Reasonable match with some gaps to address"}.`;
  } else {
    fitSummary = `Moderate candidate with ${score}% fit score. ${gaps[0] || "Some gaps exist but candidate may still be viable"}.`;
  }

  // Calculate confidence (0-1)
  let confidence = 0.5; // Base confidence
  if (resume.length > 500) confidence += 0.2; // More resume text = higher confidence
  if (jd.length > 200) confidence += 0.2; // More JD detail = higher confidence
  if (notes && notes.length > 50) confidence += 0.1; // Recruiter notes help
  confidence = Math.min(1, confidence);

  return {
    fitScore: score,
    fitSummary,
    strengths,
    gaps,
    sellingPoints,
    objectionsAndRebuttals,
    confidence,
  };
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - look for common tech terms, skills, etc.
  const commonWords = new Set([
    "javascript",
    "typescript",
    "react",
    "python",
    "java",
    "sql",
    "aws",
    "docker",
    "kubernetes",
    "node",
    "angular",
    "vue",
    "git",
    "agile",
    "scrum",
    "api",
    "rest",
    "graphql",
    "database",
    "backend",
    "frontend",
    "fullstack",
    "devops",
    "testing",
    "ci/cd",
    "cloud",
    "azure",
    "gcp",
    "linux",
    "microservices",
    "architecture",
    "leadership",
    "management",
    "team",
    "communication",
    "problem",
    "solving",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return Array.from(new Set(words.filter((w) => commonWords.has(w))));
}
