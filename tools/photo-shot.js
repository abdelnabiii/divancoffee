// Screenshot one product as customers see it: its menu row + its product sheet (demo mode, fresh browser).
// node tools/photo-shot.js <base-url> <product-id> <out.png>     (dev only, needs Playwright)
const { chromium } = require("playwright");
const [BASE, PID, OUT] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  await c.route("**/js/config.js*", async r => { const x = await r.fetch(); r.fulfill({ response: x, body: (await x.text()).replace(/supabaseUrl:\s*"[^"]*"/, 'supabaseUrl: ""') }); });
  const p = await c.newPage();
  await p.goto(BASE); await p.waitForSelector(".row");
  const row = await p.$(`.row[data-pid="${PID}"]`); await row.scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const rb = await row.boundingBox();
  const rowPng = await p.screenshot({ clip: { x: 0, y: Math.max(0, rb.y - 70), width: 390, height: rb.height + 140 } });
  await row.click(); await p.waitForTimeout(500);
  const sheetPng = await p.screenshot();
  // side by side: row strip on top of the sheet view
  const page2 = await c.newPage();
  await page2.setContent(`<body style="margin:0;background:#ddd;display:flex;gap:8px;align-items:flex-start">
    <img src="data:image/png;base64,${rowPng.toString("base64")}" style="width:390px">
    <img src="data:image/png;base64,${sheetPng.toString("base64")}" style="width:390px"></body>`);
  await page2.setViewportSize({ width: 788, height: 800 }); await page2.waitForTimeout(200);
  await page2.screenshot({ path: OUT, fullPage: true });
  await b.close(); console.log(OUT);
})();
