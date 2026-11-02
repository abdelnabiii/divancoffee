(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const api = DV.api, ART = DV.ART, ICON = DV.ICON, money = DV.money, r2 = DV.r2;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const I = b => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  const IC = {
    orders: I(`<path d="M7 3h10l2 3v15H5V6z"/><path d="M9 10h6M9 14h6M9 18h3"/>`),
    menu: I(`<path d="M4 6h16M4 12h16M4 18h10"/>`),
    coupons: ICON.tag, customers: I(`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.8 3.4-6 6.5-6s5.7 2.2 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3.2 2.9 3.5 6"/>`),
    reports: I(`<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>`),
    settings: I(`<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>`),
    edit: I(`<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>`),
    print: I(`<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>`),
    bell: I(`<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>`),
    phone: ICON.phone, wa: ICON.wa, plus: ICON.plus, trash: ICON.trash, x: ICON.x
  };
  function toast(msg, ms = 2600) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms); }
  const ago = iso => { const m = Math.floor((Date.now() - new Date(iso)) / 60000); return m < 1 ? "دلوقتي" : m < 60 ? `من ${m} د` : m < 1440 ? `من ${Math.floor(m / 60)} س` : new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short" }); };
  const clock = iso => new Date(iso).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });

  let SET = {}, CATALOG = { categories: [], products: [] }, ORDERS = [], view = "orders", poll = null, known = null, soundOn = false, actx = null;
  let ofilter = "active";

  /* ---------- مودال ---------- */
  function modal(title, body, foot, mount) {
    const m = $("#modal");
    m.innerHTML = `<div class="mh"><h3>${title}</h3><button type="button" class="x" data-x aria-label="قفل">${IC.x}</button></div><div class="mb">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ""}`;
    m.hidden = false; $("#scrim").hidden = false; document.body.style.overflow = "hidden";
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = closeModal);
    mount && mount(m);
  }
  function closeModal() { $("#modal").hidden = true; $("#scrim").hidden = true; $("#modal").innerHTML = ""; document.body.style.overflow = ""; }
  $("#scrim").onclick = closeModal;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });
  function confirmBox(msg, yes = "أيوه", danger = true) {
    return new Promise(res => {
      modal("تأكيد", `<p style="margin:0">${msg}</p>`, `<button type="button" class="btn ${danger ? "" : "ok"}" id="cfY">${yes}</button><button type="button" class="btn alt" id="cfN">لأ</button>`, () => {
        $("#cfY").onclick = () => { closeModal(); res(true); }; $("#cfN").onclick = () => { closeModal(); res(false); };
      });
    });
  }

  /* ---------- صوت التنبيه ---------- */
  function beep() {
    if (!soundOn || !actx) return;
    const now = actx.currentTime;
    [[880, 0], [1175, .18], [880, .36], [1175, .54]].forEach(([f, t]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.35, now + t + .02); g.gain.exponentialRampToValueAtTime(0.0001, now + t + .16);
      o.connect(g).connect(actx.destination); o.start(now + t); o.stop(now + t + .18);
    });
  }
  function enableSound() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); soundOn = true; beep(); } catch (e) { } }
  let titleTimer = null;
  function flashTitle(n) {
    clearInterval(titleTimer); let on = false;
    if (!n) { document.title = "لوحة التحكم — ديفان كوفي"; return; }
    titleTimer = setInterval(() => { on = !on; document.title = on ? `(${n}) طلب جديد!` : "لوحة التحكم — ديفان كوفي"; if (document.hasFocus() && view === "orders") { clearInterval(titleTimer); document.title = "لوحة التحكم — ديفان كوفي"; } }, 1000);
  }

  /* ---------- التنقل ---------- */
  const TABS = [["orders", "الطلبات"], ["menu", "المنيو"], ["coupons", "الكوبونات"], ["customers", "العملاء"], ["reports", "التقارير"], ["settings", "الإعدادات"]];
  function renderNav() {
    const newCount = ORDERS.filter(o => o.status === "new").length;
    $("#nav").innerHTML = TABS.map(([k, n]) => `<button type="button" class="tab" data-v="${k}" ${view === k ? 'aria-current="page"' : ""}>${IC[k]}<span>${n}</span>${k === "orders" && newCount ? `<span class="cnt num">${newCount}</span>` : ""}</button>`).join("");
  }
  $("#nav").onclick = e => { const b = e.target.closest("[data-v]"); if (b) go(b.dataset.v); };
  function go(v) { view = v; renderNav(); window.scrollTo(0, 0); VIEWS[v](); }

  /* ---------- الطلبات ---------- */
  async function fetchOrders() {
    const list = await api.rpc("admin_orders", { status: "", lim: 300 });
    const ids = new Set(list.map(o => o.id));
    let fresh = [];
    if (known) fresh = list.filter(o => !known.has(o.id) && o.status === "new");
    known = ids; ORDERS = list;
    if (fresh.length) { beep(); flashTitle(ORDERS.filter(o => o.status === "new").length); toast(`طلب جديد #${fresh.map(o => o.id).join("، #")}`, 5000); }
    return fresh.map(o => o.id);
  }
  const FILTERS = {
    active: ["الشغالة", o => !["done", "cancelled"].includes(o.status)],
    new: ["جديد", o => o.status === "new"], preparing: ["بيتحضّر", o => o.status === "preparing"],
    ready: ["جاهز / في الطريق", o => ["ready", "out"].includes(o.status)],
    today: ["كل طلبات النهارده", o => new Date(o.created_at).toDateString() === new Date().toDateString()],
    cancelled: ["اتلغى", o => o.status === "cancelled"]
  };
  function nextActs(o) {
    if (o.status === "new") return [["preparing", "ابدأ التحضير"]];
    if (o.status === "preparing") return o.type === "delivery" ? [["out", "خرج للتوصيل"]] : [["ready", "جاهز"]];
    if (o.status === "ready" || o.status === "out") return [["done", "اتسلّم ✓"]];
    return [];
  }
  function ocard(o, fresh) {
    const typ = o.type === "table" ? `<span class="pill table">ترابيزة ${o.table_no}</span>` : `<span class="pill ${o.type}">${DV.TYPES[o.type]}</span>`;
    const wa = "2" + o.phone;
    return `<article class="ocard ${o.status === "new" ? "new" : ""} ${fresh ? "fresh" : ""}" data-id="${o.id}">
      <div class="oh"><span class="no num">#${o.id}</span>${typ}<span class="pill ${o.status}">${DV.STATUS[o.status]}</span><span class="ago" title="${esc(new Date(o.created_at).toLocaleString("ar-EG"))}">${clock(o.created_at)} · ${ago(o.created_at)}</span></div>
      <div class="who"><b>${esc(o.name)}</b> · <a class="num ltr" href="tel:${esc(o.phone)}">${esc(o.phone)}</a> · <a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">واتساب</a>
        ${o.customer_points != null ? `<small style="color:var(--gold-ink);font-weight:600"> · عضو (${o.customer_points} حبّة)</small>` : ""}
        ${o.address ? `<div class="addr">${esc(o.address)}${o.lat != null ? `<br><a href="https://maps.google.com/?q=${o.lat},${o.lng}" target="_blank" rel="noopener">📍 افتح الموقع على الخريطة</a> <small style="color:var(--muted)">(<span class="num">${o.distance_km}</span> كم من الكافيه)</small>` : ""}</div>` : ""}</div>
      <div class="its">${o.items.map(i => `<div class="it"><span class="q num">${i.qty}×</span><span class="n">${esc(i.name)}${i.options.length ? `<small>${esc(i.options.map(x => x.choice).join(" · "))}</small>` : ""}${i.note ? `<em>📝 ${esc(i.note)}</em>` : ""}</span><span class="num">${money(i.line)}</span></div>`).join("")}</div>
      ${o.notes ? `<div class="note">ملاحظة: ${esc(o.notes)}</div>` : ""}
      <div class="tot">
        ${o.discount ? `<div><span>خصم ${esc(o.coupon || "")}</span><span class="num">−${money(o.discount)}</span></div>` : ""}
        ${o.points_used ? `<div><span>حبّات (${o.points_used})</span><span class="num">−${money(r2(o.subtotal - o.discount - (o.total - o.delivery_fee)))}</span></div>` : ""}
        ${o.delivery_fee ? `<div><span>توصيل</span><span class="num">${money(o.delivery_fee)}</span></div>` : ""}
        <div class="g"><span>المطلوب تحصيله</span><span class="num">${money(o.total)}</span></div>
        ${o.points_earned ? `<div class="pts"><span>حبّات العميل</span><span class="num">${o.status === "done" ? "اتضاف " : o.status === "cancelled" ? "اتلغى " : "هيكسب "}${o.points_earned}</span></div>` : ""}
      </div>
      <div class="act">${nextActs(o).map(([s, l]) => `<button type="button" class="btn main ${s === "done" ? "ok" : ""}" data-s="${s}">${l}</button>`).join("")}
        <button type="button" class="btn alt sm" data-print title="طباعة">${IC.print}</button>
        ${!["done", "cancelled"].includes(o.status) ? `<button type="button" class="btn danger sm" data-s="cancelled">إلغاء</button>` : ""}
        ${o.status === "cancelled" ? `<button type="button" class="btn alt sm" data-s="new">رجّعه</button>` : ""}</div>
    </article>`;
  }
  function paintOrders(fresh = []) {
    if (view !== "orders") return;
    const box = $("#oBox"); if (!box) return;
    $("#oChips").innerHTML = Object.entries(FILTERS).map(([k, [n, f]]) => `<button type="button" class="chip" data-f="${k}" aria-pressed="${ofilter === k}">${n} <b class="num">${ORDERS.filter(f).length}</b></button>`).join("");
    const list = ORDERS.filter(FILTERS[ofilter][1]).sort((a, b) => ofilter === "active" ? a.id - b.id : b.id - a.id);
    box.innerHTML = list.length ? list.map(o => ocard(o, fresh.includes(o.id))).join("") : `<div class="empty" style="grid-column:1/-1">${ofilter === "active" ? "مفيش طلبات شغالة دلوقتي ☕" : "مفيش طلبات هنا"}</div>`;
    renderNav();
  }
  async function vOrders() {
    $("#view").innerHTML = `<div class="ph"><h1>الطلبات</h1><button type="button" class="accept" id="accBtn"></button></div>
      <div class="soundbar" id="soundBar" ${soundOn ? "hidden" : ""}>${IC.bell}<span>فعّل صوت التنبيه عشان تسمع أول ما يجي طلب جديد</span><button type="button" class="btn sm dark" id="sndBtn">فعّل الصوت</button></div>
      <div class="chips" id="oChips"></div><div class="orders" id="oBox"><div class="empty" style="grid-column:1/-1">بنحمّل…</div></div>`;
    paintAccept();
    $("#sndBtn").onclick = () => { enableSound(); $("#soundBar").hidden = true; toast("صوت التنبيه شغال"); };
    $("#oChips").onclick = e => { const b = e.target.closest("[data-f]"); if (b) { ofilter = b.dataset.f; paintOrders(); } };
    $("#oBox").onclick = async e => {
      const card = e.target.closest(".ocard"); if (!card) return;
      const o = ORDERS.find(x => x.id == card.dataset.id);
      if (e.target.closest("[data-print]")) return printOrder(o);
      const b = e.target.closest("[data-s]"); if (!b) return;
      const s = b.dataset.s;
      if (s === "cancelled" && !await confirmBox(`تلغي طلب #${o.id}؟${o.points_used ? " الحبّات اللي استخدمها هترجعله." : ""}`, "ألغي الطلب")) return;
      b.disabled = true;
      try { await api.rpc("admin_set_status", { id: o.id, status: s }); await fetchOrders(); paintOrders(); toast(`#${o.id}: ${DV.STATUS[s]}`); }
      catch (err) { toast(err.message); b.disabled = false; }
    };
    try { await fetchOrders(); paintOrders(); } catch (e) { $("#oBox").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  }
  function paintAccept() {
    const b = $("#accBtn"); if (!b) return;
    b.className = "accept " + (SET.accepting ? "on" : "off");
    b.innerHTML = `<span>${SET.accepting ? "بنستقبل طلبات" : "الطلبات مقفولة"}</span><span class="switch" role="switch" aria-checked="${!!SET.accepting}"></span>`;
    b.onclick = async () => {
      if (SET.accepting && !await confirmBox("تقفل استقبال الطلبات الأونلاين؟ العملاء هيشوفوا المنيو بس مش هيقدروا يطلبوا.", "اقفل")) return;
      try { SET = await api.rpc("admin_save_settings", { s: { ...SET, accepting: !SET.accepting } }); paintAccept(); toast(SET.accepting ? "الطلبات اتفتحت" : "الطلبات اتقفلت"); } catch (e) { toast(e.message); }
    };
  }
  function printOrder(o) {
    const pa = $("#printArea");
    pa.innerHTML = `<div style="width:72mm;font-family:var(--body);font-size:13px;color:#000;padding:4mm">
      <div style="text-align:center"><img src="assets/logo-red.webp" style="height:60px;margin:0 auto;filter:grayscale(1) brightness(0)" alt=""><div style="font-size:22px;font-weight:700">#${o.id}</div>
      <div>${DV.TYPES[o.type]}${o.table_no ? " " + o.table_no : ""} — ${new Date(o.created_at).toLocaleString("ar-EG")}</div></div><hr>
      <div>${esc(o.name)} — <span dir="ltr">${esc(o.phone)}</span></div>${o.address ? `<div>${esc(o.address)}</div>` : ""}<hr>
      ${o.items.map(i => `<div style="display:flex;justify-content:space-between;gap:6px"><span>${i.qty}× ${esc(i.name)}${i.options.length ? `<br><small>${esc(i.options.map(x => x.choice).join(" · "))}</small>` : ""}${i.note ? `<br><small>* ${esc(i.note)}</small>` : ""}</span><span>${money(i.line)}</span></div>`).join("")}<hr>
      ${o.notes ? `<div>ملاحظة: ${esc(o.notes)}</div><hr>` : ""}
      ${o.discount ? `<div style="display:flex;justify-content:space-between"><span>خصم</span><span>−${money(o.discount)}</span></div>` : ""}
      ${o.points_used ? `<div style="display:flex;justify-content:space-between"><span>حبّات</span><span>−${money(r2(o.subtotal - o.discount - (o.total - o.delivery_fee)))}</span></div>` : ""}
      ${o.delivery_fee ? `<div style="display:flex;justify-content:space-between"><span>توصيل</span><span>${money(o.delivery_fee)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px"><span>الإجمالي</span><span>${money(o.total)}</span></div>
      <div style="text-align:center;margin-top:8px">قهوتك على كيفك ☕</div></div>`;
    pa.hidden = false; setTimeout(() => { window.print(); pa.hidden = true; }, 150);
  }

  /* ---------- المنيو ---------- */
  async function vMenu() {
    $("#view").innerHTML = `<div class="ph"><h1>المنيو</h1><input type="search" id="mQ" placeholder="دوّر على صنف…" style="max-width:220px"><button type="button" class="btn alt" id="addCat">${IC.plus}قسم</button><button type="button" class="btn" id="addProd">${IC.plus}صنف</button></div><div id="mBox">بنحمّل…</div>`;
    $("#addProd").onclick = () => editProduct(null);
    $("#addCat").onclick = () => editCategory(null);
    $("#mQ").oninput = paintMenu;
    try { CATALOG = await api.rpc("admin_catalog"); paintMenu(); } catch (e) { $("#mBox").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  }
  function paintMenu() {
    const q = ($("#mQ").value || "").trim();
    const box = $("#mBox");
    box.innerHTML = CATALOG.categories.map(c => {
      const ps = CATALOG.products.filter(p => p.category === c.id && (!q || p.name.includes(q)));
      if (q && !ps.length) return "";
      return `<section class="mcat"><h3>${ART[c.icon] || ART.cup}${esc(c.name)} <small>(${ps.length})${c.active ? "" : " · مخفي"}</small>
        <button type="button" class="btn ghost sm" data-ec="${esc(c.id)}">${IC.edit}تعديل القسم</button></h3>
        ${ps.map(p => `<div class="prow ${p.active ? "" : "off"}" data-p="${esc(p.id)}">
          <span class="th">${p.image ? `<img src="${esc(p.image)}" alt="">` : ART[c.icon] || ART.cup}</span>
          <span class="t"><b>${esc(p.name)}${p.popular ? " ★" : ""}</b><small class="num">${money(p.price)}${(p.options || []).length ? ` · ${p.options.length} اختيارات` : ""}${p.active ? "" : " · مخفي من المنيو"}</small></span>
          <span class="avail"><button type="button" class="switch" role="switch" data-av aria-checked="${p.available !== false}" aria-label="متاح النهارده"></button>${p.available !== false ? "متاح" : "خلص"}</span>
          <button type="button" class="btn ghost sm" data-ep aria-label="تعديل">${IC.edit}</button></div>`).join("") || `<div class="empty" style="padding:14px">مفيش أصناف</div>`}</section>`;
    }).join("") || `<div class="empty">مفيش نتايج</div>`;
    box.onclick = async e => {
      const ec = e.target.closest("[data-ec]"); if (ec) return editCategory(CATALOG.categories.find(c => c.id === ec.dataset.ec));
      const row = e.target.closest("[data-p]"); if (!row) return;
      const p = CATALOG.products.find(x => x.id === row.dataset.p);
      if (e.target.closest("[data-av]")) {
        try { const n = await api.rpc("admin_save_product", { p: { ...p, available: p.available === false } }); Object.assign(p, n); paintMenu(); toast(n.available ? `${p.name}: متاح` : `${p.name}: خلص النهارده`); } catch (err) { toast(err.message); }
        return;
      }
      editProduct(p);
    };
  }
  function editCategory(c) {
    const st = c ? { ...c } : { name: "", icon: "cup", sort: (CATALOG.categories.length + 1), active: true };
    modal(c ? "تعديل القسم" : "قسم جديد", `<div class="field"><label>اسم القسم</label><input type="text" id="cN" value="${esc(st.name)}" maxlength="40"></div>
      <div class="field"><label>الرسمة</label><div class="icons" id="cI">${["cup", "iced", "glass", "juice", "croissant", "beans", "bag"].map(k => `<button type="button" data-i="${k}" aria-pressed="${st.icon === k}">${ART[k]}</button>`).join("")}</div></div>
      <div class="row2"><div class="field"><label>الترتيب</label><input type="number" id="cS" value="${st.sort}"></div>
      <div class="field"><label>ظاهر في المنيو</label><button type="button" class="switch" role="switch" id="cA" aria-checked="${st.active}"></button></div></div><div id="cErr"></div>`,
      `<button type="button" class="btn" id="cSave">حفظ</button>${c ? `<button type="button" class="btn danger" id="cDel">${IC.trash}مسح</button>` : ""}<button type="button" class="btn alt" data-x>إلغاء</button>`, m => {
        $("#cI").onclick = e => { const b = e.target.closest("[data-i]"); if (!b) return; st.icon = b.dataset.i; m.querySelectorAll("#cI button").forEach(x => x.setAttribute("aria-pressed", x === b)); };
        $("#cA").onclick = () => { st.active = !st.active; $("#cA").setAttribute("aria-checked", st.active); };
        $("#cSave").onclick = async () => {
          try { await api.rpc("admin_save_category", { c: { ...st, name: $("#cN").value, sort: $("#cS").value } }); closeModal(); CATALOG = await api.rpc("admin_catalog"); paintMenu(); toast("اتحفظ"); }
          catch (e) { $("#cErr").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
        };
        if (c) $("#cDel").onclick = async () => {
          if (!await confirmBox(`تمسح قسم "${c.name}"؟`, "امسح")) return;
          try { await api.rpc("admin_delete_category", { id: c.id }); CATALOG = await api.rpc("admin_catalog"); paintMenu(); toast("اتمسح"); } catch (e) { toast(e.message, 4000); }
        };
      });
  }
  function editProduct(p) {
    const st = p ? JSON.parse(JSON.stringify(p)) : { name: "", category: (CATALOG.categories[0] || {}).id, price: "", description: "", options: [], popular: false, active: true, available: true, image: "", sort: CATALOG.products.length + 1 };
    st.options = st.options || [];
    const catIcon = () => ART[(CATALOG.categories.find(c => c.id === st.category) || {}).icon] || ART.cup;
    const optsHtml = () => st.options.map((g, gi) => `<div class="og" data-g="${gi}">
      <div class="ogh"><input type="text" data-k="name" value="${esc(g.name)}" placeholder="اسم المجموعة (مثلًا: الحجم)">
        <select data-k="type"><option value="single" ${g.type === "single" ? "selected" : ""}>اختيار واحد</option><option value="multi" ${g.type === "multi" ? "selected" : ""}>أكتر من اختيار</option></select>
        <label style="display:flex;gap:4px;align-items:center;font-size:13px"><input type="checkbox" data-k="required" ${g.required ? "checked" : ""}>مطلوب</label>
        <button type="button" class="btn danger sm" data-dg aria-label="مسح المجموعة">${IC.trash}</button></div>
      <div class="lbls"><span>الاختيار</span><span>+ سعر</span><span>× مضاعف</span><span></span></div>
      ${g.choices.map((c, ci) => `<div class="ch" data-c="${ci}"><input type="text" data-ck="name" value="${esc(c.name)}" placeholder="مثلًا: كبير"><input type="number" data-ck="price" value="${c.price || ""}" placeholder="0" min="0" step="0.5"><input type="number" data-ck="factor" value="${c.factor || ""}" placeholder="—" min="0" step="0.05"><button type="button" class="btn ghost sm" data-dc aria-label="مسح">${IC.x}</button></div>`).join("")}
      <button type="button" class="btn ghost sm" data-ac>${IC.plus}اختيار</button></div>`).join("");
    modal(p ? "تعديل الصنف" : "صنف جديد", `
      <div class="field"><div class="imgpick"><span class="pv" id="pPv">${st.image ? `<img src="${esc(st.image)}" alt="">` : catIcon()}</span>
        <div><label class="btn alt sm" style="cursor:pointer">رفع صورة<input type="file" id="pImg" accept="image/*" hidden></label>
        ${st.image ? `<button type="button" class="btn ghost sm" id="pImgDel">شيل الصورة</button>` : ""}<div class="hint">اختياري — من غيرها بتظهر رسمة القسم</div></div></div></div>
      <div class="field"><label>اسم الصنف</label><input type="text" id="pN" value="${esc(st.name)}" maxlength="60"></div>
      <div class="row2"><div class="field"><label>السعر (جنيه)</label><input type="number" id="pP" value="${st.price}" min="0" step="0.5"></div>
      <div class="field"><label>القسم</label><select id="pC">${CATALOG.categories.map(c => `<option value="${esc(c.id)}" ${c.id === st.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div></div>
      <div class="field"><label>وصف <span style="font-weight:400;color:var(--muted)">(اختياري)</span></label><input type="text" id="pD" value="${esc(st.description)}" maxlength="140" placeholder="مثلًا: مانجو، أناناس، ريحان"></div>
      <div class="card" style="padding:4px 14px;margin-bottom:12px">
        <div class="tog"><span>ظاهر في المنيو</span><button type="button" class="switch" role="switch" data-t="active" aria-checked="${st.active}"></button></div>
        <div class="tog"><span>متاح النهارده<small>اقفله لو الصنف خلص — بيظهر "خلص النهارده"</small></span><button type="button" class="switch" role="switch" data-t="available" aria-checked="${st.available !== false}"></button></div>
        <div class="tog"><span>من الأكثر طلبًا<small>بيظهر في أول الصفحة</small></span><button type="button" class="switch" role="switch" data-t="popular" aria-checked="${!!st.popular}"></button></div>
      </div>
      <div class="field"><label>الاختيارات والإضافات</label><div class="hint" style="margin-bottom:6px">"+ سعر" بيتزوّد على السعر. "× مضاعف" للوزن مثلًا (ربع كيلو = 0.25).</div><div id="pO">${optsHtml()}</div>
        <button type="button" class="btn alt sm" id="pAG" style="justify-self:start">${IC.plus}مجموعة اختيارات</button></div>
      <div class="field"><label>الترتيب</label><input type="number" id="pS" value="${st.sort}" style="max-width:120px"></div><div id="pErr"></div>`,
      `<button type="button" class="btn" id="pSave">حفظ</button>${p ? `<button type="button" class="btn danger" id="pDel">${IC.trash}مسح</button>` : ""}<button type="button" class="btn alt" data-x>إلغاء</button>`, m => {
        const repaintO = () => { $("#pO").innerHTML = optsHtml(); };
        m.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { const k = b.dataset.t; st[k] = !(k === "available" ? st[k] !== false : st[k]); b.setAttribute("aria-checked", k === "available" ? st[k] !== false : st[k]); });
        $("#pC").onchange = () => { st.category = $("#pC").value; if (!st.image) $("#pPv").innerHTML = catIcon(); };
        $("#pAG").onclick = () => { st.options.push({ id: "g" + Math.random().toString(36).slice(2, 7), name: "", type: "single", required: false, choices: [{ name: "" }] }); repaintO(); };
        $("#pO").addEventListener("input", e => {
          const gEl = e.target.closest("[data-g]"); if (!gEl) return; const g = st.options[+gEl.dataset.g];
          if (e.target.dataset.k) g[e.target.dataset.k] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
          const cEl = e.target.closest("[data-c]");
          if (cEl && e.target.dataset.ck) { const c = g.choices[+cEl.dataset.c], k = e.target.dataset.ck, v = e.target.value; if (k === "name") c.name = v; else if (v === "" || +v === 0) delete c[k]; else c[k] = +v; }
        });
        $("#pO").addEventListener("change", e => { if (e.target.dataset.k === "required" || e.target.dataset.k === "type") { const g = st.options[+e.target.closest("[data-g]").dataset.g]; g[e.target.dataset.k] = e.target.type === "checkbox" ? e.target.checked : e.target.value; } });
        $("#pO").addEventListener("click", e => {
          const gEl = e.target.closest("[data-g]"); if (!gEl) return; const gi = +gEl.dataset.g;
          if (e.target.closest("[data-dg]")) { st.options.splice(gi, 1); repaintO(); }
          else if (e.target.closest("[data-ac]")) { st.options[gi].choices.push({ name: "" }); repaintO(); }
          else if (e.target.closest("[data-dc]")) { st.options[gi].choices.splice(+e.target.closest("[data-c]").dataset.c, 1); repaintO(); }
        });
        $("#pImg").onchange = async () => {
          const f = $("#pImg").files[0]; if (!f) return;
          $("#pPv").innerHTML = "…";
          try { st.image = await api.admin.upload(f); $("#pPv").innerHTML = `<img src="${esc(st.image)}" alt="">`; } catch (e) { toast(e.message); $("#pPv").innerHTML = catIcon(); }
        };
        const di = $("#pImgDel"); if (di) di.onclick = () => { st.image = ""; $("#pPv").innerHTML = catIcon(); di.remove(); };
        $("#pSave").onclick = async () => {
          st.name = $("#pN").value; st.price = $("#pP").value; st.description = $("#pD").value; st.sort = $("#pS").value; st.category = $("#pC").value;
          for (const g of st.options) {
            g.name = String(g.name || "").trim(); g.choices = g.choices.filter(c => String(c.name || "").trim());
            g.choices.forEach(c => c.name = c.name.trim());
            if (!g.name) return $("#pErr").innerHTML = `<div class="err">اكتب اسم لكل مجموعة اختيارات</div>`;
            if (!g.choices.length) return $("#pErr").innerHTML = `<div class="err">مجموعة "${esc(g.name)}" محتاجة اختيار واحد على الأقل</div>`;
            if (!g.id) g.id = "g" + Math.random().toString(36).slice(2, 7);
          }
          if (String(st.price).trim() === "") return $("#pErr").innerHTML = `<div class="err">اكتب السعر</div>`;
          $("#pSave").disabled = true;
          try { await api.rpc("admin_save_product", { p: st }); closeModal(); CATALOG = await api.rpc("admin_catalog"); paintMenu(); toast("اتحفظ"); }
          catch (e) { $("#pErr").innerHTML = `<div class="err">${esc(e.message)}</div>`; $("#pSave").disabled = false; }
        };
        if (p) $("#pDel").onclick = async () => {
          if (!await confirmBox(`تمسح "${p.name}" نهائي؟ لو عايز تخفيه بس، اقفل "ظاهر في المنيو".`, "امسح")) return;
          try { await api.rpc("admin_delete_product", { id: p.id }); CATALOG = await api.rpc("admin_catalog"); paintMenu(); toast("اتمسح"); } catch (e) { toast(e.message); }
        };
      });
  }

  /* ---------- الكوبونات ---------- */
  async function vCoupons() {
    $("#view").innerHTML = `<div class="ph"><h1>الكوبونات</h1><button type="button" class="btn" id="addCp">${IC.plus}كود جديد</button></div><div class="card scroll-x" id="cpBox">بنحمّل…</div>`;
    $("#addCp").onclick = () => editCoupon(null);
    try {
      const list = await api.rpc("admin_coupons");
      $("#cpBox").innerHTML = list.length ? `<table class="tbl"><thead><tr><th>الكود</th><th>الخصم</th><th>أقل طلب</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead><tbody>
        ${list.map(c => `<tr><td><b class="ltr">${esc(c.code)}</b></td><td class="num">${c.type === "percent" ? c.value + "%" : money(c.value)}</td><td class="num">${c.min_order ? money(c.min_order) : "—"}</td>
          <td class="num">${c.used}${c.max_uses ? " / " + c.max_uses : ""}</td><td>${c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar-EG") : "—"}</td>
          <td><span class="pill ${c.active ? "ready" : "cancelled"}">${c.active ? "شغال" : "موقوف"}</span></td><td><button type="button" class="btn ghost sm" data-c="${esc(c.code)}">${IC.edit}</button></td></tr>`).join("")}</tbody></table>`
        : `<div class="empty">مفيش كوبونات لسه</div>`;
      $("#cpBox").onclick = e => { const b = e.target.closest("[data-c]"); if (b) editCoupon(list.find(c => c.code === b.dataset.c)); };
    } catch (e) { $("#cpBox").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  }
  function editCoupon(c) {
    const st = c ? { ...c } : { code: "", type: "percent", value: "", min_order: 0, max_uses: 0, active: true, expires_at: null };
    const dt = st.expires_at ? new Date(new Date(st.expires_at) - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    modal(c ? "تعديل الكود" : "كود خصم جديد", `
      <div class="field"><label>الكود</label><input type="text" id="kC" value="${esc(st.code)}" ${c ? "readonly" : ""} dir="ltr" style="text-transform:uppercase" placeholder="SUMMER20" maxlength="20"></div>
      <div class="row2"><div class="field"><label>نوع الخصم</label><select id="kT"><option value="percent" ${st.type === "percent" ? "selected" : ""}>نسبة %</option><option value="fixed" ${st.type === "fixed" ? "selected" : ""}>مبلغ ثابت</option></select></div>
      <div class="field"><label>القيمة</label><input type="number" id="kV" value="${st.value}" min="0"></div></div>
      <div class="row2"><div class="field"><label>أقل طلب (جنيه)</label><input type="number" id="kM" value="${st.min_order || ""}" min="0" placeholder="0"></div>
      <div class="field"><label>أقصى عدد استخدام</label><input type="number" id="kU" value="${st.max_uses || ""}" min="0" placeholder="بدون حد"></div></div>
      <div class="field"><label>ينتهي في <span style="font-weight:400;color:var(--muted)">(اختياري)</span></label><input type="datetime-local" id="kE" value="${dt}"></div>
      <div class="tog"><span>الكود شغال</span><button type="button" class="switch" role="switch" id="kA" aria-checked="${st.active}"></button></div><div id="kErr"></div>`,
      `<button type="button" class="btn" id="kSave">حفظ</button>${c ? `<button type="button" class="btn danger" id="kDel">${IC.trash}مسح</button>` : ""}<button type="button" class="btn alt" data-x>إلغاء</button>`, () => {
        $("#kA").onclick = () => { st.active = !st.active; $("#kA").setAttribute("aria-checked", st.active); };
        $("#kSave").onclick = async () => {
          const e = $("#kE").value;
          try {
            await api.rpc("admin_save_coupon", { c: { code: $("#kC").value, type: $("#kT").value, value: $("#kV").value, min_order: $("#kM").value || 0, max_uses: $("#kU").value || 0, active: st.active, expires_at: e ? new Date(e).toISOString() : null } });
            closeModal(); vCoupons(); toast("اتحفظ");
          } catch (err) { $("#kErr").innerHTML = `<div class="err">${esc(err.message)}</div>`; }
        };
        if (c) $("#kDel").onclick = async () => { if (!await confirmBox(`تمسح كود ${c.code}؟`, "امسح")) return; try { await api.rpc("admin_delete_coupon", { code: c.code }); vCoupons(); toast("اتمسح"); } catch (e) { toast(e.message); } };
      });
  }

  /* ---------- العملاء ---------- */
  async function vCustomers() {
    $("#view").innerHTML = `<div class="ph"><h1>العملاء</h1><input type="search" id="uQ" placeholder="دوّر بالاسم أو الرقم" style="max-width:240px"></div><div class="card scroll-x" id="uBox">بنحمّل…</div>`;
    let t; $("#uQ").oninput = () => { clearTimeout(t); t = setTimeout(load, 300); };
    async function load() {
      try {
        const list = await api.rpc("admin_customers", { q: $("#uQ").value });
        $("#uBox").innerHTML = list.length ? `<table class="tbl"><thead><tr><th>العميل</th><th>الحبّات</th><th>طلبات</th><th>صرف</th><th></th></tr></thead><tbody>
          ${list.map(u => `<tr data-u="${esc(u.id)}"><td><b>${esc(u.name)}</b><br><a class="num ltr" href="tel:${esc(u.phone)}" style="color:var(--muted);text-decoration:none">${esc(u.phone)}</a></td>
            <td class="num"><b style="color:var(--gold-ink)">${u.points}</b>${u.pending ? `<br><small style="color:var(--muted)">+${u.pending} معلّق</small>` : ""}</td><td class="num">${u.orders}</td><td class="num">${money(u.spent)}</td>
            <td style="white-space:nowrap"><button type="button" class="btn alt sm" data-a="pts">حبّات</button> <button type="button" class="btn alt sm" data-a="pass">باسورد</button></td></tr>`).join("")}</tbody></table>`
          : `<div class="empty">${$("#uQ").value ? "مفيش نتايج" : "لسه مفيش عملاء مسجلين"}</div>`;
        $("#uBox").onclick = e => {
          const b = e.target.closest("[data-a]"); if (!b) return;
          const u = list.find(x => x.id === b.closest("[data-u]").dataset.u);
          if (b.dataset.a === "pts") modal(`حبّات ${esc(u.name)}`, `<p style="margin-top:0">الرصيد الحالي: <b class="num">${u.points}</b> حبّة</p>
            <div class="field"><label>زوّد أو اخصم</label><input type="number" id="dP" placeholder="مثلًا 20 أو -20"><span class="hint">رقم بالسالب للخصم</span></div><div id="dErr"></div>`,
            `<button type="button" class="btn" id="dSave">حفظ</button><button type="button" class="btn alt" data-x>إلغاء</button>`, () => {
              $("#dSave").onclick = async () => { try { const n = await api.rpc("admin_adjust_points", { id: u.id, delta: $("#dP").value }); closeModal(); toast(`الرصيد بقى ${n} حبّة`); load(); } catch (e) { $("#dErr").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
            });
          else modal(`باسورد جديد لـ ${esc(u.name)}`, `<p style="margin-top:0;color:var(--muted)">لما العميل ينسى الباسورد: اكتب باسورد جديد وابعتهوله، وهو يقدر يغيّره بعد كده من حسابه.</p>
            <div class="field"><label>الباسورد الجديد</label><input type="text" id="nP" value="${Math.floor(100000 + Math.random() * 900000)}" dir="ltr"></div><div id="nErr"></div>`,
            `<button type="button" class="btn" id="nSave">حفظ</button><a class="btn ok" id="nWa" target="_blank" rel="noopener">${IC.wa}ابعته واتساب</a><button type="button" class="btn alt" data-x>إلغاء</button>`, () => {
              const wa = () => `https://wa.me/2${u.phone}?text=${encodeURIComponent(`أهلًا ${u.name}، الباسورد الجديد لحسابك على موقع ديفان كوفي: ${$("#nP").value}\nتقدر تغيّره من حسابي ← بياناتي.`)}`;
              $("#nWa").href = wa(); $("#nP").oninput = () => $("#nWa").href = wa();
              $("#nSave").onclick = async () => { try { await api.rpc("admin_reset_password", { id: u.id, password: $("#nP").value }); toast("الباسورد اتغيّر — ابعته للعميل"); $("#nSave").disabled = true; } catch (e) { $("#nErr").innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
            });
        };
      } catch (e) { $("#uBox").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    }
    load();
  }

  /* ---------- التقارير ---------- */
  let range = "today";
  async function vReports() {
    const P = { today: "النهارده", yesterday: "امبارح", week: "آخر 7 أيام", month: "الشهر ده" };
    $("#view").innerHTML = `<div class="ph"><h1>التقارير</h1></div><div class="chips" id="rC">${Object.entries(P).map(([k, n]) => `<button type="button" class="chip" data-r="${k}" aria-pressed="${range === k}">${n}</button>`).join("")}</div><div id="rBox">بنحمّل…</div>`;
    $("#rC").onclick = e => { const b = e.target.closest("[data-r]"); if (b) { range = b.dataset.r; vReports(); } };
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    let f = new Date(d0), t = new Date(d0.getTime() + 864e5);
    if (range === "yesterday") { f = new Date(d0.getTime() - 864e5); t = d0; }
    if (range === "week") f = new Date(d0.getTime() - 6 * 864e5);
    if (range === "month") f = new Date(d0.getFullYear(), d0.getMonth(), 1);
    try {
      const s = await api.rpc("admin_stats", { d_from: f.toISOString(), d_to: t.toISOString() });
      const mx = Math.max(1, ...s.top.map(x => x.qty));
      $("#rBox").innerHTML = `<div class="stats">
        <div class="stat"><small>المبيعات</small><b class="num">${money(s.sales)}</b></div><div class="stat"><small>عدد الطلبات</small><b class="num">${s.orders}</b></div>
        <div class="stat"><small>متوسط الطلب</small><b class="num">${money(s.avg)}</b></div><div class="stat"><small>اتلغى</small><b class="num">${s.cancelled}</b></div></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
        <div class="card"><h2 style="margin:0 0 10px;font-size:16px">الأكثر مبيعًا</h2>${s.top.length ? s.top.map(x => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${esc(x.name)}</span><span class="num">${x.qty} · ${money(x.sales)}</span></div><div class="bar"><i style="width:${x.qty / mx * 100}%"></i></div></div>`).join("") : `<div class="empty" style="padding:20px">مفيش مبيعات في الفترة دي</div>`}</div>
        <div class="card"><h2 style="margin:0 0 10px;font-size:16px">حسب نوع الطلب</h2>${["delivery", "pickup", "table"].map(k => `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>${DV.TYPES[k]}</span><span class="num">${s.by_type[k] || 0}</span></div><div class="bar"><i style="width:${(s.by_type[k] || 0) / Math.max(1, s.orders) * 100}%"></i></div></div>`).join("")}</div></div>`;
    } catch (e) { $("#rBox").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  }

  /* ---------- الإعدادات ---------- */
  async function vSettings() {
    const s = SET;
    $("#view").innerHTML = `<div class="ph"><h1>الإعدادات</h1></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));align-items:start">
      <div class="card"><h2 style="margin:0 0 6px;font-size:16px">استقبال الطلبات</h2>
        ${[["accepting", "استقبال الطلبات الأونلاين", "اقفله لو الكافيه مقفول أو زحمة"], ["delivery_enabled", "التوصيل"], ["pickup_enabled", "الاستلام من الكافيه"], ["table_enabled", "الطلب من الترابيزة (QR)"]]
          .map(([k, n, h]) => `<div class="tog"><span>${n}${h ? `<small>${h}</small>` : ""}</span><button type="button" class="switch" role="switch" data-k="${k}" aria-checked="${!!s[k]}"></button></div>`).join("")}
        <div class="row2" style="margin-top:12px"><div class="field"><label>مصاريف التوصيل</label><input type="number" id="sFee" value="${s.delivery_fee}" min="0"></div>
        <div class="field"><label>أقل طلب</label><input type="number" id="sMin" value="${s.min_order}" min="0"></div></div>
        <div class="field"><label>أقصى مسافة للتوصيل (كم)</label><input type="number" id="sRad" value="${s.delivery_radius_km}" min="0.5" max="500" step="0.5"><span class="hint">أي طلب توصيل أبعد من كده من الكافيه بيتقاله "الزون ده مش متاح"</span></div>
        <div class="row2"><div class="field"><label>موقع الكافيه (lat)</label><input type="number" id="sLat" value="${s.cafe_lat}" step="0.000001" dir="ltr"></div>
        <div class="field"><label>موقع الكافيه (lng)</label><input type="number" id="sLng" value="${s.cafe_lng}" step="0.000001" dir="ltr"></div></div>
        <div class="field"><label>ملاحظة التوصيل</label><input type="text" id="sDN" value="${esc(s.delivery_note)}" maxlength="120"></div>
        <div class="field"><label>مواعيد الشغل <span style="font-weight:400;color:var(--muted)">(بتظهر للعملاء)</span></label><input type="text" id="sH" value="${esc(s.hours)}" placeholder="مثلًا: يوميًا من 8 الصبح لـ 2 بالليل" maxlength="80"></div></div>
      <div class="card"><h2 style="margin:0 0 6px;font-size:16px">الحبّات (نقاط الولاء)</h2>
        <div class="row3"><div class="field"><label>نسبة الكاش باك %</label><input type="number" id="sCR" value="${r2(s.cashback_rate * 100)}" min="0" max="50"></div>
        <div class="field"><label>أقصى حبّات للطلب</label><input type="number" id="sCap" value="${s.points_cap}" min="0"></div>
        <div class="field"><label>قيمة الحبّة (جنيه)</label><input type="number" id="sPV" value="${s.point_value}" min="0.01" step="0.01"></div></div>
        <p class="hint" style="margin:0;color:var(--muted);font-size:13px">الحبّات بتتضاف للعميل لما تعلّم الطلب "اتسلّم"، وبترجعله لو الطلب اتلغى.</p>
        <h2 style="margin:16px 0 6px;font-size:16px">التواصل</h2>
        <div class="row2"><div class="field"><label>واتساب الطلبات</label><input type="tel" id="sWA" value="${esc(s.whatsapp)}" dir="ltr"><span class="hint">بكود الدولة: 2010…</span></div>
        <div class="field"><label>رقم التليفون</label><input type="tel" id="sPh" value="${esc(s.phone)}" dir="ltr"></div></div>
        <div class="field"><label>عدد الترابيزات</label><input type="number" id="sT" value="${s.tables_count}" min="1" max="200" style="max-width:120px"></div></div></div>
      <div id="sErr" style="margin-top:12px"></div><button type="button" class="btn" id="sSave" style="margin-top:12px;min-width:180px">حفظ الإعدادات</button>
      <div class="sec card"><div class="ph" style="margin:0 0 10px"><h2 style="margin:0;font-size:16px;margin-inline-end:auto">أكواد QR للترابيزات</h2><button type="button" class="btn alt sm" id="qrPrint">${IC.print}اطبعهم</button></div>
        <p class="hint" style="margin:0 0 12px;color:var(--muted);font-size:13px">حط كل كود على ترابيزته — العميل يمسحه ويطلب، والطلب يوصلك برقم الترابيزة.</p><div class="qrs" id="qrs"></div></div>
      <button type="button" class="btn alt" id="sOut" style="margin-top:18px">خروج من لوحة التحكم</button>`;
    const st = { ...s };
    $("#sOut").onclick = async () => { await api.admin.logout(); location.reload(); };
    $("#view").querySelectorAll(".switch[data-k]").forEach(b => b.onclick = () => { st[b.dataset.k] = !st[b.dataset.k]; b.setAttribute("aria-checked", st[b.dataset.k]); });
    $("#sSave").onclick = async () => {
      $("#sSave").disabled = true;
      try {
        SET = await api.rpc("admin_save_settings", { s: { ...st, delivery_fee: $("#sFee").value, min_order: $("#sMin").value, delivery_note: $("#sDN").value, hours: $("#sH").value,
          cashback_rate: (Number($("#sCR").value) || 0) / 100, points_cap: $("#sCap").value, point_value: $("#sPV").value, whatsapp: $("#sWA").value, phone: $("#sPh").value, tables_count: $("#sT").value,
          delivery_radius_km: $("#sRad").value, cafe_lat: $("#sLat").value, cafe_lng: $("#sLng").value } });
        $("#sErr").innerHTML = ""; toast("الإعدادات اتحفظت"); drawQR();
      } catch (e) { $("#sErr").innerHTML = `<div class="err">${esc(e.message)}</div>`; }
      $("#sSave").disabled = false;
    };
    const base = new URL("./", location.href).href;
    const drawQR = () => {
      $("#qrs").innerHTML = Array.from({ length: SET.tables_count }, (_, i) => {
        const q = qrcode(0, "M"); q.addData(`${base}?t=${i + 1}`); q.make();
        return `<div class="qr">${q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}<b>ترابيزة ${i + 1}</b><small style="color:var(--muted)">امسح واطلب</small></div>`;
      }).join("");
    };
    drawQR();
    $("#qrPrint").onclick = () => {
      const pa = $("#printArea");
      pa.innerHTML = `<div class="qrs" style="padding:8mm">${$("#qrs").innerHTML.replace(/امسح واطلب/g, "امسح الكود واطلب من مكانك ☕")}</div>`;
      pa.hidden = false; setTimeout(() => { window.print(); pa.hidden = true; }, 150);
    };
  }

  const VIEWS = { orders: vOrders, menu: vMenu, coupons: vCoupons, customers: vCustomers, reports: vReports, settings: vSettings };

  /* ---------- الدخول والتشغيل ---------- */
  async function start() {
    $("#loginView").hidden = true; $("#appView").hidden = false;
    try { SET = (await api.rpc("get_catalog")).settings; } catch (e) { toast(e.message); }
    try { await fetchOrders(); } catch (e) { }
    go("orders");
    clearInterval(poll);
    poll = setInterval(async () => {
      try {
        const fresh = await fetchOrders();
        if (view === "orders") paintOrders(fresh); else renderNav();
      } catch (e) { }
    }, 7000);
  }
  $("#loginForm").onsubmit = async e => {
    e.preventDefault(); $("#lBtn").disabled = true; $("#loginErr").innerHTML = "";
    try { await api.admin.login($("#lEmail").value, $("#lPass").value); enableSound(); start(); }
    catch (err) { $("#loginErr").innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    $("#lBtn").disabled = false;
  };
  $("#logoutBtn").onclick = async () => { await api.admin.logout(); location.reload(); };
  if (!api.live) $("#demoBar").hidden = false;
  (async () => { if (await api.admin.session()) start(); else $("#loginView").hidden = false; })();
})();
