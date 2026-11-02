/* End-to-end RPC tests for the Divan Coffee backend — run with the ANON key only.
   Calls every RPC the site uses, plus negative/security tests.

   Real project:
     SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=… \
     ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=… node tests/rpc.test.js
   (ADMIN_PASSWORD is read from the environment only and never printed.)

   Local stand-in (tests/local/stack.js) passes ADMIN_JWT / NONADMIN_JWT instead.

   What it leaves behind on a real project: a few orders (all cancelled at the end,
   names start with "اختبار"), test customers with phones 0155…, and NO coupons/products
   (test ones are deleted). tests/cleanup.sql removes the orders/customers. */
const URL_ = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL_ || !ANON) { console.error("Set SUPABASE_URL and SUPABASE_ANON_KEY"); process.exit(2); }

let pass = 0, fail = 0; const fails = [];
const ok = (cond, name, extra) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; fails.push(name); console.log("  ✗ " + name + (extra !== undefined ? "  → " + JSON.stringify(extra).slice(0, 300) : "")); } };
const section = s => console.log("\n" + s);
const rnd = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
const phone = () => "0155" + rnd(7);
const IP = `10.${rnd(2) % 250}.${rnd(2) % 250}.${rnd(2) % 250}`;   // only honoured by the local stand-in

// New-style keys (sb_publishable_…) go in `apikey` only; a JWT (legacy anon key or a user session) also goes in Authorization.
const authH = jwt => (jwt && !jwt.startsWith("sb_") ? { Authorization: "Bearer " + jwt } : {});
async function call(name, args, jwt = ANON, extraHeaders = {}) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST",
    headers: { apikey: ANON, ...authH(jwt), "Content-Type": "application/json", "X-Forwarded-For": IP, ...extraHeaders },
    body: JSON.stringify(args || {}) });
  const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) return { error: (data && data.message) || txt, code: data && data.code, status: r.status };
  if (data && typeof data === "object" && !Array.isArray(data) && data._err) return { error: data._err, soft: true };
  return { data };
}
const rpcOk = async (name, args, jwt) => { const r = await call(name, args, jwt); if (r.error) throw new Error(`${name}: ${r.error}`); return r.data; };

async function adminToken() {
  if (process.env.ADMIN_JWT) return process.env.ADMIN_JWT;
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return null;
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }) });
  const j = await r.json(); if (!j.access_token) throw new Error("admin sign-in failed: " + (j.error_description || j.msg || r.status));
  return j.access_token;
}

