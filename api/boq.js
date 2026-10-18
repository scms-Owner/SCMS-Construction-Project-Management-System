const { requireOwner, sendError } = require("./_lib/owner");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const { sql } = await requireOwner(req);
    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const projectId = String(body.project_id || "").trim();
      const itemCode = String(body.item_code || "").trim().toUpperCase().slice(0, 40);
      const description = String(body.description || "").trim().slice(0, 500);
      const unit = String(body.unit || "").trim().slice(0, 30);
      const mainRate = Number(body.main_rate);
      const quantity = Number(body.quantity);
      if (!projectId || !itemCode || !description || !unit) return res.status(400).json({ ok: false, error: "প্রজেক্ট, আইটেম কোড, বর্ণনা ও ইউনিট দিতে হবে।" });
      if (!Number.isFinite(mainRate) || mainRate < 0 || !Number.isFinite(quantity) || quantity <= 0) return res.status(400).json({ ok: false, error: "Main rate শূন্য বা তার বেশি এবং quantity শূন্যের বেশি হতে হবে।" });
      const rows = await sql`
        INSERT INTO scms.main_boq_items (project_id, item_code, description, unit, main_rate, quantity, revision, active)
        VALUES (${projectId}::uuid, ${itemCode}, ${description}, ${unit}, ${mainRate}, ${quantity}, 1, TRUE)
        RETURNING id, project_id, item_code, description, unit, main_rate, quantity, ROUND(quantity * main_rate, 2) AS main_line_total
      `;
      await sql`
        INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values)
        VALUES (${actor.id}, 'CREATE', 'main_boq_item', ${rows[0].id}, ${JSON.stringify({ project_id: projectId, item_code: itemCode, description, unit, main_rate: mainRate, quantity })}::jsonb)
      `;
      return res.status(201).json({ ok: true, item: rows[0] });
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "এই method অনুমোদিত নয়।" });
    }
    const projectId = String(req.query.project_id || "").trim();
    if (!projectId) return res.status(400).json({ ok: false, error: "প্রজেক্ট নির্বাচন করুন।" });
    const rows = await sql`
      SELECT id, project_id, item_code, description, unit, main_rate, quantity,
             ROUND(quantity * main_rate, 2) AS main_line_total, revision
      FROM scms.main_boq_items
      WHERE project_id = ${projectId}::uuid AND active = TRUE
      ORDER BY item_code
    `;
    return res.status(200).json({ ok: true, items: rows, main_total: rows.reduce((sum, item) => sum + Number(item.main_line_total || 0), 0) });
  } catch (error) {
    return sendError(res, error);
  }
};
