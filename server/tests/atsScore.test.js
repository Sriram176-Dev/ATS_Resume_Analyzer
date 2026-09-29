import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { calculateScore, buildRuleSuggestions, detectSections, scoreBand } from "../utils/atsScore.js";
import { parseResume } from "../utils/resumeParser.js";
import { makePdf, SAMPLE_JD } from "./helpers.js";

const WEAK = `John Smith
I am a hard working team player. Responsible for various tasks. I worked on many projects and helped with customer issues.
Worked at ABC Company. Did things. My duties included answering phones.
References available upon request.`;

test("a well-structured resume scores high and a weak one scores low", async () => {
  const { text, pageCount } = await parseResume(await makePdf(), "pdf");
  const good = calculateScore(text, { pageCount });
  const weak = calculateScore(WEAK);
  assert.ok(good.atsScore >= 75, `good resume scored ${good.atsScore}`);
  assert.ok(weak.atsScore <= 25, `weak resume scored ${weak.atsScore}`);
  assert.ok(good.atsScore > weak.atsScore + 40);
});

test("without a job description keywordScore is null and overall is 50/50 format/content", () => {
  const r = calculateScore(WEAK);
  assert.equal(r.keywordScore, null);
  assert.equal(r.atsScore, Math.round(r.formatScore * 0.5 + r.contentScore * 0.5));
  assert.ok(!r.checks.some((c) => c.category === "keywords"));
});

test("with a job description, overall is 40/30/30 and a keyword check exists", async () => {
  const { text, pageCount } = await parseResume(await makePdf(), "pdf");
  const r = calculateScore(text, { jobDescription: SAMPLE_JD, pageCount });
  assert.equal(r.atsScore, Math.round(r.keywordScore * 0.4 + r.formatScore * 0.3 + r.contentScore * 0.3));
  const kw = r.checks.find((c) => c.id === "keyword_match");
  assert.ok(kw && kw.fix.includes("Kubernetes"));
});

test("scores stay within 0-100 and every check is well-formed", async () => {
  const { text, pageCount } = await parseResume(await makePdf(), "pdf");
  for (const r of [calculateScore(text, { pageCount }), calculateScore(WEAK), calculateScore("x")]) {
    for (const n of [r.atsScore, r.formatScore, r.contentScore]) assert.ok(n >= 0 && n <= 100);
    for (const c of r.checks) {
      assert.ok(["pass", "warn", "fail"].includes(c.status));
      assert.ok(c.points >= 0 && c.points <= c.maxPoints);
      assert.ok(c.label && c.detail && c.fix);
    }
  }
});

test("section detection is line-based, not substring-based", () => {
  // 'network' contains 'work', 'skills' appears inside a sentence: neither is a heading
  assert.deepEqual(detectSections(["I manage the network and my skills are strong"]), []);
  const found = detectSections(["SUMMARY", "Work Experience", "EDUCATION", "Technical Skills", "Skills: JS, React", "Personal Projects", "Certifications"]);
  for (const s of ["summary", "experience", "education", "skills", "projects", "certifications"]) assert.ok(found.includes(s), s);
});

test("metrics are counted (%, currency, multipliers, magnitudes) but plain years are not", () => {
  const r = calculateScore("Cut latency by 42% and saved $1.2M with 3x throughput serving 2M requests. Joined in 2021 with 4+ years experience.");
  assert.equal(r.stats.metricCount, 4);
});

test("first-person and weak phrases are penalised", () => {
  const r = calculateScore(WEAK);
  assert.notEqual(r.checks.find((c) => c.id === "weak_phrases").status, "pass");
  assert.notEqual(r.checks.find((c) => c.id === "first_person").status, "pass");
});

test("rule suggestions are prioritised, capped and never empty for a weak resume", () => {
  const r = calculateScore(WEAK);
  const s = buildRuleSuggestions(r.checks, 5);
  assert.equal(s.length, 5);
  assert.ok(s.every((x) => x.source === "rules" && ["high", "medium", "low"].includes(x.priority) && x.text));
  assert.equal(s[0].priority, "high");
});

test("scoreBand thresholds", () => {
  assert.deepEqual([90, 75, 60, 10].map(scoreBand), ["Excellent", "Good", "Needs work", "Poor"]);
});

test("priority labels discriminate: a weak resume is not all 'high'", () => {
  const s = buildRuleSuggestions(calculateScore(WEAK).checks, 8);
  const byPriority = (p) => s.filter((x) => x.priority === p).length;
  assert.ok(byPriority("high") >= 1 && byPriority("high") <= 4, `high=${byPriority("high")}`);
  assert.ok(byPriority("medium") >= 1, "expected some medium-priority items");
  assert.equal(s[0].priority, "high");
});
