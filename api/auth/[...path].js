const AUTH_BASE_URL = process.env.NEON_AUTH_BASE_URL || "https://ep-lucky-hill-a1ygsl60.neonauth.ap-southeast-1.aws.neon.tech/scms_construction/auth";

const ALLOWED_PATHS = new Set([
  "/sign-in/email",
  "/sign-up/email",
  "/sign-out",
  "/get-session"
]);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const incoming = new URL(req.url, "https://scms.invalid");
  const path = incoming.pathname.replace(/^\/api\/auth/, "") || "/get-session";
  if (!ALLOWED_PATHS.has(path)) {
    return res.status(404).json({ error: "Authentication endpoint not allowed" });
  }

  const target = new URL(AUTH_BASE_URL.replace(/\/$/, "") + path);
  target.search = incoming.search;

  const headers = {
    accept: req.headers.accept || "application/json",
    cookie: req.headers.cookie || ""
  };
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers["user-agent"]) headers["user-agent"] = req.headers["user-agent"];
  if (req.headers.origin) headers.origin = process.env.APP_BASE_URL || "https://scmssubproject.vercel.app";

  let body;
  if (req.method !== "GET") {
    if (typeof req.body === "string") body = req.body;
    else if (req.body !== undefined) body = JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual"
    });

    const text = await upstream.text();
    const getSetCookie = upstream.headers.getSetCookie;
    const cookies = typeof getSetCookie === "function" ? getSetCookie.call(upstream.headers) : [];
    if (cookies.length) {
      const rewritten = cookies.map(cookie =>
        cookie
          .replace(/;\s*Domain=[^;]*/ig, "")
          .replace(/;\s*Path=\/scms_construction\/auth/ig, "; Path=/")
          .replace(/;\s*SameSite=None/ig, "; SameSite=Lax")
      );
      res.setHeader("Set-Cookie", rewritten);
    }

    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    if (upstream.status >= 300 && upstream.status < 400) {
      const location = upstream.headers.get("location");
      if (location) res.setHeader("Location", location);
    }
    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error("Neon Auth proxy error", error && error.message ? error.message : "unknown");
    return res.status(502).json({ error: "Authentication service temporarily unavailable" });
  }
};
