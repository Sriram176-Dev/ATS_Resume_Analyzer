import { describe, it, expect, vi, afterEach } from "vitest";
import { formatFileSize, initials, firstName, plural } from "./format";
import { scoreBand, categoryLabel } from "./score";
import { getTokenExpiry, isTokenExpired } from "./jwt";
import { validateResumeFile } from "./files";
import { getErrorMessage, getFieldErrors } from "./errors";

const makeJwt = (payload) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}.y`;
const file = (name, size = 1000) => ({ name, size });

describe("format", () => {
  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
  it("derives initials and first names safely", () => {
    expect(initials("Priya Sharma")).toBe("PS");
    expect(initials("  madonna ")).toBe("M");
    expect(initials("")).toBe("?");
    expect(firstName("Priya Sharma")).toBe("Priya");
    expect(firstName("")).toBe("there");
  });
  it("pluralizes", () => {
    expect(plural(1, "page")).toBe("1 page");
    expect(plural(3, "page")).toBe("3 pages");
    expect(plural(2, "fix", "fixes")).toBe("2 fixes");
  });
});

describe("score", () => {
  it("maps scores to bands (mirrors the server)", () => {
    expect(scoreBand(90)).toEqual({ label: "Excellent", tone: "good" });
    expect(scoreBand(70)).toEqual({ label: "Good", tone: "good" });
    expect(scoreBand(50)).toEqual({ label: "Needs work", tone: "warn" });
    expect(scoreBand(49)).toEqual({ label: "Poor", tone: "bad" });
  });
  it("labels categories and tolerates unknown ones", () => {
    expect(categoryLabel("action_verb")).toBe("Action verbs");
    expect(categoryLabel("something_new")).toBe("something new");
    expect(categoryLabel(undefined)).toBe("General");
  });
});

describe("jwt", () => {
  afterEach(() => vi.useRealTimers());
  it("reads expiry and detects expired / malformed tokens", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    expect(getTokenExpiry(makeJwt({ exp: future }))).toBe(future * 1000);
    expect(isTokenExpired(makeJwt({ exp: future }))).toBe(false);
    expect(isTokenExpired(makeJwt({ exp: Math.floor(Date.now() / 1000) - 10 }))).toBe(true);
    expect(isTokenExpired("garbage")).toBe(true);
    expect(isTokenExpired(makeJwt({ no: "exp" }))).toBe(true);
  });
  it("treats a token expiring within the skew window as expired", () => {
    const soon = Math.floor(Date.now() / 1000) + 10;
    expect(isTokenExpired(makeJwt({ exp: soon }), 30_000)).toBe(true);
  });
});

describe("validateResumeFile", () => {
  it("accepts pdf and docx case-insensitively", () => {
    expect(validateResumeFile(file("CV.PDF"), 5)).toBe("");
    expect(validateResumeFile(file("cv.docx"), 5)).toBe("");
  });
  it("rejects wrong types, legacy .doc, empty and oversized files", () => {
    expect(validateResumeFile(file("notes.txt"), 5)).toMatch(/PDF and Word/);
    expect(validateResumeFile(file("old.doc"), 5)).toMatch(/\.docx/);
    expect(validateResumeFile(file("a.pdf", 0), 5)).toMatch(/empty/);
    expect(validateResumeFile(file("a.pdf", 6 * 1024 * 1024), 5)).toMatch(/5 MB/);
    expect(validateResumeFile(null, 5)).toMatch(/Choose/);
  });
});

describe("errors", () => {
  it("prefers the server's message, with friendly network/timeout fallbacks", () => {
    expect(getErrorMessage({ response: { data: { error: "Nope" } } })).toBe("Nope");
    expect(getErrorMessage({ message: "Network Error" })).toMatch(/Can't reach the server/);
    expect(getErrorMessage({ code: "ECONNABORTED" })).toMatch(/timed out/);
    expect(getErrorMessage({}, "Custom fallback")).toBe("Custom fallback");
  });
  it("extracts field errors from validation responses", () => {
    const err = { response: { data: { details: [{ field: "email", message: "Bad email" }, { message: "no field" }] } } };
    expect(getFieldErrors(err)).toEqual({ email: "Bad email" });
    expect(getFieldErrors({})).toEqual({});
  });
});
