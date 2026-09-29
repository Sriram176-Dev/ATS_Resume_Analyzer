import api from "./client";

export const authApi = {
  login: (body) => api.post("/auth/login", body).then((r) => r.data),
  register: (body) => api.post("/auth/register", body).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data.user),
};

export const resumesApi = {
  analyze: ({ file, jobDescription, label }, onUploadProgress) => {
    const form = new FormData();
    form.append("jobDescription", jobDescription || "");
    form.append("label", label || "");
    form.append("resume", file);
    return api.post("/resumes", form, { onUploadProgress, timeout: 90_000 }).then((r) => r.data);
  },
  list: ({ page = 1, limit = 10 } = {}) => api.get("/resumes", { params: { page, limit } }).then((r) => r.data),
  stats: () => api.get("/resumes/stats").then((r) => r.data),
  get: (id) => api.get(`/resumes/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/resumes/${id}`),
  downloadReport: async (id, fileName = "resume") => {
    const res = await api.get(`/resumes/${id}/report.pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ats-report-${fileName.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const contactApi = {
  send: (body) => api.post("/contact", body).then((r) => r.data),
};

const DEFAULT_CONFIG = { aiEnabled: false, maxUploadMb: 5, maxJobDescriptionChars: 10000 };
let configPromise;
/** Public server settings (upload limit, whether AI is on). Cached; falls back to safe defaults. */
export const getPublicConfig = () =>
  (configPromise ??= api.get("/config").then((r) => r.data).catch(() => {
    configPromise = undefined;
    return DEFAULT_CONFIG;
  }));
