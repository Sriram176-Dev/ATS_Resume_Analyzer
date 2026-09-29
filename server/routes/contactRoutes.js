import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { contactLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { contactSchema } from "../validators/schemas.js";
import { createContactMessage } from "../controllers/contactController.js";

const router = express.Router();

/** Contact is public, but attach the user when a valid token is present. */
function optionalAuth(req, _res, next) {
  const [scheme, token] = (req.get("authorization") || "").split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) {
    try {
      const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
      req.user = { id: String(p.id), email: p.email };
    } catch {
      /* anonymous */
    }
  }
  next();
}

router.post("/", contactLimiter, optionalAuth, validate(contactSchema), createContactMessage);

export default router;
