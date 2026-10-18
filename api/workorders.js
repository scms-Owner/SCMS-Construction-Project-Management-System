const crypto = require("crypto");
const { requireOwner, sendError } = require("./_lib/owner");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const { sql, actor } = await requireOwner(req);
    if (req.method === "GET") {
      const id = String(req.query.id || "").trim();
      if (id) {
        const rows = await sql`
          SELECT wo.id, wo.work_order_code, wo.project_id, p.project_code, p.name AS project_name,
                 p.site_address, p.client_name, wo.subcontractor_id, s.full_name AS subcontractor_name,
                 s.company_name, s.phone AS subcontractor_phone, s.address AS subcontractor_address,
                 wo.status::text AS status, wo.start_date, wo.due_date, wo.terms,
                 wo.advance_percent, wo.retention_percent, wo.revision, wo.created_at,
                 COALESCE(json_agg(json_build_object(
                   'item_code', woi.item_code_snapshot,
                   'description', woi.description_snapshot,
                   'unit', woi.unit_snapshot,
                   'quantity', woi.assigned_quantity,
                   'rate', woi.rate_snapshot,
                   'line_total', woi.line_total
                 ) ORDER BY woi.item_code_snapshot) FILTER (WHERE woi.id IS NOT NULL), '[]'::json) AS items,
                 COALESCE(SUM(woi.line_total),0) AS total_value
          FROM scms.work_orders wo
          JOIN scms.projects p ON p.id=wo.project_id
          JOIN scms.subcontractors s ON s.id=wo.subcontractor_id
          LEFT JOIN scms.work_order_items woi ON woi.work_order_id=wo.id
          WHERE wo.id=${id}::uuid
          GROUP BY wo.id,p.id,s.id
          LIMIT 1
        `;
        if (!rows.length) return res.status(404).json({ ok: false, error: "ওয়ার্ক অর্ডার পাওয়া যায়নি।" });
        return res.status(200).json({ ok: true, work_order: rows[0] });
      }
      const rows = await sql`
        SELECT wo.id, wo.work_order_code, wo.status::text AS status, wo.start_date, wo.due_date, wo.created_at,
               p.project_code, p.name AS project_name, s.full_name AS subcontractor_name,
               COALESCE(SUM(woi.line_total),0) AS total_value,
               COUNT(woi.id) AS item_count
        FROM scms.work_orders wo
        JOIN scms.projects p ON p.id=wo.project_id
        JOIN scms.subcontractors s ON s.id=wo.subcontractor_id
        LEFT JOIN scms.work_order_items woi ON woi.work_order_id=wo.id
        GROUP BY wo.id,p.id,s.id
        ORDER BY wo.created_at DESC
      `;
      return res.status(200).json({ ok: true, work_orders: rows });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "এই method অনুমোদিত নয়।" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const projectId = String(body.project_id || "").trim();
    const contractorId = String(body.subcontractor_id || "").trim();
    const saleValue = Number(body.subcontract_value);
    const advance = Number(body.advance_percent || 0);
    const retention = Number(body.retention_percent || 0);
    if (!projectId || !contractorId) return res.status(400).json({ ok: false, error: "প্রজেক্ট ও সাব-কন্ট্রাক্টর নির্বাচন করুন।" });
    if (!Number.isFinite(saleValue) || saleValue <= 0) return res.status(400).json({ ok: false, error: "সাব-কন্ট্রাক্ট বিক্রয়মূল্য শূন্যের বেশি হতে হবে।" });
    if (!Number.isFinite(advance) || advance < 0 || advance > 100 || !Number.isFinite(retention) || retention < 0 || retention > 100) {
      return res.status(400).json({ ok: false, error: "অগ্রিম ও retention ০–১০০ শতাংশের মধ্যে দিন।" });
    }
    const projectRows = await sql`SELECT id FROM scms.projects WHERE id=${projectId}::uuid LIMIT 1`;
    if (!projectRows.length) return res.status(404).json({ ok: false, error: "প্রজেক্ট পাওয়া যায়নি।" });
    const contractorRows = await sql`SELECT id FROM scms.subcontractors WHERE id=${contractorId}::uuid AND status='ACTIVE' LIMIT 1`;
    if (!contractorRows.length) return res.status(404).json({ ok: false, error: "সক্রিয় সাব-কন্ট্রাক্টর পাওয়া যায়নি।" });
    const boqRows = await sql`
      SELECT id, project_id, item_code, description, unit, main_rate, quantity
      FROM scms.main_boq_items
      WHERE project_id=${projectId}::uuid AND active=TRUE
      ORDER BY item_code
    `;
    if (!boqRows.length) return res.status(400).json({ ok: false, error: "এই প্রজেক্টে BOQ / main rate নেই। আগে BOQ আইটেম এন্ট্রি করুন।" });
    const mainTotal = boqRows.reduce((sum,item)=>sum+Number(item.main_rate||0)*Number(item.quantity||0),0);
    if (mainTotal <= 0) return res.status(400).json({ ok: false, error: "প্রজেক্টের main BOQ total শূন্য।" });
    if (saleValue > mainTotal + 0.01) return res.status(400).json({ ok: false, error: "সাব-কন্ট্রাক্ট মূল্য মেইন BOQ total-এর বেশি হতে পারবে না। Main total: " + mainTotal.toFixed(2) });
    const reductionPercent = Math.max(0, (mainTotal-saleValue)/mainTotal*100);
    const code = "SCMS-WO-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    const terms = String(body.terms || "").trim().slice(0,4000);
    const created = await sql`
      WITH new_order AS (
        INSERT INTO scms.work_orders
          (work_order_code, project_id, subcontractor_id, status, start_date, due_date, terms, advance_percent, retention_percent, created_by)
        VALUES (
          ${code}, ${projectId}::uuid, ${contractorId}::uuid, 'DRAFT',
          NULLIF(${body.start_date || ""}, '')::date, NULLIF(${body.due_date || ""}, '')::date,
          NULLIF(${terms}, ''), ${advance}, ${retention}, ${actor.id}
        )
        RETURNING *
      ),
      new_items AS (
        INSERT INTO scms.work_order_items
          (work_order_id, boq_item_id, item_code_snapshot, description_snapshot, unit_snapshot, assigned_quantity, rate_snapshot)
        SELECT no.id, mbi.id, mbi.item_code, mbi.description, mbi.unit, mbi.quantity,
               ROUND((${saleValue}::numeric / ${mainTotal}::numeric) * mbi.main_rate, 4)
        FROM new_order no
        CROSS JOIN scms.main_boq_items mbi
        WHERE mbi.project_id=${projectId}::uuid AND mbi.active=TRUE
        RETURNING id
      )
      SELECT no.id, no.work_order_code, no.project_id, no.subcontractor_id, no.status, no.created_at,
             (SELECT COUNT(*) FROM new_items) AS item_count
      FROM new_order no
    `;
    const order=created[0];
    await sql`
      INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values)
      VALUES (${actor.id}, 'CREATE', 'work_order', ${order.id},
        ${JSON.stringify({ work_order_code: order.work_order_code, project_id: projectId, subcontractor_id: contractorId, main_total: mainTotal, subcontract_value: saleValue, reduction_percent: reductionPercent })}::jsonb)
    `;
    return res.status(201).json({ ok: true, work_order: { ...order, main_total: mainTotal, subcontract_value: saleValue, reduction_percent: reductionPercent } });
  } catch (error) {
    if (error && error.code === "23505") return res.status(409).json({ ok: false, error: "ওয়ার্ক অর্ডার কোডে সংঘর্ষ হয়েছে। আবার চেষ্টা করুন।" });
    return sendError(res, error);
  }
};
