/** Read the `exp` claim so an expired session is dropped without a wasted request. (Not a security check: the server verifies.) */
export function getTokenExpiry(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(payload));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewMs = 30_000) {
  const exp = getTokenExpiry(token);
  return exp === null ? true : Date.now() + skewMs >= exp;
}
