const { neon } = require("@neondatabase/serverless");

const AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL || "https://ep-lucky-hill-a1ygsl60.neonauth.ap-southeast-1.aws.neon.tech/scms_construction/auth";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Vary", "Cookie");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!req.headers.cookie) return res.status(401).json({ authenticated: false });

  try {
    const sessionResponse = await fetch(AUTH_BASE_URL.replace(/\/$/, "") + "/get-session", {
      method: "GET",
      headers: { cookie: req.headers.cookie, accept: "application/json" },
      cache: "no-store"
    });
    if (!sessionResponse.ok) return res.status(401).json({ authenticated: false });
    const sessionData = await sessionResponse.json();
    const user = sessionData && (sessionData.user || sessionData.session && sessionData.session.user);
    if (!user || !user.id || !user.email) return res.status(401).json({ authenticated: false });

    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ authenticated: true, authorized: false, error: "Database is not configured" });
    }

    const sql = neon(process.env.DATABASE_URL);
    const email = String(user.email).trim().toLowerCase();
    const ownerEmail = String(process.env.SCMS_OWNER_EMAIL || "").trim().toLowerCase();

    let rows = await sql`
      SELECT id, auth_subject, full_name, email, role::text AS role, active
      FROM scms.app_users
      WHERE auth_subject = ${String(user.id)}
      LIMIT 1
    `;

    // Bootstrap exactly one owner identity only when the configured owner email signs in.
    // New sign-ups never choose their own application role.
    if (rows.length === 0 && ownerEmail && email === ownerEmail) {
      const displayName = String(user.name || email).slice(0, 255);
      await sql`
        INSERT INTO scms.app_users (auth_subject, full_name, email, role, active)
        SELECT ${String(user.id)}, ${displayName}, ${email}, 'OWNER_ADMIN'::scms.app_role, TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM scms.app_users
          WHERE lower(COALESCE(email, '')) = ${email}
             OR auth_subject = ${String(user.id)}
        )
        ON CONFLICT (auth_subject) DO NOTHING
      `;
      rows = await sql`
        SELECT id, auth_subject, full_name, email, role::text AS role, active
        FROM scms.app_users
        WHERE auth_subject = ${String(user.id)}
        LIMIT 1
      `;
    }

    if (rows.length === 0) {
      return res.status(403).json({
        authenticated: true,
        authorized: false,
        error: "অ্যাকাউন্ট তৈরি হয়েছে, কিন্তু SCMS অ্যাডমিন এখনো আপনার ভূমিকা অনুমোদন করেননি।"
      });
    }
    if (!rows[0].active) {
      return res.status(403).json({ authenticated: true, authorized: false, error: "এই অ্যাকাউন্টটি নিষ্ক্রিয়।" });
    }

    return res.status(200).json({
      authenticated: true,
      authorized: true,
      user: { id: rows[0].id, name: rows[0].full_name, email: rows[0].email, role: rows[0].role }
    });
  } catch (error) {
    console.error("SCMS session lookup failed", error && error.message ? error.message : "unknown");
    return res.status(503).json({ authenticated: false, error: "সেশন যাচাই করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।" });
  }
};
