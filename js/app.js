(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const cfg = window.DV_CONFIG, api = DV.api, ART = DV.ART, ICON = DV.ICON, money = DV.money, r2 = DV.r2;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };

  let CAT = { settings: {}, categories: [], products: [] };
  let cart = store.get("dv_cart", []);
  let form = Object.assign({ type: "", name: "", phone: "", address: "", notes: "" }, store.get("dv_form", {}));
  let token = store.get("dv_token", null), me = null;
  let coupon = { code: "", discount: 0, msg: "", ok: false };
  let usePoints = false, placing = false;
  let tableNo = null;

  const S = () => CAT.settings;
  let loaded = false;
  // أرقام التواصل: من الإعدادات، ولو لسه ما وصلتش (أو السيرفر واقع) من config.js
  const WA = () => String(S().whatsapp || cfg.whatsapp || "").replace(/\D/g, "");
  const TEL = () => String(S().phone || cfg.phone || "");
  const byId = id => CAT.products.find(p => p.id === id);
  const catOf = p => CAT.categories.find(c => c.id === p.category);
  const artFor = p => ART[(catOf(p) || {}).icon] || ART.cup;
  const illFor = p => p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : artFor(p);
  const saveCart = () => { store.set("dv_cart", cart); renderCartBar(); };
  const saveForm = () => store.set("dv_form", form);

  function toast(msg, ms = 2400) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, ms); }

  /* ---------- الترابيزة من الـ QR ---------- */
  (function readTable() {
    const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
    const t = parseInt(q.get("t") || h.get("t") || store.get("dv_table", { n: null, at: 0 }).n, 10);
    const saved = store.get("dv_table", null);
    if (q.get("t") || h.get("t")) store.set("dv_table", { n: t, at: Date.now() });
    else if (saved && Date.now() - saved.at > 90 * 60e3) { store.del("dv_table"); return; }   // 90 دقيقة
    if (t > 0) tableNo = t;
  })();

  /* ---------- الهيدر ---------- */
  function renderHeader() {
    $("#acctBtn").innerHTML = ICON.user;
    const cb = $("#cartBtn"); cb.innerHTML = ICON.cart + `<span class="badge num" id="cartCount" hidden>0</span>`;
    $("#beanBtn").innerHTML = ICON.bean + `<span class="num">${me ? me.points : 0}</span>`;
    $("#beanBtn").setAttribute("aria-label", me ? `حبّاتي: ${me.points}` : "حبّاتي");
    const st = $("#openStatus"); const on = !!S().accepting;
    st.hidden = !loaded;
    st.textContent = on ? "بنستقبل طلبات" : "الطلب الأونلاين مقفول"; st.classList.toggle("off", !on);
    renderCartBar();
  }

  function cartCalc() {
    let subtotal = 0, count = 0; const lines = [];
    for (const it of cart) {
      const p = byId(it.pid); if (!p) continue;
      let unit; try { unit = DV.lineUnit(p, it.sel).unit; } catch (e) { unit = previewUnit(p, it.sel); }
      const line = r2(unit * it.qty); subtotal = r2(subtotal + line); count += it.qty;
      lines.push({ it, p, unit, line });
    }
    return { subtotal, count, lines };
  }
  function renderCartBar() {
    const { subtotal, count } = cartCalc();
    const b = $("#cartCount"); if (b) { b.textContent = count; b.hidden = !count; }
    $("#cartBar").hidden = !count; $("#cbCount").textContent = count; $("#cbTotal").textContent = money(subtotal);
  }

  /* ---------- الهيرو ---------- */
  const MODES = { delivery: ["توصيل", ICON.scooter], pickup: ["استلام", ICON.bag], table: ["ترابيزة", ICON.table] };
  function availableModes() {
    const s = S(); const m = [];
    if (tableNo && s.table_enabled) return ["table"];
    if (s.delivery_enabled) m.push("delivery"); if (s.pickup_enabled) m.push("pickup");
    return m;
  }
  function renderModes() {
    const m = availableModes();
    if (!m.includes(form.type)) form.type = m[0] || "";
    const el = $("#modes"); el.style.setProperty("--n", Math.max(m.length, 1));
    el.hidden = !m.length;
    el.innerHTML = m.map(k => `<button type="button" data-m="${k}" aria-pressed="${form.type === k}">${MODES[k][1]}<span>${k === "table" ? "ترابيزة " + tableNo : MODES[k][0]}</span></button>`).join("");
    el.onclick = e => { const b = e.target.closest("button"); if (!b) return; form.type = b.dataset.m; saveForm(); renderModes(); };
    const tb = $("#tableBan");
    if (tableNo && S().table_enabled) {
      tb.hidden = false;
      tb.innerHTML = ICON.table + `<span>إنت على ترابيزة رقم <b class="num">${tableNo}</b> — اطلب من هنا وهنجيبلك لحد عندك</span><button type="button" id="leaveTable">مش على ترابيزة؟</button>`;
      $("#leaveTable").onclick = leaveTable;
    }
    else tb.hidden = true;
  }
  /* العميل مسح QR الترابيزة وبعدين مشي — يرجع للتوصيل والاستلام */
  function leaveTable() {
    store.del("dv_table"); tableNo = null; form.type = ""; saveForm();
    const u = new URL(location.href); u.searchParams.delete("t");
    if (/(^|&)t=/.test(u.hash.slice(1))) u.hash = "";
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
    renderModes(); toast("تمام — تقدر تطلب توصيل أو استلام");
  }

  /* ---------- المنيو ---------- */
  function previewUnit(p, sel) {
    let base = Number(p.price) || 0, f = 1;
    for (const g of p.options || []) for (const i of (sel && sel[g.id]) || []) { const c = g.choices[i]; if (!c) continue; base += Number(c.price) || 0; if (c.factor) f *= c.factor; }
    return r2(base * f);
  }
  function fromPrice(p) {
    // أقل سعر ممكن (مفيد لأصناف الوزن)
    let base = Number(p.price) || 0, f = 1, hasF = false;
    for (const g of p.options || []) {
      if (!g.required) continue;
      const fs = g.choices.map(c => c.factor || 1), ps = g.choices.map(c => Number(c.price) || 0);
      if (g.choices.some(c => c.factor)) { hasF = true; f *= Math.min(...fs); }
      base += Math.min(...ps);
    }
    return { v: r2(base * f), from: hasF || (p.options || []).some(g => g.required && g.choices.some(c => (Number(c.price) || 0) > 0)) };
  }
  const isKg = p => (p.options || []).some(g => g.choices.some(c => c.factor));
  function priceTag(p) {
    return isKg(p) ? `<span class="price num">${r2(p.price)}<small>/كيلو</small></span>` : `<span class="price num">${r2(p.price)}</span>`;
  }

  function renderMenu() {
    const cats = CAT.categories.filter(c => CAT.products.some(p => p.category === c.id));
    $("#rail").innerHTML = cats.map((c, i) => `<a href="#c-${esc(c.id)}" class="${i ? "" : "on"}">${ART[c.icon] || ART.cup}<span>${esc(c.name)}</span></a>`).join("");
    $("#menuRoot").innerHTML = cats.map(c => {
      const items = CAT.products.filter(p => p.category === c.id);
      const kg = items.some(isKg);
      return `<section class="cat" id="c-${esc(c.id)}" data-cat="${esc(c.id)}">
        <div class="cart-h"><span class="ill">${ART[c.icon] || ART.cup}</span><h2 class="label">${esc(c.name)}</h2></div>
        <div class="items">${items.map(rowHtml).join("")}</div>
        ${kg ? `<p class="note-kg">الأسعار للكيلو — تقدر تطلب ربع أو نص كيلو والسعر بيتحسب لوحده</p>` : ""}
      </section>`;
    }).join("") || `<div class="empty">${ART.cup}<p>المنيو بيتجهّز… ارجع كمان شوية</p></div>`;

    const pops = CAT.products.filter(p => p.popular && p.available !== false).slice(0, 10);
    $("#popWrap").hidden = !pops.length;
    $("#pop").innerHTML = pops.map(p => `<button type="button" class="pcard" data-pid="${esc(p.id)}">
      <span class="add">${ICON.plus}</span><span class="ill">${illFor(p)}</span><span class="nm">${esc(p.name)}</span><span class="pr num">${isKg(p) ? money(p.price) + " / كيلو" : money(fromPrice(p).v)}</span></button>`).join("");

    const o = S().origins || [];
    $("#originsSec").hidden = !o.length;
    $("#origins").innerHTML = o.map(x => `<div class="origin"><span class="ill">${ART.cup}</span><b>${esc(x.name)}</b><small>${esc(x.note || "")}</small></div>`).join("");
    const ask = $("#askBeans"); ask.innerHTML = ICON.wa + "<span>اسأل على الأسعار والكميات</span>";
    ask.href = `https://wa.me/${WA()}?text=${encodeURIComponent("السلام عليكم، عايز أسأل على أسعار البن المتوفر عندكم")}`;
    spy();
  }
  function rowHtml(p) {
    const out = p.available === false;
    return `<button type="button" class="row${out ? " out" : ""}" data-pid="${esc(p.id)}" ${out ? 'aria-disabled="true"' : ""}>
      ${p.image ? `<img class="thumb" src="${esc(p.image)}" alt="" loading="lazy">` : `<span class="plus">${ICON.plus}</span>`}
      <span class="txt"><span class="nmline"><span class="nm">${esc(p.name)}</span>${p.popular ? `<span class="hot">★ الأشهر</span>` : ""}<span class="dots"></span></span>
      ${p.description ? `<span class="ds">${esc(p.description)}</span>` : ""}${out ? `<span class="soldout">خلص النهارده</span>` : ""}</span>
      ${priceTag(p)}</button>`;
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-pid]"); if (!b || b.closest(".sheet")) return;
    const p = byId(b.dataset.pid); if (!p) return;
    if (p.available === false) return toast("الصنف ده خلص النهارده");
    openProduct(p);
  });

  /* تمييز القسم الحالي في الشريط — من غير ما نوقف سكرول الصفحة */
  let spyOn = false, spyCur = null, spyTick = false;
  function spy() {
    spyCur = null; markRail();
    if (spyOn) return; spyOn = true;
    window.addEventListener("scroll", () => { if (!spyTick) { spyTick = true; requestAnimationFrame(() => { spyTick = false; markRail(); }); } }, { passive: true });
  }
  function markRail() {
    const secs = document.querySelectorAll(".cat[data-cat]"); if (!secs.length) return;
    let cur = secs[0].id;
    for (const sec of secs) if (sec.getBoundingClientRect().top <= 150) cur = sec.id;
    if (cur === spyCur) return; spyCur = cur;
    const rail = $("#rail");
    rail.querySelectorAll("a").forEach(a => {
      const on = a.getAttribute("href") === "#" + cur; a.classList.toggle("on", on);
      if (on) {
        // نحرّك الشريط أفقي بس — scrollIntoView كان بيوقف نزول الصفحة
        const r = a.getBoundingClientRect(), rr = rail.getBoundingClientRect();
        const dx = (r.left + r.width / 2) - (rr.left + rr.width / 2);
        if (Math.abs(dx) > 4) rail.scrollBy({ left: dx, behavior: "smooth" });
      }
    });
  }

  /* ---------- زورنا ---------- */
  function renderVisit() {
    const s = S();
    $("#mapCard").href = cfg.mapUrl;
    $("#mapOpen").innerHTML = ICON.pin + "<span>افتح على جوجل ماب</span>";
    $("#heroMap").href = cfg.mapUrl; $("#heroMap").target = "_blank"; $("#heroMap").rel = "noopener";
    $("#heroMap").innerHTML = ICON.pin + "<span>مكاننا</span>";
    const tel = TEL();
    $("#visitLines").innerHTML = `
      <a href="${esc(cfg.mapUrl)}" target="_blank" rel="noopener"><span class="ic">${ICON.pin}</span><span>${esc(cfg.address)}</span></a>
      ${tel ? `<a href="tel:${esc(tel)}"><span class="ic">${ICON.phone}</span><span class="num">${esc(tel)}</span></a>` : ""}
      <a href="https://wa.me/${WA()}" target="_blank" rel="noopener"><span class="ic">${ICON.wa}</span><span>كلمنا واتساب</span></a>
      ${s.hours ? `<div><span class="ic">${ICON.clock}</span><span>${esc(s.hours)}</span></div>` : ""}`;
    const so = cfg.social;
    $("#socials").innerHTML = [["facebook", ICON.fb, "فيسبوك"], ["instagram", ICON.ig, "إنستجرام"], ["tiktok", ICON.tt, "تيك توك"]]
      .filter(x => so[x[0]]).map(x => `<a href="${esc(so[x[0]])}" target="_blank" rel="noopener" aria-label="${x[2]}">${x[1]}</a>`).join("");
    $("#handle").textContent = cfg.handle; $("#credit").textContent = cfg.credit;
  }
  function renderLoyal() {
    const s = S(), pct = Math.round((s.cashback_rate || 0) * 100);
    $("#beans3").innerHTML = ICON.bean + ICON.bean + ICON.bean;
    const loyal = $(".loyal"); loyal.hidden = !pct;
    if (me) {
      $("#loyTitle").textContent = `معاك ${me.points} حبّة`;
      $("#loySub").textContent = me.pending ? `+${me.pending} حبّة جاية بعد ما تستلم طلبك` : `= ${money(me.points * (s.point_value || 1))} تخصمهم من طلبك`;
      $("#loyBtn").textContent = "حسابي";
    } else {
      $("#loyTitle").textContent = `${pct}% حبّات على كل طلب`;
      $("#loySub").textContent = `الحبّة بـ${money(s.point_value || 1).replace(" ج", " جنيه")}، تخصمها من طلبك الجاي`;
      $("#loyBtn").textContent = "سجّل";
    }
  }

  /* ---------- الشيت ---------- */
  let sheetPushed = false, onSheetClose = null;
  function openSheet(html, mount, onClose) {
    const sh = $("#sheet"), sc = $("#scrim");
    if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
    sh.innerHTML = html; sh.hidden = false; sc.hidden = false;
    requestAnimationFrame(() => { sh.classList.add("on"); sc.classList.add("on"); });
    document.body.style.overflow = "hidden"; document.body.classList.add("sheet-open");
    onSheetClose = onClose || null;
    if (!sheetPushed) { history.pushState({ dvSheet: 1 }, ""); sheetPushed = true; }
    sh.querySelectorAll("[data-close]").forEach(b => b.onclick = closeSheet);
    mount && mount(sh);
    const f = sh.querySelector("[autofocus]"); if (f && matchMedia("(min-width:720px)").matches) f.focus();
  }
  function hideSheet() {
    const sh = $("#sheet"), sc = $("#scrim");
    sh.classList.remove("on"); sc.classList.remove("on"); document.body.style.overflow = ""; document.body.classList.remove("sheet-open");
    if (onSheetClose) { const f = onSheetClose; onSheetClose = null; f(); }
    setTimeout(() => { if (!sh.classList.contains("on")) { sh.hidden = true; sc.hidden = true; sh.innerHTML = ""; } }, 280);
  }
  function closeSheet() { if (sheetPushed) { sheetPushed = false; history.back(); } hideSheet(); }
  window.addEventListener("popstate", () => { if (sheetPushed) { sheetPushed = false; hideSheet(); } });
  $("#scrim").onclick = closeSheet;
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const pk = $("#pkX"); if (pk) return pk.click();
    if (!$("#sheet").hidden) closeSheet();
  });
  const head = t => `<div class="sh-head"><h3 id="shTitle">${t}</h3><button type="button" class="xbtn" data-close aria-label="قفل">${ICON.x}</button></div>`;

  /* ---------- شيت الصنف ---------- */
  function openProduct(p, editKey) {
    const existing = editKey ? cart.find(c => c.key === editKey) : null;
    let sel = existing ? JSON.parse(JSON.stringify(existing.sel)) : {};
    let qty = existing ? existing.qty : 1;
    const groups = p.options || [];
    const html = head(esc(p.name)) + `<div class="sh-body">
      <div class="pd-top">${p.image ? `<img class="ph" src="${esc(p.image)}" alt="">` : `<span class="ill">${artFor(p)}</span>`}
        <div><div class="bp num" id="pdBase"></div>${p.description ? `<p>${esc(p.description)}</p>` : ""}</div></div>
      ${groups.map(g => `<div class="grp" data-g="${esc(g.id)}"><h4>${esc(g.name)} <small class="${g.required ? "req" : ""}">${g.required ? "مطلوب" : g.type === "multi" ? "اختار براحتك" : "اختياري"}</small></h4>
        <div class="chips">${g.choices.map((c, i) => `<button type="button" class="chip" data-i="${i}" aria-pressed="false">${esc(c.name)}${c.price ? `<small class="num">+${money(c.price)}${isKg(p) && !c.factor ? " للكيلو" : ""}</small>` : ""}</button>`).join("")}</div></div>`).join("")}
      <div class="field"><label for="pdNote">ملاحظة على الصنف <span style="font-weight:400;color:var(--muted)">(اختياري)</span></label><input id="pdNote" maxlength="120" placeholder="مثلًا: سخن جدًا، من غير رغوة…" value="${esc(existing ? existing.note : "")}"></div>
    </div><div class="sh-foot"><div class="qtyrow">
      <div class="stepper"><button type="button" id="qP" aria-label="زوّد">${ICON.plus}</button><span class="num" id="qN">1</span><button type="button" id="qM" aria-label="قلّل">${ICON.minus}</button></div>
      <button type="button" class="btn" id="addBtn">${existing ? "حدّث السلة" : "ضيف للسلة"}<span class="num" id="addTot"></span></button></div></div>`;
    openSheet(html, sh => {
      const paint = () => {
        sh.querySelectorAll(".grp").forEach(gEl => {
          const s = sel[gEl.dataset.g] || [];
          gEl.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", s.includes(+c.dataset.i)));
        });
        const u = previewUnit(p, sel);
        $("#pdBase").textContent = money(u); $("#qN").textContent = qty; $("#addTot").textContent = money(u * qty);
        $("#qM").disabled = qty <= 1;
      };
      sh.querySelectorAll(".grp").forEach(gEl => {
        const g = groups.find(x => x.id === gEl.dataset.g);
        gEl.onclick = e => {
          const c = e.target.closest(".chip"); if (!c) return;
          const i = +c.dataset.i, cur = sel[g.id] || [];
          if (g.type === "multi") sel[g.id] = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i];
          else sel[g.id] = cur.includes(i) && !g.required ? [] : [i];
          gEl.classList.remove("err"); paint();
        };
      });
      $("#qP").onclick = () => { if (qty < 50) qty++; paint(); };
      $("#qM").onclick = () => { if (qty > 1) qty--; paint(); };
      $("#addBtn").onclick = () => {
        const miss = groups.filter(g => g.required && !(sel[g.id] || []).length);
        if (miss.length) {
          miss.forEach(g => sh.querySelector(`.grp[data-g="${CSS.escape(g.id)}"]`).classList.add("err"));
          sh.querySelector(".grp.err").scrollIntoView({ behavior: "smooth", block: "center" });
          return toast("لازم تختار " + miss.map(g => g.name).join(" و "));
        }
        const note = $("#pdNote").value.trim().slice(0, 120);
        const clean = {}; Object.keys(sel).forEach(k => { if (sel[k].length) clean[k] = sel[k].slice().sort(); });
        const key = p.id + "|" + JSON.stringify(clean) + "|" + note;
        if (existing) cart = cart.filter(c => c.key !== existing.key);
        const same = cart.find(c => c.key === key);
        if (same) same.qty = Math.min(50, same.qty + qty); else cart.push({ key, pid: p.id, sel: clean, qty, note });
        saveCart(); $("#cartBar").classList.remove("bump"); void $("#cartBar").offsetWidth; $("#cartBar").classList.add("bump");
        if (existing) openCart(); else { closeSheet(); toast(`اتضاف: ${p.name}`); }
      };
      paint();
    });
  }

  /* ---------- السلة والطلب ---------- */
  function optText(p, sel) {
    const out = [];
    for (const g of p.options || []) for (const i of (sel && sel[g.id]) || []) if (g.choices[i]) out.push(g.choices[i].name);
    return out.join(" · ");
  }
  function totals() {
    const s = S(), c = cartCalc();
    let discount = coupon.ok ? coupon.discount : 0;
    if (coupon.ok && coupon.calcFor !== c.subtotal) discount = 0; // اتغيرت السلة؛ هنعيد التحقق
    discount = Math.min(discount, c.subtotal);
    const pv = Number(s.point_value) || 1;
    const maxPts = me ? Math.min(me.points, Math.floor((c.subtotal - discount) / pv)) : 0;
    const pts = usePoints ? maxPts : 0;
    const fee = form.type === "delivery" ? Number(s.delivery_fee) || 0 : 0;
    const net = r2(c.subtotal - discount - pts * pv);
    const earn = Math.min(Number(s.points_cap) || 0, Math.floor(r2(net * (Number(s.cashback_rate) || 0)) + 1e-9));
    return { ...c, discount, maxPts, pts, ptsVal: r2(pts * pv), fee, net, total: r2(net + fee), earn };
  }

  async function recheckCoupon() {
    if (!coupon.code) return;
    const sub = cartCalc().subtotal;
    try {
      const r = await api.rpc("validate_coupon", { code: coupon.code, subtotal: sub });
      coupon = { code: coupon.code, ok: !!r.ok, discount: r.discount || 0, msg: r.msg, calcFor: sub };
    } catch (e) { coupon = { code: coupon.code, ok: false, discount: 0, msg: e.message, calcFor: sub }; }
  }

  function openCart() {
    const s = S();
    if (!cart.length) {
      return openSheet(head("السلة") + `<div class="sh-body"><div class="empty">${ART.cup}<p>السلة لسه فاضية</p></div></div>
        <div class="sh-foot"><button type="button" class="btn" data-close>اختار من المنيو</button></div>`);
    }
    const modes = availableModes();
    if (!modes.includes(form.type)) form.type = modes[0] || "";
    const html = head("طلبك") + `<div class="sh-body" id="cartBody"></div><div class="sh-foot" id="cartFoot"></div>`;
    openSheet(html, () => { paintCart(); if (coupon.code) recheckCoupon().then(paintCart); });
  }

  function paintCart(focusId) {
    const body = $("#cartBody"); if (!body) return;
    const s = S(), t = totals(), modes = availableModes();
    const scroll = body.scrollTop;
    const closed = !s.accepting;
    body.innerHTML = `
      ${closed ? `<div class="closed-note">${ICON.clock}<span>الكافيه مش بيستقبل طلبات أونلاين دلوقتي. تقدر تكلمنا على <a href="tel:${esc(TEL())}" class="num">${esc(TEL())}</a></span></div>` : ""}
      <div id="cItems">${t.lines.map(({ it, p, line }) => `<div class="citem" data-k="${esc(it.key)}">
        <span class="ill">${illFor(p)}</span>
        <div class="t"><b>${esc(p.name)}</b><small>${esc(optText(p, it.sel))}${it.note ? ` — ${esc(it.note)}` : ""}</small>
          <button type="button" class="edit" style="font-size:12.5px;color:var(--red);font-weight:600;margin-top:2px">تعديل</button></div>
        <div class="r"><span class="lp num">${money(line)}</span>
          <div class="stepper sm"><button type="button" data-a="inc" aria-label="زوّد">${ICON.plus}</button><span class="num">${it.qty}</span><button type="button" data-a="dec" aria-label="${it.qty > 1 ? "قلّل" : "شيل"}">${it.qty > 1 ? ICON.minus : ICON.trash}</button></div></div></div>`).join("")}</div>

      <h4 style="margin:18px 0 8px">هتستلم إزاي؟</h4>
      ${modes.length ? `<div class="seg" id="segType" style="--n:${modes.length}">${modes.map(k => `<button type="button" data-m="${k}" aria-pressed="${form.type === k}">${MODES[k][1]}<span>${k === "table" ? "ترابيزة " + tableNo : MODES[k][0]}</span></button>`).join("")}</div>` : `<div class="err">مفيش طريقة طلب متاحة دلوقتي</div>`}
      ${form.type === "delivery" && s.delivery_note ? `<div class="field"><span class="hint">${esc(s.delivery_note)} — مصاريف التوصيل ${money(s.delivery_fee)}</span></div>` : ""}
      ${form.type === "delivery" ? locBox() : ""}
      ${form.type === "pickup" ? `<div class="field"><span class="hint">هنبلغك أول ما يجهز — استلمه من الكافيه في X Mall</span></div>` : ""}
      ${form.type === "table" ? `<div class="field"><span class="hint">هنجيبلك الطلب على ترابيزة ${tableNo}، والدفع عند الكاشير</span></div>` : ""}

      <div class="field" id="f-name"><label for="iName">الاسم</label><input id="iName" autocomplete="name" value="${esc(form.name)}" maxlength="60"></div>
      <div class="field" id="f-phone"><label for="iPhone">رقم الموبايل</label><input id="iPhone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" style="text-align:right" placeholder="01xxxxxxxxx" value="${esc(form.phone)}" maxlength="16"></div>
      ${form.type === "delivery" ? `<div class="field" id="f-address"><label for="iAddr">العنوان بالتفصيل</label><textarea id="iAddr" autocomplete="street-address" placeholder="الكمباوند / الشارع، رقم العمارة، الدور، الشقة، علامة مميزة" maxlength="300">${esc(form.address)}</textarea></div>` : ""}
      <div class="field"><label for="iNotes">ملاحظات للطلب <span style="font-weight:400;color:var(--muted)">(اختياري)</span></label><input id="iNotes" value="${esc(form.notes)}" maxlength="300"></div>

      <div class="box"><div class="cpn"><input id="iCoupon" placeholder="كود خصم" value="${esc(coupon.code)}" maxlength="20" aria-label="كود الخصم"><button type="button" id="cpnBtn">${coupon.ok ? "شيله" : "تطبيق"}</button></div>
        ${coupon.msg ? `<div class="msg ${coupon.ok ? "ok" : "bad"}">${esc(coupon.msg)}</div>` : ""}</div>

      ${me ? (me.points > 0 ? `<div class="box beans">${ICON.bean}<div><b>استخدم حبّاتك</b><br><small>معاك ${me.points} حبّة — هتخصم ${money(t.maxPts * (s.point_value || 1))}</small></div>
          <button type="button" class="switch" role="switch" id="ptsSw" aria-checked="${usePoints}" aria-label="استخدم الحبّات"></button></div>` : "")
        : (s.cashback_rate ? `<div class="box beans">${ICON.bean}<div><b>الطلب ده يكسّبك ${Math.min(s.points_cap || 0, Math.floor(r2(t.net * s.cashback_rate) + 1e-9))} حبّة</b><br><small>سجّل دخول قبل ما تطلب عشان تتحسبلك</small></div>
          <button type="button" class="btn alt" id="goLogin" style="flex:none;padding:8px 14px;font-size:14px">دخول</button></div>` : "")}

      <div class="sum">
        <div><span>المجموع</span><span class="num">${money(t.subtotal)}</span></div>
        ${t.discount ? `<div class="neg"><span>خصم ${esc(coupon.code)}</span><span class="num">−${money(t.discount)}</span></div>` : ""}
        ${t.pts ? `<div class="neg"><span>حبّات (${t.pts})</span><span class="num">−${money(t.ptsVal)}</span></div>` : ""}
        ${form.type === "delivery" ? `<div><span>التوصيل</span><span class="num">${t.fee ? money(t.fee) : "مجاني"}</span></div>` : ""}
        <div class="tot"><span>الإجمالي</span><span class="num">${money(t.total)}</span></div>
        ${me && t.earn ? `<div style="color:var(--gold-ink);font-size:14px;font-weight:600"><span>هتكسب بعد الاستلام</span><span class="num">+${t.earn} حبّة</span></div>` : ""}
      </div>
      <div id="placeErr"></div>`;
    const outZone = form.type === "delivery" && zone().state === "out";
    $("#cartFoot").innerHTML = `<button type="button" class="btn" id="placeBtn" ${closed || !modes.length || placing || outZone ? "disabled" : ""}>${placing ? "بنبعت طلبك…" : outZone ? "الزون ده مش متاح للتوصيل" : "أكّد الطلب"}<span class="num">${money(t.total)}</span></button>`;
    body.scrollTop = scroll;

    body.querySelectorAll(".citem").forEach(el => {
      const it = cart.find(c => c.key === el.dataset.k);
      el.querySelector(".stepper").onclick = async e => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.a === "inc") it.qty = Math.min(50, it.qty + 1); else if (it.qty > 1) it.qty--; else cart = cart.filter(c => c !== it);
        saveCart(); if (!cart.length) return openCart();
        paintCart(); if (coupon.code) { await recheckCoupon(); paintCart(); }
      };
      el.querySelector(".edit").onclick = () => { const p = byId(it.pid); if (p) openProduct(p, it.key); };
    });
    const seg = $("#segType"); if (seg) seg.onclick = e => { const b = e.target.closest("button"); if (!b) return; form.type = b.dataset.m; saveForm(); renderModes(); paintCart(); };
    [["iName", "name"], ["iPhone", "phone"], ["iAddr", "address"], ["iNotes", "notes"]].forEach(([id, k]) => {
      const el = $("#" + id); if (el) el.oninput = () => { form[k] = el.value; saveForm(); el.closest(".field").classList.remove("bad"); };
    });
    $("#cpnBtn").onclick = async () => {
      if (coupon.ok) { coupon = { code: "", discount: 0, msg: "", ok: false }; return paintCart(); }
      const code = $("#iCoupon").value.trim().toUpperCase();
      if (!code) { const had = !!coupon.code; coupon = { code: "", discount: 0, msg: "", ok: false }; paintCart(); return had ? toast("اتشال الكود") : toast("اكتب الكود"); }
      coupon.code = code; $("#cpnBtn").disabled = true; await recheckCoupon(); paintCart();
    };
    $("#iCoupon").onkeydown = e => { if (e.key === "Enter") $("#cpnBtn").click(); };
    const sw = $("#ptsSw"); if (sw) sw.onclick = () => { usePoints = !usePoints; paintCart(); };
    const gl = $("#goLogin"); if (gl) gl.onclick = () => openAccount("login", true);
    $("#placeBtn").onclick = place;
    const gb = $("#gpsBtn"); if (gb) gb.onclick = useGps;
    body.querySelectorAll("[data-map]").forEach(b => b.onclick = openPicker);
    const tp = $("#toPickup"); if (tp) tp.onclick = () => { form.type = "pickup"; saveForm(); renderModes(); paintCart(); toast("اتحوّل لاستلام من الكافيه"); };
    if (focusId) { const f = $("#" + focusId); f && f.focus(); }
  }

  /* ---------- منطقة التوصيل ---------- */
  function zone() {
    const s = S(), L = form.loc;
    if (!L || !DV.validLL(L.lat, L.lng)) return { state: "none" };
    const d = DV.distKm(Number(s.cafe_lat), Number(s.cafe_lng), L.lat, L.lng);
    return { state: d <= Number(s.delivery_radius_km) ? "in" : "out", d: Math.round(d * 10) / 10 };
  }
  function locBox() {
    const R = S().delivery_radius_km, z = zone();
    if (z.state === "none") return `<div class="box loc" id="f-loc"><div class="lh">${ICON.pin}<div><b>حدد مكان التوصيل</b><small>عشان نتأكد إنك جوه منطقة التوصيل (لحد ${R} كم من الكافيه)</small></div></div>
      <div class="locbtns"><button type="button" class="btn" id="gpsBtn">${ICON.pin}موقعي الحالي</button><button type="button" class="btn alt" data-map>اختار على الخريطة</button></div></div>`;
    if (z.state === "in") return `<div class="box loc ok" id="f-loc"><div class="lh">${ICON.check}<div><b>في منطقة التوصيل</b><small>على بُعد <span class="num">${z.d}</span> كم من الكافيه</small></div>
      <button type="button" class="lnk" data-map>تعديل</button></div></div>`;
    return `<div class="box loc out" id="f-loc"><div class="lh">${ICON.x}<div><b>الزون ده مش متاح للتوصيل</b><small>المكان ده على بُعد <span class="num">${z.d}</span> كم، وإحنا بنوصّل لحد ${R} كم من الكافيه.</small></div></div>
      <div class="locbtns"><button type="button" class="btn alt" data-map>غيّر المكان</button>${S().pickup_enabled ? `<button type="button" class="btn" id="toPickup">${ICON.bag}استلمه من الكافيه</button>` : ""}</div></div>`;
  }
  function setLoc(lat, lng) {
    form.loc = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }; saveForm();
    const z = zone(); paintCart();
    toast(z.state === "in" ? `تمام — إنت في منطقة التوصيل (${z.d} كم)` : DV.ZONE_MSG(S().delivery_radius_km), 3200);
  }
  function useGps() {
    if (!navigator.geolocation) return toast("الموبايل ده مش بيدعم تحديد الموقع — اختار على الخريطة");
    const b = $("#gpsBtn"); if (b) { b.disabled = true; b.lastChild.textContent = "بنحدد مكانك…"; }
    navigator.geolocation.getCurrentPosition(
      p => setLoc(p.coords.latitude, p.coords.longitude),
      e => { paintCart(); toast(e.code === 1 ? "اسمح للموقع يعرف مكانك، أو اختار على الخريطة" : "معرفناش نحدد مكانك — اختار على الخريطة", 3500); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }
  let leafletP = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletP) return leafletP;
    leafletP = new Promise((res, rej) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "vendor/leaflet/leaflet.css?v=5"; document.head.appendChild(css);
      const js = document.createElement("script"); js.src = "vendor/leaflet/leaflet.js?v=5"; js.onload = res; js.onerror = () => { leafletP = null; rej(); };
      document.head.appendChild(js);
    });
    return leafletP;
  }
  async function openPicker() {
    const s = S(), cafe = [Number(s.cafe_lat), Number(s.cafe_lng)], R = Number(s.delivery_radius_km);
    try { await loadLeaflet(); } catch (e) { return toast("الخريطة مش راضية تحمّل — جرّب موقعي الحالي"); }
    const el = document.createElement("div"); el.className = "picker"; el.id = "picker";
    el.innerHTML = `<div class="pk-head"><button type="button" class="xbtn" id="pkX" aria-label="قفل">${ICON.x}</button><b>حرّك الخريطة وحط الدبوس على مكانك</b></div>
      <div class="pk-map" id="pkMap"></div><div class="pk-pin">${ICON.pin}</div>
      <button type="button" class="pk-gps" id="pkGps" aria-label="موقعي الحالي">${ICON.pin}</button>
      <div class="pk-foot"><div id="pkInfo" class="pk-info"></div><button type="button" class="btn" id="pkOk">أكّد المكان ده</button></div>`;
    document.body.appendChild(el);
    const start = form.loc && DV.validLL(form.loc.lat, form.loc.lng) ? [form.loc.lat, form.loc.lng] : cafe;
    const map = L.map("pkMap", { zoomControl: true, attributionControl: true }).setView(start, form.loc ? 16 : 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    L.circle(cafe, { radius: R * 1000, color: "#961a12", weight: 2, fillColor: "#961a12", fillOpacity: .06 }).addTo(map);
    L.marker(cafe, { icon: L.divIcon({ className: "pk-cafe", html: `<span>ديفان</span>`, iconSize: [54, 26], iconAnchor: [27, -8] }) }).addTo(map);
    window.__dvMap = map;
    // الدبوس لازم يبقى في نص الخريطة بالظبط (مش نص الشاشة) — ده المكان اللي بيتحفظ
    const mapEl = $("#pkMap"), pin = el.querySelector(".pk-pin");
    const placePin = () => { pin.style.top = (mapEl.offsetTop + mapEl.offsetHeight / 2) + "px"; };
    const ro = new ResizeObserver(placePin); ro.observe(mapEl); placePin();
    const info = () => {
      const c = map.getCenter(), d = Math.round(DV.distKm(cafe[0], cafe[1], c.lat, c.lng) * 10) / 10, ok = d <= R;
      $("#pkInfo").innerHTML = ok ? `<span class="okc">✓ جوه منطقة التوصيل</span> · <span class="num">${d}</span> كم` : `<span class="outc">✗ الزون ده مش متاح</span> · <span class="num">${d}</span> كم (الحد ${R} كم)`;
      $("#pkOk").disabled = !ok;
    };
    map.on("move", info); info();
    const close = () => { ro.disconnect(); map.remove(); el.remove(); window.__dvMap = null; };
    $("#pkX").onclick = close;
    $("#pkOk").onclick = () => { const c = map.getCenter(); close(); setLoc(c.lat, c.lng); };
    $("#pkGps").onclick = () => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 17),
      () => toast("معرفناش نحدد مكانك"), { enableHighAccuracy: true, timeout: 12000 });
    setTimeout(() => map.invalidateSize(), 50);
  }

  async function place() {
    if (placing) return;
    const bad = id => { const f = $("#" + id); f.classList.add("bad"); f.scrollIntoView({ behavior: "smooth", block: "center" }); f.querySelector("input,textarea").focus(); };
    form.name = form.name.trim();
    if (form.name.length < 2) { bad("f-name"); return toast("اكتب اسمك"); }
    if (!DV.phoneNorm(form.phone)) { bad("f-phone"); return toast("رقم الموبايل لازم 11 رقم ويبدأ بـ 01"); }
    if (form.type === "delivery") {
      const z = zone();
      if (z.state === "none") { const f = $("#f-loc"); f.classList.add("need"); f.scrollIntoView({ behavior: "smooth", block: "center" }); return toast("حدد مكانك الأول عشان نتأكد إن التوصيل متاح"); }
      if (z.state === "out") return toast(DV.ZONE_MSG(S().delivery_radius_km));
    }
    if (form.type === "delivery" && form.address.trim().length < 8) { bad("f-address"); return toast("اكتب العنوان بالتفصيل"); }
    if (coupon.code && !coupon.ok) return toast("كود الخصم مش شغال — شيله أو صحّحه");
    const t = totals();
    placing = true; paintCart();
    try {
      const payload = { type: form.type, name: form.name, phone: form.phone, address: form.type === "delivery" ? form.address : "",
        lat: form.type === "delivery" && form.loc ? form.loc.lat : null, lng: form.type === "delivery" && form.loc ? form.loc.lng : null,
        notes: form.notes, table_no: form.type === "table" ? tableNo : null, coupon: coupon.ok ? coupon.code : null, points: t.pts,
        items: cart.map(c => ({ pid: c.pid, qty: c.qty, sel: c.sel, note: c.note })) };
      const o = await api.rpc("place_order", { payload, token });
      const tracks = store.get("dv_tracks", []); tracks.unshift({ id: o.id, track: o.track, at: Date.now() }); store.set("dv_tracks", tracks.slice(0, 20));
      cart = []; saveCart(); coupon = { code: "", discount: 0, msg: "", ok: false }; usePoints = false;
      if (me) await refreshMe();
      placing = false;
      openTrack(o, true);
    } catch (e) {
      placing = false; paintCart();
      $("#placeErr").innerHTML = `<div class="err" style="margin-top:12px">${esc(e.message)}</div>`;
      $("#placeErr").scrollIntoView({ behavior: "smooth", block: "center" });
      try { CAT = await api.rpc("get_catalog"); renderAll(); paintCart(); $("#placeErr").innerHTML = `<div class="err" style="margin-top:12px">${esc(e.message)}</div>`; } catch (x) { }
    }
  }

  function waText(o) {
    const lines = [`طلب جديد من الموقع #${o.id}`, `الاسم: ${o.name || form.name}`, `النوع: ${DV.TYPES[o.type]}${o.table_no ? " " + o.table_no : ""}`, ""];
    o.items.forEach(i => lines.push(`• ${i.qty}× ${i.name}${i.options.length ? " (" + i.options.map(x => x.choice).join("، ") + ")" : ""}${i.note ? " — " + i.note : ""} = ${money(i.line)}`));
    lines.push("", `الإجمالي: ${money(o.total)}`);
    if (o.type === "delivery" && form.loc) lines.push(`الموقع: https://maps.google.com/?q=${form.loc.lat},${form.loc.lng}`);
    return lines.join("\n");
  }

  /* ---------- متابعة الطلب ---------- */
  const FLOW = { delivery: ["new", "preparing", "out", "done"], pickup: ["new", "preparing", "ready", "done"], table: ["new", "preparing", "ready", "done"] };
  const FLOW_LBL = { new: ["استلمنا", ICON.check], preparing: ["بنحضّر", ICON.clock], ready: ["جاهز", ICON.bag], out: ["في الطريق", ICON.scooter], done: ["اتسلّم", ICON.gift] };
  function openTrack(o, fresh) {
    let timer = null;
    const draw = o => {
      const flow = FLOW[o.type] || FLOW.pickup, idx = flow.indexOf(o.status);
      const cancelled = o.status === "cancelled";
      const body = $("#trackBody"); if (!body) return;
      body.innerHTML = `<div class="track">
        ${fresh ? `<p style="margin:0;color:var(--ok);font-weight:700">طلبك وصلنا ✓</p>` : ""}
        <div class="no num">#${o.id}</div><small style="color:var(--muted)">${DV.TYPES[o.type]}${o.table_no ? " " + o.table_no : ""} · ${new Date(o.created_at).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}</small>
        ${cancelled ? `<div class="err" style="margin-top:16px">الطلب ده اتلغى. لو في مشكلة كلمنا على <a class="num" href="tel:${esc(TEL())}">${esc(TEL())}</a></div>`
          : `<div class="steps" style="--n:${flow.length}">${flow.map((st, i) => `<div class="s ${i < idx || o.status === "done" ? "done" : i === idx ? "cur done" : ""}"><i>${FLOW_LBL[st][1]}</i>${FLOW_LBL[st][0]}</div>`).join("")}</div>`}
        </div>
        <div class="box">${o.items.map(i => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;padding:3px 0"><span>${i.qty}× ${esc(i.name)}${i.options.length ? `<small style="color:var(--muted)"> (${esc(i.options.map(x => x.choice).join("، "))})</small>` : ""}</span><span class="num">${money(i.line)}</span></div>`).join("")}
          <div class="sum" style="margin-top:8px">
          ${o.discount ? `<div class="neg"><span>خصم</span><span class="num">−${money(o.discount)}</span></div>` : ""}
          ${o.points_used ? `<div class="neg"><span>حبّات</span><span class="num">−${money(o.subtotal - o.discount - (o.total - o.delivery_fee))}</span></div>` : ""}
          ${o.delivery_fee ? `<div><span>التوصيل</span><span class="num">${money(o.delivery_fee)}</span></div>` : ""}
          <div class="tot"><span>الإجمالي</span><span class="num">${money(o.total)}</span></div></div></div>
        ${o.points_earned && !cancelled ? `<div class="box beans">${ICON.bean}<div><b>${o.status === "done" ? "اتضافلك" : "هيتضافلك"} ${o.points_earned} حبّة</b><br><small>${o.status === "done" ? "تقدر تستخدمهم في طلبك الجاي" : "أول ما تستلم الطلب"}</small></div></div>` : ""}`;
    };
    openSheet(head("متابعة الطلب") + `<div class="sh-body" id="trackBody"></div><div class="sh-foot" style="display:flex;gap:8px">
      <a class="btn green" id="waBtn" target="_blank" rel="noopener">${ICON.wa}ابعته واتساب</a><button type="button" class="btn alt" data-close>تمام</button></div>`, () => {
      draw(o);
      $("#waBtn").href = `https://wa.me/${WA()}?text=${encodeURIComponent(waText(o))}`;
      const tick = async () => {
        try { const n = await api.rpc("track_order", { track: o.track }); if (n) { const changed = n.status !== o.status; o = n; draw(o); if (changed && o.status === "done" && me) refreshMe(); } } catch (e) { }
        if (!["done", "cancelled"].includes(o.status)) timer = setTimeout(tick, 8000);
      };
      timer = setTimeout(tick, 6000);
    }, () => clearTimeout(timer));
  }

  /* ---------- الحساب ---------- */
  async function refreshMe() {
    if (!token) { me = null; renderHeader(); renderLoyal(); return; }
    try { me = await api.rpc("me", { token }); if (!me) { token = null; store.del("dv_token"); } }
    catch (e) { /* نسيبه زي ما هو لو النت فاصل */ }
    renderHeader(); renderLoyal();
  }

  function openAccount(tab, backToCart) {
    if (!me) {
      tab = tab === "register" ? "register" : "login";
      const s = S(), pct = Math.round((s.cashback_rate || 0) * 100);
      openSheet(head("حسابك في ديفان") + `<div class="sh-body">
        <div class="pts-hero" style="margin-bottom:14px">${ICON.bean.replace("<svg", '<svg class="bg"')}<div><b style="font-family:var(--head);font-size:20px">${pct}% حبّات على كل طلب</b><small>الحبّة بجنيه — بتتضاف بعد ما تستلم طلبك وتخصمها من أي طلب بعده</small></div></div>
        <div class="tabs" role="tablist"><button type="button" role="tab" data-t="login" aria-selected="${tab === "login"}">دخول</button><button type="button" role="tab" data-t="register" aria-selected="${tab === "register"}">حساب جديد</button></div>
        <div id="aErr"></div>
        <form id="aForm" novalidate>
          ${tab === "register" ? `<div class="field"><label for="aName">الاسم</label><input id="aName" autocomplete="name" value="${esc(form.name)}" maxlength="60" required></div>` : ""}
          <div class="field"><label for="aPhone">رقم الموبايل</label><input id="aPhone" type="tel" inputmode="tel" dir="ltr" style="text-align:right" autocomplete="tel" value="${esc(form.phone)}" placeholder="01xxxxxxxxx" required></div>
          <div class="field"><label for="aPass">الباسورد</label><input id="aPass" type="password" autocomplete="${tab === "register" ? "new-password" : "current-password"}" minlength="6" required>${tab === "register" ? `<span class="hint">6 حروف أو أرقام على الأقل</span>` : ""}</div>
          <button class="btn" style="width:100%;margin-top:16px" id="aBtn">${tab === "register" ? "اعمل الحساب" : "ادخل"}</button>
          ${tab === "login" ? `<button type="button" id="forgot" style="margin:12px auto 0;display:block;color:var(--red);font-size:14px;font-weight:600">نسيت الباسورد؟</button>` : ""}
        </form></div>`, sh => {
        sh.querySelector(".tabs").onclick = e => { const b = e.target.closest("button"); if (b) openAccount(b.dataset.t, backToCart); };
        const f = $("#forgot"); if (f) f.onclick = () => {
          const ph = $("#aPhone").value.trim();
          const msg = encodeURIComponent(`السلام عليكم، نسيت باسورد حسابي على موقع ديفان كوفي${ph ? " — رقمي: " + ph : ""}`);
          $("#aErr").innerHTML = `<div class="box" style="margin:0 0 10px">ابعتلنا واتساب وهنغيّرلك الباسورد في دقيقة: <a href="https://wa.me/${WA()}?text=${msg}" target="_blank" rel="noopener" style="color:var(--red);font-weight:700">ابعت دلوقتي</a><br><small style="color:var(--muted)">بعد ما تدخل تقدر تغيّره بنفسك من حسابك.</small></div>`;
        };
        $("#aForm").onsubmit = async e => {
          e.preventDefault();
          const btn = $("#aBtn"); btn.disabled = true; $("#aErr").innerHTML = "";
          try {
            const args = { phone: $("#aPhone").value, password: $("#aPass").value };
            if (tab === "register") args.name = $("#aName").value;
            const r = await api.rpc(tab === "register" ? "register" : "login", args);
            token = r.token; store.set("dv_token", token); me = r.profile;
            form.phone = me.phone; if (!form.name) form.name = me.name; saveForm();
            renderHeader(); renderLoyal();
            toast(tab === "register" ? `أهلًا ${me.name}! حسابك جاهز` : `أهلًا ${me.name}`);
            if (backToCart && cart.length) openCart(); else openAccount();
          } catch (err) { $("#aErr").innerHTML = `<div class="err">${esc(err.message)}</div>`; btn.disabled = false; }
        };
      });
      return;
    }
    const s = S(); tab = tab || "orders";
    openSheet(head(`أهلًا ${esc(me.name)}`) + `<div class="sh-body">
      <div class="pts-hero">${ICON.bean.replace("<svg", '<svg class="bg"')}<div><div class="big num">${me.points}</div><small>حبّة = ${money(me.points * (s.point_value || 1))} تخصمهم من طلبك</small>${me.pending ? `<small style="color:#ffd99a;font-weight:600">+${me.pending} حبّة جاية بعد استلام طلباتك</small>` : ""}</div></div>
      <div class="tabs" role="tablist" style="margin-top:14px"><button type="button" role="tab" data-t="orders" aria-selected="${tab === "orders"}">طلباتي</button><button type="button" role="tab" data-t="profile" aria-selected="${tab === "profile"}">بياناتي</button></div>
      <div id="accBody"><div class="skel"></div><div class="skel"></div></div></div>`, async sh => {
      sh.querySelector(".tabs").onclick = e => { const b = e.target.closest("button"); if (b) openAccount(b.dataset.t); };
      const box = $("#accBody");
      if (tab === "profile") {
        box.innerHTML = `<div class="box" style="margin-top:0"><b>${esc(me.name)}</b><br><span class="num" style="color:var(--muted)">${esc(me.phone)}</span></div>
          <h4 style="margin:18px 0 0">غيّر الباسورد</h4><div id="pErr"></div>
          <div class="field"><label for="pOld">الباسورد الحالي</label><input id="pOld" type="password" autocomplete="current-password"></div>
          <div class="field"><label for="pNew">الباسورد الجديد</label><input id="pNew" type="password" autocomplete="new-password" minlength="6"></div>
          <button type="button" class="btn" style="width:100%;margin-top:12px" id="pBtn">حفظ الباسورد</button>
          <button type="button" class="btn alt" style="width:100%;margin-top:10px" id="logout">خروج</button>`;
        $("#pBtn").onclick = async () => {
          $("#pBtn").disabled = true;
          try { await api.rpc("change_password", { token, old_password: $("#pOld").value, new_password: $("#pNew").value }); toast("الباسورد اتغيّر"); $("#pOld").value = $("#pNew").value = ""; $("#pErr").innerHTML = ""; }
          catch (e) { $("#pErr").innerHTML = `<div class="err" style="margin-top:10px">${esc(e.message)}</div>`; }
          $("#pBtn").disabled = false;
        };
        $("#logout").onclick = async () => { try { await api.rpc("logout", { token }); } catch (e) { } token = null; me = null; store.del("dv_token"); usePoints = false; renderHeader(); renderLoyal(); closeSheet(); toast("خرجت من حسابك"); };
        return;
      }
      try {
        const list = await api.rpc("my_orders", { token });
        if (!$("#accBody")) return;
        box.innerHTML = list.length ? list.map(o => `<div class="ord"><div class="h"><b class="num">#${o.id}</b><span class="pill ${esc(o.status)}">${DV.STATUS[o.status]}</span></div>
          <small>${new Date(o.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })} · ${DV.TYPES[o.type]} · <span class="num">${money(o.total)}</span>${o.points_earned && o.status !== "cancelled" ? ` · ${o.status === "done" ? "+" : "⏳ "}${o.points_earned} حبّة` : ""}</small>
          <div style="font-size:13.5px;margin-top:4px">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join("، ")}</div>
          <div class="acts"><button type="button" data-re="${o.id}">${ICON.repeat}اطلبه تاني</button>${!["done", "cancelled"].includes(o.status) ? `<button type="button" data-tr="${o.id}">${ICON.clock}تابع</button>` : ""}</div></div>`).join("")
          : `<div class="empty">${ART.cup}<p>لسه مطلبتش حاجة — أول طلب يكسّبك حبّات</p></div>`;
        box.onclick = e => {
          const re = e.target.closest("[data-re]"), tr = e.target.closest("[data-tr]");
          if (tr) return openTrack(list.find(o => o.id == tr.dataset.tr));
          if (re) reorder(list.find(o => o.id == re.dataset.re));
        };
      } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    });
  }

  function reorder(o) {
    let added = 0, skipped = 0;
    for (const i of o.items) {
      const p = byId(i.pid);
      if (!p || p.available === false) { skipped++; continue; }
      const sel = {}; let ok = true;
      for (const pk of i.options) {
        const g = (p.options || []).find(g => g.name === pk.group); const ci = g ? g.choices.findIndex(c => c.name === pk.choice) : -1;
        if (ci < 0) { ok = false; break; } (sel[g.id] = sel[g.id] || []).push(ci);
      }
      if (!ok) { skipped++; continue; }
      Object.keys(sel).forEach(k => sel[k].sort());
      const key = p.id + "|" + JSON.stringify(sel) + "|" + (i.note || "");
      const same = cart.find(c => c.key === key);
      if (same) same.qty = Math.min(50, same.qty + i.qty); else cart.push({ key, pid: p.id, sel, qty: i.qty, note: i.note || "" });
      added++;
    }
    saveCart();
    if (!added) return toast("الأصناف دي مبقتش متاحة");
    openCart(); if (skipped) toast(`${skipped} صنف مبقاش متاح فاتشال`);
  }

  /* ---------- التشغيل ---------- */
  function renderAll() { renderHeader(); renderModes(); renderMenu(); renderVisit(); renderLoyal(); }

  $("#heroArt").innerHTML = ART.hero; $("#sprig").innerHTML = ART.sprig;
  $("#cartBtn").onclick = openCart; $("#cartBarBtn").onclick = openCart;
  $("#acctBtn").onclick = () => openAccount();
  $("#beanBtn").onclick = () => openAccount();
  $("#loyBtn").onclick = () => openAccount(me ? "orders" : "register");
  if (api.demo) $("#demoBar").hidden = false;
  renderHeader(); renderVisit();

  /* ---------- تحميل المنيو ---------- */
  let booting = false;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SKEL = `<div class="skel"></div>`.repeat(4);
  function loadNote(msg) { $("#menuRoot").innerHTML = SKEL + `<p class="loadnote" role="status">${esc(msg)}</p>`; }
  function loadError(e) {
    const tel = TEL(), wa = WA();
    $("#menuRoot").innerHTML = `<div class="empty loaderr" role="alert">${ART.cup}<p><b>المنيو ما اتحمّلش</b><br>${esc(e.message)}</p>
      <button type="button" class="btn" id="retryBtn">جرّب تاني</button>
      ${tel || wa ? `<p class="alt">أو اطلب على طول: ${tel ? `<a href="tel:${esc(tel)}" class="num">${esc(tel)}</a>` : ""}${tel && wa ? " · " : ""}${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">واتساب</a>` : ""}</p>` : ""}</div>`;
    $("#retryBtn").onclick = () => { $("#menuRoot").innerHTML = SKEL; boot(); };
  }
  async function boot() {
    if (booting || loaded) return;
    booting = true;
    for (let attempt = 1; ; attempt++) {
      try { CAT = await api.rpc("get_catalog"); break; }
      catch (e) {
        // نحاول تلات مرات (النت بيقطع على الموبايل)، وبعدها رسالة واضحة وزرار
        if (attempt >= 3 || e.kind === "setup" || e.kind === "offline") { booting = false; loadError(e); return; }
        loadNote("بنحاول نوصل للسيرفر…");
        await sleep(1500 * attempt);
      }
    }
    booting = false; loaded = true;
    cart = cart.filter(c => byId(c.pid)); saveCart();
    renderAll();
    refreshMe();
    // لو في طلب لسه شغال، نوري زرار متابعة
    const tracks = store.get("dv_tracks", []).filter(t => Date.now() - t.at < 6 * 3600e3);
    if (tracks.length) {
      const o = await api.rpc("track_order", { track: tracks[0].track }).catch(() => null);
      if (o && !["done", "cancelled"].includes(o.status)) {
        const b = document.createElement("button"); b.type = "button"; b.className = "tbtn"; b.setAttribute("aria-label", "متابعة الطلب");
        b.innerHTML = ICON.clock; b.onclick = () => openTrack(o);
        $("#cartBtn").before(b);
      }
    }
  }
  window.addEventListener("online", () => { if (!loaded && !booting) { $("#menuRoot").innerHTML = SKEL; boot(); } });
  boot();
  setInterval(async () => { if (!loaded) return boot(); try { const c = await api.rpc("get_catalog"); const was = JSON.stringify(CAT); if (JSON.stringify(c) !== was) { CAT = c; renderAll(); } } catch (e) { } }, 90000);
})();
