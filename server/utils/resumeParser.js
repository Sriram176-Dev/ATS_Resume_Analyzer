/**
 * Resume text extraction for PDF and DOCX.
 *
 * The important part is preserving *line structure*: bullet detection, section
 * headings and layout checks all depend on it. For PDFs that means rebuilding
 * lines from text-item positions rather than joining every fragment with a space.
 */
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";
import { ApiError } from "./ApiError.js";

const MAX_PDF_PAGES = 20;
const MAX_TEXT_CHARS = 60_000;

/** Glyphs commonly used (or mis-mapped by PDF fonts) as bullets. */
const BULLET_LINE_START = /^[\s]*[\uF0B7\uF0A7\uF076\uF0D8\uF0FC\u2022\u25CF\u25AA\u25AB\u25CB\u25E6\u2023\u2043\u2219\u25A0\u25A1\u27A2\u25BA\u25B8]\s+/;
const BULLET_GLYPHS_ANYWHERE = /[\uF0B7\uF0A7\uF076\uF0D8\uF0FC]/g;

/** Tidy raw extracted text without destroying its line structure. */
export function normalizeText(raw) {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .split(/\r?\n/)
    .map((line) => {
      const cleaned = line.replace(BULLET_GLYPHS_ANYWHERE, "•").replace(/[ \t]+/g, " ").trim();
      return cleaned.replace(BULLET_LINE_START, "• ");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Build text lines from pdf.js text items using their coordinates. */
function pageToLines(items) {
  const lines = [];
  let current = "";
  let lastY = null;
  let lastEndX = null;

  const flush = () => {
    if (current.trim()) lines.push(current);
    current = "";
    lastY = null;
    lastEndX = null;
  };

  for (const item of items) {
    if (typeof item.str !== "string") continue;
    const [, , , , x, y] = item.transform;
    const height = Math.abs(item.height) || 10;

    // New line when the baseline moves by more than ~half a line height.
    if (lastY !== null && Math.abs(y - lastY) > height * 0.6) flush();

    if (current && lastEndX !== null) {
      const gap = x - lastEndX;
      const needsSpace = gap > height * 0.15 && !current.endsWith(" ") && !item.str.startsWith(" ");
      if (needsSpace) current += " ";
    }

    current += item.str;
    lastY = y;
    lastEndX = x + (item.width || 0);

    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

async function extractPdf(buffer) {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });

  let pdf;
  try {
    pdf = await task.promise;
  } catch (err) {
    await task.destroy().catch(() => {});
    if (err?.name === "PasswordException") {
      throw ApiError.unprocessable("This PDF is password-protected. Remove the password and upload it again.");
    }
    throw ApiError.unprocessable("We couldn't read this PDF. It may be corrupted; try exporting it again.");
  }

  try {
    const pageCount = pdf.numPages;
    const pages = [];
    for (let n = 1; n <= Math.min(pageCount, MAX_PDF_PAGES); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(pageToLines(content.items).join("\n"));
      page.cleanup();
    }
    return { text: pages.join("\n\n"), pageCount };
  } finally {
    await task.destroy().catch(() => {});
  }
}

/** Convert mammoth's HTML into plain text that keeps paragraph and list-item boundaries. */
function htmlToText(html) {
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|li|h[1-6]|tr|div|ul|ol|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

async function extractDocx(buffer) {
  try {
    const { value } = await mammoth.convertToHtml({ buffer });
    return { text: htmlToText(value), pageCount: null };
  } catch {
    throw ApiError.unprocessable("We couldn't read this Word document. It may be corrupted; try saving it again as .docx.");
  }
}

/**
 * @param {Buffer} buffer
 * @param {"pdf" | "docx"} type
 * @returns {Promise<{ text: string, pageCount: number | null }>}
 */
export async function parseResume(buffer, type) {
  if (!buffer || buffer.length === 0) throw ApiError.badRequest("The uploaded file is empty.");

  const { text, pageCount } = type === "docx" ? await extractDocx(buffer) : await extractPdf(buffer);
  const normalized = normalizeText(text).slice(0, MAX_TEXT_CHARS);

  if (normalized.replace(/\s/g, "").length < 50) {
    throw ApiError.unprocessable(
      type === "pdf"
        ? "We couldn't find readable text in this PDF. It may be a scan or an image-based export, which ATS software can't read either. Export a text-based PDF from your editor and try again."
        : "We couldn't find enough text in this document. Add your resume content and try again."
    );
  }

  return { text: normalized, pageCount };
}