(async () => {
  const ADMIN = await adminToken();
  const cat = await rpcOk("get_catalog");
  const S = cat.settings;
  const P = id => cat.products.find(p => p.id === id);
  const inside = { lat: Number(S.cafe_lat) + 0.01, lng: Number(S.cafe_lng) + 0.01 };
  const base = (o = {}) => ({ type: "pickup", name: "اختبار " + rnd(3), phone: phone(), notes: "", items: [{ pid: "p009", qty: 1, sel: {} }], ...o });
  const placed = [];
  const place = async (payload, token) => { const r = await call("place_order", { payload, token }); if (r.data) placed.push(r.data.id); return r; };

  section("Catalog");
  ok(cat.categories.length >= 1 && cat.products.length >= 1, `get_catalog: ${cat.categories.length} categories, ${cat.products.length} products`);
  ok(cat.products.every(p => p.active !== false), "get_catalog returns only active products");
  ok(S && S.cafe_lat && S.delivery_radius_km, "settings present");

  section("Direct table access with the anon key is blocked");
  for (const t of ["categories", "products", "settings", "coupons", "customers", "customer_sessions", "orders", "admins", "auth_events"]) {
    const r = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: ANON, ...authH(ANON) } });
    const body = await r.text();
    ok(r.status === 401 || r.status === 403 || r.status === 404, `GET ${t} → ${r.status}`, body);
  }
  {
    const r = await fetch(`${URL_}/rest/v1/orders`, { method: "POST", headers: { apikey: ANON, ...authH(ANON), "Content-Type": "application/json" },
      body: JSON.stringify({ track: "x", name: "x", phone: "x", type: "pickup", items: [], subtotal: 0, total: 0 }) });
    ok(r.status >= 400, `INSERT orders directly → ${r.status}`);
    const r2 = await fetch(`${URL_}/rest/v1/customers?id=neq.0`, { method: "PATCH", headers: { apikey: ANON, ...authH(ANON), "Content-Type": "application/json" }, body: '{"points":99999}' });
    ok(r2.status >= 400, `UPDATE customers directly → ${r2.status}`);
    const r3 = await call("line_unit", { p_options: [], p_price: 1, p_sel: {} });
    ok(!!r3.error, `private helpers not exposed (rpc/line_unit → ${r3.status})`);
  }

  section("Anon cannot call any admin_* function");
  const adminCalls = { admin_orders: { status: "", lim: 5 }, admin_set_status: { id: 1, status: "done" }, admin_catalog: {},
    admin_save_product: { p: { name: "x", price: 1, category: "hot" } }, admin_delete_product: { id: "p001" },
    admin_save_category: { c: { name: "x" } }, admin_delete_category: { id: "hot" }, admin_coupons: {},
    admin_save_coupon: { c: { code: "HACK1", type: "percent", value: 100 } }, admin_delete_coupon: { code: "DIVAN10" },
    admin_customers: { q: "" }, admin_adjust_points: { id: "x", delta: "100" }, admin_reset_password: { id: "x", password: "123456" },
    admin_save_settings: { s: { ...S, accepting: false } }, admin_stats: { d_from: "2020-01-01", d_to: "2030-01-01" } };
  for (const [n, a] of Object.entries(adminCalls)) { const r = await call(n, a); ok(!!r.error && !r.data, `anon ${n} → ${r.status} ${r.code || ""}`, r); }
  const ia = await call("is_admin"); ok(ia.data === false, "is_admin() is false for anon");
  if (process.env.NONADMIN_JWT) {
    const r = await call("admin_orders", { status: "", lim: 5 }, process.env.NONADMIN_JWT);
    ok(r.error && r.code === "42501", "signed-in non-admin user is refused (42501)", r);
    const r2 = await call("admin_save_settings", { s: { ...S, accepting: false } }, process.env.NONADMIN_JWT);
    ok(!!r2.error, "signed-in non-admin cannot change settings");
  }

  section("Coupons (validate)");
  const v0 = await rpcOk("validate_coupon", { code: "NOPE-" + rnd(4), subtotal: 500 });
  ok(v0.ok === false && v0.msg === "الكود ده مش موجود", "unknown code → الكود ده مش موجود", v0);

  section("place_order — validation and server-side pricing");
  {
    const r = await place(base({ items: [{ pid: "p009", qty: 2, sel: { sugar: [0] }, unit: 0.01, price: 0.01, line: 0 }],
      subtotal: 1, total: 1, discount: 999, delivery_fee: 0 }));
    const exp = Number(P("p009").price) * 2;
    ok(r.data && r.data.subtotal === exp && r.data.total === exp && r.data.discount === 0, `tampered prices ignored → total ${r.data && r.data.total} (expected ${exp})`, r);
    ok(r.data && !("phone" in r.data) && !("address" in r.data) && !("client_ip" in r.data), "public order hides phone/address/ip");
    ok(r.data && /^[0-9a-f]{24}$/.test(r.data.track), "tracking code is 96-bit random");
  }
  {
    const p = P("p053");    // توليفة سبيشيال 1000/kg: ¼ kg, spiced +120, dark +80 → (1000+120+80)*0.25 = 300
    const r = await place(base({ items: [{ pid: "p053", qty: 1, sel: { weight: [0], spice: [1], roast: [2], grind: [0] } }] }));
    ok(r.data && r.data.total === 300, `kg product priced by DB: ${r.data && r.data.total} (expected 300)`, r);
    ok(r.data && r.data.items[0].options.length === 4, "picked options recorded");
    const r2 = await place(base({ items: [{ pid: "p053", qty: 1, sel: { weight: [0] } }] }));
    ok(r2.error === "لازم تختار التحويجة", "missing required option rejected", r2);
    const r3 = await place(base({ items: [{ pid: "p053", qty: 1, sel: { weight: [0, 1], spice: [0], roast: [0], grind: [0] } }] }));
    ok(r3.error === 'اختار حاجة واحدة بس في "الوزن"', "two choices in a single group rejected", r3);
    const r4 = await place(base({ items: [{ pid: "p009", qty: 1, sel: { sugar: [99, -1, "x"] } }] }));
    ok(r4.data && r4.data.total === Number(P("p009").price), "out-of-range choice indexes ignored", r4);
    void p;
  }
  ok((await place(base({ items: [{ pid: "nope", qty: 1 }] }))).error === "في صنف في السلة مبقاش متاح، شيله وكمّل", "unknown product rejected");
  ok((await place(base({ items: [{ pid: "p009", qty: 51 }] }))).error === "الكمية مش صح", "qty > 50 rejected");
  ok((await place(base({ items: [{ pid: "p009", qty: 0 }] }))).error === "الكمية مش صح", "qty 0 rejected");
  ok((await place(base({ items: Array.from({ length: 41 }, () => ({ pid: "p009", qty: 1 })) }))).error === "الطلب كبير أوي، كلمنا على التليفون", "41 lines rejected");
  ok((await place(base({ notes: "x".repeat(40000) }))).error === "الطلب كبير أوي، كلمنا على التليفون", "40 KB payload rejected");
  ok((await place(base({ items: [] }))).error === "السلة فاضية", "empty cart rejected");
  ok((await place(base({ name: "a" }))).error === "اكتب اسمك", "short name rejected");
  ok((await place(base({ phone: "12345" }))).error === "رقم الموبايل مش صح", "bad phone rejected");
  ok((await place(base({ type: "teleport" }))).error === "نوع الطلب ده مش متاح", "bad type rejected");
  {
    const r = await place(base({ phone: "+20 155 " + rnd(7).replace(/^(.{3})/, "$1 ") }));
    ok(r.data, "+20 formatted phone normalised", r);
  }

  section("Delivery zone");
  {
    const r = await place(base({ type: "delivery", address: "عمارة 5 شارع 90 التجمع", ...inside }));
    ok(r.data && r.data.delivery_fee === Number(S.delivery_fee) && r.data.total === Number(P("p009").price) + Number(S.delivery_fee), `inside radius accepted, fee ${S.delivery_fee}`, r);
    const out = await place(base({ type: "delivery", address: "كورنيش إسكندرية عمارة 1", lat: 31.2001, lng: 29.9187 }));
    ok(out.error === `الزون ده مش متاح للتوصيل — بنوصّل لحد ${S.delivery_radius_km} كم من الكافيه`, "address outside the radius rejected", out);
    const nol = await place(base({ type: "delivery", address: "عمارة 5 شارع 90 التجمع", lat: "", lng: "" }));
    ok(nol.error === "حدد موقعك عشان نتأكد إنك في منطقة التوصيل", "delivery without location rejected", nol);
    const na = await place(base({ type: "delivery", address: "قريب", ...inside }));
    ok(na.error === "اكتب العنوان بالتفصيل", "short address rejected", na);
  }
  section("Table orders");
  {
    const r = await place(base({ type: "table", table_no: 3 }));
    ok(r.data && r.data.table_no === 3 && r.data.type === "table", "table 3 accepted", r);
    const bad = await place(base({ type: "table", table_no: Number(S.tables_count) + 1 }));
    ok(bad.error === "رقم الترابيزة مش صح", "table beyond tables_count rejected", bad);
  }

  section("Rate limit per phone");
  {
    const ph = phone(); let last;
    for (let i = 0; i < 6; i++) last = await place(base({ phone: ph }));
    ok(last.error === "طلبات كتير في وقت قصير — استنى شوية أو كلمنا على التليفون", "6th order in 10 min from one phone rejected", last);
  }

  if (/127\.0\.0\.1|localhost/.test(URL_)) {   // the client IP can only be faked against the local stand-in
    section("Rate limit per client IP (local only)");
    const ip = "10.250." + (Math.floor(Math.random() * 250)) + ".9"; let last;
    for (let i = 0; i < 41; i++) last = await call("place_order", { payload: base() }, ANON, { "X-Forwarded-For": ip });
    ok(last.error === "طلبات كتير في وقت قصير — استنى شوية أو كلمنا على التليفون", "41st order in 10 min from one IP rejected", last);
  }

  section("Tracking");
  {
    const r = await place(base());
    const t = await rpcOk("track_order", { track: r.data.track });
    ok(t && t.id === r.data.id && t.status === "new", "track_order returns the order");
    ok((await rpcOk("track_order", { track: "0".repeat(24) })) === null, "unknown track → null");
    ok((await rpcOk("track_order", { track: "' or 1=1 --" })) === null, "malformed track → null");
  }

  section("Customer accounts");
  const ph = phone(), pw = "pw" + rnd(6);
  const reg = await rpcOk("register", { phone: ph, name: "اختبار عميل", password: pw });
  ok(reg.token && reg.token.length === 64 && reg.profile.points === 0 && reg.profile.phone === ph, "register returns token + profile", reg.profile);
  ok((await call("register", { phone: ph, name: "تاني", password: pw })).error === "الرقم ده متسجّل قبل كده، ادخل بيه", "duplicate phone rejected");
  ok((await call("register", { phone: phone(), name: "اختبار", password: "123" })).error === "الباسورد لازم 6 حروف أو أرقام على الأقل", "short password rejected");
  let tok = reg.token;
  const me = await rpcOk("me", { token: tok }); ok(me && me.phone === ph, "me() with token");
  ok((await rpcOk("me", { token: "f".repeat(64) })) === null, "me() with forged token → null");
  const lg = await call("login", { phone: ph, password: pw }); ok(lg.data && lg.data.token, "login with correct password", lg);
  ok((await call("login", { phone: ph, password: "wrong!!" })).error === "الرقم أو الباسورد غلط", "wrong password rejected (Arabic)");
  ok((await call("login", { phone: phone(), password: "whatever" })).error === "الرقم أو الباسورد غلط", "unknown phone gives the same message");
  ok((await call("change_password", { token: tok, old_password: "nope", new_password: "newpass1" })).error === "الباسورد القديم غلط", "change_password checks old password");
  ok((await rpcOk("change_password", { token: tok, old_password: pw, new_password: pw + "x" })) === true, "change_password ok");
  ok((await rpcOk("me", { token: lg.data.token })) === null, "other sessions signed out after password change");
  ok((await call("login", { phone: ph, password: pw + "x" })).data, "login with the new password");

  section("Login throttling");
  {
    const p2 = phone(), pw2 = "pw" + rnd(6);
    await rpcOk("register", { phone: p2, name: "اختبار قفل", password: pw2 });
    for (let i = 0; i < 5; i++) await call("login", { phone: p2, password: "bad" + i });
    const r = await call("login", { phone: p2, password: pw2 });
    ok(r.error === "محاولات غلط كتير — استنى ربع ساعة وجرّب تاني", "6th attempt blocked even with the right password", r);
  }

  section("Points: earn, use, refund");
  {
    const o1 = await place(base({ items: [{ pid: "p009", qty: 1, sel: {} }] }), tok);   // لاتيه
    const net = Number(P("p009").price);
    const earn = Math.min(Number(S.points_cap), Math.floor(Math.round(net * Number(S.cashback_rate) * 100) / 100 + 1e-9));
    ok(o1.data && o1.data.points_earned === earn, `logged-in order earns ${earn} points`, o1.data && o1.data.points_earned);
    ok((await rpcOk("me", { token: tok })).pending === earn, "points pending until done");
    const noauth = await place(base({ points: 5 }));
    ok(noauth.error === "سجّل دخول عشان تستخدم حبّاتك", "points without login rejected");
    if (ADMIN) {
      const pts = async () => (await rpcOk("me", { token: tok })).points;
      await rpcOk("admin_set_status", { id: o1.data.id, status: "done" }, ADMIN);
      ok(await pts() === earn, `done → +${earn}`);
      await rpcOk("admin_set_status", { id: o1.data.id, status: "done" }, ADMIN);
      ok(await pts() === earn, "done twice does not double-award");
      await rpcOk("admin_set_status", { id: o1.data.id, status: "preparing" }, ADMIN);
      ok(await pts() === 0, "back to preparing → points reversed");
      await rpcOk("admin_set_status", { id: o1.data.id, status: "done" }, ADMIN);
      ok(await pts() === earn, "done again → awarded again");
      const o2 = await place(base({ points: 9999, items: [{ pid: "p009", qty: 1 }] }), tok);
      ok(o2.data && o2.data.points_used === earn && o2.data.total === r2(net - earn * Number(S.point_value)), `uses all ${earn} points, capped at balance`, o2.data);
      ok(await pts() === 0, "points deducted at order time");
      await rpcOk("admin_set_status", { id: o2.data.id, status: "cancelled" }, ADMIN);
      ok(await pts() === earn, "cancel → used points refunded");
      await rpcOk("admin_set_status", { id: o2.data.id, status: "cancelled" }, ADMIN);
      ok(await pts() === earn, "cancel twice does not double-refund");
      await rpcOk("admin_set_status", { id: o2.data.id, status: "new" }, ADMIN);
      ok(await pts() === 0, "un-cancel → refund reversed");
      await rpcOk("admin_set_status", { id: o2.data.id, status: "cancelled" }, ADMIN);
      const mine = await rpcOk("my_orders", { token: tok });
      ok(Array.isArray(mine) && mine[0].id === o2.data.id, `my_orders lists ${mine.length} orders, newest first`);
    }
  }

  if (!ADMIN) { console.log("\n(no admin credentials → admin tests skipped)"); return finish(); }

  section("Admin: coupons (limits and expiry)");
  {
    const c1 = "T" + rnd(6), c2 = "X" + rnd(6), c3 = "M" + rnd(6);
    await rpcOk("admin_save_coupon", { c: { code: c1, type: "fixed", value: 10, min_order: 0, max_uses: 1, active: true } }, ADMIN);
    await rpcOk("admin_save_coupon", { c: { code: c2.toLowerCase(), type: "percent", value: 50, max_uses: 0, active: true, expires_at: new Date(Date.now() - 60e3).toISOString() } }, ADMIN);
    await rpcOk("admin_save_coupon", { c: { code: c3, type: "percent", value: 10, min_order: 1000, active: true } }, ADMIN);
    const v = await rpcOk("validate_coupon", { code: c1.toLowerCase(), subtotal: 100 });
    ok(v.ok && v.discount === 10 && v.msg === "خصم 10 ج", "validate fixed coupon (case-insensitive)", v);
    const a = await place(base({ coupon: c1 }));
    ok(a.data && a.data.discount === 10 && a.data.coupon === c1, "coupon applied server-side", a);
    const b = await place(base({ coupon: c1 }));
    ok(b.error === "الكود ده اتستخدم للآخر", "max_uses enforced", b);
    ok((await place(base({ coupon: c2 }))).error === "الكود ده خلص", "expired coupon rejected");
    const m = await place(base({ coupon: c3 }));
    ok(m.error === "الكود ده لطلبات من 1,000 ج", "min_order enforced (Arabic, formatted)", m);
    ok((await call("admin_save_coupon", { c: { code: "A", type: "percent", value: 10 } }, ADMIN)).error === "الكود لازم حروف إنجليزي أو أرقام (3–20)", "bad code rejected");
    ok((await call("admin_save_coupon", { c: { code: "ABCD", type: "percent", value: 150 } }, ADMIN)).error === "قيمة الخصم مش صح", "150% rejected");
    const list = await rpcOk("admin_coupons", {}, ADMIN);
    ok(list.find(x => x.code === c1).used === 1, "admin_coupons shows usage");
    for (const c of [c1, c2, c3]) await rpcOk("admin_delete_coupon", { code: c }, ADMIN);
    ok(!(await rpcOk("admin_coupons", {}, ADMIN)).some(x => [c1, c2, c3].includes(x.code)), "admin_delete_coupon");
    ok((await call("place_order", { payload: base({ coupon: "NOPE" + rnd(3) }) })).error === "الكود ده مش موجود", "unknown coupon in order rejected");
  }

  section("Admin: catalog editing");
  {
    const cat2 = await rpcOk("admin_save_category", { c: { name: "قسم اختبار", icon: "cup", sort: 99, active: false } }, ADMIN);
    ok(/^c[0-9a-f]{6}$/.test(cat2.id), "admin_save_category creates id");
    const p = await rpcOk("admin_save_product", { p: { name: "صنف اختبار", price: "42.5", category: cat2.id, description: "<b>x</b>",
      options: [{ name: "الحجم", type: "single", required: true, choices: [{ name: "صغير" }, { name: "كبير", price: "10" }] }] } }, ADMIN);
    ok(p.price === 42.5 && p.options[0].id && p.options[0].choices[1].price === 10 && p.available === true, "admin_save_product normalises", p);
    ok((await call("admin_save_product", { p: { ...p, image: "javascript:alert(1)" } }, ADMIN)).error === "رابط الصورة مش صح", "javascript: image URL rejected");
    ok((await call("admin_save_product", { p: { ...p, price: -1 } }, ADMIN)).error === "السعر مش صح", "negative price rejected");
    ok((await call("admin_save_product", { p: { ...p, options: [{ name: "x", choices: [{ name: "y", factor: -2 }] }] } }, ADMIN)).error === "الاختيارات فيها رقم مش منطقي", "negative factor rejected");
    const off = await rpcOk("admin_save_product", { p: { ...p, available: false } }, ADMIN);
    ok(off.available === false, "toggle available off");
    const ac = await rpcOk("admin_catalog", {}, ADMIN);
    ok(ac.products.some(x => x.id === p.id) && ac.categories.some(x => x.id === cat2.id), "admin_catalog includes hidden items");
    ok(!(await rpcOk("get_catalog")).categories.some(x => x.id === cat2.id), "hidden category not in public catalog");
    ok((await call("admin_delete_category", { id: cat2.id }, ADMIN)).error === "القسم فيه أصناف، انقلها أو امسحها الأول", "can't delete non-empty category");
    await rpcOk("admin_delete_product", { id: p.id }, ADMIN);
    ok((await rpcOk("admin_delete_category", { id: cat2.id }, ADMIN)) === true, "delete product then category");
    // sold-out product cannot be ordered
    const lat = cat.products.find(x => x.id === "p001");
    await rpcOk("admin_save_product", { p: { ...lat, available: false } }, ADMIN);
    ok((await place(base({ items: [{ pid: "p001", qty: 1, sel: { sugar: [0] } }] }))).error === `"${lat.name}" خلص النهارده`, "sold-out product rejected");
    await rpcOk("admin_save_product", { p: { ...lat, available: true } }, ADMIN);
  }

  section("Admin: orders, customers, stats, settings");
  {
    const list = await rpcOk("admin_orders", { status: "", lim: 300 }, ADMIN);
    ok(Array.isArray(list) && list.length > 0 && "phone" in list[0] && !("client_ip" in list[0]) && "customer_points" in list[0], `admin_orders: ${list.length} orders with phone/customer_points`);
    const act = await rpcOk("admin_orders", { status: "active", lim: 300 }, ADMIN);
    ok(act.every(o => !["done", "cancelled"].includes(o.status)), "admin_orders active filter");
    ok((await call("admin_set_status", { id: list[0].id, status: "lost" }, ADMIN)).error === "حالة غلط", "bad status rejected");
    ok((await call("admin_set_status", { id: 999999999, status: "done" }, ADMIN)).error === "الطلب مش موجود", "unknown order rejected");
    const cs = await rpcOk("admin_customers", { q: ph }, ADMIN);
    ok(cs.length === 1 && cs[0].phone === ph && "spent" in cs[0] && !("pass_hash" in cs[0]), "admin_customers search, no hash exposed", cs[0]);
    ok((await rpcOk("admin_adjust_points", { id: cs[0].id, delta: "20" }, ADMIN)) === cs[0].points + 20, "admin_adjust_points +20");
    ok((await rpcOk("admin_adjust_points", { id: cs[0].id, delta: "-100000" }, ADMIN)) === 0, "points never go below 0");
    ok((await call("admin_adjust_points", { id: cs[0].id, delta: "" }, ADMIN)).error === "اكتب عدد الحبّات", "empty delta rejected");
    ok((await rpcOk("admin_reset_password", { id: cs[0].id, password: "reset123" }, ADMIN)) === true, "admin_reset_password");
    ok((await rpcOk("me", { token: tok })) === null, "reset signs the customer out");
    ok((await call("login", { phone: ph, password: "reset123" })).data, "login with the reset password");
    const st = await rpcOk("admin_stats", { d_from: new Date(Date.now() - 864e5).toISOString(), d_to: new Date(Date.now() + 864e5).toISOString() }, ADMIN);
    ok(st.orders > 0 && st.sales > 0 && Array.isArray(st.top) && typeof st.by_type === "object", `admin_stats: ${st.orders} orders, ${st.sales} ج`);
    const same = await rpcOk("admin_save_settings", { s: S }, ADMIN);
    ok(same.whatsapp === S.whatsapp && Number(same.delivery_radius_km) === Number(S.delivery_radius_km), "admin_save_settings round-trip keeps values");
    ok((await call("admin_save_settings", { s: { ...S, whatsapp: "0100" } }, ADMIN)).error === "رقم الواتساب لازم يبدأ بـ 20 (مثال 201000160277)", "bad WhatsApp rejected");
    ok((await call("admin_save_settings", { s: { ...S, cashback_rate: 0.9 } }, ADMIN)).error === "في رقم في الإعدادات مش منطقي", "cashback 90% rejected");
    const keep = await rpcOk("admin_save_settings", { s: { ...S, cafe_lat: "" } }, ADMIN);
    ok(Number(keep.cafe_lat) === Number(S.cafe_lat), "empty cafe_lat keeps the current value");
    const closed = await rpcOk("admin_save_settings", { s: { ...S, accepting: false } }, ADMIN);
    ok(closed.accepting === false, "close online orders");
    ok((await place(base())).error === "الكافيه مش بيستقبل طلبات أونلاين دلوقتي", "orders refused while closed");
    await rpcOk("admin_save_settings", { s: S }, ADMIN);
    ok((await rpcOk("get_catalog")).settings.accepting === S.accepting, "settings restored");
    ok((await rpcOk("is_admin", {}, ADMIN)) === true, "is_admin() true for the admin");
  }

  section("Cleanup: cancel test orders");
  for (const id of placed) await call("admin_set_status", { id, status: "cancelled" }, ADMIN);
  ok(true, `cancelled ${placed.length} test orders`);
  finish();
})().catch(e => { console.error("\nFATAL", e.message); process.exit(1); });

function r2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failed:\n - " + fails.join("\n - ")); process.exit(1); }
}
