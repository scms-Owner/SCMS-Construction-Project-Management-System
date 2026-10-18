const { requireOwner, sendError } = require("./_lib/owner");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const { sql, actor } = await requireOwner(req);
    if (req.method === "GET") {
      const rows = await sql`
        SELECT p.id, p.project_code, p.name, p.site_address, p.client_name,
               p.start_date, p.end_date, p.budget, p.contract_value, p.status,
               p.notes, p.created_at,
               COALESCE((SELECT SUM(mbi.quantity * mbi.main_rate)
                         FROM scms.main_boq_items mbi
                         WHERE mbi.project_id = p.id AND mbi.active = TRUE), 0) AS boq_total,
               COALESCE((SELECT COUNT(*) FROM scms.work_orders wo WHERE wo.project_id = p.id), 0) AS work_order_count
        FROM scms.projects p
        ORDER BY p.created_at DESC
      `;
      return res.status(200).json({ ok: true, projects: rows });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "এই method অনুমোদিত নয়।" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const name = String(body.name || "").trim().slice(0, 200);
    const code = String(body.project_code || "").trim().toUpperCase().slice(0, 40);
    const clientName = String(body.client_name || "").trim().slice(0, 200);
    const siteAddress = String(body.site_address || "").trim().slice(0, 500);
    const status = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].includes(body.status) ? body.status : "PLANNING";
    const budget = Number(body.budget || 0);
    const contractValue = Number(body.contract_value || 0);
    if (!name || !code) return res.status(400).json({ ok: false, error: "প্রজেক্টের নাম ও ইউনিক কোড দিতে হবে।" });
    if (!Number.isFinite(budget) || budget < 0 || !Number.isFinite(contractValue) || contractValue < 0) {
      return res.status(400).json({ ok: false, error: "বাজেট ও চুক্তিমূল্য শূন্য বা তার বেশি হতে হবে।" });
    }
    const rows = await sql`
      WITH new_project AS (
        INSERT INTO scms.projects
          (project_code, name, site_address, client_name, start_date, end_date, budget, contract_value, status, notes, created_by)
        VALUES (
          ${code}, ${name}, NULLIF(${siteAddress}, ''), NULLIF(${clientName}, ''),
          NULLIF(${body.start_date || ""}, '')::date, NULLIF(${body.end_date || ""}, '')::date,
          ${budget}, ${contractValue}, ${status}, NULLIF(${String(body.notes || "").trim().slice(0,3000)}, ''), ${actor.id}
        )
        RETURNING *
      ),
      new_contract AS (
        INSERT INTO scms.main_contracts (project_id, client_name, contract_ref, contract_value)
        SELECT id, COALESCE(NULLIF(client_name, ''), 'Main company'),
               NULLIF(${String(body.contract_ref || "").trim().slice(0,100)}, ''), contract_value
        FROM new_project
        RETURNING id
      )
      SELECT new_project.* FROM new_project
    `;
    const project = rows[0];
    await sql`
      INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values)
      VALUES (${actor.id}, 'CREATE', 'project', ${project.id}, ${JSON.stringify({ project_code: project.project_code, name: project.name, contract_value: project.contract_value })}::jsonb)
    `;
    return res.status(201).json({ ok: true, project });
  } catch (error) {
    if (error && error.code === "23505") return res.status(409).json({ ok: false, error: "এই প্রজেক্ট কোডটি আগে ব্যবহার করা হয়েছে।" });
    return sendError(res, error);
  }
};
