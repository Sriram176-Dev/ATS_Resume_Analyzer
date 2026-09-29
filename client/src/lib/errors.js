/** Turn any thrown value from the API layer into a message safe to show users. */
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (err?.code === "ECONNABORTED") return "The request timed out. Please try again.";
  if (err?.message === "Network Error" || (err?.request && !err?.response)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return err?.response?.data?.error || fallback;
}

/** Field-level messages from a validation response: { email: "Enter a valid email" } */
export function getFieldErrors(err) {
  const details = err?.response?.data?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => d.field).map((d) => [d.field, d.message]));
}
