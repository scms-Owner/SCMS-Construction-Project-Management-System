const { neon } = require("@neondatabase/serverless");

const AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL || "https://ep-lucky-hill-a1ygsl60.neonauth.ap-southeast-1.aws.neon.tech/scms_construction/auth";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, database: false, auth: false, error: "Server environment is not configured" });
  }

  let database = false;
  let auth = false;
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1 AS ok`;
    database = true;
  } catch (error) {
    console.error("SCMS database health check failed", error && error.message ? error.message : "unknown");
  }
  try {
    const response = await fetch(AUTH_BASE_URL.replace(/\/$/, "") + "/get-session", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    auth = response.ok;
  } catch (error) {
    console.error("SCMS auth health check failed", error && error.message ? error.message : "unknown");
  }

  const ok = database && auth;
  return res.status(ok ? 200 : 503).json({
    ok,
    database,
    auth,
    ...(ok ? {} : { error: "One or more backend services are unavailable or not configured" })
  });
};
