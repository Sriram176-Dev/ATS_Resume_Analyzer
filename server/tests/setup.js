// Must be imported before any application module so config validation sees these values.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://localhost:27017/ats-test";
process.env.JWT_SECRET = "test-only-secret-that-is-long-enough-0123456789abcdef";
process.env.GEMINI_API_KEY = "";
process.env.SERVE_CLIENT = "false";
process.env.MAX_UPLOAD_MB = "1";
