import "./setup.js";
import test, { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import User from "../models/User.js";
import Resume from "../models/Resume.js";
import ContactMessage from "../models/ContactMessage.js";
import { makePdf, makeDocx, SAMPLE_JD } from "./helpers.js";

/*
 * These tests exercise the real Express stack (routing, validation, auth, upload handling,
 * parsing, scoring, PDF generation). Only the Mongoose model methods are stubbed, so no
 * database is required.
 */

const app = createApp();
const USER_ID = "64b0c0ffee0c0ffee0c0ffee";
const OTHER_ID = "64b0deadbeefdeadbeefdead";
const RESUME_ID = "64b1c0ffee0c0ffee0c0ffee";
const token = (id = USER_ID) => jwt.sign({ id, email: "priya@example.com" }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
const auth = (id) => ({ Authorization: `Bearer ${token(id)}` });

/** Minimal chainable stand-in for a Mongoose query. */
const query = (result) => {
  const q = { sort: () => q, skip: () => q, limit: () => q, select: () => q, lean: () => q, then: (res, rej) => Promise.resolve(result).then(res, rej) };
  return q;
};

const storedResume = (over = {}) => ({
  _id: RESUME_ID, userId: USER_ID, fileName: "resume.pdf", fileType: "pdf", label: "Backend role", atsScore: 82, formatScore: 90, contentScore: 80, keywordScore: 70,
  matchPercentage: 70, jobDescription: "We need Node.js", matchedKeywords: ["Node.js"], missingKeywords: ["Kubernetes"], keywordDetails: [], sections: ["experience"], stats: {},
  checks: [{ id: "contact_email", category: "format", label: "Email address", status: "pass", points: 10, maxPoints: 10, detail: "An email address was found." }],
  suggestions: [{ text: "Add Kubernetes if you have used it.", category: "keyword_optimization", priority: "high", source: "rules" }],
  aiStatus: "disabled", createdAt: new Date("2026-09-01T10:00:00Z"), updatedAt: new Date("2026-09-01T10:00:00Z"), ...over,
});

afterEach(() => mock.restoreAll());

describe("platform", () => {
  it("GET /api/health reports degraded (503) when the database is not connected", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 503);
    assert.equal(res.body.db, "down");
    assert.ok(res.headers["x-request-id"]);
  });

  it("unknown API routes return a JSON 404 with the standard error shape", async () => {
    const res = await request(app).get("/api/nope");
    assert.equal(res.status, 404);
    assert.equal(res.body.code, "NOT_FOUND");
    assert.ok(res.body.requestId);
  });

  it("malformed JSON returns 400, not 500", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad json");
    assert.equal(res.status, 400);
    assert.equal(res.body.code, "INVALID_JSON");
  });

  it("GET /api/config exposes only non-sensitive settings", async () => {
    const res = await request(app).get("/api/config");
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ["aiEnabled", "maxJobDescriptionChars", "maxUploadMb"]);
    assert.equal(res.body.aiEnabled, false);
    assert.equal(res.body.maxUploadMb, 1);
  });

  it("sets security headers and hides the framework", async () => {
    const res = await request(app).get("/api/health");
    assert.ok(res.headers["content-security-policy"]);
    assert.ok(!res.headers["content-security-policy"].includes("upgrade-insecure-requests"));
    assert.ok(res.headers["content-security-policy"].includes("script-src 'self'"));
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-powered-by"], undefined);
  });
});

