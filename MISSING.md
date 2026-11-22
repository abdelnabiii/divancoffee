# Missing content — Divan Coffee

Tick list for everything the site needs but doesn't have yet. Reply **skip** to any item: skipped products keep their line-art icon.

## How each product photo should be shot
- **Square-friendly.** The site crops every photo to a square (menu row 50 px, product sheet 96 px, popular cards 64 px), so keep the product centred with some space around it.
- **The real thing.** The drink in the cup/glass you actually serve, the pastry on your plate. No stock photos, no text, logos or watermarks.
- **Plain background** (wood, marble or a single colour), **daylight or soft light**, no flash.
- **Phone camera is fine.** Send the original file (not a WhatsApp-compressed copy if you can avoid it). I convert it to WebP, max 900 px, quality 85, saved as `assets/menu/<id>.webp`.

## Product photos (13) — the drinks were removed from the menu in v6
The 7 coffee products already have a designed 3D bag (drawn in code from the menu data), so their photos are optional — send a photo of the real bag only if you want it shown in the menu rows. Bakery photos are still useful.

| # | ID | Product | Shot needed | Status |
|---|---|---|---|---|
| 1 | p051 | كرواسون تركي بالجبنة ★ | On a plate, 45°, one cut open to show the filling | ⬜ |
| 2 | p046 | كرواسون سادة | Plain croissant on a plate, 45° | ⬜ |
| 3 | p047 | كرواسون جبنة | Cheese croissant, 45°, cut to show filling | ⬜ |
| 4 | p048 | كرواسون تركي | Turkish croissant, 45° | ⬜ |
| 5 | p049 | كرواسون لوز | Almond croissant, 45°, almonds visible | ⬜ |
| 6 | p050 | كرواسون شوكولاتة | Chocolate croissant, 45°, cut to show filling | ⬜ |
| 7–13 | p052–p058 | the 7 coffee products | Optional: your real bag, front, plain background | ⬜ optional |

## Other assets the site doesn't have
| Item | Why | Status |
|---|---|---|
| Intro clip (≤ 6 s, MP4, ≤ 2.5 MB): coffee beans bursting toward the camera on Divan red | v6 intro; without it the site shows the logo stamp. Put it in `assets/` and set `introVideo` in `js/config.js` | ⬜ optional |
| Ingredient image sheet (beans, hazelnut, caramel, cardamom, cinnamon, ground coffee) | v6 floating bits + storm; today they are drawn in code | ⬜ optional |
| Vector logo (SVG or PDF/AI) | Sharp logo at any size; today only 885×760 PNG/WebP exist | ⬜ |
| 2–3 cafe photos (storefront in X Mall + interior) | Google listing / structured data, and a real-photo version of the share image | ⬜ |
| Share image 1200×630 | ✅ made from the logo (`assets/share-1200x630.jpg`); can be redone with a cafe photo | ✅ |
| Maskable app icons | ✅ made (`assets/icon-maskable-*.png`) | ✅ |

## Values to confirm (they look unverified)
| Value | Currently | Status |
|---|---|---|
| Site address (domain) | not set → share links/sitemap use a placeholder | ⬜ later |
| Opening hours | empty (not shown on the site) | ⬜ |
| WhatsApp / phone | 201000160277 / 01000160277 | ⬜ |
| Cafe coordinates | 30.043304, 31.4685865 | ⬜ |
| Delivery radius | 50 km (very large for a cafe) | ⬜ |
| Delivery fee / minimum order / tables | 30 ج / 0 / 15 | ⬜ |
| Cashback | 10 %, max 100 points per order, 1 point = 1 ج | ⬜ |
| Social links | facebook.com/divancoffee.eg, instagram.com/divancoffee.eg, tiktok.com/@divancoffee.eg | ⬜ |
| Every price vs the printed menu | 58 prices in `js/seed.js` | ⬜ |
| Demo coupon `DIVAN10` (10 %, min 100 ج) | not in the live database yet | ⬜ |
| Admin email | — | ⬜ |
