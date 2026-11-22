/* v6 redesign checks (Playwright, dev only): the travelling 3D coffee bag.
   node tests/stage.e2e.js <base-url> <out-dir> [backend-url backend-anon-key backend-base-url]
   <base-url>: Apache with the real .htaccess (CSP on). Demo mode is forced in the browser.
   With backend args: a builder order goes through the real RPCs and the server total must match. */
const { chromium } = require("playwright");
const fs = require("fs");
const [BASE, OUT, BURL, BKEY, BBASE] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const fails = [];
const ok = (c, n, x) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; fails.push(n); console.log("  ✗ " + n + (x !== undefined ? "  → " + JSON.stringify(x).slice(0, 300) : "")); } };
const sec = s => console.log("\n" + s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOISE = /GPU stall|GL Driver Message|WebGL: too many|swiftshader/i;

async function ctx(b, { width = 1440, height = 900, intro = false, mode = "demo", url, key, rm = false } = {}) {
  const c = await b.newContext({ viewport: { width, height }, locale: "ar-EG", reducedMotion: rm ? "reduce" : "no-preference" });
  await c.route("**/js/config.js*", async r => {
    const x = await r.fetch(); let t = await x.text();
    if (mode === "demo") t = t.replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""');
    if (mode === "backend") t = t.replace(/supabaseUrl:\s*"[^"]*"/, `supabaseUrl: "${url}"`).replace(/supabaseAnonKey:\s*"[^"]*"/, `supabaseAnonKey: "${key}"`);
    r.fulfill({ response: x, body: t });
  });
  if (!intro) await c.addInitScript(() => { try { localStorage.setItem("dv_intro_at", String(Date.now())); } catch (e) { } });
  return c;
}
function watch(p) {
  const errs = [], hosts = new Set();
  p.on("console", m => { if (m.type() === "error" && !NOISE.test(m.text())) errs.push(m.text().slice(0, 200)); });
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("request", r => { try { hosts.add(new URL(r.url()).host); } catch (e) { } });
  return { errs, hosts };
}
const st = p => p.evaluate(() => ({ mode: DV.stage.mode, pos: DV.stage.pos, target: DV.stage.target, N: DV.stage.N, flip: DV.stage.flip, step: DV.stage.step, trav: DV.stage.trav, states: DV.stage.states() }));
const ready = async p => { await p.waitForFunction(() => window.DV && DV.stage && DV.stage.mode && document.body.classList.contains("entered"), null, { timeout: 30000 }); await sleep(2200); };
const stopAuto = p => p.evaluate(() => { const a = document.getElementById("auto"); if (a.getAttribute("aria-pressed") === "true") a.click(); });

(async () => {
  const b = await chromium.launch();

  sec("Hero: 3D bags on the arc");
  const c = await ctx(b); const p = await c.newPage(); const W = watch(p);
  await p.goto(BASE); await ready(p); await stopAuto(p);
  let s = await st(p);
  ok(s.mode === "gl", `WebGL renderer active (${s.mode})`);
  ok(s.N === 7, `7 coffee bags from the catalogue (${s.N})`);
  const vis = s.states.filter(x => x.op > 0.5);
  ok(vis.length >= 7, `${vis.length} bags visible on the arc`);
  const centre = s.states.reduce((a, x) => Math.abs(x.k) < Math.abs(a.k) ? x : a);
  ok(s.states.every(x => x.h <= centre.h + 0.5), "centre bag is the largest");
  const right = s.states.find(x => Math.round(x.k) === 1), left = s.states.find(x => Math.round(x.k) === -1);
  ok(right && left && right.x < centre.x && left.x > centre.x, "RTL: the next bag sits to the left");
  const name0 = await p.$eval("#title", e => e.dataset.name);
  ok(name0 === "توليفة ديفان" && (await p.$eval("#count", e => e.textContent)) === "01", "starts on توليفة ديفان, counter 01");
  ok((await p.$eval("#hprice", e => e.textContent)).includes("800 ج"), "price from the catalogue");
  await p.screenshot({ path: OUT + "/hero-1440.png" });

  sec("Changing bag");
  await p.click("#next"); await sleep(1300);
  s = await st(p);
  ok(s.target === 1 && Math.abs(s.pos - 1) < 0.01, "→ button advances one bag and the glide settles");
  ok((await p.$eval("#title", e => e.dataset.name)) === "توليفة سبيشيال" && (await p.$eval("#count", e => e.textContent)) === "02", "title + counter updated");
  ok((await p.$eval("#title", e => e.querySelectorAll(".w").length)) === 2, "title animated per word (Arabic letters stay joined)");
  const flav = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--flav").trim());
  ok(flav === "#c8963e", `background colour became the bag colour (${flav})`);
  await p.keyboard.press("ArrowLeft"); await sleep(1200); ok((await st(p)).target === 2, "← key = next (RTL)");
  await p.keyboard.press("ArrowRight"); await sleep(1200); ok((await st(p)).target === 1, "→ key = previous");
  // drag right 2 slots (RTL: right = next)
  const box = await p.$eval("#arc", e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 }; });
  await p.mouse.move(box.x, box.y); await p.mouse.down();
  for (let i = 1; i <= 20; i++) { await p.mouse.move(box.x + i * 25, box.y); await sleep(16); }
  const mid = (await st(p)).pos; ok(mid > 1.5, `bags follow the pointer while dragging (pos ${mid.toFixed(2)})`);
  await sleep(200); await p.mouse.up(); await sleep(1400);
  s = await st(p); ok(Number.isInteger(s.target) && s.target >= 2 && Math.abs(s.pos - s.target) < 0.01, `release snaps to a bag (target ${s.target})`);
  // tap a side bag
  const t0 = s.target; const side = s.states.find(x => Math.round(x.k) === 1);
  await p.mouse.click(side.x, side.y); await sleep(1400);
  ok((await st(p)).target === t0 + 1, "tapping the next bag selects it");
  // autoplay
  await p.click("#auto"); const ta = (await st(p)).target; await sleep(4300);
  ok((await st(p)).target === ta + 1, "autoplay advances after 3.2 s"); await stopAuto(p);
  await p.screenshot({ path: OUT + "/hero-after.png" });

  sec("Hero CTA → real product sheet → cart");
  const cur = await p.$eval("#title", e => e.dataset.name);
  await p.click("#hbuy"); await sleep(600);
  ok((await p.$eval("#shTitle", e => e.textContent)) === cur, "CTA opens the selected bag's product sheet");
  await p.click("#addBtn"); await sleep(300);
  ok((await p.$$eval(".grp.err", e => e.length)) > 0, "required options (weight, grind…) enforced");
  for (const g of await p.$$eval(".grp", e => e.map(x => x.dataset.g))) await p.click(`.grp[data-g="${g}"] .chip[data-i="0"]`);
  await p.click("#addBtn"); await sleep(150);
  ok(await p.$(".fly") !== null, "bag flies to the cart");
  await sleep(1100);
  ok((await p.$eval("#cartCount", e => e.textContent)) === "1", "cart badge = 1");

  sec("From bean to cup: pinned steps, flips, storm");
  const ins = await p.$eval("#inside", e => ({ top: e.getBoundingClientRect().top + scrollY, h: e.offsetHeight }));
  const span = ins.h - 900, at = f => ins.top + span * f;
  const heads = [];
  for (const [i, f, want] of [[0, 0.08, 0], [1, 0.27, 180], [2, 0.46, 360], [3, 0.66, 720]]) {
    await p.evaluate(y => scrollTo({ top: y, behavior: "instant" }), at(f)); await sleep(2100);
    s = await st(p); heads.push(await p.$eval("#inHead", e => e.innerText.replace(/\s+/g, " ")));
    ok(s.step === i && Math.abs(s.flip - want) < 0.5, `step 0${i + 1}: bag turned to ${want}° (${s.flip.toFixed(0)}°)`);
    if (i === 1) await p.screenshot({ path: OUT + "/inside-back.png" });
  }
  ok(heads[0].includes("أجود بن") && heads[1].includes("بنحمّصه") && heads[3] === cur, "step headlines, step 04 = the bag's name", heads);
  ok((await p.$eval('#inIcons [aria-current="step"]', e => e.dataset.st)) === "3", "active step icon");
  await p.evaluate(y => scrollTo({ top: y, behavior: "instant" }), at(0.9)); await sleep(700);
  const storm = await p.$$eval("#storm i", e => e.filter(x => +getComputedStyle(x).opacity > 0.05).length);
  ok(storm >= 5, `storm: ingredient pieces flying (${storm} visible)`);
  ok(+(await p.$eval("#inDark", e => getComputedStyle(e).opacity)) > 0.2, "storm darkens the page");
  await p.screenshot({ path: OUT + "/storm.png" });

  sec("The bag lands on its own card");
  const sig = await p.$eval("#cards", e => e.getBoundingClientRect().top + scrollY);
  await p.evaluate(y => scrollTo({ top: y - 250, behavior: "instant" }), sig); await sleep(1500);
  s = await st(p);
  const live = await p.$eval("#cards .card.live", e => { const r = e.querySelector(".pk").getBoundingClientRect(); return { id: e.dataset.pid, x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, hidden: getComputedStyle(e.querySelector(".pk")).visibility }; });
  ok(s.trav && s.trav.id === live.id, "traveller is the selected bag");
  ok(s.trav && Math.abs(s.trav.x - live.x) < 4 && Math.abs(s.trav.y - live.y) < 4 && Math.abs(s.trav.h - live.h) < 4, `3D bag sits exactly on its card (Δx ${s.trav && (s.trav.x - live.x).toFixed(1)}, Δy ${s.trav && (s.trav.y - live.y).toFixed(1)})`);
  ok(live.hidden === "hidden", "the live card's flat sprite is hidden");
  ok((await p.$$eval("#cards .card:not(.live) .pk", e => e.every(x => getComputedStyle(x).visibility === "visible"))), "other cards show their flat bag");
  await p.screenshot({ path: OUT + "/landed.png" });
  await p.click(`#cards .card[data-pid="${live.id}"] .add`); await sleep(500);
  ok((await p.$eval("#shTitle", e => e.textContent)) === cur, "card + opens the product sheet");
  await p.keyboard.press("Escape"); await sleep(400);
  ok(await p.$("#rail a") !== null && (await p.$$eval("#menuRoot .row", e => e.length)) === 13, "full menu (beans + bakery, 13 items) still below the cards");

  sec("Build your bag");
  await p.evaluate(() => document.getElementById("beans").scrollIntoView()); await sleep(1200);
  await p.click('#bThumbs [data-pid="p054"]'); await sleep(300);
  await p.click('#bGroups .chip[data-g="weight"][data-i="0"]'); await p.click('#bGroups .chip[data-g="roast"][data-i="2"]'); await p.click('#bGroups .chip[data-g="spice"][data-i="1"]');
  await sleep(200);
  const shown = await p.$eval("#bPrice", e => e.textContent);
  ok(shown === "350 ج", `VIP ¼ kg, dark, spiced = (1200+80+120)×0.25 = 350 ج (shows ${shown})`);
  await p.click("#bBtn"); await sleep(1300);
  ok((await p.$eval("#cartCount", e => e.textContent)) === "2" && (await p.$eval("#bBtn", e => e.textContent)).includes("اتضاف"), "added to the same cart");
  await p.screenshot({ path: OUT + "/beans.png" });
  ok(W.errs.length === 0, "no console errors", W.errs);
  ok([...W.hosts].every(h => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h) || h === "tile.openstreetmap.org" || /\.supabase\.co$/.test(h)), "no new network hosts", [...W.hosts]);
  await c.close();

  sec("Intro");
  {
    const ci = await ctx(b, { intro: true }); const pi = await ci.newPage(); await pi.goto(BASE, { waitUntil: "domcontentloaded" });
    ok(!!(await pi.waitForSelector("#intro:not([hidden])", { timeout: 3000 }).catch(() => null)), "first visit shows the intro (logo stamp)");
    await pi.click("#skipIntro", { timeout: 3000 }).catch(() => { }); await sleep(700);
    ok(await pi.$eval("#intro", e => e.hidden), "Skip works");
    await pi.reload(); await sleep(400);
    ok(await pi.$eval("#intro", e => e.hidden), "not shown again within 24 h");
    await ci.close();
    const ct = await ctx(b, { intro: true }); const pt = await ct.newPage(); await pt.goto(BASE + "?t=4"); await sleep(400);
    ok(await pt.$eval("#intro", e => e.hidden), "never on a table-QR visit"); await ct.close();
    const cr = await ctx(b, { intro: true, rm: true }); const pr = await cr.newPage(); await pr.goto(BASE); await ready(pr);
    ok(await pr.$eval("#intro", e => e.hidden), "never with reduced motion");
    await pr.click("#next"); await sleep(150);
    ok(Math.abs((await st(pr)).pos - 1) < 0.01, "reduced motion: instant bag change");
    ok((await pr.$eval("#auto", e => e.getAttribute("aria-pressed"))) === "false", "reduced motion: autoplay off");
    await cr.close();
  }

  sec("Layout at every size (no overflow, nothing overlapping)");
  for (const [w, h] of [[1440, 900], [390, 844], [320, 640], [844, 390], [768, 1024], [360, 740]]) {
    const cl = await ctx(b, { width: w, height: h }); const pl = await cl.newPage(); const E = watch(pl);
    await pl.goto(BASE); await ready(pl); await stopAuto(pl); await sleep(1300);   // ثابت، مش في نص حركة
    const o = await pl.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? b : null; };
      const hit = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      const cta = r("#hcta"), pill = r("#navPill"), title = r("#title"), next = r("#next");
      const c0 = DV.stage.states().reduce((a, x) => Math.abs(x.k) < Math.abs(a.k) ? x : a), bw = c0.h / 1.42;
      const bag = { left: c0.x - bw / 2 + 6, right: c0.x + bw / 2 - 6, top: c0.y - c0.h / 2 + 6, bottom: c0.y + c0.h / 2 - 6 };
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, ctaPill: hit(cta, pill), titleCta: hit(title, cta), nextTitle: hit(next, title), ctaIn: cta && cta.bottom <= innerHeight && cta.top >= 0, nextBag: hit(next, bag), titleBag: hit(title, bag) };
    });
    ok(o.sw <= o.cw, `${w}×${h}: no horizontal scroll (${o.sw}/${o.cw})`);
    ok(!o.ctaPill && !o.titleCta && !o.nextTitle && !o.nextBag && !o.titleBag && o.ctaIn, `${w}×${h}: centre bag, title, CTA, next and nav don't overlap; CTA on screen`, o);
    ok(E.errs.length === 0, `${w}×${h}: no console errors`, E.errs);
    await pl.screenshot({ path: `${OUT}/hero-${w}x${h}.png` });
    await cl.close();
  }

  sec("Without WebGL");
  {
    const bf = await chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis"] });
    const cf = await ctx(bf); const pf = await cf.newPage(); const E = watch(pf);
    await pf.goto(BASE); await ready(pf);
    ok((await st(pf)).mode === "2d", "falls back to 2D sprites");
    ok((await pf.$$eval("#arc2d .b2d", e => e.filter(x => x.style.display !== "none" && +x.style.opacity > 0.5).length)) >= 7, "7 flat bags on the arc");
    await pf.click("#next"); await sleep(1300); ok((await st(pf)).target === 1, "bag change works without WebGL");
    await pf.click("#hbuy"); await sleep(500); ok(!!(await pf.$("#shTitle")), "ordering unaffected");
    ok(E.errs.length === 0, "no console errors", E.errs);
    await bf.close();
  }

  if (BURL) {
    sec("Builder order through the backend (" + BURL + ")");
    const cb = await ctx(b, { mode: "backend", url: BURL, key: BKEY }); const pb = await cb.newPage(); const E = watch(pb);
    await pb.goto(BBASE); await ready(pb); await stopAuto(pb);
    await pb.evaluate(() => document.getElementById("beans").scrollIntoView()); await sleep(1000);
    await pb.click('#bThumbs [data-pid="p058"]'); await sleep(200);
    await pb.click('#bGroups .chip[data-g="weight"][data-i="2"]'); await pb.click('#bGroups .chip[data-g="flavor"][data-i="1"]'); await pb.click('#bGroups .chip[data-g="grind"][data-i="2"]');
    const price = await pb.$eval("#bPrice", e => e.textContent);
    await pb.click("#bBtn"); await sleep(400);
    await pb.click("#cartBarBtn"); await sleep(400); await pb.click('#segType [data-m="pickup"]');
    await pb.fill("#iName", "اختبار كيس"); await pb.fill("#iPhone", "0155" + String(Date.now()).slice(-7)); await pb.click("#placeBtn");
    await pb.waitForSelector("#trackBody .no", { timeout: 10000 });
    const total = await pb.$eval("#trackBody .tot .num", e => e.textContent);
    ok(price === "680 ج" && total === price, `server total matches the builder price (${price} → ${total})`);
    ok(E.errs.length === 0, "no console errors against the backend", E.errs);
    await cb.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log("Failed:\n - " + fails.join("\n - ")); process.exit(1); }
})().catch(e => { console.error("FATAL", e); process.exit(1); });
