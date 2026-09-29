import path from "node:path";
import { ApiError } from "./ApiError.js";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx"]);

/** Multer decodes filenames as latin1; recover UTF-8 names and strip anything unsafe. */
export function normalizeFileName(name = "resume") {
  let decoded = name;
  try {
    const utf8 = Buffer.from(name, "latin1").toString("utf8");
    if (!utf8.includes("\uFFFD")) decoded = utf8;
  } catch {
    /* keep original */
  }
  const base = path.basename(decoded.replace(/\\/g, "/"));
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001F\u007F<>:"|?*]/g, "").trim();
  return (cleaned || "resume").slice(0, 120);
}

/** Cheap pre-check before the file is buffered: extension only (browsers report unreliable MIME types). */
export function hasAllowedExtension(originalName = "") {
  return ALLOWED_EXTENSIONS.has(path.extname(originalName).toLowerCase());
}

/**
 * Determine the real file type from its bytes, not from what the client claims.
 * @returns {"pdf" | "docx"}
 */
export function detectFileType(buffer, originalName = "") {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".doc") {
    throw ApiError.unsupportedMedia("Legacy .doc files aren't supported. Save the file as .docx or PDF and upload it again.");
  }
  if (!buffer || buffer.length < 16) {
    throw ApiError.badRequest("The uploaded file is empty.");
  }

  // PDF: "%PDF-" appears within the first 1 KB.
  if (buffer.subarray(0, 1024).includes("%PDF-")) return "pdf";

  // DOCX: a ZIP archive that contains word/document.xml.
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (isZip && buffer.includes("word/document.xml")) return "docx";

  throw ApiError.unsupportedMedia("That file doesn't look like a valid PDF or DOCX. Please upload a PDF or Word (.docx) resume.");
}