describe("auth", () => {
  it("register validates input and reports the first problem", async () => {
    const weak = await request(app).post("/api/auth/register").send({ name: "Priya", email: "priya@example.com", password: "short" });
    assert.equal(weak.status, 400);
    assert.equal(weak.body.code, "VALIDATION_ERROR");
    assert.match(weak.body.error, /at least 8/);

    const noDigit = await request(app).post("/api/auth/register").send({ name: "Priya", email: "priya@example.com", password: "onlyletters" });
    assert.match(noDigit.body.error, /number/);

    const badEmail = await request(app).post("/api/auth/register").send({ name: "Priya", email: "nope", password: "Passw0rd!" });
    assert.match(badEmail.body.error, /valid email/);
  });

  it("register ignores non-string payloads (NoSQL injection attempt) with a 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  it("register creates a user, normalises email, hashes the password and returns a token without the hash", async () => {
    let created;
    mock.method(User, "exists", async () => null);
    mock.method(User, "create", async (data) => {
      created = data;
      return { _id: USER_ID, name: data.name, email: data.email, toJSON() { return { id: USER_ID, name: data.name, email: data.email }; } };
    });

    const res = await request(app).post("/api/auth/register").send({ name: "  Priya  ", email: "Priya@Example.COM ", password: "Passw0rd!" });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined);
    assert.equal(created.email, "priya@example.com");
    assert.equal(created.name, "Priya");
    assert.notEqual(created.password, "Passw0rd!");
    assert.ok(await bcrypt.compare("Passw0rd!", created.password));
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.equal(payload.id, USER_ID);
  });

  it("register rejects a duplicate email with 409", async () => {
    mock.method(User, "exists", async () => ({ _id: USER_ID }));
    const res = await request(app).post("/api/auth/register").send({ name: "Priya", email: "priya@example.com", password: "Passw0rd!" });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, "EMAIL_TAKEN");
  });

  it("login succeeds with correct credentials", async () => {
    const hash = await bcrypt.hash("Passw0rd!", 4);
    mock.method(User, "findOne", () => query({ _id: USER_ID, email: "priya@example.com", password: hash, toJSON() { return { id: USER_ID, email: this.email }; } }));
    const res = await request(app).post("/api/auth/login").send({ email: "priya@example.com", password: "Passw0rd!" });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined);
  });

  it("login gives the same 401 for a wrong password and an unknown email", async () => {
    const hash = await bcrypt.hash("Passw0rd!", 4);
    mock.method(User, "findOne", () => query({ _id: USER_ID, email: "priya@example.com", password: hash }));
    const wrongPw = await request(app).post("/api/auth/login").send({ email: "priya@example.com", password: "WrongPass1" });

    mock.restoreAll();
    mock.method(User, "findOne", () => query(null));
    const unknown = await request(app).post("/api/auth/login").send({ email: "ghost@example.com", password: "Passw0rd!" });

    assert.equal(wrongPw.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrongPw.body.error, unknown.body.error);
  });

  it("protected routes reject missing, malformed, tampered and expired tokens", async () => {
    assert.equal((await request(app).get("/api/resumes")).status, 401);
    assert.equal((await request(app).get("/api/resumes").set("Authorization", "Basic abc")).status, 401);
    assert.equal((await request(app).get("/api/resumes").set("Authorization", "Bearer not.a.jwt")).status, 401);

    const forged = jwt.sign({ id: USER_ID }, "some-other-secret-that-is-also-long-enough-123");
    assert.equal((await request(app).get("/api/resumes").set("Authorization", `Bearer ${forged}`)).status, 401);

    const none = jwt.sign({ id: USER_ID }, "", { algorithm: "none" });
    assert.equal((await request(app).get("/api/resumes").set("Authorization", `Bearer ${none}`)).status, 401);

    const expired = jwt.sign({ id: USER_ID }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get("/api/resumes").set("Authorization", `Bearer ${expired}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.code, "TOKEN_EXPIRED");
  });

  it("GET /api/auth/me returns the current user", async () => {
    mock.method(User, "findById", async () => ({ _id: USER_ID, toJSON: () => ({ id: USER_ID, name: "Priya" }) }));
    const res = await request(app).get("/api/auth/me").set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, "Priya");
  });
});

describe("resume analysis", () => {
  const stubCreate = () => {
    let saved;
    mock.method(Resume, "create", async (data) => {
      saved = data;
      return { ...data, _id: RESUME_ID, createdAt: new Date(), updatedAt: new Date() };
    });
    return () => saved;
  };

  it("analyzes a PDF end to end and stores rich results (no AI key => rule-based advice)", async () => {
    const saved = stubCreate();
    const res = await request(app)
      .post("/api/resumes").set(auth())
      .field("jobDescription", SAMPLE_JD).field("label", "Full stack @ Acme")
      .attach("resume", await makePdf(), { filename: "Priya Resume.pdf", contentType: "application/pdf" });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    const r = res.body;
    assert.equal(r.id, RESUME_ID);
    assert.equal(r.fileName, "Priya Resume.pdf");
    assert.equal(r.label, "Full stack @ Acme");
    assert.ok(r.atsScore >= 60 && r.atsScore <= 100);
    assert.equal(r.hasJobDescription, true);
    assert.ok(r.matchedKeywords.includes("React") && r.missingKeywords.includes("Kubernetes"));
    assert.ok(r.checks.length >= 15);
    assert.equal(r.aiStatus, "disabled");
    assert.ok(r.suggestions.length > 0 && r.suggestions.every((s) => s.source === "rules"));
    assert.equal(r.text, undefined, "raw resume text must never be returned");
    assert.equal(saved().userId, USER_ID);
    assert.equal(saved().pageCount, 1);
  });

  it("analyzes a DOCX without a job description (keyword score is null)", async () => {
    stubCreate();
    const res = await request(app).post("/api/resumes").set(auth())
      .attach("resume", await makeDocx(), { filename: "resume.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.keywordScore, null);
    assert.equal(res.body.hasJobDescription, false);
    assert.equal(res.body.fileType, "docx");
  });

  it("rejects requests with no file (400)", async () => {
    const res = await request(app).post("/api/resumes").set(auth()).field("jobDescription", "x");
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Choose a resume/);
  });

  it("rejects wrong extensions (415) and files whose bytes don't match (415)", async () => {
    const ext = await request(app).post("/api/resumes").set(auth()).attach("resume", Buffer.from("hello world"), { filename: "notes.txt", contentType: "text/plain" });
    assert.equal(ext.status, 415);

    const fake = await request(app).post("/api/resumes").set(auth()).attach("resume", Buffer.from("MZ this is an executable, not a pdf, honest ....."), { filename: "evil.pdf", contentType: "application/pdf" });
    assert.equal(fake.status, 415);
  });

  it("rejects oversized uploads with 413", async () => {
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1.5 * 1024 * 1024, 65)]);
    const res = await request(app).post("/api/resumes").set(auth()).attach("resume", big, { filename: "big.pdf", contentType: "application/pdf" });
    assert.equal(res.status, 413);
    assert.equal(res.body.code, "FILE_TOO_LARGE");
  });

  it("rejects an over-long job description with a clear message", async () => {
    const res = await request(app).post("/api/resumes").set(auth()).field("jobDescription", "x".repeat(10_001))
      .attach("resume", await makePdf(), { filename: "r.pdf", contentType: "application/pdf" });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /10,000/);
  });

  it("requires authentication to upload", async () => {
    const res = await request(app).post("/api/resumes").attach("resume", await makePdf(), { filename: "r.pdf" });
    assert.equal(res.status, 401);
  });
});

describe("resume history", () => {
  it("lists only the caller's analyses, paginated, as summaries", async () => {
    let filter;
    mock.method(Resume, "find", (f) => { filter = f; return query([storedResume(), storedResume({ _id: "64b1c0ffee0c0ffee0c0ffe0" })]); });
    mock.method(Resume, "countDocuments", async () => 12);

    const res = await request(app).get("/api/resumes?page=1&limit=2").set(auth());
    assert.equal(res.status, 200);
    assert.deepEqual(filter, { userId: USER_ID });
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.total, 12);
    assert.equal(res.body.hasMore, true);
    assert.equal(res.body.items[0].suggestions, undefined);
    assert.equal(res.body.items[0].hasJobDescription, true);
  });

  it("validates pagination parameters", async () => {
    assert.equal((await request(app).get("/api/resumes?limit=999").set(auth())).status, 400);
    assert.equal((await request(app).get("/api/resumes?page=0").set(auth())).status, 400);
  });

  it("scopes lookups by owner and returns 404 (not 403) for someone else's resume", async () => {
    let filter;
    mock.method(Resume, "findOne", async (f) => { filter = f; return null; });
    const res = await request(app).get(`/api/resumes/${RESUME_ID}`).set(auth(OTHER_ID));
    assert.equal(res.status, 404);
    assert.deepEqual(filter, { _id: RESUME_ID, userId: OTHER_ID });
  });

  it("returns a full analysis for the owner", async () => {
    mock.method(Resume, "findOne", async () => storedResume());
    const res = await request(app).get(`/api/resumes/${RESUME_ID}`).set(auth());
    assert.equal(res.status, 200);
    assert.equal(res.body.checks[0].id, "contact_email");
    assert.equal(res.body.userId, undefined);
  });

  it("rejects malformed ids with 400 before touching the database", async () => {
    const res = await request(app).get("/api/resumes/not-an-id").set(auth());
    assert.equal(res.status, 400);
  });

  it("delete is owner-scoped: 204 when deleted, 404 when not found", async () => {
    let filter;
    mock.method(Resume, "deleteOne", async (f) => { filter = f; return { deletedCount: 1 }; });
    assert.equal((await request(app).delete(`/api/resumes/${RESUME_ID}`).set(auth())).status, 204);
    assert.deepEqual(filter, { _id: RESUME_ID, userId: USER_ID });

    mock.restoreAll();
    mock.method(Resume, "deleteOne", async () => ({ deletedCount: 0 }));
    assert.equal((await request(app).delete(`/api/resumes/${RESUME_ID}`).set(auth())).status, 404);
  });

  it("downloads a real PDF report", async () => {
    mock.method(Resume, "findOne", async () => storedResume());
    const res = await request(app).get(`/api/resumes/${RESUME_ID}/report.pdf`).set(auth()).buffer(true).parse((r, cb) => {
      const chunks = []; r.on("data", (c) => chunks.push(c)); r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.match(res.headers["content-disposition"], /attachment; filename="ats-report-resume\.pdf"/);
    assert.equal(res.body.subarray(0, 5).toString(), "%PDF-");
    assert.ok(res.body.length > 1500);
  });

  it("stats aggregates totals and a trend", async () => {
    mock.method(Resume, "aggregate", async () => [{ _id: null, count: 3, best: 91, average: 78.4 }]);
    mock.method(Resume, "find", () => query([{ atsScore: 91, createdAt: new Date("2026-09-03") }, { atsScore: 70, createdAt: new Date("2026-09-02") }, { atsScore: 74, createdAt: new Date("2026-09-01") }]));
    const res = await request(app).get("/api/resumes/stats").set(auth());
    assert.equal(res.status, 200);
    assert.deepEqual([res.body.count, res.body.best, res.body.average, res.body.latest, res.body.change], [3, 91, 78, 91, 21]);
    assert.deepEqual(res.body.trend.map((t) => t.score), [74, 70, 91]);
  });

  it("stats works for a brand-new user", async () => {
    mock.method(Resume, "aggregate", async () => []);
    mock.method(Resume, "find", () => query([]));
    const res = await request(app).get("/api/resumes/stats").set(auth());
    assert.deepEqual([res.body.count, res.body.best, res.body.latest, res.body.change], [0, null, null, null]);
  });
});

describe("contact", () => {
  it("stores a valid message", async () => {
    let saved;
    mock.method(ContactMessage, "create", async (d) => { saved = d; return d; });
    const res = await request(app).post("/api/contact").send({ name: "Sam", email: "Sam@Example.com", message: "Hello, I have a question about scoring." });
    assert.equal(res.status, 201);
    assert.equal(saved.email, "sam@example.com");
    assert.equal(saved.userId, null);
  });

  it("validates fields", async () => {
    const res = await request(app).post("/api/contact").send({ name: "S", email: "bad", message: "short" });
    assert.equal(res.status, 400);
    assert.ok(res.body.details.length >= 2);
  });

  it("silently drops honeypot submissions without storing them", async () => {
    const create = mock.method(ContactMessage, "create", async () => ({}));
    const res = await request(app).post("/api/contact").send({ name: "Bot", email: "bot@example.com", message: "Buy cheap watches now please", website: "http://spam" });
    assert.equal(res.status, 201);
    assert.equal(create.mock.callCount(), 0);
  });
});
