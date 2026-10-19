const { requireOwner } = require("./_lib/owner");
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store, max-age=0");
 try{
  const {sql,actor}=await requireOwner(req);
  if(req.method==="GET"){
   const projectId=String(req.query.project_id||"").trim();
   const rows=await sql`SELECT e.id,e.expense_code,e.project_id,p.project_code,p.name AS project_name,e.category,e.expense_date,e.amount,e.paid_to,e.method::text AS method,e.billable_to_client,e.status::text AS status,e.notes,e.created_at FROM scms.expenses e JOIN scms.projects p ON p.id=e.project_id WHERE (${projectId}='' OR e.project_id=${projectId}::uuid) ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 500`;
   return res.status(200).json({ok:true,expenses:rows});
  }
  if(req.method!=="POST"){res.setHeader("Allow","GET, POST");return res.status(405).json({ok:false,error:"Method not allowed"});}
  const b=req.body||{},project=String(b.project_id||"").trim(),category=String(b.category||"").trim(),date=String(b.expense_date||"").trim(),amount=Number(b.amount);
  if(!project||!category||category.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(amount)||amount<=0)return res.status(400).json({ok:false,error:"প্রজেক্ট, খরচের খাত, তারিখ ও সঠিক টাকার অঙ্ক দিন।"});
  const method=["CASH","BANK","BKASH","NAGAD","OTHER"].includes(b.method)?b.method:"CASH",code="EXP-"+Date.now().toString(36).toUpperCase();
  const rows=await sql`INSERT INTO scms.expenses(expense_code,project_id,category,expense_date,amount,paid_to,method,billable_to_client,status,notes,created_by) SELECT ${code},p.id,${category},${date}::date,${amount},${String(b.paid_to||"").slice(0,200)},${method}::scms.payment_method,${Boolean(b.billable_to_client)},'SUBMITTED',${String(b.notes||"").slice(0,2000)},${actor.id}::uuid FROM scms.projects p WHERE p.id=${project}::uuid RETURNING id,expense_code,project_id,category,expense_date,amount,status`;
  if(!rows.length)return res.status(404).json({ok:false,error:"প্রজেক্ট পাওয়া যায়নি।"});
  return res.status(201).json({ok:true,expense:rows[0]});
 }catch(e){return res.status(e.statusCode||500).json({ok:false,error:e.publicMessage||"খরচ সংরক্ষণ করা যায়নি।"});}
};
