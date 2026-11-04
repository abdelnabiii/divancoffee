// Renders tools/share-image.html to assets/share-1200x630.jpg. Needs Playwright (dev only).
const { chromium } = require("playwright"), path = require("path");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto("file://" + path.join(__dirname, "share-image.html")); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, "..", "assets", "share-1200x630.jpg"), type: "jpeg", quality: 85 });
  await b.close(); console.log("assets/share-1200x630.jpg written");
})();
