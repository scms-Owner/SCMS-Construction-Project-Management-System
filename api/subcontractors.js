const { requireOwner, sendError } = require("./_lib/owner");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const { sql, actor } = await requireOwner(req);
    if (req.method === "GET") {
      const rows = await sql`
        SELECT s.id, s.company_name, s.full_name, s.phone, s.email, s.address,
               s.payment_terms, s.retention_percent, s.status, s.created_at,
               COUNT(DISTINCT wo.id) AS work_order_count,
               COALESCE(SUM(DISTINCT wo_total.total), 0) AS assigned_value
        FROM scms.subcontractors s
        LEFT JOIN scms.work_orders wo ON wo.subcontractor_id = s.id
        LEFT JOIN LATERAL (
          SELECT SUM(line_total) AS total FROM scms.work_order_items WHERE work_order_id = wo.id
        ) wo_total ON TRUE
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `;
      return res.status(200).json({ ok: true, subcontractors: rows });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "এই method অনুমোদিত নয়।" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const fullName = String(body.full_name || "").trim().slice(0, 200);
    const companyName = String(body.company_name || "").trim().slice(0, 200);
    const phone = String(body.phone || "").trim().slice(0, 40);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
    const address = String(body.address || "").trim().slice(0, 500);
    const paymentTerms = String(body.payment_terms || "").trim().slice(0, 1000);
    const retention = Number(body.retention_percent || 0);
    if (!fullName) return res.status(400).json({ ok: false, error: "সাব-কন্ট্রাক্টরের নাম আবশ্যক।" });
    if (!Number.isFinite(retention) || retention < 0 || retention > 100) {
      return res.status(400).json({ ok: false, error: "Retention ০ থেকে ১০০ শতাংশের মধ্যে হতে হবে।" });
    }
    const rows = await sql`
      INSERT INTO scms.subcontractors
        (company_name, full_name, phone, email, address, payment_terms, retention_percent, status)
      VALUES (
        NULLIF(${companyName}, ''), ${fullName}, NULLIF(${phone}, ''),
        NULLIF(${email}, ''), NULLIF(${address}, ''), NULLIF(${paymentTerms}, ''),
        ${retention}, 'ACTIVE'
      )
      RETURNING id, company_name, full_name, phone, email, address, payment_terms, retention_percent, status, created_at
    `;
    const contractor = rows[0];
    await sql`
      INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values)
      VALUES (${actor.id}, 'CREATE', 'subcontractor', ${contractor.id}, ${JSON.stringify({ full_name: contractor.full_name, phone: contractor.phone, status: contractor.status })}::jsonb)
    `;
    return res.status(201).json({ ok: true, subcontractor: contractor });
  } catch (error) {
    return sendError(res, error);
  }
};
