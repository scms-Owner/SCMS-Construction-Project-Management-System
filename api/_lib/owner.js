const { neon } = require("@neondatabase/serverless");

const AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL || "https://ep-lucky-hill-a1ygsl60.neonauth.ap-southeast-1.aws.neon.tech/scms_construction/auth";

async function requireOwner(req) {
  if (!req.headers.cookie) {
    const error = new Error("লগইন প্রয়োজন।");
    error.status = 401;
    throw error;
  }
  if (!process.env.DATABASE_URL) {
    const error = new Error("সার্ভার ডেটাবেজ কনফিগার করা নেই।");
    error.status = 503;
    throw error;
  }
  const sessionResponse = await fetch(AUTH_BASE_URL.replace(/\/$/, "") + "/get-session", {
    method: "GET",
    headers: { cookie: req.headers.cookie, accept: "application/json" },
    cache: "no-store"
  });
  if (!sessionResponse.ok) {
    const error = new Error("সেশন মেয়াদ শেষ হয়েছে। আবার লগইন করুন।");
    error.status = 401;
    throw error;
  }
  const sessionData = await sessionResponse.json();
  const user = sessionData && (sessionData.user || (sessionData.session && sessionData.session.user));
  if (!user || !user.id || !user.email) {
    const error = new Error("লগইন যাচাই করা যায়নি।");
    error.status = 401;
    throw error;
  }
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT id, auth_subject, full_name, email, role::text AS role, active
    FROM scms.app_users
    WHERE auth_subject = ${String(user.id)}
    LIMIT 1
  `;
  if (!rows.length || !rows[0].active || rows[0].role !== "OWNER_ADMIN") {
    const error = new Error("এই অ্যাপটি শুধু অনুমোদিত SCMS Owner ব্যবহার করতে পারবেন।");
    error.status = 403;
    throw error;
  }
  return { sql, actor: rows[0] };
}

function sendError(res, error) {
  const status = Number(error && error.status) || 500;
  if (status >= 500) console.error("SCMS owner API error:", error && error.message ? error.message : "unknown");
  return res.status(status).json({
    ok: false,
    error: status >= 500 ? "সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।" : error.message
  });
}

module.exports = { requireOwner, sendError };
