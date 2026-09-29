import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { hasAllowedExtension } from "../utils/fileValidation.js";

/**
 * Multer configured for a single in-memory resume upload.
 * Deep validation (magic bytes) happens in the service layer once the bytes are available.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadBytes,
    files: 1,
    fields: 5,
    fieldSize: 64 * 1024, // job description text
  },
  fileFilter(_req, file, cb) {
    if (!hasAllowedExtension(file.originalname)) {
      return cb(ApiError.unsupportedMedia("Only PDF and DOCX files are supported."));
    }
    cb(null, true);
  },
});

export const uploadResumeFile = upload.single("resume");
