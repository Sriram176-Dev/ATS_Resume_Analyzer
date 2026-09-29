import mongoose from "mongoose";

const score = { type: Number, min: 0, max: 100 };

const checkSchema = new mongoose.Schema(
  {
    id: String,
    category: { type: String, enum: ["format", "content", "keywords"] },
    label: String,
    status: { type: String, enum: ["pass", "warn", "fail"] },
    points: Number,
    maxPoints: Number,
    detail: String,
  },
  { _id: false }
);

const suggestionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, maxlength: 600 },
    category: { type: String, required: true },
    priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    source: { type: String, enum: ["ai", "rules"], default: "ai" },
  },
  { _id: false }
);

const keywordSchema = new mongoose.Schema(
  { term: String, category: String, weight: Number, matched: Boolean },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: [true, "User ID is required"] },

    // File metadata
    fileName: { type: String, default: "resume", maxlength: 120 },
    fileType: { type: String, enum: ["pdf", "docx"] },
    fileSize: Number,
    pageCount: { type: Number, default: null },
    label: { type: String, default: "", maxlength: 100 },

    // Extracted text is only needed for analysis; never returned by default.
    text: { type: String, required: [true, "Resume text is required"], minlength: [50, "Resume text must be at least 50 characters"], maxlength: 60000, select: false },

    // Scores. keywordScore is null when no job description was supplied.
    atsScore: { ...score, default: 0 },
    formatScore: { ...score, default: 0 },
    contentScore: { ...score, default: 0 },
    keywordScore: { ...score, default: null },
    matchPercentage: { ...score, default: 0 },

    checks: { type: [checkSchema], default: [] },
    sections: { type: [String], default: [] },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} },
    suggestions: { type: [suggestionSchema], default: [] },
    aiStatus: { type: String, enum: ["ok", "unavailable", "disabled"], default: "disabled" },

    jobDescription: { type: String, default: "", maxlength: 10000 },
    matchedKeywords: { type: [String], default: [] },
    missingKeywords: { type: [String], default: [] },
    keywordDetails: { type: [keywordSchema], default: [] },
  },
  { timestamps: true }
);

// Serves the history list (newest first per user).
resumeSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Resume", resumeSchema);
