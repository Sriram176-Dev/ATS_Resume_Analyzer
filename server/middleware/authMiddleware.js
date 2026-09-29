import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

/** Require a valid `Authorization: Bearer <jwt>` header. Sets `req.user = { id, email }`. */
export default function authMiddleware(req, _res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return next(ApiError.unauthorized("Please sign in to continue"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: String(payload.id), email: payload.email };
    return next();
  } catch (err) {
    const message = err.name === "TokenExpiredError" ? "Your session has expired. Please sign in again." : "Invalid session. Please sign in again.";
    return next(ApiError.unauthorized(message, { code: err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN" }));
  }
}
