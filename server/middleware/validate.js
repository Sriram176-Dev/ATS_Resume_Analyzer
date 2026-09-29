/**
 * Validate and normalise `req[source]` with a zod schema.
 * On success the parsed value (trimmed, coerced, unknown keys stripped) replaces the original.
 */
export const validate = (schema, source = "body") => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req[source] = result.data;
  next();
};
