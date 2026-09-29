/** Score presentation helpers. Thresholds mirror the server's scoreBand(). */
export function scoreBand(score) {
  if (score >= 85) return { label: "Excellent", tone: "good" };
  if (score >= 70) return { label: "Good", tone: "good" };
  if (score >= 50) return { label: "Needs work", tone: "warn" };
  return { label: "Poor", tone: "bad" };
}

const CATEGORY_LABELS = {
  bullet_improvement: "Bullet points",
  action_verb: "Action verbs",
  quantifiable_achievement: "Metrics",
  formatting: "Formatting",
  keyword_optimization: "Keywords",
  section_improvement: "Sections",
  content_gap: "Missing content",
};
export const categoryLabel = (c) => CATEGORY_LABELS[c] || (c ? c.replace(/_/g, " ") : "General");

export const SECTION_LABELS = {
  summary: "Summary", experience: "Experience", education: "Education", skills: "Skills",
  projects: "Projects", certifications: "Certifications", awards: "Awards",
};

export const KEYWORD_GROUPS = [
  { key: "technical", label: "Technical skills" },
  { key: "domain", label: "Industry and tools" },
  { key: "soft", label: "Soft skills" },
  { key: "other", label: "Other terms" },
];
