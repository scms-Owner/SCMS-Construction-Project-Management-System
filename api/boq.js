const { requireOwner, sendError } = require("./_lib/owner");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const { sql } = await requireOwner(req);
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
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
