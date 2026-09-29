/** Central place for values you may want to change per deployment. */
export const APP_NAME = "ResumeATS";
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "hello@resumeats.com";
export const TOKEN_KEY = "ats.token";
export const THEME_KEY = "ats.theme";
export const DEFAULT_MAX_UPLOAD_MB = 5;
export const MAX_JOB_DESCRIPTION_CHARS = 10000;
