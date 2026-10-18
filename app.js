const titles={dashboard:["ড্যাশবোর্ড","আপনার নির্মাণ প্রকল্প ও আর্থিক কার্যক্রমের সারসংক্ষেপ।"],projects:["প্রকল্পসমূহ","প্রকল্পের তথ্য, দায়িত্ব ও অগ্রগতি পরিচালনা করুন।"],boq:["BOQ ও রেট","BOQ item এবং অনুমোদিত রেট পরিচালনা করুন।"],workorders:["ওয়ার্ক অর্ডার","সাব-কন্ট্রাক্টরের কাজ ও অনুমোদিত রেটের snapshot।"],measurements:["কাজের মাপ","সাইটের মাপ, ছবি ও approval workflow।"],billing:["বিল ও পেমেন্ট","বিল, অগ্রিম, retention ও payment ledger।"],workforce:["শ্রমিক ও হাজিরা","হাজিরা, খোরাকি ও শ্রমিক খরচ।"],expenses:["খরচ","প্রকল্প ও অফিসের অনুমোদিত খরচ।"],reports:["রিপোর্ট","Project summary, cashflow ও profit/loss রিপোর্ট।"]};let language="bn";const $=s=>document.querySelector(s);const modal=$("#modal");function showModal(title,text){$("#modalTitle").textContent=title;$("#modalText").textContent=text;modal.hidden=false}$("#closeModal").onclick=$("#modalOk").onclick=()=>modal.hidden=true;modal.addEventListener("click",e=>{if(e.target===modal)modal.hidden=true});$("#menuToggle").onclick=()=>$("#sidebar").classList.toggle("open");document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));btn.classList.add("active");const page=btn.dataset.page;$("#crumb").textContent=titles[page][0];$("#pageTitle").textContent=titles[page][0];$("#pageSubtitle").textContent=titles[page][1];$("#sidebar").classList.remove("open");if(page!=="dashboard")showModal(titles[page][0],"এই মডিউলের UI ও database workflow পরবর্তী phase-এ তৈরি হবে। বর্তমান preview-তে কোনো live record নেই।")}));$("#langToggle").onclick=()=>{language=language==="bn"?"en":"bn";$("#langToggle").textContent=language==="bn"?"EN":"বাংলা";document.documentElement.lang=language;document.querySelectorAll("[data-en][data-bn]").forEach(el=>el.textContent=el.dataset[language]);if(language==="en"){$("#pageTitle").textContent="Dashboard";$("#pageSubtitle").textContent="Overview of your construction projects and financial operations.";$("#crumb").textContent="Dashboard";$("#tableHeading").textContent="Project Overview"}else{$("#pageTitle").textContent="ড্যাশবোর্ড";$("#pageSubtitle").textContent=titles.dashboard[1];$("#crumb").textContent="ড্যাশবোর্ড";$("#tableHeading").textContent="প্রকল্পের অবস্থা"}};$("#quickAction").onclick=()=>showModal(language==="bn"?"নতুন প্রকল্প":"New Project","এটি একটি UI preview। Database ও server-side permission workflow যুক্ত হলে প্রকল্প তৈরি করা যাবে।");$("#viewAll").onclick=()=>document.querySelector('[data-page="projects"]').click();

