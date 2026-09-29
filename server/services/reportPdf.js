/**
 * Generates a downloadable PDF report for a stored analysis, using pdfkit's built-in
 * Helvetica (no font files to ship). Text is sanitised to the characters Helvetica can render.
 */
import PDFDocument from "pdfkit";
import { scoreBand } from "../utils/atsScore.js";

const C = { ink: "#11161D", muted: "#5D6675", line: "#DFE3E8", primary: "#0B7A63", good: "#12805C", warn: "#9A5B00", bad: "#B42318", soft: "#F3F5F7" };
const M = 50; // page margin

/** Keep only glyphs available in the standard PDF fonts (WinAnsi-ish). */
const safe = (v = "") =>
  String(v)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u00FF\u2022]/g, "?");

const scoreColor = (n) => (n >= 70 ? C.good : n >= 50 ? C.warn : C.bad);
const statusColor = { pass: C.good, warn: C.warn, fail: C.bad };
const priorityColor = { high: C.bad, medium: C.warn, low: C.good };

function ensureSpace(doc, needed) {
  if (doc.y + needed > doc.page.height - M - 20) doc.addPage();
}

function heading(doc, text) {
  ensureSpace(doc, 60);
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(C.ink).text(safe(text));
  const y = doc.y + 3;
  doc.moveTo(M, y).lineTo(doc.page.width - M, y).lineWidth(0.75).strokeColor(C.line).stroke();
  doc.y = y + 8;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * @param {ReturnType<import("./serializers.js").serializeResume>} r
 * @param {import("node:stream").Writable} stream
 */
export function writeReportPdf(r, stream) {
  const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true, info: { Title: `ATS report - ${safe(r.fileName)}`, Author: "ResumeATS" } });
  doc.pipe(stream);
  const width = doc.page.width - M * 2;

  // Title block
  doc.font("Helvetica-Bold").fontSize(20).fillColor(C.primary).text("ResumeATS");
  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.ink).text("ATS resume report", { continued: false });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(C.muted);
  doc.text(`File: ${safe(r.fileName)}`);
  doc.text(`Analysed: ${formatDate(r.createdAt)}`);
  doc.text(`Target: ${r.label ? safe(r.label) : r.hasJobDescription ? "Job description provided" : "General best practices"}`);

  // Score summary
  doc.moveDown(1);
  const top = doc.y;
  doc.roundedRect(M, top, width, 92, 6).fillColor(C.soft).fill();
  doc.font("Helvetica-Bold").fontSize(46).fillColor(scoreColor(r.atsScore)).text(String(r.atsScore), M + 20, top + 14, { width: 90, align: "left", lineBreak: false });
  doc.font("Helvetica").fontSize(10).fillColor(C.muted).text("out of 100", M + 20, top + 66, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(C.ink).text(scoreBand(r.atsScore), M + 20 + 100, top + 20, { lineBreak: false });

  const subs = [
    ["Format", r.formatScore],
    ["Content", r.contentScore],
    ["Keywords", r.keywordScore],
  ];
  subs.forEach(([label, value], i) => {
    const x = M + 200 + i * 105;
    doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(label, x, top + 22, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(22).fillColor(value == null ? C.muted : scoreColor(value)).text(value == null ? "n/a" : String(value), x, top + 38, { lineBreak: false });
  });
  doc.x = M;
  doc.y = top + 92 + 6;

  // Recommendations
  if (r.suggestions.length) {
    heading(doc, "Recommendations");
    r.suggestions.forEach((s) => {
      ensureSpace(doc, 48);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(priorityColor[s.priority] || C.muted).text(`${s.priority.toUpperCase()} PRIORITY`, M, doc.y, { continued: true });
      doc.font("Helvetica").fillColor(C.muted).text(`   ${s.category.replace(/_/g, " ")}${s.source === "ai" ? "  (AI)" : ""}`);
      doc.font("Helvetica").fontSize(10.5).fillColor(C.ink).text(safe(s.text), M, doc.y + 1, { width });
      doc.moveDown(0.6);
    });
  }

  // Checks
  if (r.checks.length) {
    heading(doc, "ATS checks");
    r.checks
      .filter((c) => c.category !== "keywords")
      .forEach((c) => {
        ensureSpace(doc, 30);
        const y = doc.y;
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(statusColor[c.status]).text(c.status.toUpperCase(), M, y, { width: 36, lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(10).fillColor(C.ink).text(safe(c.label), M + 44, y, { width: width - 44 });
        doc.font("Helvetica").fontSize(9.5).fillColor(C.muted).text(safe(c.detail), M + 44, doc.y, { width: width - 44 });
        doc.moveDown(0.45);
      });
  }

  // Keywords
  if (r.hasJobDescription) {
    heading(doc, `Keyword match (${r.matchPercentage}%)`);
    const list = (title, items, color) => {
      ensureSpace(doc, 40);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(color).text(`${title} (${items.length})`, M, doc.y);
      doc.font("Helvetica").fontSize(10).fillColor(C.ink).text(items.length ? safe(items.join(", ")) : "None", M, doc.y + 2, { width });
      doc.moveDown(0.7);
    };
    list("Found in your resume", r.matchedKeywords, C.good);
    list("Missing from your resume", r.missingKeywords, C.bad);
  }

  // Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font("Helvetica").fontSize(8).fillColor(C.muted);
    doc.text(`ResumeATS report  |  Page ${i + 1} of ${range.count}`, M, doc.page.height - 38, { width, align: "center", lineBreak: false });
  }

  doc.end();
}
