const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user:null, projects:[], contractors:[], page:"dashboard", search:"" };
const titles = {
  dashboard:["ড্যাশবোর্ড","আপনার সব প্রজেক্ট ও আর্থিক কার্যক্রমের নিয়ন্ত্রণকেন্দ্র।"],
  projects:["মেইন প্রজেক্ট","মেইন কোম্পানির কাছ থেকে পাওয়া প্রজেক্টের রেজিস্টার।"],
  contractors:["সাব-কন্ট্রাক্টর","কন্ট্রাক্টরের তথ্য একবার রেজিস্টার করুন; পরে প্রজেক্ট ও ওয়ার্ক অর্ডারের সঙ্গে যুক্ত হবে।"],
  workorders:["ওয়ার্ক অর্ডার","প্রজেক্ট, কন্ট্রাক্টর ও আইটেম রেট যুক্ত করে ওয়ার্ক অর্ডার তৈরি করুন।"],
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
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const button=$("#loginSubmit"),msg=$("#authMessage");button.disabled=true;msg.hidden=true;
  try{
    const result=await fetch("/api/auth/sign-in/email",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value})});
    const data=await result.json().catch(()=>({}));
    if(!result.ok||data.error){msg.textContent=data.message||data.error||"লগইন হয়নি। ইমেইল ও পাসওয়ার্ড যাচাই করুন।";msg.hidden=false;return}
    await checkSession();
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
    const [p,c]=await Promise.all([api("/api/projects"),api("/api/subcontractors")]);
    state.projects=p.projects||[];state.contractors=c.subcontractors||[];
  }catch(err){showNotice(err.message);state.projects=[];state.contractors=[]}
}
function renderPage(){
  const view=$("#pageView");setActions("");
  if(state.page==="dashboard") return renderDashboard(view);
  if(state.page==="projects") return renderProjects(view);
  if(state.page==="contractors") return renderContractors(view);
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
function renderContractors(view){
  setActions('<button class="primary-btn" id="newContractorBtn">＋ নতুন সাব-কন্ট্রাক্টর</button>');
  view.innerHTML='<div class="table-toolbar"><div class="count-note">মোট '+state.contractors.length+' জন কন্ট্রাক্টর · কোনো আলাদা লগইন নেই</div><input class="search-input" id="contractorSearch" placeholder="নাম, ফোন বা কোম্পানি খুঁজুন…"></div><div id="contractorTableWrap">'+contractorTable(state.contractors)+'</div>';
  $("#newContractorBtn").onclick=openContractorForm;
  $("#contractorSearch").addEventListener("input",e=>{const q=e.target.value.toLowerCase();const list=state.contractors.filter(c=>[c.full_name,c.company_name,c.phone,c.email].some(v=>String(v||"").toLowerCase().includes(q)));$("#contractorTableWrap").innerHTML=contractorTable(list)});
}
function contractorTable(list){
  if(!list.length)return '<div class="empty-state"><div class="empty-icon">♙</div><h2>সাব-কন্ট্রাক্টর রেজিস্টার খালি</h2><p>কন্ট্রাক্টরের নাম, ফোন, ঠিকানা ও শর্ত একবার এন্ট্রি করুন। পরের ধাপে তাকে প্রজেক্ট ও ওয়ার্ক অর্ডারের সঙ্গে যুক্ত করা হবে।</p><button class="primary-btn" id="emptyNewContractor">＋ কন্ট্রাক্টর রেজিস্টার</button></div>';
  return '<div class="table-card"><div class="table-scroll"><table><thead><tr><th>কন্ট্রাক্টর</th><th>ফোন / ইমেইল</th><th>ঠিকানা</th><th>ওয়ার্ক অর্ডার</th><th>অ্যাসাইনড মূল্য</th><th>স্ট্যাটাস</th></tr></thead><tbody>'+list.map(c=>'<tr><td><b>'+esc(c.full_name)+'</b><small>'+esc(c.company_name||"ব্যক্তিগত কন্ট্রাক্টর")+'</small></td><td>'+esc(c.phone||"—")+'<small>'+esc(c.email||"")+'</small></td><td>'+esc(c.address||"—")+'</td><td>'+Number(c.work_order_count||0)+'</td><td class="number">'+money(c.assigned_value)+'</td><td><span class="pill '+(c.status==="ACTIVE"?"active-pill":"pending-pill")+'">'+(c.status==="ACTIVE"?"সক্রিয়":"নিষ্ক্রিয়")+'</span></td></tr>').join("")+'</tbody></table></div></div>';
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
