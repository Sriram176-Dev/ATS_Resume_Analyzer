import mongoose from "mongoose";
import Resume from "../models/Resume.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";
import { analyzeResumeFile } from "../services/resumeAnalysis.js";
import { serializeResume, serializeResumeSummary } from "../services/serializers.js";
import { writeReportPdf } from "../services/reportPdf.js";

/** Load a resume that belongs to the caller, or 404 (never reveal that someone else's id exists). */
async function findOwned(req) {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user.id });
  if (!resume) throw ApiError.notFound("Resume analysis not found");
  return resume;
}

/** POST /api/resumes  (multipart: resume, jobDescription?, label?) */
export const createAnalysis = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("Choose a resume file to analyze (PDF or DOCX).");

  const analysis = await analyzeResumeFile({
    file: req.file,
    jobDescription: req.body.jobDescription,
    label: req.body.label,
  });

  const resume = await Resume.create({ userId: req.user.id, ...analysis });
  logger.info("Resume analysed", { userId: req.user.id, resumeId: String(resume._id), score: resume.atsScore, ai: analysis.aiStatus });

  res.status(201).json(serializeResume(resume));
});

/** GET /api/resumes?page=1&limit=10 */
export const listAnalyses = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const filter = { userId: req.user.id };

  const [items, total] = await Promise.all([
    Resume.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-checks -suggestions -keywordDetails -matchedKeywords -missingKeywords").lean(),
    Resume.countDocuments(filter),
  ]);

  res.json({ items: items.map(serializeResumeSummary), total, page, pageSize: limit, hasMore: page * limit < total });
});

/** GET /api/resumes/stats */
export const getStats = asyncHandler(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const [totals] = await Resume.aggregate([
    { $match: { userId } },
    { $group: { _id: null, count: { $sum: 1 }, best: { $max: "$atsScore" }, average: { $avg: "$atsScore" } } },
  ]);
  const recent = await Resume.find({ userId }).sort({ createdAt: -1 }).limit(12).select("atsScore createdAt").lean();

  const trend = recent.reverse().map((r) => ({ score: r.atsScore, createdAt: r.createdAt }));
  const latest = trend.length ? trend[trend.length - 1].score : null;
  const previous = trend.length > 1 ? trend[trend.length - 2].score : null;

  res.json({
    count: totals?.count || 0,
    best: totals?.best ?? null,
    average: totals ? Math.round(totals.average) : null,
    latest,
    change: latest !== null && previous !== null ? latest - previous : null,
    trend,
  });
});

/** GET /api/resumes/:id */
export const getAnalysis = asyncHandler(async (req, res) => {
  res.json(serializeResume(await findOwned(req)));
});

/** GET /api/resumes/:id/report.pdf */
export const downloadReport = asyncHandler(async (req, res) => {
  const resume = serializeResume(await findOwned(req));
  const safeName = resume.fileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_").slice(0, 60) || "resume";

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="ats-report-${safeName}.pdf"`,
    "Cache-Control": "private, no-store",
  });
  writeReportPdf(resume, res);
});

/** DELETE /api/resumes/:id */
export const deleteAnalysis = asyncHandler(async (req, res) => {
  const { deletedCount } = await Resume.deleteOne({ _id: req.params.id, userId: req.user.id });
  if (!deletedCount) throw ApiError.notFound("Resume analysis not found");
  logger.info("Resume deleted", { userId: req.user.id, resumeId: req.params.id });
  res.status(204).end();
});
