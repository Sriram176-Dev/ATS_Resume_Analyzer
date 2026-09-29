/**
 * Orchestrates a full analysis of an uploaded resume:
 * validate file -> extract text -> score -> keyword match -> AI (best effort) -> merge advice.
 */
import { env } from "../config/env.js";
import { detectFileType, normalizeFileName } from "../utils/fileValidation.js";
import { parseResume } from "../utils/resumeParser.js";
import { calculateScore, buildRuleSuggestions } from "../utils/atsScore.js";
import { generateSuggestions } from "../utils/aiAnalyzer.js";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/** AI advice first (when available), rule-based advice filling the gaps; sorted high -> low priority. */
function mergeSuggestions(ai, rules) {
  const combined = ai.length ? [...ai, ...rules.filter((r) => r.priority === "high").slice(0, 3)] : rules;
  return combined
    .map((s, i) => ({ s, i }))
    .sort((a, b) => PRIORITY_ORDER[a.s.priority] - PRIORITY_ORDER[b.s.priority] || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * @param {{ file: import("multer").File, jobDescription?: string, label?: string }} input
 */
export async function analyzeResumeFile({ file, jobDescription = "", label = "" }) {
  const fileType = detectFileType(file.buffer, file.originalname);
  const { text, pageCount } = await parseResume(file.buffer, fileType);

  const analysis = calculateScore(text, { jobDescription, pageCount });
  const ruleSuggestions = buildRuleSuggestions(analysis.checks);

  let aiSuggestions = [];
  let aiStatus = "disabled";
  if (env.aiEnabled) {
    try {
      aiSuggestions = await generateSuggestions({ resumeText: text, jobDescription, analysis });
      aiStatus = "ok";
    } catch {
      aiStatus = "unavailable";
    }
  }

  return {
    fileName: normalizeFileName(file.originalname),
    fileType,
    fileSize: file.size,
    label,
    text,
    pageCount,
    jobDescription,
    atsScore: analysis.atsScore,
    formatScore: analysis.formatScore,
    contentScore: analysis.contentScore,
    keywordScore: analysis.keywordScore,
    matchPercentage: analysis.keywordResult.matchPercentage,
    matchedKeywords: analysis.keywordResult.matched,
    missingKeywords: analysis.keywordResult.missing,
    keywordDetails: analysis.keywordResult.details,
    checks: analysis.checks,
    sections: analysis.sections,
    stats: analysis.stats,
    suggestions: mergeSuggestions(aiSuggestions, ruleSuggestions),
    aiStatus,
  };
}
