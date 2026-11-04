/* Browser regression for the customer site + admin (Playwright, dev only).
   node tests/site.e2e.js <base-url> <out-dir> [backend-url backend-anon-key]
   - <base-url> should be served by Apache with the real .htaccess (headers + CSP), e.g. http://localhost:8088/
   - Demo mode is forced by rewriting js/config.js in the browser (file on disk untouched).
   - With backend args, also runs the site against that Supabase-compatible backend (needs a server without
     the production CSP, e.g. tools/preview.js, because the CSP only allows *.supabase.co). */
const { chromium } = require("playwright");
const fs = require("fs");
const [BASE, OUT, BURL, BKEY, BBASE] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const fails = [];
const ok = (c, n, x) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; fails.push(n); console.log("  ✗ " + n + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 300) : "")); } };
const sec = s => console.log("\n" + s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ctx(browser, { mode = "demo", width = 390, url, key, block } = {}) {
  const c = await browser.newContext({ viewport: { width, height: width < 700 ? 800 : 900 }, locale: "ar-EG",
    geolocation: { latitude: 30.05, longitude: 31.47 }, permissions: ["geolocation"] });
  await c.route("**/js/config.js*", async r => {
    const resp = await r.fetch(); let body = await resp.text();
    if (mode === "demo") body = body.replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""');
    if (mode === "backend") body = body.replace(/supabaseUrl:\s*"[^"]*"/, `supabaseUrl: "${url}"`).replace(/supabaseAnonKey:\s*"[^"]*"/, `supabaseAnonKey: "${key}"`);
    r.fulfill({ response: resp, body });
  });
  if (block) await c.route(block, r => r.abort());
  return c;
}
function watch(page) {
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0, 220)); });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  return errs;
}
const cspErrors = errs => errs.filter(e => /Content Security Policy|Refused to/i.test(e));
async function overflow(page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth }));
}
const shot = (p, n, full) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: !!full });

