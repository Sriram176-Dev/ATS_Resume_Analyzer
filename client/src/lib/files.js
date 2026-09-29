const ALLOWED = [".pdf", ".docx"];

/** @returns {string} an error message, or "" when the file is acceptable */
export function validateResumeFile(file, maxMb) {
  if (!file) return "Choose a resume file to analyze.";
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) return "Legacy .doc files aren't supported. Save the file as .docx or PDF first.";
  if (!ALLOWED.some((ext) => name.endsWith(ext))) return "Only PDF and Word (.docx) files are supported.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `That file is too large. The maximum size is ${maxMb} MB.`;
  return "";
}
