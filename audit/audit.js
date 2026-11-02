// Phase 0 audit: drives the site in demo + live mode, records console errors, overflow, screenshots.
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = "http://127.0.0.1:8080/";
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (...a) => { const s = a.join(" "); log.push(s); console.log(s); };

async function ctx(browser, mode, width) {
  const c = await browser.newContext({ viewport: { width, height: width < 700 ? 780 : 900 }, locale: "ar-EG",
    geolocation: { latitude: 30.0300, longitude: 31.4700 }, permissions: ["geolocation"] });
  if (mode === "demo") {
    await c.route("**/js/config.js*", async r => {
      const resp = await r.fetch(); let body = await resp.text();
      body = body.replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""').replace(/supabaseAnonKey:\s*"[^"]*"/, 'supabaseAnonKey: ""');
      r.fulfill({ response: resp, body });
    });
  }
  return c;
}
function watch(page, tag) {
  const errs = [];
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${m.text().slice(0, 200)}`); });
  page.on("pageerror", e => errs.push("[pageerror] " + e.message));
  page.on("requestfailed", r => errs.push(`[reqfail] ${r.url().slice(0, 100)} ${r.failure() && r.failure().errorText}`));
  page.on("dialog", d => d.dismiss());
  return errs;
}
async function overflow(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    document.querySelectorAll("body *").forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width || getComputedStyle(el).position === "fixed") return;
      if (r.right > W + 1 || r.left < -1) {
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== "visible") { clipped = true; break; } p = p.parentElement; }
        if (!clipped) bad.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")}#${el.id} [${Math.round(r.left)},${Math.round(r.right)}]`);
      }
    });
    return { scrollW: document.documentElement.scrollWidth, W, bad: bad.slice(0, 6) };
  });
}
const shot = (page, name, full = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });

