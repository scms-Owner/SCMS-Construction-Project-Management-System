const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user:null, projects:[], contractors:[], workOrders:[], boqItems:[], boqProjectId:"", page:"dashboard", search:"" };
const titles = {
  dashboard:["ড্যাশবোর্ড","আপনার সব প্রজেক্ট ও আর্থিক কার্যক্রমের নিয়ন্ত্রণকেন্দ্র।"],
  projects:["মেইন প্রজেক্ট","মেইন কোম্পানির কাছ থেকে পাওয়া প্রজেক্টের রেজিস্টার।"],
  boq:["মেইন BOQ ও রেট","প্রতিটি মেইন প্রজেক্টের আইটেম, পরিমাণ ও মেইন কোম্পানির রেট সংরক্ষণ করুন।"],
  contractors:["সাব-কন্ট্রাক্টর","কন্ট্রাক্টরের তথ্য একবার রেজিস্টার করুন; পরে প্রজেক্ট ও ওয়ার্ক অর্ডারের সঙ্গে যুক্ত হবে।"],
  workorders:["ওয়ার্ক অর্ডার","প্রজেক্ট, কন্ট্রাক্টর ও আইটেম রেট যুক্ত করে ওয়ার্ক অর্ডার তৈরি করুন।"],
  packages:["প্যাকেজ ও কন্ট্রাক্টর","প্যাকেজ যোগ করুন, কন্ট্রাক্টরকে কাজ দিন, অগ্রগতি ও আলাদা পাওনা হিসাব রাখুন।"],
  progress:["দৈনিক অগ্রগতি","প্রতিদিনের কাজের পরিমাণ, অনুমোদিত মাপ ও cumulative progress ট্র্যাক করুন।"],
  subbills:["সাব-কন্ট্রাক্ট বিল","অনুমোদিত অগ্রগতি থেকে প্রাপ্য বিল, পেমেন্ট ও বকেয়া নিয়ন্ত্রণ করুন।"],
  mainbills:["মেইন কোম্পানি বিল","মেইন রেট অনুযায়ী বিল জমা, প্রাপ্ত টাকা ও পাওনা ট্র্যাক করুন।"],
  expenses:["খরচ ও লাভ-ক্ষতি","প্রজেক্ট খরচ ও সাব-কন্ট্রাক্ট খরচ মিলিয়ে প্রকৃত লাভ-ক্ষতি বিশ্লেষণ করুন।"],
  reports:["রিপোর্ট ও বিশ্লেষণ","প্রজেক্ট অগ্রগতি, ক্যাশফ্লো ও আর্থিক রিপোর্ট।"]
};
const money = value => "৳ " + Number(value || 0).toLocaleString("en-BD",{minimumFractionDigits:0,maximumFractionDigits:2});
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(message, isError=false){const el=$("#toast");el.textContent=message;el.classList.toggle("error",isError);el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,3600)}
function showNotice(message){const el=$("#appNotice");el.textContent=message;el.hidden=!message}
async function api(url, options={}) {
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,headers:{"content-type":"application/json","accept":"application/json",...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(response.status===401){$("#appShell").hidden=true;$("#authWrap").hidden=false;throw new Error("সেশন শেষ হয়েছে। আবার লগইন করুন।")}
  if(!response.ok || data.ok===false) throw new Error(data.error||data.message||"অনুরোধ সম্পন্ন হয়নি।");
  return data;
}
function setPage(page){
  state.page=page;state.search="";
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("#crumb").textContent=titles[page][0];$("#pageTitle").textContent=titles[page][0];$("#pageSubtitle").textContent=titles[page][1];
  $("#sidebar").classList.remove("open");renderPage();
}
function setActions(html){$("#pageActions").innerHTML=html}
function showModal(title,html){
  $("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").hidden=false;
}
function closeModal(){$("#modal").hidden=true;$("#modalBody").innerHTML=""}
$("#closeModal").addEventListener("click",closeModal);
$("#modal").addEventListener("click",e=>{if(e.target===$("#modal"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#nav").addEventListener("click",e=>{const b=e.target.closest("[data-page]");if(b)setPage(b.dataset.page)});
$("#logoutBtn").addEventListener("click",async()=>{try{await fetch("/api/auth/sign-out",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:"{}"})}finally{window.location.reload()}});
let authMode="login";
$("#authSwitch").addEventListener("click",()=>{
  authMode=authMode==="login"?"signup":"login";
  $("#ownerNameRow").hidden=authMode!=="signup";
  $("#ownerName").required=authMode==="signup";
  $("#loginPassword").autocomplete=authMode==="login"?"current-password":"new-password";
  $("#loginSubmit").innerHTML=authMode==="login"?'নিরাপদ লগইন <span>→</span>':'Owner অ্যাকাউন্ট তৈরি করুন <span>→</span>';
  $("#authSwitch").textContent=authMode==="login"?"প্রথমবার ব্যবহার করছেন? Owner অ্যাকাউন্ট তৈরি করুন":"আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন";
  $("#authMessage").hidden=true;
});
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const button=$("#loginSubmit"),msg=$("#authMessage");button.disabled=true;msg.hidden=true;
  const payload={email:$("#loginEmail").value.trim(),password:$("#loginPassword").value};
  if(authMode==="signup")payload.name=$("#ownerName").value.trim();
  try{
    const result=await fetch(authMode==="login"?"/api/auth/sign-in/email":"/api/auth/sign-up/email",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify(payload)});
    const data=await result.json().catch(()=>({}));
    if(!result.ok||data.error){msg.textContent=data.message||data.error||(authMode==="signup"?"Owner account তৈরি হয়নি।":"লগইন হয়নি। ইমেইল ও পাসওয়ার্ড যাচাই করুন।");msg.hidden=false;return}
    if(authMode==="signup"){
      const profile=await fetch("/api/me",{credentials:"same-origin",cache:"no-store"});
      const profileData=await profile.json().catch(()=>({}));
      if(profile.ok&&profileData.authorized&&profileData.user?.role==="OWNER_ADMIN"){state.user=profileData.user;$("#authWrap").hidden=true;$("#appShell").hidden=false;await loadData();renderPage();toast("Owner অ্যাকাউন্ট তৈরি ও যাচাই হয়েছে।")}
      else{msg.textContent=profileData.error||"অ্যাকাউন্ট তৈরি হয়েছে। Owner অ্যাকাউন্ট যাচাই করতে পারেনি; Vercel-এ SCMS_OWNER_EMAIL সেট আছে কি না দেখুন।";msg.hidden=false}
    }else await checkSession();
  }catch(err){msg.textContent=err.message||"সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না।";msg.hidden=false}
  finally{button.disabled=false}
});
async function checkSession(){
  const r=await fetch("/api/me",{credentials:"same-origin",cache:"no-store"});const d=await r.json().catch(()=>({}));
  if(r.ok&&d.authorized&&d.user&&d.user.role==="OWNER_ADMIN"){
    state.user=d.user;$("#authWrap").hidden=true;$("#appShell").hidden=false;await loadData();renderPage();return true;
  }
  $("#appShell").hidden=true;$("#authWrap").hidden=false;
  if(r.status===403) {$("#authMessage").textContent=d.error||"এই অ্যাপটি শুধু Owner ব্যবহার করতে পারবেন।";$("#authMessage").hidden=false}
  else if(r.status>=500){$("#authMessage").textContent=d.error||"সার্ভার কনফিগারেশন পরীক্ষা করুন।";$("#authMessage").hidden=false}
  return false;
}
async function loadData(){
  showNotice("");
  try{
    const [p,c,w]=await Promise.all([api("/api/projects"),api("/api/subcontractors"),api("/api/workorders")]);
    state.projects=p.projects||[];state.contractors=c.subcontractors||[];state.workOrders=w.work_orders||[];
  }catch(err){showNotice(err.message);state.projects=[];state.contractors=[];state.workOrders=[]}
}
function renderPage(){
  const view=$("#pageView");setActions("");
  if(state.page==="dashboard") return renderDashboard(view);
  if(state.page==="projects") return renderProjects(view);
  if(state.page==="boq") return renderBoq(view);
  if(state.page==="contractors") return renderContractors(view);
  if(state.page==="workorders") return renderWorkOrders(view);
  if(state.page==="packages") return renderPackages(view);
  const moduleInfo={
    workorders:["ওয়ার্ক অর্ডার মডিউল","পরবর্তী ধাপে কন্ট্রাক্টর + প্রজেক্ট + BOQ রেট যুক্ত করে ওয়ার্ক অর্ডার তৈরি, rate snapshot সংরক্ষণ এবং Print Work Order চালু হবে।","▣"],
    progress:["দৈনিক অগ্রগতি মডিউল","প্রতিদিনের কাজের তারিখ, আইটেম, মাপ, ছবি ও অগ্রগতির শতাংশ যোগ করে অনুমোদনের পর বিলের সঙ্গে যুক্ত হবে।","◴"],
    subbills:["সাব-কন্ট্রাক্ট বিল মডিউল","অনুমোদিত অগ্রগতির মূল্য থেকে পূর্বের পেমেন্ট বাদ দিয়ে সর্বোচ্চ প্রাপ্য টাকা হিসাব করা হবে। প্রাপ্যের বেশি পেমেন্ট সার্ভার থেকে আটকে দেওয়া হবে।","৳"],
    mainbills:["মেইন কোম্পানি বিল মডিউল","মেইন কোম্পানির রেট অনুযায়ী বিল, জমাদানের তারিখ, প্রাপ্ত টাকা ও বকেয়া আলাদা লেজারে থাকবে।","⇧"],
    expenses:["খরচ ও লাভ-ক্ষতি মডিউল","প্রজেক্ট খরচ, সাব-কন্ট্রাক্টের দায়, মেইন কোম্পানি থেকে আদায় এবং বাস্তব cashflow একত্রে বিশ্লেষণ করা হবে।","↗"],
    reports:["রিপোর্ট ও বিশ্লেষণ","প্রজেক্ট অগ্রগতি, আইটেমভিত্তিক বিল, কন্ট্রাক্টর বকেয়া, মেইন কোম্পানির receivable এবং লাভ-ক্ষতির চার্ট তৈরি হবে।","▧"]
  };
  const info=moduleInfo[state.page];
  view.innerHTML='<div class="empty-state"><div class="empty-icon">'+info[2]+'</div><h2>'+info[0]+'</h2><p>'+info[1]+'</p><span class="pill pending-pill">পরবর্তী বাস্তবায়ন ধাপ</span></div>';
}
function renderDashboard(view){
  const totalContract=state.projects.reduce((n,p)=>n+Number(p.contract_value||0),0);
  const totalBudget=state.projects.reduce((n,p)=>n+Number(p.budget||0),0);
  const totalAssigned=state.contractors.reduce((n,c)=>n+Number(c.assigned_value||0),0);
  const active=state.projects.filter(p=>p.status==="ACTIVE").length;
  const recent=state.projects.slice(0,6);
  const max=Math.max(1,...recent.map(p=>Number(p.contract_value||0)));
  view.innerHTML=`
  <div class="metrics">
    <article class="metric"><div class="metric-top"><span>মোট মেইন প্রজেক্ট</span><span class="metric-icon blue">▤</span></div><strong>${state.projects.length}</strong><small>ডেটাবেজে সংরক্ষিত প্রজেক্ট</small></article>
    <article class="metric"><div class="metric-top"><span>মেইন চুক্তিমূল্য</span><span class="metric-icon green">৳</span></div><strong>${money(totalContract)}</strong><small>সব প্রজেক্টের রেকর্ডকৃত মূল্য</small></article>
    <article class="metric"><div class="metric-top"><span>সাব-কন্ট্রাক্টর</span><span class="metric-icon amber">♙</span></div><strong>${state.contractors.length}</strong><small>রেজিস্টার করা কন্ট্রাক্টর</small></article>
    <article class="metric"><div class="metric-top"><span>রেকর্ডকৃত প্রজেক্ট বাজেট</span><span class="metric-icon violet">▥</span></div><strong>${money(totalBudget)}</strong><small>মেইন চুক্তিমূল্য থেকে আলাদা</small></article>
  </div>
  <div class="chart-grid">
    <section class="chart-panel"><div class="section-heading compact"><div><h2>প্রজেক্টভিত্তিক মেইন চুক্তিমূল্য</h2><p class="muted">সর্বশেষ ৬টি রেকর্ডকৃত প্রজেক্ট</p></div><button class="text-btn" data-go="projects">প্রজেক্ট দেখুন →</button></div>
    ${recent.length?'<div class="chart-bars">'+recent.map(p=>'<div class="chart-bar-wrap"><b>'+moneyShort(p.contract_value)+'</b><div class="chart-bar" style="height:'+Math.max(5,Number(p.contract_value||0)/max*100)+'%"></div><small title="'+esc(p.name)+'">'+esc(p.project_code)+'</small></div>').join("")+'</div><p class="chart-note">চার্টটি ডেটাবেজে থাকা contract value থেকে তৈরি। ফাঁকা বা অসম্পূর্ণ প্রজেক্টে ০ দেখাবে।</p>':'<div class="loading">এখনো কোনো প্রজেক্ট নেই। “নতুন প্রজেক্ট” দিয়ে শুরু করুন।</div>'}</section>
    <section class="chart-panel"><div class="section-heading compact"><div><h2>সিস্টেম সংক্ষিপ্তসার</h2><p class="muted">Owner-only workspace</p></div><span class="metric-icon green">✓</span></div>
      <div class="task"><div class="task-icon blue">▤</div><div><b>চলমান প্রজেক্ট</b><small>স্ট্যাটাস ACTIVE</small></div><strong class="number" style="margin-left:auto">${active}</strong></div>
      <div class="task"><div class="task-icon amber">♙</div><div><b>কন্ট্রাক্টর অ্যাসাইনমেন্ট</b><small>মোট ওয়ার্ক অর্ডার value</small></div><strong class="number" style="margin-left:auto">${money(totalAssigned)}</strong></div>
      <div class="task"><div class="task-icon violet">৳</div><div><b>আর্থিক হিসাব</b><small>বিল ও পেমেন্ট মডিউল পরবর্তী ধাপে যুক্ত হবে</small></div><span class="task-state">পরিকল্পিত</span></div>
    </section>
  </div>
  <div class="section-heading"><div><h2>সাম্প্রতিক প্রজেক্ট</h2><p class="muted">প্রকৃত ডেটাবেজ রেকর্ড</p></div><button class="text-btn" data-go="projects">সব প্রজেক্ট দেখুন →</button></div>
  ${projectTable(recent)}
  `;
  view.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.go)));
  const emptyProject=$("#emptyNewProject");if(emptyProject)emptyProject.onclick=openProjectForm;
  setActions('<button class="primary-btn" id="newProjectBtn">＋ নতুন প্রজেক্ট</button>');
  $("#newProjectBtn").onclick=openProjectForm;
}
function moneyShort(v){const n=Number(v||0);if(n>=10000000)return "৳"+(n/10000000).toFixed(1)+"Cr";if(n>=100000)return "৳"+(n/100000).toFixed(1)+"L";if(n>=1000)return "৳"+(n/1000).toFixed(0)+"k";return "৳"+n.toFixed(0)}
function projectTable(projects){
  if(!projects.length)return '<div class="empty-state"><div class="empty-icon">▤</div><h2>এখনো প্রজেক্ট রেজিস্টার করা হয়নি</h2><p>মেইন কোম্পানি থেকে পাওয়া প্রজেক্টগুলো এখানে যোগ করুন। মেইন কোম্পানির রেট ও চুক্তিমূল্য শুধু আপনার Owner অ্যাকাউন্টে থাকবে।</p><button class="primary-btn" id="emptyNewProject">＋ প্রথম প্রজেক্ট যোগ করুন</button></div>';
  return '<div class="table-card"><div class="table-scroll"><table><thead><tr><th>প্রজেক্ট কোড / নাম</th><th>মেইন কোম্পানি / ক্লায়েন্ট</th><th>সাইট</th><th>চুক্তিমূল্য</th><th>স্ট্যাটাস</th></tr></thead><tbody>'+projects.map(p=>'<tr><td><b>'+esc(p.name)+'</b><small>'+esc(p.project_code)+'</small></td><td>'+esc(p.client_name||"—")+'</td><td>'+esc(p.site_address||"—")+'</td><td class="number">'+money(p.contract_value)+'</td><td><span class="pill '+(p.status==="ACTIVE"?"active-pill":"pending-pill")+'">'+statusBn(p.status)+'</span></td></tr>').join("")+'</tbody></table></div></div>';
}
function statusBn(s){return ({PLANNING:"পরিকল্পনায়",ACTIVE:"চলমান",ON_HOLD:"স্থগিত",COMPLETED:"সম্পন্ন",CANCELLED:"বাতিল"})[s]||s}
function renderProjects(view){
  setActions('<button class="primary-btn" id="newProjectBtn">＋ নতুন প্রজেক্ট</button>');
  view.innerHTML='<div class="table-toolbar"><div class="count-note">মোট '+state.projects.length+'টি প্রজেক্ট · Owner-only data</div><input class="search-input" id="projectSearch" placeholder="নাম, কোড বা ক্লায়েন্ট খুঁজুন…"></div><div id="projectTableWrap">'+projectTable(state.projects)+'</div>';
  $("#newProjectBtn").onclick=openProjectForm;
  $("#projectSearch").value=state.search;
  $("#projectSearch").addEventListener("input",e=>{state.search=e.target.value;const q=state.search.toLowerCase();const filtered=state.projects.filter(p=>[p.project_code,p.name,p.client_name,p.site_address].some(v=>String(v||"").toLowerCase().includes(q)));$("#projectTableWrap").innerHTML=projectTable(filtered);const empty=$("#emptyNewProject");if(empty)empty.onclick=openProjectForm});
  const empty=$("#emptyNewProject");if(empty)empty.onclick=openProjectForm;
}
async function renderBoq(view){
  setActions('<button class="primary-btn" id="newBoqItemBtn">＋ নতুন BOQ আইটেম</button>');
  const selected=state.boqProjectId||state.projects[0]?.id||"";
  state.boqProjectId=selected;
  view.innerHTML='<section class="panel"><div class="form-grid"><div class="field"><label for="boqProjectSelect">মেইন প্রজেক্ট নির্বাচন করুন</label><select id="boqProjectSelect">'+state.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.project_code+" — "+p.name)+'</option>').join("")+'</select></div><div class="field"><label>আইটেম সংখ্যা</label><input id="boqCount" readonly value="লোড হচ্ছে…"></div></div></section><div class="section-heading"><div><h2>মেইন BOQ ও রেট শিডিউল</h2><p class="muted">এই রেটগুলো শুধু Owner view-তে থাকবে; প্রিন্ট ওয়ার্ক অর্ডারে মেইন রেট দেখানো হবে না।</p></div></div><div id="boqTableWrap" class="loading">BOQ লোড হচ্ছে…</div>';
  $("#newBoqItemBtn").onclick=()=>openBoqForm(state.boqProjectId);
  $("#boqProjectSelect").addEventListener("change",async e=>{state.boqProjectId=e.target.value;await loadBoqForPage()});
  if(!selected){$("#boqCount").value="প্রজেক্ট নেই";$("#boqTableWrap").innerHTML='<div class="empty-state"><h2>প্রথমে একটি মেইন প্রজেক্ট তৈরি করুন</h2><p>তারপর সেই প্রজেক্টের BOQ আইটেম ও মেইন রেট এন্ট্রি করতে পারবেন।</p><button class="primary-btn" id="boqCreateProject">＋ নতুন প্রজেক্ট</button></div>';$("#boqCreateProject").onclick=openProjectForm;return}
  await loadBoqForPage();
  const empty=$("#emptyNewBoq");if(empty)empty.onclick=()=>openBoqForm(state.boqProjectId);
}
async function loadBoqForPage(){
  const wrap=$("#boqTableWrap");if(!wrap)return;
  wrap.innerHTML='<div class="loading">BOQ লোড হচ্ছে…</div>';
  try{
    const d=await api("/api/boq?project_id="+encodeURIComponent(state.boqProjectId));state.boqItems=d.items||[];
    $("#boqCount").value=state.boqItems.length+"টি আইটেম";
    const total=Number(d.main_total||0);
    wrap.innerHTML='<div class="metrics" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:15px"><article class="metric"><div class="metric-top"><span>মেইন BOQ মোট</span><span class="metric-icon green">৳</span></div><strong>'+money(total)+'</strong><small>পরিমাণ × মেইন রেট</small></article><article class="metric"><div class="metric-top"><span>রেট এন্ট্রি</span><span class="metric-icon blue">▥</span></div><strong>'+state.boqItems.length+'</strong><small>এই প্রজেক্টে সক্রিয় আইটেম</small></article></div>'+boqTable(state.boqItems);
    const empty=$("#emptyNewBoq");if(empty)empty.onclick=()=>openBoqForm(state.boqProjectId);
  }catch(err){wrap.innerHTML='<div class="empty-state"><h2>BOQ লোড করা যায়নি</h2><p>'+esc(err.message)+'</p></div>'}
}
function boqTable(items){
  if(!items.length)return '<div class="empty-state"><div class="empty-icon">▥</div><h2>এই প্রজেক্টে BOQ রেট নেই</h2><p>প্রতিটি আইটেমের মেইন রেট ও পরিমাণ এন্ট্রি করুন। এরপর সাব-কন্ট্রাক্ট ওয়ার্ক অর্ডার তৈরি করা যাবে।</p><button class="primary-btn" id="emptyNewBoq">＋ প্রথম BOQ আইটেম</button></div>';
  return '<div class="table-card"><div class="table-scroll"><table><thead><tr><th>আইটেম কোড</th><th>কাজের বর্ণনা</th><th>ইউনিট</th><th>পরিমাণ</th><th>মেইন রেট (৳)</th><th>মেইন মোট (৳)</th></tr></thead><tbody>'+items.map(i=>'<tr><td><b>'+esc(i.item_code)+'</b></td><td>'+esc(i.description)+'</td><td>'+esc(i.unit)+'</td><td class="number">'+Number(i.quantity||0).toLocaleString("en-BD")+'</td><td class="number">'+money(i.main_rate)+'</td><td class="number">'+money(i.main_line_total)+'</td></tr>').join("")+'</tbody></table></div></div>';
}
function openBoqForm(projectId){
  if(!projectId){toast("আগে একটি প্রজেক্ট নির্বাচন করুন।",true);return}
  showModal("নতুন মেইন BOQ আইটেম",`
    <form id="boqForm">
      <div class="form-grid">
        <div class="field"><label for="boqItemCode">আইটেম কোড *</label><input id="boqItemCode" name="item_code" required maxlength="40" placeholder="A-01"></div>
        <div class="field"><label for="boqUnit">ইউনিট *</label><select id="boqUnit" name="unit" required><option value="LS">LS (Lump Sum)</option><option value="sft">sft</option><option value="sqft">sqft</option><option value="sqm">sqm</option><option value="cft">cft</option><option value="cft">CFT</option><option value="kg">kg</option><option value="pcs">pcs</option><option value="rft">rft</option><option value="day">day</option><option value="m3">m³</option><option value="m2">m²</option></select></div>
        <div class="field full"><label for="boqDescription">কাজের বর্ণনা *</label><input id="boqDescription" name="description" required maxlength="500" placeholder="যেমন: Earth Cutting"></div>
        <div class="field"><label for="boqQuantity">পরিমাণ *</label><input id="boqQuantity" name="quantity" type="number" min="0.0001" step="0.0001" value="1" required></div>
        <div class="field"><label for="boqRate">মেইন কোম্পানির রেট (৳) *</label><input id="boqRate" name="main_rate" type="number" min="0" step="0.0001" required></div>
        <div class="field full"><div class="notice" style="margin:0">মেইন রেট শুধু আপনার অফিসের অভ্যন্তরীণ হিসাব। সাব-কন্ট্রাক্টরের ওয়ার্ক অর্ডারে ছাড়-পরবর্তী সাব-কন্ট্রাক্ট রেটই দেখানো হবে।</div></div>
      </div>
      <div class="form-actions"><button class="secondary-btn" type="button" data-cancel>বাতিল</button><button class="primary-btn" type="submit">BOQ আইটেম সংরক্ষণ</button></div>
    </form>`);
  const form=$("#boqForm");form.querySelector("[data-cancel]").onclick=closeModal;
  form.addEventListener("submit",async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;const payload=Object.fromEntries(new FormData(form).entries());payload.project_id=projectId;payload.quantity=Number(payload.quantity);payload.main_rate=Number(payload.main_rate);
    try{await api("/api/boq",{method:"POST",body:JSON.stringify(payload)});closeModal();await loadBoqForPage();toast("মেইন BOQ আইটেম সংরক্ষণ হয়েছে।")}catch(err){toast(err.message,true)}finally{button.disabled=false}
  });
}
function renderContractors(view){
  setActions('<button class="primary-btn" id="newContractorBtn">＋ নতুন সাব-কন্ট্রাক্টর</button>');
  view.innerHTML='<div class="table-toolbar"><div class="count-note">মোট '+state.contractors.length+' জন কন্ট্রাক্টর · কোনো আলাদা লগইন নেই</div><input class="search-input" id="contractorSearch" placeholder="নাম, ফোন বা কোম্পানি খুঁজুন…"></div><div id="contractorTableWrap">'+contractorTable(state.contractors)+'</div>';
  $("#newContractorBtn").onclick=openContractorForm;
  $("#contractorSearch").addEventListener("input",e=>{const q=e.target.value.toLowerCase();const list=state.contractors.filter(c=>[c.full_name,c.company_name,c.phone,c.email].some(v=>String(v||"").toLowerCase().includes(q)));$("#contractorTableWrap").innerHTML=contractorTable(list);bindContractorActions()});
  bindContractorActions();
}
function bindContractorActions(){
  const empty=$("#emptyNewContractor");if(empty)empty.onclick=openContractorForm;
  $("[data-new-workorder]").forEach(b=>b.onclick=()=>openWorkOrderForm(b.dataset.newWorkorder));
}
function contractorTable(list){
  if(!list.length)return '<div class="empty-state"><div class="empty-icon">♙</div><h2>সাব-কন্ট্রাক্টর রেজিস্টার খালি</h2><p>কন্ট্রাক্টরের নাম, ফোন, ঠিকানা ও শর্ত একবার এন্ট্রি করুন। এরপর “ওয়ার্ক অর্ডার তৈরি” বাটনে তার জন্য প্রজেক্টভিত্তিক চুক্তি তৈরি করুন।</p><button class="primary-btn" id="emptyNewContractor">＋ কন্ট্রাক্টর রেজিস্টার</button></div>';
  return '<div class="table-card"><div class="table-scroll"><table><thead><tr><th>কন্ট্রাক্টর</th><th>ফোন / ইমেইল</th><th>ঠিকানা</th><th>ওয়ার্ক অর্ডার</th><th>অ্যাসাইনড মূল্য</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th></tr></thead><tbody>'+list.map(c=>'<tr><td><b>'+esc(c.full_name)+'</b><small>'+esc(c.company_name||"ব্যক্তিগত কন্ট্রাক্টর")+'</small></td><td>'+esc(c.phone||"—")+'<small>'+esc(c.email||"")+'</small></td><td>'+esc(c.address||"—")+'</td><td>'+Number(c.work_order_count||0)+'</td><td class="number">'+money(c.assigned_value)+'</td><td><span class="pill '+(c.status==="ACTIVE"?"active-pill":"pending-pill")+'">'+(c.status==="ACTIVE"?"সক্রিয়":"নিষ্ক্রিয়")+'</span></td><td><button class="text-btn nowrap" data-new-workorder="'+esc(c.id)+'">＋ ওয়ার্ক অর্ডার</button></td></tr>').join("")+'</tbody></table></div></div>';
}
function renderWorkOrders(view){
  setActions('<button class="primary-btn" id="newWorkOrderBtn">＋ ওয়ার্ক অর্ডার তৈরি</button>');
  view.innerHTML='<div class="table-toolbar"><div class="count-note">মোট '+state.workOrders.length+'টি ওয়ার্ক অর্ডার · মেইন রেট শুধু Owner-এর জন্য</div><input class="search-input" id="workOrderSearch" placeholder="কোড, প্রজেক্ট বা কন্ট্রাক্টর খুঁজুন…"></div><div id="workOrderTableWrap">'+workOrderTable(state.workOrders)+'</div>';
  $("#newWorkOrderBtn").onclick=()=>openWorkOrderForm();
  $("#workOrderSearch").addEventListener("input",e=>{const q=e.target.value.toLowerCase();const list=state.workOrders.filter(w=>[w.work_order_code,w.project_name,w.project_code,w.subcontractor_name].some(v=>String(v||"").toLowerCase().includes(q)));$("#workOrderTableWrap").innerHTML=workOrderTable(list);bindPrintButtons()});
  bindPrintButtons();
}
function workOrderTable(list){
  if(!list.length)return '<div class="empty-state"><div class="empty-icon">▣</div><h2>এখনো ওয়ার্ক অর্ডার তৈরি হয়নি</h2><p>প্রজেক্ট ও সাব-কন্ট্রাক্টর রেজিস্টার করুন। এরপর মোট সাব-কন্ট্রাক্ট মূল্য লিখলে সিস্টেম গড় ছাড় ও আইটেমভিত্তিক রেট বের করবে।</p><button class="primary-btn" id="emptyNewWorkOrder">＋ প্রথম ওয়ার্ক অর্ডার</button></div>';
  return '<div class="table-card"><div class="table-scroll"><table><thead><tr><th>ওয়ার্ক অর্ডার</th><th>প্রজেক্ট</th><th>সাব-কন্ট্রাক্টর</th><th>আইটেম</th><th>চুক্তিমূল্য</th><th>স্ট্যাটাস</th><th>প্রিন্ট</th></tr></thead><tbody>'+list.map(w=>'<tr><td><b>'+esc(w.work_order_code)+'</b><small>'+dateText(w.created_at)+'</small></td><td>'+esc(w.project_name)+'<small>'+esc(w.project_code)+'</small></td><td>'+esc(w.subcontractor_name)+'</td><td>'+Number(w.item_count||0)+'</td><td class="number">'+money(w.total_value)+'</td><td><span class="pill pending-pill">'+esc(w.status||"DRAFT")+'</span></td><td><button class="text-btn" data-print-wo="'+esc(w.id)+'">ওয়ার্ক অর্ডার প্রিন্ট</button></td></tr>').join("")+'</tbody></table></div></div>';
}
function dateText(value){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
function bindPrintButtons(){
  const empty=$("#emptyNewWorkOrder");if(empty)empty.onclick=()=>openWorkOrderForm();
  $("[data-print-wo]").forEach(b=>b.onclick=()=>printWorkOrder(b.dataset.printWo));
}
function openWorkOrderForm(preselectedContractor=""){
  if(!state.projects.length||!state.contractors.length){toast("আগে অন্তত একটি প্রজেক্ট ও একটি সক্রিয় সাব-কন্ট্রাক্টর রেজিস্টার করুন।",true);return}
  showModal("সাব-কন্ট্রাক্ট ওয়ার্ক অর্ডার তৈরি",`
    <form id="workOrderForm">
      <div class="form-grid">
        <div class="field"><label for="woProject">মেইন প্রজেক্ট *</label><select id="woProject" name="project_id" required><option value="">প্রজেক্ট নির্বাচন করুন</option>${state.projects.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.project_code+" — "+p.name)+'</option>').join("")}</select></div>
        <div class="field"><label for="woContractor">সাব-কন্ট্রাক্টর *</label><select id="woContractor" name="subcontractor_id" required><option value="">কন্ট্রাক্টর নির্বাচন করুন</option>${state.contractors.filter(c=>c.status==="ACTIVE").map(c=>'<option value="'+esc(c.id)+'" '+(c.id===preselectedContractor?'selected':'')+'>'+esc(c.full_name+(c.company_name?' — '+c.company_name:''))+'</option>').join("")}</select></div>
        <div class="field"><label for="woMainTotal">মেইন BOQ মোট (৳)</label><input id="woMainTotal" readonly value="প্রজেক্ট নির্বাচন করুন"></div>
        <div class="field"><label for="woSaleValue">সাব-কন্ট্রাক্ট বিক্রয়মূল্য (৳) *</label><input id="woSaleValue" name="subcontract_value" type="number" min="0.01" step="0.01" required placeholder="যেমন 3050000"></div>
        <div class="field"><label for="woReduction">গড় ছাড় (%)</label><input id="woReduction" readonly value="—"></div>
        <div class="field"><label for="woDiscountValue">মোট পার্থক্য (৳)</label><input id="woDiscountValue" readonly value="—"></div>
        <div class="field"><label for="woStart">কাজ শুরুর তারিখ</label><input id="woStart" name="start_date" type="date"></div>
        <div class="field"><label for="woDue">কাজ শেষের তারিখ</label><input id="woDue" name="due_date" type="date"></div>
        <div class="field"><label for="woAdvance">অগ্রিম (%)</label><input id="woAdvance" name="advance_percent" type="number" min="0" max="100" step="0.01" value="0"></div>
        <div class="field"><label for="woRetention">Retention (%)</label><input id="woRetention" name="retention_percent" type="number" min="0" max="100" step="0.01" value="0"></div>
        <div class="field full"><label for="woTerms">কাজের শর্ত</label><textarea id="woTerms" name="terms" maxlength="4000" placeholder="অনুমোদিত কাজের অগ্রগতি অনুযায়ী বিল হবে; চুক্তির অতিরিক্ত টাকা দেওয়া হবে না।"></textarea></div>
        <div class="field full"><div class="notice" style="margin:0">প্রিন্ট কপিতে শুধু সাব-কন্ট্রাক্টের রেট দেখানো হবে। মেইন রেট, ছাড়ের শতাংশ ও কোম্পানির মার্জিন কন্ট্রাক্টরের কপিতে দেখানো হবে না।</div></div>
        <div class="field full" id="woPreview"><p class="muted">প্রজেক্ট নির্বাচন করলে আইটেম সংখ্যা ও মোট মেইন রেট দেখা যাবে।</p></div>
      </div>
      <div class="form-actions"><button class="secondary-btn" type="button" data-cancel>বাতিল</button><button class="primary-btn" type="submit">ওয়ার্ক অর্ডার তৈরি করুন</button></div>
    </form>`);
  const form=$("#workOrderForm");form.querySelector("[data-cancel]").onclick=closeModal;
  const mainTotal=$("#woMainTotal"),sale=$("#woSaleValue"),reduction=$("#woReduction"),difference=$("#woDiscountValue"),preview=$("#woPreview");
  let boqItems=[],mainValue=0;
  async function loadBoq(){
    const id=$("#woProject").value;boqItems=[];mainValue=0;
    if(!id){mainTotal.value="প্রজেক্ট নির্বাচন করুন";preview.innerHTML='<p class="muted">প্রজেক্ট নির্বাচন করুন।</p>';calc();return}
    mainTotal.value="লোড হচ্ছে…";preview.innerHTML='<p class="muted">BOQ লোড হচ্ছে…</p>';
    try{
      const d=await api("/api/boq?project_id="+encodeURIComponent(id));boqItems=d.items||[];mainValue=Number(d.main_total||0);mainTotal.value=money(mainValue);
      preview.innerHTML='<div class="notice" style="margin:0">এই প্রজেক্টে '+boqItems.length+'টি main BOQ item পাওয়া গেছে। গড় ছাড় একই অনুপাতে সব আইটেমের rate snapshot-এ প্রয়োগ হবে।</div>';
      if(!Number(sale.value)&&mainValue)sale.value=mainValue.toFixed(2);calc();
    }catch(err){mainTotal.value="BOQ পাওয়া যায়নি";preview.innerHTML='<p class="muted">'+esc(err.message)+'</p>';toast(err.message,true)}
  }
  function calc(){
    const sv=Number(sale.value||0);
    if(mainValue>0&&sv>0){reduction.value=((mainValue-sv)/mainValue*100).toFixed(2)+"%";difference.value=money(mainValue-sv)}
    else{reduction.value="—";difference.value="—"}
  }
  $("#woProject").addEventListener("change",loadBoq);sale.addEventListener("input",calc);
  if(preselectedContractor)$("#woContractor").value=preselectedContractor;
  form.addEventListener("submit",async e=>{
    e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;
    const payload=Object.fromEntries(new FormData(form).entries());payload.subcontract_value=Number(payload.subcontract_value);payload.advance_percent=Number(payload.advance_percent||0);payload.retention_percent=Number(payload.retention_percent||0);
    try{
      const d=await api("/api/workorders",{method:"POST",body:JSON.stringify(payload)});closeModal();await loadData();setPage("workorders");toast("ওয়ার্ক অর্ডার তৈরি হয়েছে। প্রিন্ট করার জন্য তালিকা থেকে নির্বাচন করুন।");
    }catch(err){toast(err.message,true)}finally{button.disabled=false}
  });
  if(state.projects.length===1){$("#woProject").value=state.projects[0].id;loadBoq()}
}
async function printWorkOrder(id){
  try{
    const d=await api("/api/workorders?id="+encodeURIComponent(id));const w=d.work_order;
    const rows=Array.isArray(w.items)?w.items:[];
    $("#pageView").innerHTML=`
      <div class="print-toolbar"><button class="secondary-btn" id="backToWorkOrders">← ওয়ার্ক অর্ডারে ফিরুন</button><button class="primary-btn" id="printNow">প্রিন্ট / PDF</button></div>
      <article class="print-document">
        <header class="print-header"><div class="print-logo">S</div><div><h2>SOHANUR CONSTRUCTION &amp; MANPOWER SOLUTION</h2><p>Building Trust, Delivering Quality</p><h3>SUB-CONTRACT WORK ORDER</h3></div><div class="print-code"><b>${esc(w.work_order_code)}</b><small>Date: ${dateText(w.created_at)}</small></div></header>
        <div class="print-meta"><div><small>Project / Site</small><b>${esc(w.project_name)} (${esc(w.project_code)})</b><p>${esc(w.site_address||"")}</p></div><div><small>Sub-contractor</small><b>${esc(w.subcontractor_name)}</b><p>${esc(w.company_name||"")}${w.subcontractor_phone?" · "+esc(w.subcontractor_phone):""}</p><p>${esc(w.subcontractor_address||"")}</p></div></div>
        <table class="print-table"><thead><tr><th>Sl.</th><th>Item Code</th><th>Work Description</th><th>Unit</th><th>Qty</th><th>Rate (BDT)</th><th>Amount (BDT)</th></tr></thead><tbody>${rows.map((it,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(it.item_code)+'</td><td>'+esc(it.description)+'</td><td>'+esc(it.unit)+'</td><td class="number">'+Number(it.quantity||0).toLocaleString("en-BD")+'</td><td class="number">'+money(it.rate)+'</td><td class="number">'+money(it.line_total)+'</td></tr>').join("")}</tbody><tfoot><tr><th colspan="6">TOTAL SUB-CONTRACT VALUE</th><th class="number">${money(w.total_value)}</th></tr></tfoot></table>
        <div class="print-terms"><b>Terms &amp; Conditions</b><p>${esc(w.terms||"Payment will be made only against approved work progress and measured quantities. Payment must not exceed the approved earned value. Any unpaid balance remains subject to verified progress and contract terms.")}</p><p>Work Start: ${dateText(w.start_date)} &nbsp;&nbsp; Target Completion: ${dateText(w.due_date)}</p><p>Advance: ${Number(w.advance_percent||0)}% &nbsp;&nbsp; Retention: ${Number(w.retention_percent||0)}%</p></div>
        <div class="signature-grid"><div><span></span><b>For SCMS (Authorized Signature)</b></div><div><span></span><b>Sub-contractor Signature</b></div></div>
        <p class="print-footer">This work order contains subcontract rates only. Main company rates and SCMS internal margin are confidential.</p>
      </article>`;
    $("#backToWorkOrders").onclick=()=>setPage("workorders");$("#printNow").onclick=()=>window.print();
  }catch(err){toast(err.message,true)}
}

function openProjectForm(){
  showModal("নতুন মেইন প্রজেক্ট",`
    <form id="projectForm">
      <div class="form-grid">
        <div class="field"><label for="projectCode">প্রজেক্ট কোড *</label><input id="projectCode" name="project_code" required maxlength="40" placeholder="SCMS-PRJ-001"></div>
        <div class="field"><label for="projectName">প্রজেক্টের নাম *</label><input id="projectName" name="name" required maxlength="200" placeholder="যেমন: River CTG"></div>
        <div class="field"><label for="clientName">মেইন কোম্পানি / ক্লায়েন্ট</label><input id="clientName" name="client_name" maxlength="200"></div>
        <div class="field"><label for="contractRef">মেইন ওয়ার্ক অর্ডার / রেফারেন্স</label><input id="contractRef" name="contract_ref" maxlength="100"></div>
        <div class="field full"><label for="siteAddress">প্রজেক্ট সাইট / ঠিকানা</label><input id="siteAddress" name="site_address" maxlength="500"></div>
        <div class="field"><label for="mainContractValue">মেইন চুক্তিমূল্য (৳)</label><input id="mainContractValue" name="contract_value" type="number" min="0" step="0.01" value="0" required></div>
        <div class="field"><label for="projectBudget">বাজেট (৳)</label><input id="projectBudget" name="budget" type="number" min="0" step="0.01" value="0" required></div>
        <div class="field"><label for="projectStart">শুরুর তারিখ</label><input id="projectStart" name="start_date" type="date"></div>
        <div class="field"><label for="projectEnd">শেষের তারিখ</label><input id="projectEnd" name="end_date" type="date"></div>
        <div class="field"><label for="projectStatus">স্ট্যাটাস</label><select id="projectStatus" name="status"><option value="PLANNING">পরিকল্পনায়</option><option value="ACTIVE">চলমান</option><option value="ON_HOLD">স্থগিত</option><option value="COMPLETED">সম্পন্ন</option><option value="CANCELLED">বাতিল</option></select></div>
        <div class="field full"><label for="projectNotes">নোট</label><textarea id="projectNotes" name="notes" maxlength="3000" placeholder="চুক্তির শর্ত বা প্রয়োজনীয় নোট"></textarea></div>
      </div>
      <div class="form-actions"><button class="secondary-btn" type="button" data-cancel>বাতিল</button><button class="primary-btn" type="submit">প্রজেক্ট সংরক্ষণ করুন</button></div>
    </form>`);
  $("#projectForm").querySelector("[data-cancel]").onclick=closeModal;
  $("#projectForm").addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
    const payload=Object.fromEntries(new FormData(form).entries());
    payload.contract_value=Number(payload.contract_value||0);payload.budget=Number(payload.budget||0);
    try{await api("/api/projects",{method:"POST",body:JSON.stringify(payload)});closeModal();await loadData();setPage("projects");toast("প্রজেক্ট ডেটাবেজে সংরক্ষণ হয়েছে।")}
    catch(err){toast(err.message,true)}finally{button.disabled=false}
  });
}
function openContractorForm(){
  showModal("নতুন সাব-কন্ট্রাক্টর রেজিস্ট্রেশন",`
    <form id="contractorForm">
      <div class="form-grid">
        <div class="field"><label for="contractorFullName">কন্ট্রাক্টরের পূর্ণ নাম *</label><input id="contractorFullName" name="full_name" required maxlength="200"></div>
        <div class="field"><label for="contractorCompany">কোম্পানি / প্রতিষ্ঠানের নাম</label><input id="contractorCompany" name="company_name" maxlength="200"></div>
        <div class="field"><label for="contractorPhone">মোবাইল নম্বর</label><input id="contractorPhone" name="phone" maxlength="40" inputmode="tel"></div>
        <div class="field"><label for="contractorEmail">ইমেইল</label><input id="contractorEmail" name="email" type="email" maxlength="254"></div>
        <div class="field full"><label for="contractorAddress">ঠিকানা</label><input id="contractorAddress" name="address" maxlength="500"></div>
        <div class="field"><label for="contractorRetention">Retention (%)</label><input id="contractorRetention" name="retention_percent" type="number" min="0" max="100" step="0.01" value="0"></div>
        <div class="field"><label for="contractorTerms">পেমেন্ট শর্ত</label><input id="contractorTerms" name="payment_terms" maxlength="1000" placeholder="যেমন: অনুমোদিত অগ্রগতি অনুযায়ী"></div>
        <div class="field full"><div class="notice" style="margin:0">এই রেজিস্ট্রেশন শুধু আপনার অফিসের রেকর্ড। কন্ট্রাক্টরের জন্য আলাদা লগইন তৈরি হবে না এবং সে মেইন কোম্পানির রেট দেখতে পাবে না।</div></div>
      </div>
      <div class="form-actions"><button class="secondary-btn" type="button" data-cancel>বাতিল</button><button class="primary-btn" type="submit">কন্ট্রাক্টর সংরক্ষণ করুন</button></div>
    </form>`);
  $("#contractorForm").querySelector("[data-cancel]").onclick=closeModal;
  $("#contractorForm").addEventListener("submit",async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
    const payload=Object.fromEntries(new FormData(form).entries());payload.retention_percent=Number(payload.retention_percent||0);
    try{await api("/api/subcontractors",{method:"POST",body:JSON.stringify(payload)});closeModal();await loadData();setPage("contractors");toast("সাব-কন্ট্রাক্টর রেজিস্ট্রেশন সংরক্ষণ হয়েছে।")}
    catch(err){toast(err.message,true)}finally{button.disabled=false}
  });
}
(async function init(){
  await checkSession();
})();