// Secure sign-in gate. The API verifies the Neon Auth session and SCMS role on the server.
(async function scmsSecureLogin() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  shell.style.display = "none";

  const style = document.createElement("style");
  style.textContent = `
    .scms-auth-wrap{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:linear-gradient(135deg,#102a43,#176b65);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    .scms-auth-card{width:min(100%,430px);background:#fff;border-radius:22px;padding:30px;box-shadow:0 24px 80px #0004;color:#102a43}
    .scms-auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}.scms-auth-mark{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#102a43;color:#fff;font-size:26px;font-weight:800}
    .scms-auth-card h1{font-size:24px;margin:0 0 6px}.scms-auth-muted{color:#64748b;font-size:14px;margin:0 0 22px}
    .scms-auth-card label{display:block;font-size:13px;font-weight:700;margin:14px 0 6px}
    .scms-auth-card input{box-sizing:border-box;width:100%;padding:12px 13px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;background:#fff;color:#102a43}
    .scms-auth-submit{width:100%;border:0;border-radius:10px;padding:13px;margin-top:18px;background:#176b65;color:white;font-size:15px;font-weight:700;cursor:pointer}
    .scms-auth-switch{width:100%;border:0;background:transparent;color:#176b65;padding:12px 4px;cursor:pointer;font-weight:700}
    .scms-auth-message{font-size:13px;line-height:1.55;color:#9a3412;background:#fff7ed;border-radius:10px;padding:10px 12px;margin-top:14px;white-space:pre-wrap}
    .scms-auth-message[hidden]{display:none}.scms-auth-note{font-size:12px;color:#64748b;line-height:1.5;margin-top:12px}
    .scms-user-actions{display:flex;align-items:center;gap:8px;margin-left:8px}.scms-user-email{font-size:12px;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.scms-logout{border:1px solid #cbd5e1;background:white;border-radius:8px;padding:7px 10px;cursor:pointer;color:#102a43}
    @media(max-width:520px){.scms-auth-card{padding:23px}.scms-user-email{display:none}}
  `;
  document.head.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = "scms-auth-wrap";
  wrap.innerHTML = `
    <section class="scms-auth-card" aria-label="SCMS secure login">
      <div class="scms-auth-brand"><div class="scms-auth-mark">S</div><div><strong>SCMS</strong><div style="font-size:10px;letter-spacing:1px;color:#64748b">CONSTRUCTION MANAGEMENT</div></div></div>
      <h1 id="scmsAuthTitle">SCMS-এ লগইন করুন</h1>
      <p class="scms-auth-muted">Sohanur Construction &amp; Manpower Solution</p>
      <form id="scmsAuthForm">
        <div id="scmsNameRow" hidden><label for="scmsAuthName">আপনার নাম</label><input id="scmsAuthName" name="name" autocomplete="name" maxlength="255"></div>
        <label for="scmsAuthEmail">ইমেইল</label><input id="scmsAuthEmail" name="email" type="email" autocomplete="username" required maxlength="254">
        <label for="scmsAuthPassword">পাসওয়ার্ড</label><input id="scmsAuthPassword" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128">
        <button class="scms-auth-submit" id="scmsAuthSubmit" type="submit">লগইন</button>
      </form>
      <button class="scms-auth-switch" id="scmsAuthSwitch" type="button">নতুন অ্যাকাউন্ট তৈরি করুন</button>
      <div class="scms-auth-message" id="scmsAuthMessage" role="status" hidden></div>
      <p class="scms-auth-note">নিরাপত্তার জন্য লগইন ও ভূমিকা সার্ভারে যাচাই হয়। নতুন অ্যাকাউন্ট তৈরি করলেই প্রকল্পের তথ্য দেখার অনুমতি পাওয়া যায় না; SCMS অ্যাডমিনের অনুমোদন প্রয়োজন।</p>
    </section>`;
  document.body.appendChild(wrap);

  let mode = "login";
  const message = wrap.querySelector("#scmsAuthMessage");
  const showMessage = (text) => { message.textContent = text; message.hidden = !text; };
  const switchMode = () => {
    mode = mode === "login" ? "signup" : "login";
    wrap.querySelector("#scmsAuthTitle").textContent = mode === "login" ? "SCMS-এ লগইন করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন";
    wrap.querySelector("#scmsNameRow").hidden = mode !== "signup";
    wrap.querySelector("#scmsAuthName").required = mode === "signup";
    wrap.querySelector("#scmsAuthPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
    wrap.querySelector("#scmsAuthSubmit").textContent = mode === "login" ? "লগইন" : "অ্যাকাউন্ট তৈরি করুন";
    wrap.querySelector("#scmsAuthSwitch").textContent = mode === "login" ? "নতুন অ্যাকাউন্ট তৈরি করুন" : "আগে থেকেই অ্যাকাউন্ট আছে? লগইন করুন";
    showMessage("");
  };
  wrap.querySelector("#scmsAuthSwitch").addEventListener("click", switchMode);

  async function getProfile() {
    const response = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  function showSignedIn(data) {
    wrap.remove();
    shell.style.display = "";
    const topActions = document.querySelector(".top-actions");
    if (topActions && !document.querySelector(".scms-user-actions")) {
      const actions = document.createElement("div");
      actions.className = "scms-user-actions";
      const email = document.createElement("span");
      email.className = "scms-user-email";
      email.textContent = (data.user && data.user.email) || "";
      email.title = email.textContent;
      const logout = document.createElement("button");
      logout.className = "scms-logout";
      logout.type = "button";
      logout.textContent = "লগআউট";
      logout.addEventListener("click", async () => {
        logout.disabled = true;
        try { await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" }); }
        finally { window.location.reload(); }
      });
      actions.append(email, logout);
      topActions.appendChild(actions);
    }
    const notice = document.querySelector(".notice");
    if (notice) {
      notice.innerHTML = "<b>নিরাপদ লগইন সক্রিয়</b> — এই ড্যাশবোর্ডের কিছু সংখ্যা এখনো ডেমো; লাইভ হিসাব/বিল মডিউল আলাদাভাবে সম্পন্ন করতে হবে।";
    }
  }

  try {
    const { response, data } = await getProfile();
    if (response.ok && data.authorized && data.user) {
      showSignedIn(data);
      return;
    }
    if (response.status === 403 && data.error) showMessage(data.error);
  } catch (_) {
    showMessage("সার্ভার সংযোগ পাওয়া যায়নি। Vercel environment variables ও deployment পরীক্ষা করুন।");
  }

  wrap.querySelector("#scmsAuthForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = wrap.querySelector("#scmsAuthSubmit");
    submit.disabled = true;
    showMessage("");
    const payload = {
      email: wrap.querySelector("#scmsAuthEmail").value.trim(),
      password: wrap.querySelector("#scmsAuthPassword").value
    };
    if (mode === "signup") payload.name = wrap.querySelector("#scmsAuthName").value.trim();

    try {
      const response = await fetch(mode === "login" ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        const detail = data.message || data.error || "অনুরোধ সম্পন্ন হয়নি। ইমেইল ও পাসওয়ার্ড পরীক্ষা করুন।";
        showMessage(String(detail));
        return;
      }
      const profile = await getProfile();
      if (profile.response.ok && profile.data.authorized && profile.data.user) {
        showSignedIn(profile.data);
      } else {
        showMessage(profile.data.error || (mode === "signup"
          ? "অ্যাকাউন্ট তৈরি হয়েছে। SCMS অ্যাডমিনের অনুমোদনের পর প্রবেশ করতে পারবেন।"
          : "লগইন হয়েছে, কিন্তু SCMS ভূমিকা অনুমোদিত নয়।"));
      }
    } catch (_) {
      showMessage("সার্ভারের সঙ্গে যোগাযোগ করা যাচ্ছে না। পরে আবার চেষ্টা করুন।");
    } finally {
      submit.disabled = false;
    }
  });
})();
