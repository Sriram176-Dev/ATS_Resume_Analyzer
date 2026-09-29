import axios from "axios";
import { API_BASE_URL, TOKEN_KEY } from "../config";

const api = axios.create({ baseURL: API_BASE_URL, timeout: 60_000 });

let onUnauthorized = null;
/** AuthContext registers a handler so an expired session logs the user out cleanly (no hard reload). */
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Blob responses (PDF download) carry JSON errors as a Blob; unwrap so callers see a normal error.
    if (error.response?.data instanceof Blob && error.response.data.type.includes("json")) {
      try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* keep as is */ }
    }
    // A failed *login* is also a 401, but it is not an expired session.
    const code = error.response?.data?.code;
    if (error.response?.status === 401 && (code === "TOKEN_EXPIRED" || code === "INVALID_TOKEN")) {
      onUnauthorized?.(error.response.data.error);
    }
    return Promise.reject(error);
  }
);

export default api;
