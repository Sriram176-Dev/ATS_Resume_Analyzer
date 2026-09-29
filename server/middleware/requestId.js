import { randomUUID } from "node:crypto";

/** Attach a request id (honouring an inbound X-Request-Id) for log correlation. */
export function requestId(req, res, next) {
  const inbound = req.get("x-request-id");
  req.id = inbound && /^[\w-]{8,64}$/.test(inbound) ? inbound : randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}
