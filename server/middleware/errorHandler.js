import multer from "multer";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/** JSON 404 for unknown API routes. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}

/** Convert any error into a consistent `{ error, code, details?, requestId }` response. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = "Something went wrong on our side. Please try again.";
  let code = "INTERNAL_ERROR";
  let details;

  if (err instanceof ApiError) {
    ({ statusCode: status, message, code, details } = err);
  } else if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      status = 413;
      code = "FILE_TOO_LARGE";
      message = `File is too large. The maximum size is ${env.MAX_UPLOAD_MB} MB.`;
    } else if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
      status = 400;
      code = "BAD_UPLOAD";
      message = "Upload exactly one file in the 'resume' field.";
    } else {
      status = 400;
      code = "BAD_UPLOAD";
      message = "The upload could not be processed.";
    }
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    message = details[0]?.message || "Invalid request";
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    code = "VALIDATION_ERROR";
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || "Invalid data";
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = "INVALID_ID";
    message = "Invalid identifier";
  } else if (err?.code === 11000) {
    status = 409;
    code = "CONFLICT";
    message = "That record already exists";
  } else if (err?.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body is not valid JSON";
  } else if (err?.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large";
  }

  if (status >= 500) {
    logger.error("Unhandled error", { err, requestId: req.id, method: req.method, path: req.originalUrl });
  }

  res.status(status).json({ error: message, code, ...(details ? { details } : {}), requestId: req.id });
}
