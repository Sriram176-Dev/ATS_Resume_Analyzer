export function formatDate(iso, { time = false } = {}) {
  if (!iso) return "";
  const opts = { year: "numeric", month: "short", day: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) };
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(iso));
}

export function formatFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export const firstName = (name = "") => name.trim().split(/\s+/)[0] || "there";