(async () => {
  const browser = await chromium.launch();

  sec("Demo mode: layout at 360 / 390 / 768 / 1280 (Apache headers + CSP active)");
  for (const w of [360, 390, 768, 1280]) {
    const c = await ctx(browser, { width: w }); const p = await c.newPage(); const errs = watch(p);
    const resp = await p.goto(BASE); await p.waitForSelector(".row");
    if (w === 360) ok(!!resp.headers()["content-security-policy"], "CSP header is being sent");
    await sleep(400);
    const o = await overflow(p);
    ok(o.sw <= o.w, `${w}px: no horizontal overflow (${o.sw}/${o.w})`);
    ok(errs.length === 0, `${w}px: no console errors`, errs);
    await shot(p, `demo-${w}`); await shot(p, `demo-${w}-full`, true);
    await c.close();
  }

  sec("Demo mode: customer flows");
  const c = await ctx(browser); const p = await c.newPage(); const errs = watch(p);
  await p.goto(BASE); await p.waitForSelector(".row");
  ok(await p.$eval("#demoBar", e => !e.hidden), "demo bar visible in demo mode");
  ok(await p.$eval("#acctBtn", e => !!e.querySelector("svg")) && await p.$eval("#cartBtn", e => !!e.querySelector("svg")), "header icons rendered");
  await p.click('.row[data-pid="p002"]'); await sleep(300);
  await p.click('.grp[data-g="sugar"] .chip[data-i="2"]'); await p.click("#qP"); await p.click("#addBtn"); await sleep(400);
  const toastTop = await p.$eval("#toast", e => e.getBoundingClientRect().top);
  ok(toastTop < 80, `toast near the top after adding (${Math.round(toastTop)}px)`);
  await p.click("#cartBarBtn"); await sleep(300);
  await p.fill("#iCoupon", "DIVAN10"); await p.click("#cpnBtn"); await sleep(400);
  ok((await p.$eval("#cartBody .msg", e => e.innerText)) === "الكود ده لطلبات من 100 ج", "coupon below its minimum explained");
  await p.fill("#iCoupon", ""); await p.click("#cpnBtn"); await sleep(200);
  ok(!(await p.$("#cartBody .msg")), "clearing the field removes a coupon that didn't apply (was stuck before)");
  await p.click("[data-map]"); await sleep(2500);
  const tiles = await p.$$eval(".leaflet-tile-loaded", e => e.length);
  ok(tiles > 0, `map tiles load under CSP (${tiles})`);
  const g = await p.evaluate(() => { const m = document.querySelector("#pkMap").getBoundingClientRect(), pin = document.querySelector(".pk-pin svg").getBoundingClientRect(),
    lab = document.querySelector(".pk-cafe").getBoundingClientRect(); return { centre: m.top + m.height / 2, tip: pin.bottom, label: lab.top }; });
  ok(Math.abs(g.tip - 4 - g.centre) < 3, `pin tip is on the map centre (tip ${Math.round(g.tip)}, centre ${Math.round(g.centre)})`);
  ok(g.label >= g.tip - 6, "cafe label no longer hidden under the centre pin");
  await shot(p, "flow-map");
  await p.click("#pkOk"); await sleep(400);
  await p.fill("#iName", "<b>محمد</b> تست"); await p.fill("#iPhone", "01012345678"); await p.fill("#iAddr", "عمارة 5 شارع 90 التجمع الخامس");
  await shot(p, "flow-cart-toast");
  await p.click("#placeBtn"); await p.waitForSelector("#trackBody .no");
  ok(/#\d+/.test(await p.$eval("#trackBody .no", e => e.textContent)), "delivery order placed → tracking");
  ok((await p.$eval("#waBtn", e => e.href)).startsWith("https://wa.me/201000160277?text="), "WhatsApp hand-off link has the number");
  await p.click(".sh-foot [data-close]"); await sleep(400);

  sec("Table mode: banner + leave");
  const t = await c.newPage(); watch(t);
  await t.goto(BASE + "?t=7"); await t.waitForSelector(".row"); await sleep(300);
  ok(await t.$eval("#tableBan", e => !e.hidden && e.innerText.includes("7")), "?t=7 shows the table banner");
  ok((await t.$$eval("#modes button", b => b.map(x => x.dataset.m))).join() === "table", "only table mode while at a table");
  await shot(t, "table-banner");
  await t.click("#leaveTable"); await sleep(300);
  ok(await t.$eval("#tableBan", e => e.hidden), "'مش على ترابيزة؟' hides the banner");
  ok((await t.$$eval("#modes button", b => b.map(x => x.dataset.m))).join() === "delivery,pickup", "delivery + pickup are back");
  ok(!new URL(t.url()).searchParams.has("t"), "?t= removed from the address bar");
  await t.reload(); await t.waitForSelector(".row"); await sleep(300);
  ok(await t.$eval("#tableBan", e => e.hidden), "stays out of table mode after reload");
  await t.close();

  sec("Accounts + points (demo)");
  await p.click("#acctBtn"); await sleep(300); await p.click('.tabs [data-t="register"]'); await sleep(200);
  await p.fill("#aName", "سارة"); await p.fill("#aPhone", "01112223334"); await p.fill("#aPass", "secret12"); await p.click("#aBtn"); await sleep(700);
  ok((await p.$eval("#beanBtn", e => e.innerText)).trim() === "0", "registered, header shows 0 beans");
  await p.click(".xbtn[data-close]"); await sleep(300);
  ok(cspErrors(errs).length === 0 && errs.length === 0, "no console / CSP errors in customer flows", errs);
  await c.close();

  sec("Admin (demo)");
  {
    const c2 = await ctx(browser, { width: 390 }); const a = await c2.newPage(); const ae = watch(a);
    await a.goto(BASE + "admin.html"); await sleep(500);
    ok(!(await a.content()).includes("divan2026"), "no demo password anywhere in admin.html");
    await a.fill("#lEmail", "a@b.c"); await a.fill("#lPass", "nope"); await a.click("#lBtn"); await sleep(300);
    ok((await a.$eval("#loginErr", e => e.innerText)) === "الباسورد غلط", "wrong demo password → no hint shown");
    await a.fill("#lPass", "divan2026"); await a.click("#lBtn"); await sleep(1000);
    ok(await a.$eval("#appView", e => !e.hidden), "admin dashboard opens");
    await a.click('#nav [data-v="menu"]'); await sleep(600);
    await a.click('#addProd'); await sleep(300);
    await a.fill("#pN", '<img src=x onerror="window.__xss=1">'); await a.fill("#pP", "10"); await a.click("#pSave"); await sleep(600);
    const row = await a.$('.prow:has-text("img src=x")');
    ok(!!row, "product with HTML in its name saved and shown as text");
    await row.click(); await sleep(300); await a.click("#pDel"); await sleep(300);
    ok(await a.evaluate(() => !window.__xss && !document.querySelector("#modal img[src=x]")), "delete-confirm dialog escapes the name (no XSS)");
    await shot(a, "admin-confirm-escaped");
    await a.click("#cfY"); await sleep(500);
    for (const v of ["orders", "coupons", "customers", "reports", "settings"]) { await a.click(`#nav [data-v="${v}"]`); await sleep(500); }
    ok(await a.$$eval(".qr svg", e => e.length) === 15, "15 table QR codes drawn");
    const qr = await a.$eval(".qr b", e => e.textContent); ok(qr === "ترابيزة 1", "QR labels");
    const o = await overflow(a); ok(o.sw <= o.w, `admin 390px no overflow (${o.sw}/${o.w})`);
    ok(ae.length === 0, "admin: no console / CSP errors", ae);
    await c2.close();
  }

  sec("Production config, backend unreachable (today's situation)");
  {
    const c3 = await ctx(browser, { mode: "live" }); const pg = await c3.newPage(); const le = watch(pg);
    const t0 = Date.now(); await pg.goto(BASE);
    ok(await pg.$eval("#acctBtn", e => !!e.querySelector("svg")), "header icons shown before the menu loads");
    ok(await pg.$eval("#modes", e => e.hidden) && await pg.$eval(".loyal", e => e.hidden), "no empty mode bar / placeholder loyalty card");
    ok(await pg.$eval("#demoBar", e => e.hidden), "never falls back to demo mode");
    await pg.waitForSelector("#retryBtn", { timeout: 20000 });
    const secs = (Date.now() - t0) / 1000;
    ok(secs < 9, `clear error after ${secs.toFixed(1)} s (was ~15 s)`);
    const txt = await pg.$eval(".loaderr", e => e.innerText);
    ok(txt.includes("المنيو ما اتحمّلش") && txt.includes("السيرفر مش بيرد"), "Arabic error says the server isn't answering (not 'your internet')", txt);
    ok((await pg.$eval('.loaderr a[href^="https://wa.me/"]', e => e.href)) === "https://wa.me/201000160277", "fallback WhatsApp link works");
    ok((await pg.$eval('.loaderr a[href^="tel:"]', e => e.getAttribute("href"))) === "tel:01000160277", "fallback phone link works");
    ok((await pg.$eval('#visitLines a[href^="https://wa.me/"]', e => e.href)) === "https://wa.me/201000160277", "visit section WhatsApp no longer wa.me/undefined");
    await shot(pg, "live-unreachable-error");
    await pg.click("#retryBtn"); await sleep(300);
    ok(await pg.$$eval(".skel", e => e.length) > 0, "retry shows loading again in place (no page reload)");
    await c3.close();
  }

  sec("Production config, supabase library missing");
  {
    const c4 = await ctx(browser, { mode: "live", block: "**/vendor/supabase.min.js*" }); const pg = await c4.newPage();
    await pg.goto(BASE); await pg.waitForSelector("#retryBtn", { timeout: 15000 });
    ok(await pg.$eval("#demoBar", e => e.hidden), "no silent demo mode when the library fails");
    ok((await pg.$eval(".loaderr", e => e.innerText)).includes("الموقع مش قادر يوصل للسيرفر"), "clear setup error instead");
    const a = await c4.newPage(); await a.goto(BASE + "admin.html"); await sleep(500);
    await a.fill("#lEmail", "a@b.c"); await a.fill("#lPass", "divan2026"); await a.click("#lBtn"); await sleep(500);
    ok(await a.$eval("#appView", e => e.hidden), "demo admin password does NOT work with a production config");
    await c4.close();
  }

  if (BURL) {
    sec("Against a real backend (" + BURL + ")");
    const c5 = await ctx(browser, { mode: "backend", url: BURL, key: BKEY }); const pg = await c5.newPage(); const be = watch(pg);
    await pg.goto(BBASE); await pg.waitForSelector(".row", { timeout: 15000 });
    ok(await pg.$$eval(".row", e => e.length) === 58, "58 products from the backend");
    await pg.click('.row[data-pid="p009"]'); await sleep(300); await pg.click("#addBtn"); await sleep(300);
    await pg.click("#cartBarBtn"); await sleep(400); await pg.click('#segType [data-m="pickup"]');
    await pg.fill("#iName", "اختبار متصفح"); await pg.fill("#iPhone", "0155" + String(Date.now()).slice(-7)); await pg.click("#placeBtn");
    await pg.waitForSelector("#trackBody .no", { timeout: 10000 });
    ok(true, "order placed on the backend → tracking shown");
    await pg.click(".sh-foot [data-close]"); await sleep(400);
    await pg.click("#acctBtn"); await sleep(300);
    await pg.fill("#aPhone", "01559999999"); await pg.fill("#aPass", "wrongpass"); await pg.click("#aBtn"); await sleep(1200);
    ok((await pg.$eval("#aErr", e => e.innerText)) === "الرقم أو الباسورد غلط", "login error from the server, in Arabic");
    ok(be.length === 0, "no console errors against the backend", be);
    await shot(pg, "backend-login-error");
    await c5.close();
  }
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failed:\n - " + fails.join("\n - ")); process.exit(1); }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
