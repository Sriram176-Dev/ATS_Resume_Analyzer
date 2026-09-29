/**
 * Operational error with an HTTP status. Anything thrown that is NOT an
 * ApiError is treated as a bug and returned to the client as a generic 500.
 */
export class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, opts) { return new ApiError(400, message, { code: "BAD_REQUEST", ...opts }); }
  static unauthorized(message = "Authentication required", opts) { return new ApiError(401, message, { code: "UNAUTHORIZED", ...opts }); }
  static forbidden(message = "You don't have access to this resource", opts) { return new ApiError(403, message, { code: "FORBIDDEN", ...opts }); }
  static notFound(message = "Not found", opts) { return new ApiError(404, message, { code: "NOT_FOUND", ...opts }); }
  static conflict(message, opts) { return new ApiError(409, message, { code: "CONFLICT", ...opts }); }
  static payloadTooLarge(message, opts) { return new ApiError(413, message, { code: "PAYLOAD_TOO_LARGE", ...opts }); }
  static unsupportedMedia(message, opts) { return new ApiError(415, message, { code: "UNSUPPORTED_MEDIA_TYPE", ...opts }); }
  static unprocessable(message, opts) { return new ApiError(422, message, { code: "UNPROCESSABLE", ...opts }); }
}
