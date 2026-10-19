const { requireOwner } = require("./_lib/owner");
module.exports = async function handler(req,res) {
 res.setHeader("Cache-Control","no-store, max-age=0");
 try {
  const {sql,actor}=await requireOwner(req);
  if(req.method==="GET") {
   const projectId=String(req.query.project_id||"").trim();
   const rows=await sql`SELECT m.id,m.measurement_code,m.project_id,m.work_order_item_id,m.measured_on,m.method,m.length,m.width,m.height,m.direct_quantity,m.calculated_quantity,m.location_note,m.notes,m.status::text AS status,woi.item_code_snapshot,woi.description_snapshot,woi.unit_snapshot,woi.assigned_quantity,woi.rate_snapshot,wo.work_order_code,s.full_name AS subcontractor_name FROM scms.measurements m JOIN scms.work_order_items woi ON woi.id=m.work_order_item_id JOIN scms.work_orders wo ON wo.id=woi.work_order_id JOIN scms.subcontractors s ON s.id=wo.subcontractor_id WHERE (${projectId}='' OR m.project_id=${projectId}::uuid) ORDER BY m.measured_on DESC,m.created_at DESC LIMIT 500`;
   return res.status(200).json({ok:true,measurements:rows});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  const b=req.body||{}, item=String(b.work_order_item_id||"").trim(), date=String(b.measured_on||"").trim();
  const method=b.method==="LENGTH_WIDTH_HEIGHT"?"LENGTH_WIDTH_HEIGHT":"DIRECT";
  const n=v=>v===""||v===undefined||v===null?null:Number(v);
  const direct=n(b.direct_quantity), l=n(b.length), w=n(b.width), h=n(b.height);
  const qty=method==="DIRECT"?direct:(l!==null&&w!==null&&h!==null?l*w*h:null);
  if(!item||!/^\d{4}-\d{2}-\d{2}$/.test(date)||qty===null||!Number.isFinite(qty)||qty<=0)return res.status(400).json({ok:false,error:"আইটেম, তারিখ ও শূন্যের বেশি সঠিক পরিমাণ দিন।"});
  const code="MSR-"+Date.now().toString(36).toUpperCase();
  const rows=await sql`INSERT INTO scms.measurements(measurement_code,project_id,work_order_item_id,measured_on,method,length,width,height,direct_quantity,calculated_quantity,location_note,notes,status,submitted_by) SELECT ${code},wo.project_id,woi.id,${date}::date,${method},${l},${w},${h},${direct},${qty},${String(b.location_note||"").slice(0,500)},${String(b.notes||"").slice(0,2000)},'SUBMITTED',${actor.id}::uuid FROM scms.work_order_items woi JOIN scms.work_orders wo ON wo.id=woi.work_order_id WHERE woi.id=${item}::uuid AND wo.status IN ('DRAFT','SUBMITTED','CHECKED','APPROVED') RETURNING id,measurement_code,project_id,work_order_item_id,measured_on,calculated_quantity,status`;
  if(!rows.length)return res.status(404).json({ok:false,error:"ওয়ার্ক অর্ডারের আইটেম পাওয়া যায়নি।"});
  return res.status(201).json({ok:true,measurement:rows[0]});
 } catch(e) { return res.status(e.statusCode||500).json({ok:false,error:e.publicMessage||"দৈনিক মাপ সংরক্ষণ করা যায়নি।"}); }
};
