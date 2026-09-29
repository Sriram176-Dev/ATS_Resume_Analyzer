/** Shape database documents into the API's public JSON. Raw resume text is never exposed. */

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

export function serializeResumeSummary(doc) {
  return {
    id: String(doc._id),
    fileName: doc.fileName || "Untitled resume",
    label: doc.label || "",
    atsScore: doc.atsScore,
    formatScore: doc.formatScore,
    contentScore: doc.contentScore,
    keywordScore: doc.keywordScore ?? null,
    hasJobDescription: Boolean(doc.jobDescription && doc.jobDescription.trim()),
    createdAt: iso(doc.createdAt),
  };
}

export function serializeResume(doc) {
  return {
    ...serializeResumeSummary(doc),
    fileType: doc.fileType || null,
    fileSize: doc.fileSize ?? null,
    pageCount: doc.pageCount ?? null,
    jobDescription: doc.jobDescription || "",
    matchPercentage: doc.matchPercentage ?? 0,
    matchedKeywords: doc.matchedKeywords || [],
    missingKeywords: doc.missingKeywords || [],
    keywordDetails: (doc.keywordDetails || []).map((k) => ({ term: k.term, category: k.category, weight: k.weight, matched: k.matched })),
    checks: (doc.checks || []).map((c) => ({ id: c.id, category: c.category, label: c.label, status: c.status, points: c.points, maxPoints: c.maxPoints, detail: c.detail })),
    sections: doc.sections || [],
    stats: doc.stats || {},
    suggestions: (doc.suggestions || []).map((s) => ({ text: s.text, category: s.category, priority: s.priority, source: s.source || "ai" })),
    aiStatus: doc.aiStatus || "disabled",
    updatedAt: iso(doc.updatedAt),
  };
}
