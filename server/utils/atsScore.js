/**
 * ATS scoring engine.
 *
 * The score is built from explicit, explainable checks. Each check has a point
 * value, a pass/warn/fail status, a human-readable detail and a concrete fix,
 * so users can see exactly *why* they got their score and what to change.
 *
 *  Format  (0-100): can software parse it and is it structured conventionally?
 *  Content (0-100): are the bullets specific, quantified and written in strong language?
 *  Keywords(0-100): how much of the job description's vocabulary does the resume cover?
 *                   `null` when no job description was provided.
 *
 *  Overall:  with a JD    -> 40% keywords + 30% format + 30% content
 *            without a JD -> 50% format   + 50% content
 */
import { extractKeywords, compareKeywords, countMatches } from "./keywordExtractor.js";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

const ACTION_VERB_BASES = (
  "achieve manage develop lead create implement design improve increase reduce deliver launch build optimize coordinate establish execute generate negotiate streamline spearhead supervise analyze mentor resolve transform collaborate facilitate initiate pioneer consolidate accelerate architect automate migrate refactor deploy integrate engineer maintain monitor test debug document research evaluate assess plan organize train coach guide direct oversee drive define prioritize present communicate partner support advise consult audit forecast budget secure grow expand scale boost cut save lower raise enhance strengthen simplify standardize modernize redesign rebuild revamp overhaul unify merge configure install administer provision harden investigate identify diagnose troubleshoot review approve validate verify enforce conduct perform produce publish write draft edit compose craft curate translate teach tutor instruct recruit hire onboard interview select screen promote market sell close acquire retain convert engage attract mobilize orchestrate steer champion advocate represent liaise schedule allocate track measure report visualize model prototype simulate calculate extract process clean ingest query own operate administer resolve won earn award exceed surpass outperform reengineer restructure reorganize centralize decrease eliminate minimize maximize customize personalize contribute deliver ship release publish demonstrate showcase lead"
).split(/\s+/);
const IRREGULAR_VERBS = new Set(["led", "built", "ran", "wrote", "won", "taught", "drove", "grew", "oversaw", "sold", "spent", "held", "cut", "set", "made"]);

/** Reduce a verb to a comparable key: managed / manages / managing / manage -> "manag". */
function verbKey(word) {
  return word
    .toLowerCase()
    .replace(/(ing|ed|es|s|d)$/, "")
    .replace(/e$/, "")
    .replace(/([b-df-hj-np-tv-z])\1$/, "$1")
    .replace(/i$/, "y");
}
const VERB_KEYS = new Set(ACTION_VERB_BASES.map(verbKey));
const isActionVerb = (word) => IRREGULAR_VERBS.has(word.toLowerCase()) || (word.length > 2 && VERB_KEYS.has(verbKey(word)));

const WEAK_PHRASES = [
  "responsible for", "duties included", "duties include", "tasked with", "helped with", "helped to", "worked on", "assisted with", "assisted in",
  "in charge of", "hard-working", "hard working", "team player", "go-getter", "results-oriented", "self-motivated", "references available", "various tasks", "and so on", "etc.",
];

