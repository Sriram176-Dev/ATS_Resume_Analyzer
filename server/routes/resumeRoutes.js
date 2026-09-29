import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { analyzeLimiter } from "../middleware/rateLimiters.js";
import { uploadResumeFile } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { analyzeBodySchema, listQuerySchema, objectIdParamSchema } from "../validators/schemas.js";
import { createAnalysis, listAnalyses, getStats, getAnalysis, downloadReport, deleteAnalysis } from "../controllers/resumeController.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", analyzeLimiter, uploadResumeFile, validate(analyzeBodySchema), createAnalysis);
router.get("/", validate(listQuerySchema, "query"), listAnalyses);
router.get("/stats", getStats);
router.get("/:id", validate(objectIdParamSchema, "params"), getAnalysis);
router.get("/:id/report.pdf", validate(objectIdParamSchema, "params"), downloadReport);
router.delete("/:id", validate(objectIdParamSchema, "params"), deleteAnalysis);

export default router;
