/* حسابات الأسعار (مشتركة بين الموقع والداشبورد) + نسخة العرض اللي بتشتغل من غير سيرفر.
   نفس القواعد مكتوبة في قاعدة البيانات (supabase/schema.sql) عشان السعر يتحسب على السيرفر. */
(function () {
  const r2 = x => Math.round((Number(x) + Number.EPSILON) * 100) / 100;
  const money = x => {
    const v = r2(x);
    return (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)) + " ج";
  };

  /* selections = { groupId: [choiceIndex, ...] } */
  function lineUnit(product, selections) {
    let base = Number(product.price) || 0, factor = 1;
    const picked = [];
    for (const g of product.options || []) {
      const sel = (selections && selections[g.id]) || [];
      const idx = [...new Set(sel.map(Number))].filter(i => Number.isInteger(i) && g.choices[i]);
      if (g.type === "single" && idx.length > 1) throw new Error(`اختار حاجة واحدة بس في "${g.name}"`);
      if (g.required && idx.length === 0) throw new Error(`لازم تختار ${g.name}`);
      for (const i of idx) {
        const c = g.choices[i];
        base += Number(c.price) || 0;
        if (c.factor) factor *= Number(c.factor);
        picked.push({ group: g.name, choice: c.name });
      }
    }
    return { unit: r2(base * factor), picked };
  }

  function phoneNorm(p) {
    let d = String(p || "").replace(/[٠-٩]/g, c => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, "");
    if (d.startsWith("0020")) d = d.slice(4);
    if (d.startsWith("20") && d.length === 12) d = d.slice(2);
    if (d.length === 10 && d.startsWith("1")) d = "0" + d;
    return /^01[0125]\d{8}$/.test(d) ? d : null;
  }

  function couponDiscount(c, subtotal) {
    if (!c || !c.active) return { ok: false, msg: "الكود ده مش شغال" };
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { ok: false, msg: "الكود ده خلص" };
    if (c.max_uses && c.used >= c.max_uses) return { ok: false, msg: "الكود ده اتستخدم للآخر" };
    if (subtotal < (Number(c.min_order) || 0)) return { ok: false, msg: `الكود ده لطلبات من ${money(c.min_order)}` };
    const d = c.type === "percent" ? r2(subtotal * Number(c.value) / 100) : Number(c.value);
    return { ok: true, discount: r2(Math.min(d, subtotal)), msg: c.type === "percent" ? `خصم ${c.value}%` : `خصم ${money(c.value)}` };
  }

  /* المسافة بالكيلو بين نقطتين (Haversine) — نفس المعادلة في قاعدة البيانات */
  function distKm(lat1, lng1, lat2, lng2) {
    const rad = d => d * Math.PI / 180, R = 6371;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  const validLL = (lat, lng) => lat !== null && lat !== undefined && lng !== null && lng !== undefined && lat !== "" && lng !== "" &&
    isFinite(Number(lat)) && isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
  const ZONE_MSG = r => `الزون ده مش متاح للتوصيل — بنوصّل لحد ${r} كم من الكافيه`;

  const STATUS = {
    new: "جديد", preparing: "بيتحضّر", ready: "جاهز", out: "في الطريق", done: "اتسلّم", cancelled: "اتلغى"
  };
  const TYPES = { delivery: "توصيل", pickup: "استلام من الكافيه", table: "على الترابيزة" };

  window.DV = window.DV || {};
  Object.assign(window.DV, { r2, money, lineUnit, phoneNorm, couponDiscount, distKm, validLL, ZONE_MSG, STATUS, TYPES });

  /* ================= نسخة العرض (localStorage) ================= */
  const KEY = "dv_demo_db_v1";
  const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");
  async function sha(s) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dv|" + s));
    return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = m => { throw new Error(m); };

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      if (v && v.v === 1) { v.settings = Object.assign({}, window.DV_SEED.settings, v.settings); return v; }
    } catch (e) { }
    const S = clone(window.DV_SEED);
    const db = { v: 1, seq: 1000, settings: S.settings, categories: S.categories.map(c => ({ ...c, active: true })),
      products: S.products, coupons: [{ code: "DIVAN10", type: "percent", value: 10, min_order: 100, max_uses: 0, used: 0, active: true, expires_at: null }],
      customers: [], sessions: {}, orders: [] };
    save(db); return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { fail("مساحة المتصفح مليانة"); } }
  const custBy = (db, token) => { const id = token && db.sessions[token]; return id ? db.customers.find(c => c.id === id) : null; };
  const pendingOf = (db, cid) => db.orders.filter(o => o.customer_id === cid && !["done", "cancelled"].includes(o.status)).reduce((s, o) => s + o.points_earned, 0);
  const profile = (db, c) => ({ id: c.id, name: c.name, phone: c.phone, points: c.points, pending: pendingOf(db, c.id) });
  const publicOrder = o => ({ id: o.id, track: o.track, status: o.status, type: o.type, table_no: o.table_no, items: o.items,
    subtotal: o.subtotal, discount: o.discount, coupon: o.coupon, points_used: o.points_used, delivery_fee: o.delivery_fee,
    total: o.total, points_earned: o.points_earned, created_at: o.created_at, name: o.name });
  const publicSettings = s => { const { ...p } = s; return p; };

  const handlers = {
    get_catalog(db) {
      return { settings: publicSettings(db.settings), categories: db.categories.filter(c => c.active).sort((a, b) => a.sort - b.sort),
        products: db.products.filter(p => p.active).sort((a, b) => a.sort - b.sort) };
    },
    validate_coupon(db, { code, subtotal }) {
      const c = db.coupons.find(x => x.code === String(code || "").trim().toUpperCase());
      return c ? couponDiscount(c, Number(subtotal) || 0) : { ok: false, msg: "الكود ده مش موجود" };
    },
    place_order(db, { payload, token }) {
      const order = payload || {};
      const s = db.settings;
      if (!s.accepting) fail("الكافيه مش بيستقبل طلبات أونلاين دلوقتي");
      const type = order.type;
      if (!TYPES[type] || !s[type + "_enabled"]) fail("نوع الطلب ده مش متاح");
      const name = String(order.name || "").trim(); if (name.length < 2) fail("اكتب اسمك");
      const phone = phoneNorm(order.phone); if (!phone) fail("رقم الموبايل مش صح");
      let table_no = null, address = "";
      if (type === "table") { table_no = parseInt(order.table_no, 10); if (!(table_no >= 1 && table_no <= s.tables_count)) fail("رقم الترابيزة مش صح"); }
      let lat = null, lng = null, distance_km = null;
      if (type === "delivery") {
        address = String(order.address || "").trim(); if (address.length < 8) fail("اكتب العنوان بالتفصيل");
        if (!validLL(order.lat, order.lng)) fail("حدد موقعك عشان نتأكد إنك في منطقة التوصيل");
        lat = Number(order.lat); lng = Number(order.lng);
        const d = distKm(Number(s.cafe_lat), Number(s.cafe_lng), lat, lng);
        if (d > Number(s.delivery_radius_km)) fail(ZONE_MSG(s.delivery_radius_km));
        distance_km = Math.round(d * 10) / 10;
      }
      if (!Array.isArray(order.items) || !order.items.length) fail("السلة فاضية");
      if (order.items.length > 40) fail("الطلب كبير أوي، كلمنا على التليفون");
      const items = []; let subtotal = 0;
      for (const it of order.items) {
        const p = db.products.find(x => x.id === it.pid && x.active);
        if (!p) fail("في صنف في السلة مبقاش متاح، شيله وكمّل");
        if (p.available === false) fail(`"${p.name}" خلص النهارده`);
        const qty = parseInt(it.qty, 10); if (!(qty >= 1 && qty <= 50)) fail("الكمية مش صح");
        const { unit, picked } = lineUnit(p, it.sel);
        const line = r2(unit * qty); subtotal = r2(subtotal + line);
        items.push({ pid: p.id, name: p.name, qty, unit, line, options: picked, note: String(it.note || "").slice(0, 120) });
      }
      if (subtotal < (Number(s.min_order) || 0)) fail(`أقل طلب ${money(s.min_order)}`);
      let discount = 0, coupon = null, cref = null;
      if (order.coupon) {
        cref = db.coupons.find(x => x.code === String(order.coupon).trim().toUpperCase());
        const r = cref ? couponDiscount(cref, subtotal) : { ok: false, msg: "الكود ده مش موجود" };
        if (!r.ok) fail(r.msg);
        discount = r.discount; coupon = cref.code;
      }
      const cust = custBy(db, token);
      let points_used = 0;
      const want = Math.max(0, parseInt(order.points, 10) || 0);
      if (want > 0) {
        if (!cust) fail("سجّل دخول عشان تستخدم حبّاتك");
        const pv = Number(s.point_value) || 1;
        points_used = Math.min(want, cust.points, Math.floor((subtotal - discount) / pv));
      }
      const pval = r2(points_used * (Number(s.point_value) || 1));
      const fee = type === "delivery" ? Number(s.delivery_fee) || 0 : 0;
      const net = r2(subtotal - discount - pval);
      const total = r2(net + fee);
      const points_earned = cust ? Math.min(Number(s.points_cap) || 0, Math.floor(r2(net * (Number(s.cashback_rate) || 0)) + 1e-9)) : 0;
      if (cust && points_used) cust.points -= points_used;
      if (cref) cref.used++;
      const o = { id: ++db.seq, track: rand(6), customer_id: cust ? cust.id : null, name, phone, type, table_no, address, lat, lng, distance_km,
        notes: String(order.notes || "").slice(0, 300), items, subtotal, discount, coupon, points_used, delivery_fee: fee, total,
        points_earned, awarded: false, refunded: false, status: "new", created_at: new Date().toISOString() };
      db.orders.push(o);
      return publicOrder(o);
    },
    track_order(db, { track }) { const o = db.orders.find(x => x.track === track); return o ? publicOrder(o) : null; },
    async register(db, { phone, name, password }) {
      const p = phoneNorm(phone); if (!p) fail("رقم الموبايل مش صح");
      if (String(name || "").trim().length < 2) fail("اكتب اسمك");
      if (String(password || "").length < 6) fail("الباسورد لازم 6 حروف أو أرقام على الأقل");
      if (db.customers.some(c => c.phone === p)) fail("الرقم ده متسجّل قبل كده، ادخل بيه");
      const c = { id: rand(8), phone: p, name: String(name).trim(), hash: await sha(password), points: 0, created_at: new Date().toISOString() };
      db.customers.push(c);
      const token = rand(16); db.sessions[token] = c.id;
      return { token, profile: profile(db, c) };
    },
    async login(db, { phone, password }) {
      const p = phoneNorm(phone);
      const c = p && db.customers.find(x => x.phone === p);
      if (!c || c.hash !== await sha(password)) fail("الرقم أو الباسورد غلط");
      const token = rand(16); db.sessions[token] = c.id;
      return { token, profile: profile(db, c) };
    },
    me(db, { token }) { const c = custBy(db, token); return c ? profile(db, c) : null; },
    logout(db, { token }) { delete db.sessions[token]; return true; },
    async change_password(db, { token, old_password, new_password }) {
      const c = custBy(db, token); if (!c) fail("سجّل دخول الأول");
      if (c.hash !== await sha(old_password)) fail("الباسورد القديم غلط");
      if (String(new_password || "").length < 6) fail("الباسورد الجديد لازم 6 حروف أو أرقام على الأقل");
      c.hash = await sha(new_password); return true;
    },
    my_orders(db, { token }) {
      const c = custBy(db, token); if (!c) fail("سجّل دخول الأول");
      return db.orders.filter(o => o.customer_id === c.id).sort((a, b) => b.id - a.id).slice(0, 30).map(publicOrder);
    },

    /* ---------- الأدمن ---------- */
    admin_orders(db, { status, lim }) {
      let list = db.orders.slice().sort((a, b) => b.id - a.id);
      if (status === "active") list = list.filter(o => !["done", "cancelled"].includes(o.status));
      else if (status) list = list.filter(o => o.status === status);
      return clone(list.slice(0, lim || 200)).map(o => {
        const c = o.customer_id && db.customers.find(x => x.id === o.customer_id);
        o.customer_points = c ? c.points : null; return o;
      });
    },
    admin_set_status(db, { id, status }) {
      const o = db.orders.find(x => x.id === Number(id)); if (!o) fail("الطلب مش موجود");
      if (!STATUS[status]) fail("حالة غلط");
      const c = o.customer_id && db.customers.find(x => x.id === o.customer_id);
      if (status === "done" && !o.awarded && c) { c.points += o.points_earned; o.awarded = true; }
      if (status !== "done" && o.awarded && c) { c.points = Math.max(0, c.points - o.points_earned); o.awarded = false; }
      if (status === "cancelled" && !o.refunded && c && o.points_used) { c.points += o.points_used; o.refunded = true; }
      if (status !== "cancelled" && o.refunded && c) { c.points = Math.max(0, c.points - o.points_used); o.refunded = false; }
      o.status = status; return true;
    },
    admin_catalog(db) { return { categories: db.categories.slice().sort((a, b) => a.sort - b.sort), products: db.products.slice().sort((a, b) => a.sort - b.sort) }; },
    admin_save_product(db, { p }) {
      if (!String(p.name || "").trim()) fail("اكتب اسم الصنف");
      if (!(Number(p.price) >= 0)) fail("السعر مش صح");
      if (!db.categories.some(c => c.id === p.category)) fail("اختار القسم");
      const row = { id: p.id || "p" + rand(4), category: p.category, name: String(p.name).trim(), price: Number(p.price),
        description: String(p.description || ""), options: p.options || [], popular: !!p.popular, active: p.active !== false,
        available: p.available !== false, image: p.image || "", sort: Number(p.sort) || 0 };
      const i = db.products.findIndex(x => x.id === row.id);
      if (i >= 0) db.products[i] = row; else db.products.push(row);
      return row;
    },
    admin_delete_product(db, { id }) { db.products = db.products.filter(x => x.id !== id); return true; },
    admin_save_category(db, { c }) {
      if (!String(c.name || "").trim()) fail("اكتب اسم القسم");
      const row = { id: c.id || "c" + rand(3), name: String(c.name).trim(), icon: c.icon || "cup", sort: Number(c.sort) || 0, active: c.active !== false };
      const i = db.categories.findIndex(x => x.id === row.id);
      if (i >= 0) db.categories[i] = row; else db.categories.push(row);
      return row;
    },
    admin_delete_category(db, { id }) {
      if (db.products.some(p => p.category === id)) fail("القسم فيه أصناف، انقلها أو امسحها الأول");
      db.categories = db.categories.filter(x => x.id !== id); return true;
    },
    admin_coupons(db) { return db.coupons; },
    admin_save_coupon(db, { c }) {
      const code = String(c.code || "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(code)) fail("الكود لازم حروف إنجليزي أو أرقام (3–20)");
      if (!["percent", "fixed"].includes(c.type)) fail("نوع الخصم غلط");
      if (!(Number(c.value) > 0) || (c.type === "percent" && Number(c.value) > 100)) fail("قيمة الخصم مش صح");
      const old = db.coupons.find(x => x.code === code);
      const row = { code, type: c.type, value: Number(c.value), min_order: Number(c.min_order) || 0, max_uses: parseInt(c.max_uses, 10) || 0,
        used: old ? old.used : 0, active: c.active !== false, expires_at: c.expires_at || null };
      if (old) Object.assign(old, row); else db.coupons.push(row);
      return row;
    },
    admin_delete_coupon(db, { code }) { db.coupons = db.coupons.filter(x => x.code !== code); return true; },
    admin_customers(db, { q }) {
      const s = String(q || "").trim();
      return db.customers.filter(c => !s || c.phone.includes(s) || c.name.includes(s)).slice(-200).reverse().map(c => {
        const os = db.orders.filter(o => o.customer_id === c.id && o.status === "done");
        return { id: c.id, name: c.name, phone: c.phone, points: c.points, pending: pendingOf(db, c.id), orders: os.length,
          spent: r2(os.reduce((a, o) => a + o.total, 0)), created_at: c.created_at };
      });
    },
    admin_adjust_points(db, { id, delta }) {
      const c = db.customers.find(x => x.id === id); if (!c) fail("العميل مش موجود");
      const d = parseInt(delta, 10); if (!d) fail("اكتب عدد الحبّات");
      c.points = Math.max(0, c.points + d); return c.points;
    },
    async admin_reset_password(db, { id, password }) {
      const c = db.customers.find(x => x.id === id); if (!c) fail("العميل مش موجود");
      if (String(password || "").length < 6) fail("الباسورد لازم 6 حروف أو أرقام على الأقل");
      c.hash = await sha(password);
      for (const t in db.sessions) if (db.sessions[t] === id) delete db.sessions[t];
      return true;
    },
    admin_save_settings(db, { s }) {
      const cur = db.settings;
      const n = (v, lo, hi) => { v = Number(v); if (!(v >= lo && v <= hi)) fail("في رقم في الإعدادات مش منطقي"); return v; };
      const w = String(s.whatsapp ?? cur.whatsapp).replace(/\D/g, "");
      if (!/^20\d{10}$/.test(w)) fail("رقم الواتساب لازم يبدأ بـ 20 (مثال 201000160277)");
      Object.assign(cur, {
        accepting: !!s.accepting, delivery_enabled: !!s.delivery_enabled, pickup_enabled: !!s.pickup_enabled, table_enabled: !!s.table_enabled,
        delivery_fee: n(s.delivery_fee, 0, 1000), min_order: n(s.min_order, 0, 100000), cashback_rate: n(s.cashback_rate, 0, 0.5),
        points_cap: n(s.points_cap, 0, 100000), point_value: n(s.point_value, 0.01, 100), tables_count: n(s.tables_count, 1, 200),
        whatsapp: w, phone: String(s.phone || "").trim(), hours: String(s.hours || "").trim(), delivery_note: String(s.delivery_note || "").trim(),
        origins: Array.isArray(s.origins) ? s.origins : cur.origins,
        cafe_lat: n(s.cafe_lat ?? cur.cafe_lat, -90, 90), cafe_lng: n(s.cafe_lng ?? cur.cafe_lng, -180, 180),
        delivery_radius_km: n(s.delivery_radius_km ?? cur.delivery_radius_km, 0.5, 500)
      });
      return cur;
    },
    admin_stats(db, { d_from, d_to }) {
      const f = new Date(d_from), t = new Date(d_to);
      const os = db.orders.filter(o => { const d = new Date(o.created_at); return d >= f && d < t && o.status !== "cancelled"; });
      const items = {};
      os.forEach(o => o.items.forEach(i => { items[i.name] = items[i.name] || { name: i.name, qty: 0, sales: 0 }; items[i.name].qty += i.qty; items[i.name].sales = r2(items[i.name].sales + i.line); }));
      const by = {}; os.forEach(o => by[o.type] = (by[o.type] || 0) + 1);
      return { orders: os.length, sales: r2(os.reduce((a, o) => a + o.total, 0)), avg: os.length ? r2(os.reduce((a, o) => a + o.total, 0) / os.length) : 0,
        by_type: by, top: Object.values(items).sort((a, b) => b.qty - a.qty).slice(0, 10),
        cancelled: db.orders.filter(o => { const d = new Date(o.created_at); return d >= f && d < t && o.status === "cancelled"; }).length };
    }
  };

  DV.demoBackend = {
    async rpc(name, args) {
      const h = handlers[name]; if (!h) fail("عملية مش معروفة: " + name);
      const db = load();
      const out = await h(db, args || {});
      save(db);
      return clone(out ?? null);
    },
    reset() { localStorage.removeItem(KEY); }
  };
})();