const SECTION_PATTERNS = {
  summary: /^(?:(?:professional|career|executive) )?(?:summary|profile|objective)(?: statement)?$|^about(?: me)?$/,
  experience: /^(?:(?:professional|relevant|work|industry|related|internship) )?(?:experience|history|employment)(?: history)?$|^(?:work|employment) (?:history|experience)$|^internships?$/,
  education: /^(?:education|academic background|academic qualifications|educational qualifications|academics)(?: (?:and|&) \w+)?$/,
  skills: /^(?:(?:technical|core|key|professional|relevant) )?(?:skills?|competencies|expertise)(?: (?:and|&) \w+)?$|^(?:tech stack|technologies|tools(?: (?:and|&) technologies)?)$/,
  projects: /^(?:(?:personal|academic|key|selected|side|notable) )?projects?$/,
  certifications: /^(?:licenses? (?:and|&) )?(?:certifications?|certificates?|licenses?|courses|training)(?: (?:and|&) \w+)?$/,
  awards: /^(?:awards?|honou?rs|achievements|accomplishments)(?: (?:and|&) \w+)?$/,
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINK_RE = /linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|medium\.com|https?:\/\/|www\./i;
const BULLET_RE = /^(?:[•▪◦►\-*]|[\u2013\u2014])\s+\S/;
const METRIC_RE = new RegExp(
  [
    String.raw`[$€£₹]\s?\d[\d,.]*\s?(?:k|m|b|mn|bn|lakhs?|cr|crores?)?\b`,
    String.raw`\b\d[\d,.]*\s?%`,
    String.raw`\b\d+(?:\.\d+)?\s?[kmb]\+?(?![a-z])`,
    String.raw`\b\d+(?:\.\d+)?x\b`,
    String.raw`\b\d[\d,]*\+?\s+(?:users|customers|clients|projects|members|engineers|developers|employees|people|requests|transactions|records|applications|apps|services|stores|leads|accounts|students|teams|reports|releases|deployments|endpoints|pipelines)\b`,
  ].join("|"),
  "gi"
);
const FIRST_PERSON_RE = /\b(?:I(?:'m|'ve|'ll| am| have| was| will| can| led| built| worked| developed| managed| designed| like| love| enjoy)|my|myself)\b/g;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function makeCheck({ id, category, label, maxPoints, points, detail, fix, suggestionCategory }) {
  const earned = Math.round(clamp(points, 0, maxPoints) * 10) / 10;
  const status = earned >= maxPoints ? "pass" : earned >= maxPoints * 0.5 ? "warn" : "fail";
  return { id, category, label, status, points: earned, maxPoints, detail, fix, suggestionCategory };
}

/** Find which standard section headings are present (line-level, not substring). */
export function detectSections(lines) {
  const found = new Set();
  for (const raw of lines) {
    let line = raw.replace(/^[•\-*\s]+/, "").trim();
    if (!line) continue;

    // "Skills: JavaScript, React" -> treat the part before the colon as the heading
    const colon = line.indexOf(":");
    if (colon > 0 && colon <= 32) line = line.slice(0, colon);
    if (line.length > 45) continue;

    const normalized = line.toLowerCase().replace(/[^a-z& ]/g, " ").replace(/\s+/g, " ").trim();
    for (const [key, re] of Object.entries(SECTION_PATTERNS)) {
      if (re.test(normalized)) found.add(key);
    }
  }
  return [...found];
}

function findPhone(text) {
  const candidates = text.match(/\+?\d[\d\s().-]{8,18}\d/g) || [];
  return candidates.some((c) => {
    const digits = c.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 && !/^(19|20)\d{2}\D*(19|20)\d{2}$/.test(c.trim());
  });
}

/* ------------------------------------------------------------------ */
/* Check groups                                                        */
/* ------------------------------------------------------------------ */

function formatChecks({ text, lines, sections, wordCount, bullets, pageCount }) {
  const has = (s) => sections.includes(s);
  const yearMentions = (text.match(/\b(?:19|20)\d{2}\b/g) || []).length + (/\bpresent\b|\bcurrent\b/i.test(text) ? 1 : 0);

  const experiencePoints = has("experience") ? 12 : has("projects") ? 6 : 0;
  const lengthPoints = wordCount >= 250 && wordCount <= 900 ? 10 : (wordCount >= 150 && wordCount < 250) || (wordCount > 900 && wordCount <= 1200) ? 5 : 0;
  let pagePoints = 6;
  let pageDetail = "Page count isn't available for Word documents.";
  if (pageCount != null) {
    pagePoints = pageCount <= 2 ? 6 : pageCount === 3 ? 3 : 0;
    pageDetail = `Your resume is ${pageCount} page${pageCount === 1 ? "" : "s"}.`;
  }

  return [
    makeCheck({ id: "contact_email", category: "format", label: "Email address", maxPoints: 10, points: EMAIL_RE.test(text) ? 10 : 0,
      detail: EMAIL_RE.test(text) ? "An email address was found." : "No email address was found in the text.",
      fix: "Add a professional email address at the top of your resume, as plain text (not inside an image or header/footer).", suggestionCategory: "content_gap" }),
    makeCheck({ id: "contact_phone", category: "format", label: "Phone number", maxPoints: 8, points: findPhone(text) ? 8 : 0,
      detail: findPhone(text) ? "A phone number was found." : "No phone number was found in the text.",
      fix: "Add a phone number with country code next to your email so recruiters can reach you quickly.", suggestionCategory: "content_gap" }),
    makeCheck({ id: "contact_links", category: "format", label: "Profile link", maxPoints: 6, points: LINK_RE.test(text) ? 6 : 0,
      detail: LINK_RE.test(text) ? "A LinkedIn, GitHub or portfolio link was found." : "No LinkedIn, GitHub or portfolio link was found.",
      fix: "Add your LinkedIn profile and, if relevant, a GitHub or portfolio URL.", suggestionCategory: "content_gap" }),
    makeCheck({ id: "section_experience", category: "format", label: "Experience section", maxPoints: 12, points: experiencePoints,
      detail: has("experience") ? "A standard Experience heading was found." : has("projects") ? "No Experience heading, but a Projects section was found." : "No Experience heading was found.",
      fix: "Add a section headed \"Experience\" or \"Work Experience\". ATS software looks for these standard headings; students can use \"Internships\" and \"Projects\".", suggestionCategory: "section_improvement" }),
    makeCheck({ id: "section_education", category: "format", label: "Education section", maxPoints: 10, points: has("education") ? 10 : 0,
      detail: has("education") ? "A standard Education heading was found." : "No Education heading was found.",
      fix: "Add a section headed \"Education\" listing your degree, institution and graduation year.", suggestionCategory: "section_improvement" }),
    makeCheck({ id: "section_skills", category: "format", label: "Skills section", maxPoints: 10, points: has("skills") ? 10 : 0,
      detail: has("skills") ? "A standard Skills heading was found." : "No Skills heading was found.",
      fix: "Add a dedicated \"Skills\" section. It is the first place ATS filters look for keyword matches.", suggestionCategory: "section_improvement" }),
    makeCheck({ id: "section_summary", category: "format", label: "Summary", maxPoints: 4, points: has("summary") ? 4 : 0,
      detail: has("summary") ? "A summary or profile section was found." : "No summary or profile section was found.",
      fix: "Add a 2-3 line professional summary at the top that states your role, years of experience and strongest skills.", suggestionCategory: "formatting" }),
    makeCheck({ id: "dates", category: "format", label: "Dates on experience", maxPoints: 8, points: yearMentions >= 2 ? 8 : yearMentions === 1 ? 4 : 0,
      detail: yearMentions >= 2 ? "Dates were found." : "Few or no dates were found.",
      fix: "Add start and end dates (e.g. \"Jun 2022 - Present\") to every role, education entry and project so ATS can compute your experience.", suggestionCategory: "formatting" }),
    makeCheck({ id: "bullets", category: "format", label: "Bullet points", maxPoints: 12, points: bullets.length >= 6 ? 12 : bullets.length >= 3 ? 6 : 0,
      detail: `${bullets.length} bullet point${bullets.length === 1 ? "" : "s"} detected.`,
      fix: "Describe each role with 3-5 short bullet points instead of long paragraphs. Use standard round bullets.", suggestionCategory: "formatting" }),
    makeCheck({ id: "length", category: "format", label: "Length", maxPoints: 10, points: lengthPoints,
      detail: `${wordCount} words. Aim for roughly 250-900.`,
      fix: wordCount < 250 ? "Your resume is very short. Add more detail about your responsibilities, projects and results." : "Your resume is long. Trim older or less relevant roles and keep it to two pages.", suggestionCategory: "formatting" }),
    makeCheck({ id: "pages", category: "format", label: "Page count", maxPoints: 6, points: pagePoints, detail: pageDetail,
      fix: "Keep your resume to one or two pages. Recruiters spend seconds on a first pass.", suggestionCategory: "formatting" }),
    makeCheck({ id: "structure", category: "format", label: "Readable structure", maxPoints: 4, points: lines.length >= 15 ? 4 : lines.length >= 8 ? 2 : 0,
      detail: `${lines.length} lines of text were extracted.`,
      fix: "Very little line structure was extracted. Avoid tables, text boxes and multi-column layouts; use a single-column layout.", suggestionCategory: "formatting" }),
  ];
}

function contentChecks({ text, wordCount, bullets }) {
  // Action verbs -------------------------------------------------------
  const bulletStarts = bullets.map((b) => b.replace(BULLET_RE, (m) => m.slice(-1)).trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "") || "");
  const verbStarts = bulletStarts.filter((w) => w && isActionVerb(w));
  let verbPoints;
  let verbDetail;
  if (bullets.length >= 3) {
    const ratio = verbStarts.length / bullets.length;
    verbPoints = Math.min(30, (ratio / 0.6) * 30);
    verbDetail = `${verbStarts.length} of ${bullets.length} bullets start with a strong action verb (${Math.round(ratio * 100)}%).`;
  } else {
    const distinct = new Set((text.toLowerCase().match(/[a-z]+/g) || []).filter((w) => isActionVerb(w)).map(verbKey));
    verbPoints = Math.min(30, distinct.size * 3);
    verbDetail = `Too few bullets to check how they start; ${distinct.size} action verbs found in the text.`;
  }

  // Quantified achievements --------------------------------------------
  const metrics = (text.match(METRIC_RE) || []).length;

  // Weak phrases ---------------------------------------------------------
  const weakHits = WEAK_PHRASES.map((p) => [p, countMatches(text, p)]).filter(([, n]) => n > 0);
  const weakCount = weakHits.reduce((n, [, c]) => n + c, 0);

  // First-person language --------------------------------------------------
  const firstPerson = (text.match(FIRST_PERSON_RE) || []).length;

  // Bullet length -------------------------------------------------------------
  const lengths = bullets.map((b) => b.split(/\s+/).length - 1);
  const avgLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  let lenPoints = 0;
  if (bullets.length >= 3) lenPoints = avgLen >= 8 && avgLen <= 28 ? 10 : (avgLen >= 5 && avgLen < 8) || (avgLen > 28 && avgLen <= 40) ? 5 : 0;

  // Variety of bullet openers --------------------------------------------------
  const openers = bulletStarts.filter(Boolean).map((w) => w.toLowerCase());
  const variety = openers.length ? new Set(openers).size / openers.length : 0;
  const varietyPoints = bullets.length >= 3 ? (variety >= 0.75 ? 10 : variety >= 0.5 ? 5 : 0) : 0;

  return [
    makeCheck({ id: "action_verbs", category: "content", label: "Action verbs", maxPoints: 30, points: verbPoints, detail: verbDetail,
      fix: "Start every bullet with a strong past-tense verb such as Led, Built, Designed, Reduced or Launched instead of nouns or phrases like \"Responsible for\".", suggestionCategory: "action_verb" }),
    makeCheck({ id: "metrics", category: "content", label: "Quantified results", maxPoints: 25, points: Math.min(25, (metrics / 6) * 25),
      detail: `${metrics} quantified result${metrics === 1 ? "" : "s"} found (numbers, percentages, currency). Aim for 6 or more.`,
      fix: "Add numbers to your achievements: percentages, revenue, users, time saved or team size. For example, \"Cut page load time by 42%\".", suggestionCategory: "quantifiable_achievement" }),
    makeCheck({ id: "weak_phrases", category: "content", label: "Weak or clichéd phrases", maxPoints: 15, points: 15 - weakCount * 3,
      detail: weakCount === 0 ? "No weak or clichéd phrases found." : `Found: ${weakHits.map(([p, c]) => `"${p}"${c > 1 ? ` ×${c}` : ""}`).join(", ")}.`,
      fix: weakHits.length ? `Replace ${weakHits.slice(0, 3).map(([p]) => `"${p}"`).join(", ")} with a specific action and outcome, e.g. "Reduced onboarding time by 30% by...".` : "Remove clichéd phrases.", suggestionCategory: "bullet_improvement" }),
    makeCheck({ id: "first_person", category: "content", label: "Professional tone", maxPoints: 10, points: firstPerson === 0 ? 10 : firstPerson <= 2 ? 6 : 0,
      detail: firstPerson === 0 ? "No first-person pronouns found." : `${firstPerson} first-person phrase${firstPerson === 1 ? "" : "s"} found (I, my).`,
      fix: "Remove first-person pronouns (\"I\", \"my\"). Resume bullets are written in an implied first person, e.g. \"Built...\" not \"I built...\".", suggestionCategory: "bullet_improvement" }),
    makeCheck({ id: "bullet_length", category: "content", label: "Bullet length", maxPoints: 10, points: lenPoints,
      detail: bullets.length >= 3 ? `Bullets average ${Math.round(avgLen)} words. Aim for 8-28.` : "Not enough bullets to measure length.",
      fix: avgLen > 28 ? "Shorten your bullets to one or two lines: lead with the action, then the result." : "Expand very short bullets to include what you did, how, and the result.", suggestionCategory: "bullet_improvement" }),
    makeCheck({ id: "bullet_variety", category: "content", label: "Varied bullet openers", maxPoints: 10, points: varietyPoints,
      detail: bullets.length >= 3 ? `${Math.round(variety * 100)}% of bullet openers are unique.` : "Not enough bullets to measure variety.",
      fix: "Vary the first word of your bullets. Repeating the same verb makes achievements blur together.", suggestionCategory: "action_verb" }),
  ];
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

const sumScore = (checks) => {
  const max = checks.reduce((n, c) => n + c.maxPoints, 0);
  const got = checks.reduce((n, c) => n + c.points, 0);
  return max ? Math.round((got / max) * 100) : 0;
};

/**
 * @param {string} resumeText
 * @param {{ jobDescription?: string, pageCount?: number | null }} [options]
 */
export function calculateScore(resumeText, { jobDescription = "", pageCount = null } = {}) {
  const lines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => BULLET_RE.test(l));
  const sections = detectSections(lines);
  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const ctx = { text: resumeText, lines, sections, wordCount, bullets, pageCount };

  const fmt = formatChecks(ctx);
  const content = contentChecks(ctx);
  const formatScore = sumScore(fmt);
  const contentScore = sumScore(content);

  // Keywords (only when a job description is supplied)
  let keywordScore = null;
  let keywordResult = { details: [], matched: [], missing: [], matchPercentage: 0 };
  const checks = [...fmt, ...content];
  const hasJd = jobDescription.trim().length > 0;

  if (hasJd) {
    const keywords = extractKeywords(jobDescription);
    keywordResult = compareKeywords(resumeText, keywords);
    keywordScore = keywordResult.matchPercentage;

    const topMissing = keywordResult.details.filter((d) => !d.matched).slice(0, 6).map((d) => d.term);
    if (keywords.length > 0) {
      checks.push(
        makeCheck({
          id: "keyword_match", category: "keywords", label: "Job description keywords", maxPoints: 100, points: keywordScore,
          detail: `${keywordResult.matched.length} of ${keywords.length} keywords from the job description were found.`,
          fix: topMissing.length
            ? `Add the missing keywords that genuinely apply to you, in your Skills section and in bullet points: ${topMissing.join(", ")}.`
            : "Keep using the job description's exact terms.",
          suggestionCategory: "keyword_optimization",
        })
      );
    }
  }

  const atsScore = hasJd && keywordScore !== null
    ? Math.round(keywordScore * 0.4 + formatScore * 0.3 + contentScore * 0.3)
    : Math.round(formatScore * 0.5 + contentScore * 0.5);

  const stats = {
    wordCount,
    bulletCount: bullets.length,
    metricCount: (resumeText.match(METRIC_RE) || []).length,
    pageCount,
  };

  return { atsScore: clamp(atsScore), formatScore, contentScore, keywordScore, checks, sections, stats, keywordResult };
}

/** Human label for a 0-100 score. */
export function scoreBand(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs work";
  return "Poor";
}

/**
 * Deterministic recommendations derived from failed checks. Always available, even
 * when the AI service is down or not configured.
 *
 * @returns {{ text: string, category: string, priority: "high"|"medium"|"low", source: "rules" }[]}
 */
export function buildRuleSuggestions(checks, limit = 8) {
  return checks
    .filter((c) => c.status !== "pass")
    .map((c) => ({ c, lost: c.maxPoints - c.points }))
    .map(({ c, lost }) => ({
      lost,
      // Keyword gaps are weighted on a 0-100 scale, so judge them by percentage lost.
      priority: c.category === "keywords" ? (lost >= 40 ? "high" : lost >= 20 ? "medium" : "low") : lost >= 15 ? "high" : lost >= 8 ? "medium" : "low",
      text: c.fix,
      category: c.suggestionCategory,
      source: "rules",
    }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, limit)
    .map(({ lost: _lost, ...rest }) => rest);
}
