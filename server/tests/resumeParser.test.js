import "./setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import { parseResume, normalizeText } from "../utils/resumeParser.js";
import { detectFileType, normalizeFileName } from "../utils/fileValidation.js";
import { makePdf, makeDocx } from "./helpers.js";

test("PDF: preserves line structure, bullets and page count", async () => {
  const { text, pageCount } = await parseResume(await makePdf(), "pdf");
  assert.equal(pageCount, 1);
  const lines = text.split("\n");
  assert.ok(lines.length >= 15, `expected many lines, got ${lines.length}`);
  assert.ok(lines.includes("EXPERIENCE"));
  assert.ok(lines.filter((l) => l.startsWith("• ")).length >= 6);
  assert.ok(lines[1].includes("priya.sharma@example.com"));
});

test("DOCX: extracts text and list items as bullets", async () => {
  const { text, pageCount } = await parseResume(await makeDocx(), "docx");
  assert.equal(pageCount, null);
  assert.ok(text.includes("priya.sharma@example.com"));
  assert.ok(text.split("\n").filter((l) => l.startsWith("• ")).length >= 6);
});

test("PDF with no extractable text gives a helpful, specific error", async () => {
  const empty = await makePdf([" "]);
  await assert.rejects(() => parseResume(empty, "pdf"), (e) => e.statusCode === 422 && /scan|image/i.test(e.message));
});

test("corrupt files are rejected with 422, not a crash", async () => {
  const junk = Buffer.from("%PDF-1.7\nthis is not really a pdf at all, just some bytes to fill the buffer");
  await assert.rejects(() => parseResume(junk, "pdf"), (e) => e.statusCode === 422);
  await assert.rejects(() => parseResume(Buffer.from("PK\u0003\u0004 definitely not a docx archive, padding padding"), "docx"), (e) => e.statusCode === 422);
});

test("normalizeText fixes ligatures, private-use bullets and blank-line runs", () => {
  const out = normalizeText("\uF0B7 ef\uFB01cient  work\n\n\n\n\u25CF  second");
  assert.equal(out, "• efficient work\n\n• second");
});

test("detectFileType trusts bytes, not the file extension", async () => {
  assert.equal(detectFileType(await makePdf(), "resume.pdf"), "pdf");
  assert.equal(detectFileType(await makePdf(), "renamed.docx"), "pdf");
  assert.equal(detectFileType(await makeDocx(), "resume.docx"), "docx");
  assert.throws(() => detectFileType(Buffer.from("MZ\u0090\u0000 this is an executable pretending to be a resume"), "resume.pdf"), (e) => e.statusCode === 415);
  assert.throws(() => detectFileType(Buffer.alloc(4), "x.pdf"), (e) => e.statusCode === 400);
  assert.throws(() => detectFileType(Buffer.alloc(64), "old.doc"), (e) => e.statusCode === 415 && /\.docx/.test(e.message));
});

test("a plain ZIP without word/document.xml is not accepted as DOCX", () => {
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)]);
  assert.throws(() => detectFileType(zip, "x.docx"), (e) => e.statusCode === 415);
});

test("normalizeFileName strips paths and control characters, recovers UTF-8", () => {
  assert.equal(normalizeFileName("../../etc/passwd"), "passwd");
  assert.equal(normalizeFileName("C:\\Users\\me\\resume.pdf"), "resume.pdf");
  assert.equal(normalizeFileName("a<b>:c\u0000.pdf"), "abc.pdf");
  assert.equal(normalizeFileName(Buffer.from("résumé.pdf", "utf8").toString("latin1")), "résumé.pdf");
  assert.equal(normalizeFileName("x".repeat(300)).length, 120);
});
