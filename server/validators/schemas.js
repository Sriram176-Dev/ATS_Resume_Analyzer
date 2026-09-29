import { z } from "zod";

const trimmed = (schema) => z.preprocess((v) => (typeof v === "string" ? v.trim() : v), schema);

export const registerSchema = z.object({
  name: trimmed(z.string({ required_error: "Name is required" }).min(2, "Name must be at least 2 characters").max(80, "Name is too long")),
  email: trimmed(z.string({ required_error: "Email is required" }).email("Enter a valid email address").max(254)).transform((v) => v.toLowerCase()),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer")
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/\d/, "Password must include at least one number"),
});

// Login intentionally does not enforce password rules: existing accounts may predate them.
export const loginSchema = z.object({
  email: trimmed(z.string({ required_error: "Email is required" }).email("Enter a valid email address").max(254)).transform((v) => v.toLowerCase()),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required").max(200),
});

export const analyzeBodySchema = z.object({
  jobDescription: trimmed(z.string().max(10000, "Job description must be 10,000 characters or fewer")).optional().default(""),
  label: trimmed(z.string().max(100, "Label must be 100 characters or fewer")).optional().default(""),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid resume id"),
});

export const contactSchema = z.object({
  name: trimmed(z.string({ required_error: "Name is required" }).min(2, "Name must be at least 2 characters").max(80)),
  email: trimmed(z.string({ required_error: "Email is required" }).email("Enter a valid email address").max(254)).transform((v) => v.toLowerCase()),
  message: trimmed(z.string({ required_error: "Message is required" }).min(10, "Message must be at least 10 characters").max(4000, "Message must be 4,000 characters or fewer")),
  // Honeypot: real users never see or fill this field. Accepted here so the controller can
  // silently discard bot submissions instead of revealing that they were detected.
  website: z.string().max(500).optional().default(""),
});
