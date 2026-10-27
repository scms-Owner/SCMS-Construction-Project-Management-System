const crypto = require("crypto");
const { requireOwner, sendError } = require("./_lib/owner");

const code = (prefix) => prefix + "-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
const num = (v) => Number(v || 0);
const validAmount = (v, min = 0) => Number.isFinite(Number(v)) && Number(v) >= min;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const { sql, actor } = await requireOwner(req);
    if (req.method === "GET") {
      const [catalog, projects, contractors, assignments] = await Promise.all([
        sql`SELECT id, package_code, package_name, category, unit, active, created_at FROM scms.package_catalog ORDER BY active DESC, package_code`,
        sql`SELECT id, project_code, name, status FROM scms.projects WHERE status <> 'CANCELLED' ORDER BY created_at DESC`,
        sql`SELECT id, full_name, company_name, phone FROM scms.subcontractors WHERE status = 'ACTIVE' ORDER BY full_name`,
        sql`
          SELECT pa.id, pa.assignment_code, pa.project_package_id, pa.subcontractor_id,
                 pa.assigned_quantity, pa.rate_snapshot, pa.opening_completed_quantity,
                 pa.status, pa.assigned_on, pa.transferred_at, pa.transfer_note,
                 pp.project_id, pp.package_id, pp.total_quantity, pp.unit_snapshot,
                 p.project_code, p.name AS project_name,
                 pc.package_code, pc.package_name, pc.category,
                 s.full_name AS contractor_name, s.company_name,
                 COALESCE(pr.progress_quantity,0) AS logged_progress_quantity,
                 pa.opening_completed_quantity + COALESCE(pr.progress_quantity,0) AS completed_quantity,
                 ROUND((pa.opening_completed_quantity + COALESCE(pr.progress_quantity,0)) * pa.rate_snapshot,2) AS earned_value,
                 ROUND((pa.opening_completed_quantity + COALESCE(pr.progress_quantity,0)) * pa.rate_snapshot * 0.05,2) AS security_retained,
                 COALESCE(pay.total_paid,0) AS total_paid,
                 ROUND((pa.opening_completed_quantity + COALESCE(pr.progress_quantity,0)) * pa.rate_snapshot * 0.95 - COALESCE(pay.total_paid,0),2) AS balance_due,
                 COALESCE(pay.advance_paid,0) AS advance_paid,
                 COALESCE(pay.work_paid,0) AS work_paid,
                 COALESCE(hist.progress_log_count,0) AS progress_log_count,
                 GREATEST(0, pa.assigned_quantity - pa.opening_completed_quantity - COALESCE(pr.progress_quantity,0)) AS remaining_quantity
          FROM scms.package_assignments pa
          JOIN scms.project_packages pp ON pp.id=pa.project_package_id
          JOIN scms.projects p ON p.id=pp.project_id
          JOIN scms.package_catalog pc ON pc.id=pp.package_id
          JOIN scms.subcontractors s ON s.id=pa.subcontractor_id
          LEFT JOIN LATERAL (SELECT SUM(quantity) AS progress_quantity FROM scms.package_progress_entries WHERE assignment_id=pa.id) pr ON TRUE
          LEFT JOIN LATERAL (
            SELECT SUM(amount) AS total_paid,
                   SUM(amount) FILTER (WHERE payment_type='ADVANCE') AS advance_paid,
                   SUM(amount) FILTER (WHERE payment_type='WORK_PAYMENT') AS work_paid
            FROM scms.package_payment_transactions WHERE assignment_id=pa.id
          ) pay ON TRUE
          LEFT JOIN LATERAL (SELECT COUNT(*) AS progress_log_count FROM scms.package_progress_entries WHERE assignment_id=pa.id) hist ON TRUE
          ORDER BY pa.created_at DESC
        `
      ]);
      return res.status(200).json({ ok: true, catalog, projects, contractors, assignments });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok: false, error: "এই method অনুমোদিত নয়।" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = String(body.action || "");
    if (action === "create_package") {
      const packageCode = String(body.package_code || "").trim().toUpperCase().replace(/\s+/g, "-").slice(0, 40);
      const packageName = String(body.package_name || "").trim().slice(0, 250);
      const category = String(body.category || "").trim().slice(0, 150);
      const unit = String(body.unit || "প্যাকেজ").trim().slice(0, 30);
      if (!packageCode || !packageName || !unit) return res.status(400).json({ ok: false, error: "প্যাকেজ কোড, নাম ও ইউনিট দিতে হবে।" });
      const rows = await sql`INSERT INTO scms.package_catalog (package_code, package_name, category, unit, created_by) VALUES (${packageCode}, ${packageName}, NULLIF(${category},''), ${unit}, ${actor.id}) RETURNING *`;
      await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'CREATE', 'package_catalog', ${rows[0].id}, ${JSON.stringify({package_code:packageCode,package_name:packageName,unit})}::jsonb)`;
      return res.status(201).json({ ok: true, package: rows[0] });
    }
    if (action === "toggle_package") {
      const id = String(body.package_id || "");
      if (!id) return res.status(400).json({ ok:false, error:"প্যাকেজ নির্বাচন করুন।" });
      const rows = await sql`UPDATE scms.package_catalog SET active = NOT active, updated_at=now() WHERE id=${id}::uuid RETURNING id, package_code, package_name, active`;
      if (!rows.length) return res.status(404).json({ok:false,error:"প্যাকেজ পাওয়া যায়নি।"});
      await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'UPDATE', 'package_catalog', ${rows[0].id}, ${JSON.stringify(rows[0])}::jsonb)`;
      return res.status(200).json({ok:true,package:rows[0]});
    }
    if (action === "assign") {
      const projectId = String(body.project_id || "");
      const packageId = String(body.package_id || "");
      const contractorId = String(body.contractor_id || "");
      const totalQuantity = Number(body.total_quantity);
      const assignedQuantity = Number(body.assigned_quantity);
      const rate = Number(body.rate);
      const openingCompleted = Number(body.opening_completed_quantity || 0);
      if (!projectId || !packageId || !contractorId) return res.status(400).json({ok:false,error:"প্রজেক্ট, প্যাকেজ ও কন্ট্রাক্টর নির্বাচন করুন।"});
      if (!validAmount(totalQuantity,0.0001) || !validAmount(assignedQuantity,0) || !validAmount(rate,0) || !validAmount(openingCompleted,0) || openingCompleted>assignedQuantity) return res.status(400).json({ok:false,error:"পরিমাণ, রেট ও প্রাথমিক অগ্রগতি যাচাই করুন।"});
      const activePackage = await sql`SELECT id, unit, package_name FROM scms.package_catalog WHERE id=${packageId}::uuid AND active=TRUE LIMIT 1`;
      if (!activePackage.length) return res.status(400).json({ok:false,error:"সক্রিয় প্যাকেজ নির্বাচন করুন।"});
      const p = await sql`SELECT id FROM scms.projects WHERE id=${projectId}::uuid AND status <> 'CANCELLED' LIMIT 1`;
      const c = await sql`SELECT id FROM scms.subcontractors WHERE id=${contractorId}::uuid AND status='ACTIVE' LIMIT 1`;
      if (!p.length || !c.length) return res.status(400).json({ok:false,error:"প্রজেক্ট বা কন্ট্রাক্টর পাওয়া যায়নি।"});
      await sql`INSERT INTO scms.project_packages (project_id,package_id,total_quantity,unit_snapshot,created_by) VALUES (${projectId}::uuid,${packageId}::uuid,${totalQuantity},${activePackage[0].unit},${actor.id}) ON CONFLICT (project_id,package_id) DO NOTHING`;
      const pp = await sql`SELECT id,total_quantity,unit_snapshot FROM scms.project_packages WHERE project_id=${projectId}::uuid AND package_id=${packageId}::uuid LIMIT 1`;
      if (Math.abs(Number(pp[0].total_quantity)-totalQuantity)>0.0001) return res.status(409).json({ok:false,error:"এই প্রজেক্টে প্যাকেজের মোট পরিমাণ আগে থেকেই আছে। বিদ্যমান মোট পরিমাণের সঙ্গে মিলিয়ে দিন।"});
      const used = await sql`SELECT COALESCE(SUM(assigned_quantity),0) AS qty FROM scms.package_assignments WHERE project_package_id=${pp[0].id}::uuid AND status <> 'CANCELLED'`;
      if (Number(used[0].qty)+assignedQuantity>totalQuantity+0.0001) return res.status(409).json({ok:false,error:"এই প্যাকেজের মোট বরাদ্দের বেশি দেওয়া যাবে না। অবশিষ্ট: "+Math.max(0,totalQuantity-Number(used[0].qty))+" "+pp[0].unit_snapshot});
      const assignment = await sql`INSERT INTO scms.package_assignments (assignment_code,project_package_id,subcontractor_id,assigned_quantity,rate_snapshot,opening_completed_quantity,created_by) VALUES (${code("SCMS-PKG")},${pp[0].id}::uuid,${contractorId}::uuid,${assignedQuantity},${rate},${openingCompleted},${actor.id}) RETURNING *`;
      await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'CREATE', 'package_assignment', ${assignment[0].id}, ${JSON.stringify({project_id:projectId,package_id:packageId,contractor_id:contractorId,assigned_quantity:assignedQuantity,rate_snapshot:rate})}::jsonb)`;
      return res.status(201).json({ok:true,assignment:assignment[0]});
    }
    if (action === "handover") {
      const assignmentId = String(body.assignment_id || "");
      const contractorId = String(body.contractor_id || "");
      const rate = Number(body.rate);
      const note = String(body.notes || "").trim().slice(0,1000);
      if (!assignmentId || !contractorId || !validAmount(rate,0)) return res.status(400).json({ok:false,error:"আগের বরাদ্দ, নতুন কন্ট্রাক্টর ও রেট নির্বাচন করুন।"});
      const oldRows = await sql`
        SELECT pa.*, pp.total_quantity, pp.unit_snapshot,
               pa.opening_completed_quantity + COALESCE(pr.progress_quantity,0) AS completed_quantity
        FROM scms.package_assignments pa
        JOIN scms.project_packages pp ON pp.id=pa.project_package_id
        LEFT JOIN LATERAL (SELECT SUM(quantity) AS progress_quantity FROM scms.package_progress_entries WHERE assignment_id=pa.id) pr ON TRUE
        WHERE pa.id=${assignmentId}::uuid AND pa.status='ACTIVE'
      `;
      if (!oldRows.length) return res.status(404).json({ok:false,error:"এই কাজটি আর সক্রিয় নেই বা পাওয়া যায়নি।"});
      const old = oldRows[0], completed = Number(old.completed_quantity||0), remaining = Number(old.assigned_quantity)-completed;
      if (remaining <= 0.0001) return res.status(400).json({ok:false,error:"এই কন্ট্রাক্টরের বরাদ্দে আর বাকি কাজ নেই।"});
      const c = await sql`SELECT id FROM scms.subcontractors WHERE id=${contractorId}::uuid AND status='ACTIVE' LIMIT 1`;
      if (!c.length) return res.status(400).json({ok:false,error:"নতুন সক্রিয় কন্ট্রাক্টর নির্বাচন করুন।"});
      const next = await sql`INSERT INTO scms.package_assignments (assignment_code,project_package_id,subcontractor_id,assigned_quantity,rate_snapshot,opening_completed_quantity,created_by) VALUES (${code("SCMS-PKG")},${old.project_package_id}::uuid,${contractorId}::uuid,${remaining},${rate},0,${actor.id}) RETURNING *`;
      await sql`UPDATE scms.package_assignments SET assigned_quantity=${completed}, status='TRANSFERRED', transferred_at=now(), transferred_to_assignment_id=${next[0].id}::uuid, transfer_note=NULLIF(${note},'') WHERE id=${assignmentId}::uuid`;
      await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'HANDOVER', 'package_assignment', ${assignmentId}::uuid, ${JSON.stringify({completed_quantity:completed,remaining_quantity:remaining,new_assignment_id:next[0].id,new_contractor_id:contractorId,rate_snapshot:rate,note})}::jsonb)`;
      return res.status(201).json({ok:true,assignment:next[0],completed_quantity:completed,remaining_quantity:remaining});
    }
    if (action === "progress") {
      const assignmentId = String(body.assignment_id || "");
      const date = String(body.progress_date || new Date().toISOString().slice(0,10));
      const quantity = Number(body.quantity);
      const notes = String(body.notes || "").trim().slice(0,1000);
      if (!assignmentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !validAmount(quantity,0.0001)) return res.status(400).json({ok:false,error:"তারিখ ও শূন্যের বেশি কাজের পরিমাণ দিতে হবে।"});
      const rows = await sql`
        SELECT pa.assigned_quantity, pa.opening_completed_quantity, pa.status,
               COALESCE(pr.progress_quantity,0) AS progress_quantity
        FROM scms.package_assignments pa
        LEFT JOIN LATERAL (SELECT SUM(quantity) AS progress_quantity FROM scms.package_progress_entries WHERE assignment_id=pa.id) pr ON TRUE
        WHERE pa.id=${assignmentId}::uuid
      `;
      if (!rows.length || rows[0].status!=="ACTIVE") return res.status(400).json({ok:false,error:"শুধু সক্রিয় কন্ট্রাক্টরের কাজে অগ্রগতি যোগ করা যাবে।"});
      const completed = Number(rows[0].opening_completed_quantity)+Number(rows[0].progress_quantity);
      if (completed+quantity>Number(rows[0].assigned_quantity)+0.0001) return res.status(409).json({ok:false,error:"এই কন্ট্রাক্টরের বরাদ্দের চেয়ে বেশি কাজ এন্ট্রি করা যাবে না। বাকি: "+Math.max(0,Number(rows[0].assigned_quantity)-completed)});
      const saved = await sql`INSERT INTO scms.package_progress_entries (assignment_id,progress_date,quantity,notes,created_by) VALUES (${assignmentId}::uuid,${date}::date,${quantity},NULLIF(${notes},''),${actor.id}) RETURNING *`;
      await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'CREATE', 'package_progress', ${saved[0].id}, ${JSON.stringify({assignment_id:assignmentId,date,quantity,notes})}::jsonb)`;
      return res.status(201).json({ok:true,progress:saved[0]});
    }
    if (action === "payment") {
      const assignmentId = String(body.assignment_id || "");
      const type = String(body.payment_type || "");
      const amount = Number(body.amount);
      const date = String(body.paid_on || new Date().toISOString().slice(0,10));
      const notes = String(body.notes || "").trim().slice(0,1000);
      const override = body.override === true;
      const reason = String(body.override_reason || "").trim().slice(0,500);
      if (!assignmentId || !["ADVANCE","WORK_PAYMENT"].includes(type) || !validAmount(amount,0.009) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ok:false,error:"পেমেন্টের ধরন, তারিখ ও সঠিক টাকা দিন।"});
      if (override && !reason) return res.status(400).json({ok:false,error:"Overpayment override-এর কারণ লিখতে হবে।"});
      const rows = await sql`
        SELECT pa.assigned_quantity, pa.rate_snapshot, pa.opening_completed_quantity,
               COALESCE(pr.progress_quantity,0) AS progress_quantity,
               COALESCE(py.total_paid,0) AS total_paid,
               ROUND((pa.opening_completed_quantity+COALESCE(pr.progress_quantity,0))*pa.rate_snapshot,2) AS earned_value,
               ROUND((pa.opening_completed_quantity+COALESCE(pr.progress_quantity,0))*pa.rate_snapshot*0.95,2) AS net_earned,
               ROUND(pa.assigned_quantity*pa.rate_snapshot,2) AS assignment_value
        FROM scms.package_assignments pa
        LEFT JOIN LATERAL (SELECT SUM(quantity) AS progress_quantity FROM scms.package_progress_entries WHERE assignment_id=pa.id) pr ON TRUE
        LEFT JOIN LATERAL (SELECT SUM(amount) AS total_paid FROM scms.package_payment_transactions WHERE assignment_id=pa.id) py ON TRUE
        WHERE pa.id=${assignmentId}::uuid
      `;
      if (!rows.length) return res.status(404).json({ok:false,error:"কাজের বরাদ্দ পাওয়া যায়নি।"});
      const r=rows[0], available=type==="ADVANCE"?Number(r.assignment_value)-Number(r.total_paid):Number(r.net_earned)-Number(r.total_paid);
      if (amount>available+0.009 && !override) return res.status(409).json({ok:false,error:"এই পেমেন্টে প্রাপ্যের বেশি হবে। সর্বোচ্চ অনুমোদিত টাকা: "+Math.max(0,available).toFixed(2)+"। বিশেষ অনুমতি দিতে হলে override চিহ্নিত করে কারণ লিখুন।"});
      if (amount>available+0.009 && override) {
        await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'PAYMENT_OVERRIDE_REQUEST', 'package_assignment', ${assignmentId}::uuid, ${JSON.stringify({amount,available,reason})}::jsonb)`;
      }
      const saved=await sql`INSERT INTO scms.package_payment_transactions (assignment_id,payment_code,payment_type,amount,paid_on,notes,created_by) VALUES (${assignmentId}::uuid,${code("SCMS-PAY")},${type},${amount},${date}::date,NULLIF(${notes},''),${actor.id}) RETURNING *`;
      await sql`INSERT INTO scms.audit_logs (actor_user_id, action, entity_type, entity_id, new_values) VALUES (${actor.id}, 'CREATE', 'package_payment', ${saved[0].id}, ${JSON.stringify({assignment_id:assignmentId,type,amount,date,override,reason})}::jsonb)`;
      return res.status(201).json({ok:true,payment:saved[0],overpayment:amount>available+0.009});
    }
    return res.status(400).json({ok:false,error:"অজানা action।"});
  } catch (error) {
    if (error && error.code === "23505") return res.status(409).json({ok:false,error:"এই প্যাকেজ কোডটি আগে ব্যবহার করা হয়েছে।"});
    return sendError(res, error);
  }
};
