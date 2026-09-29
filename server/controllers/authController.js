import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

const signToken = (user) =>
  jwt.sign({ id: String(user._id), email: user.email }, env.JWT_SECRET, { algorithm: "HS256", expiresIn: env.JWT_EXPIRES_IN });

/** POST /api/auth/register  { name, email, password } */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict("An account with this email already exists. Try signing in instead.", { code: "EMAIL_TAKEN" });
  }

  const user = await User.create({ name, email, password: await bcrypt.hash(password, BCRYPT_ROUNDS) });
  logger.info("User registered", { userId: String(user._id) });

  res.status(201).json({ token: signToken(user), user });
});

/** POST /api/auth/login  { email, password } */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  const valid = await bcrypt.compare(password, user?.password || DUMMY_HASH);
  if (!user || !valid) {
    throw ApiError.unauthorized("Incorrect email or password.", { code: "INVALID_CREDENTIALS" });
  }

  res.json({ token: signToken(user), user });
});

/** GET /api/auth/me  (requires auth) */
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized("Your account no longer exists. Please sign in again.", { code: "INVALID_TOKEN" });
  res.json({ user });
});
