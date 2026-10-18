const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!process.env.DATABASE_URL || !process.env.NEON_AUTH_BASE_URL) {
    return res.status(503).json({ ok: false, database: false, auth: false, error: "Server environment is not configured" });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1 AS ok`;
    return res.status(200).json({ ok: true, database: true, auth: true });
  } catch (error) {
    console.error("SCMS health check failed", error && error.message ? error.message : "unknown");
    return res.status(503).json({ ok: false, database: false, auth: true, error: "Database connection failed" });
  }
};