(async () => {
  const browser = await chromium.launch();
  const widths = [360, 390, 768, 1280];

  // ---------- LIVE MODE: what production does today ----------
  {
    const c = await ctx(browser, "live", 390); const page = await c.newPage(); const errs = watch(page, "live");
    const t0 = Date.now(); await page.goto(BASE);
    await page.waitForTimeout(3000); await shot(page, "live-390-3s");
    let shown = null;
    for (let i = 0; i < 30; i++) { shown = await page.$eval("#menuRoot", e => e.innerText.trim()); if (shown) break; await page.waitForTimeout(1000); }
    note(`LIVE: menuRoot text after ${Math.round((Date.now() - t0) / 1000)}s: ${JSON.stringify(shown)}`);
    note(`LIVE: demoBar hidden=${await page.$eval("#demoBar", e => e.hidden)} skeletons=${await page.$$eval(".skel", e => e.length)}`);
    await shot(page, "live-390-end", true);
    note("LIVE console:", [...new Set(errs)].slice(0, 8).join("\n   "));
    // admin live
    const a = await c.newPage(); const aerr = watch(a, "live-admin");
    await a.goto(BASE + "admin.html"); await a.waitForTimeout(1500);
    await a.fill("#lEmail", "x@example.com"); await a.fill("#lPass", "whatever1");
    await a.click("#lBtn"); await a.waitForTimeout(4000);
    note(`LIVE admin login error: ${JSON.stringify(await a.$eval("#loginErr", e => e.innerText))}`);
    await shot(a, "live-admin-login");
    await c.close();
  }

  // ---------- DEMO MODE: widths, overflow ----------
  for (const w of widths) {
    const c = await ctx(browser, "demo", w); const page = await c.newPage(); const errs = watch(page);
    await page.goto(BASE); await page.waitForSelector(".row"); await page.waitForTimeout(600);
    const o = await overflow(page);
    note(`DEMO ${w}px: rows=${await page.$$eval(".row", e => e.length)} scrollW=${o.scrollW}/${o.W} overflow=${JSON.stringify(o.bad)} errs=${errs.length}`);
    await shot(page, `demo-${w}-top`); await shot(page, `demo-${w}-full`, true);
    // open a product sheet with options
    await page.click('.row[data-pid="p002"]'); await page.waitForTimeout(500);
    const o2 = await overflow(page); note(`  sheet overflow=${JSON.stringify(o2.bad)}`);
    await shot(page, `demo-${w}-product`);
    if (errs.length) note("  errs:", errs.join(" | "));
    await c.close();
  }

  // ---------- DEMO MODE: full customer flows (390) ----------
  const c = await ctx(browser, "demo", 390); const page = await c.newPage(); const errs = watch(page);
  await page.goto(BASE); await page.waitForSelector(".row");
  // required option enforcement
  await page.click('.row[data-pid="p002"]'); await page.waitForTimeout(300);
  await page.click("#addBtn"); await page.waitForTimeout(300);
  note(`FLOW required-option toast: ${await page.$eval("#toast", e => e.innerText)}`);
  await page.click('.grp[data-g="sugar"] .chip[data-i="2"]'); await page.click("#qP");
  note(`FLOW product total (2x Turkish double): ${await page.$eval("#addTot", e => e.innerText)}`);
  await page.click("#addBtn"); await page.waitForTimeout(500);
  // kg product
  await page.click('.row[data-pid="p053"]'); await page.waitForTimeout(300);
  for (const [g, i] of [["weight", 0], ["spice", 1], ["roast", 2], ["grind", 0]]) await page.click(`.grp[data-g="${g}"] .chip[data-i="${i}"]`);
  note(`FLOW blend 1/4kg + spiced + dark: ${await page.$eval("#addTot", e => e.innerText)} (expected (800+80+80)*0.25=240)`);
  await page.click("#addBtn"); await page.waitForTimeout(500);
  note(`FLOW cartbar: ${await page.$eval("#cartBar", e => e.innerText.replace(/\s+/g, " "))}`);
  await shot(page, "flow-cartbar");
  await page.click("#cartBarBtn"); await page.waitForTimeout(500);
  await shot(page, "flow-cart-delivery");
  // coupon
  await page.fill("#iCoupon", "divan10"); await page.click("#cpnBtn"); await page.waitForTimeout(500);
  note(`FLOW coupon msg: ${await page.$eval("#cartBody .msg", e => e.innerText).catch(() => "none")}`);
  note(`FLOW sum: ${await page.$eval(".sum", e => e.innerText.replace(/\s+/g, " "))}`);
  // map picker
  await page.click("[data-map]"); await page.waitForTimeout(2500);
  await shot(page, "flow-map-picker");
  note(`FLOW picker info: ${await page.$eval("#pkInfo", e => e.innerText)}; tiles loaded=${await page.$$eval(".leaflet-tile-loaded", e => e.length)}`);
  await page.click("#pkOk"); await page.waitForTimeout(500);
  note(`FLOW loc box: ${await page.$eval("#f-loc", e => e.innerText.replace(/\s+/g, " "))}`);
  await page.fill("#iName", "محمد تست"); await page.fill("#iPhone", "01012345678");
  await page.fill("#iAddr", "عمارة 5 شارع 90 التجمع الخامس");
  await page.click("#placeBtn"); await page.waitForTimeout(1200);
  await shot(page, "flow-track");
  note(`FLOW track: ${await page.$eval("#trackBody", e => e.innerText.replace(/\s+/g, " ").slice(0, 200)).catch(e => "NO TRACK " + e.message)}`);
  await page.click(".sh-foot [data-close]"); await page.waitForTimeout(500);
  // register + points
  await page.click("#acctBtn"); await page.waitForTimeout(400);
  await page.click('.tabs [data-t="register"]'); await page.waitForTimeout(300);
  await page.fill("#aName", "<img src=x onerror=alert(1)>سارة"); await page.fill("#aPhone", "01112223334"); await page.fill("#aPass", "secret12");
  await page.click("#aBtn"); await page.waitForTimeout(800);
  await shot(page, "flow-account");
  note(`FLOW after register header beans: ${await page.$eval("#beanBtn", e => e.innerText)}`);
  // pickup order logged in
  await page.click(".xbtn[data-close]").catch(() => { }); await page.waitForTimeout(400);
  await page.click('.row[data-pid="p009"]'); await page.waitForTimeout(300); await page.click("#addBtn"); await page.waitForTimeout(400);
  await page.click("#cartBarBtn"); await page.waitForTimeout(400);
  await page.click('#segType [data-m="pickup"]'); await page.waitForTimeout(300);
  note(`FLOW pickup earn line: ${await page.$eval(".sum", e => e.innerText.replace(/\s+/g, " "))}`);
  await page.click("#placeBtn"); await page.waitForTimeout(1000);
  note(`FLOW pickup track: ${await page.$eval("#trackBody", e => e.innerText.replace(/\s+/g, " ").slice(0, 160)).catch(() => "none")}`);
  await page.click(".sh-foot [data-close]"); await page.waitForTimeout(400);
  // change password
  await page.click("#acctBtn"); await page.waitForTimeout(400); await page.click('.tabs [data-t="profile"]'); await page.waitForTimeout(400);
  await page.fill("#pOld", "secret12"); await page.fill("#pNew", "secret34"); await page.click("#pBtn"); await page.waitForTimeout(600);
  note(`FLOW change pw toast: ${await page.$eval("#toast", e => e.innerText)}`);
  await shot(page, "flow-profile");
  note(`FLOW errors: ${JSON.stringify(errs)}`);

  // ---------- table mode ----------
  {
    const p2 = await c.newPage(); const e2 = watch(p2);
    await p2.goto(BASE + "?t=7"); await p2.waitForSelector(".row"); await p2.waitForTimeout(400);
    note(`TABLE banner: ${await p2.$eval("#tableBan", e => (e.hidden ? "HIDDEN " : "") + e.innerText)}; modes=${await p2.$eval("#modes", e => e.innerText.replace(/\s+/g, " "))}`);
    await shot(p2, "table-top");
    const p3 = await c.newPage(); await p3.goto(BASE + "?table=7"); await p3.waitForSelector(".row");
    note(`TABLE ?table=7 banner hidden=${await p3.$eval("#tableBan", e => e.hidden)} (app reads ?t= only)`);
    await p2.close(); await p3.close();
  }

  // ---------- ADMIN ----------
  const a = await c.newPage(); const ae = watch(a);
  await a.goto(BASE + "admin.html"); await a.waitForTimeout(600);
  await shot(a, "admin-login");
  note(`ADMIN demo bar: ${await a.$eval("#demoBar", e => (e.hidden ? "hidden " : "") + e.innerText)}`);
  await a.fill("#lEmail", "a@b.c"); await a.fill("#lPass", "divan2026"); await a.click("#lBtn"); await a.waitForTimeout(1200);
  await shot(a, "admin-orders");
  note(`ADMIN orders cards: ${await a.$$eval(".ocard", e => e.length)}`);
  const xssCount = await a.$$eval("img[src=x]", e => e.length); note(`ADMIN injected <img src=x> elements: ${xssCount}`);
  // status flow on the logged-in pickup order (latest id)
  const ids = await a.$$eval(".ocard", e => e.map(x => +x.dataset.id)); const last = Math.max(...ids);
  for (const s of ["preparing", "ready", "done"]) { await a.click(`.ocard[data-id="${last}"] [data-s="${s}"]`); await a.waitForTimeout(500); }
  await a.click('#oChips [data-f="today"]'); await a.waitForTimeout(300);
  note(`ADMIN after done: ${await a.$eval(`.ocard[data-id="${last}"] .tot`, e => e.innerText.replace(/\s+/g, " "))}`);
  for (const v of ["menu", "coupons", "customers", "reports", "settings"]) {
    await a.click(`#nav [data-v="${v}"]`); await a.waitForTimeout(800);
    await shot(a, `admin-${v}`, v === "settings");
    note(`ADMIN ${v}: ${(await a.$eval("#view", e => e.innerText.replace(/\s+/g, " "))).slice(0, 140)}`);
  }
  await a.click('#nav [data-v="customers"]'); await a.waitForTimeout(600);
  note(`ADMIN customers row: ${await a.$eval("#uBox", e => e.innerText.replace(/\s+/g, " ").slice(0, 160))}`);
  // menu editor save
  await a.click('#nav [data-v="menu"]'); await a.waitForTimeout(600);
  await a.click('[data-p="p009"] [data-ep]'); await a.waitForTimeout(400); await shot(a, "admin-edit-product");
  await a.fill("#pP", "66"); await a.click("#pSave"); await a.waitForTimeout(600);
  note(`ADMIN product save toast: ${await a.$eval("#toast", e => e.innerText)}`);
  for (const w of [360, 768]) { await a.setViewportSize({ width: w, height: 800 }); await a.waitForTimeout(300); const o = await overflow(a); note(`ADMIN ${w}px overflow scrollW=${o.scrollW}/${o.W} ${JSON.stringify(o.bad)}`); await shot(a, `admin-menu-${w}`); }
  note(`ADMIN errors: ${JSON.stringify([...new Set(ae)])}`);
  await browser.close();
  fs.writeFileSync(`${OUT}/audit-log.txt`, log.join("\n"));
})().catch(e => { console.error("FATAL", e); process.exit(1); });
