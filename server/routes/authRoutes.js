import express from "express";
import { register, login, me } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { registerSchema, loginSchema } from "../validators/schemas.js";

const router = express.Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), login);
router.get("/me", authMiddleware, me);

export default router;
