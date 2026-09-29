import ContactMessage from "../models/ContactMessage.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

/** POST /api/contact  { name, email, message } */
export const createContactMessage = asyncHandler(async (req, res) => {
  const { name, email, message, website } = req.body;

  // Honeypot tripped: pretend success so bots learn nothing.
  if (website) return res.status(201).json({ ok: true });

  await ContactMessage.create({ name, email, message, userId: req.user?.id || null });
  logger.info("Contact message received");
  res.status(201).json({ ok: true });
});
