# Divan Coffee — ordering site redesign with one travelling 3D cup

> **As built (v6) — differences from the spec below, decided during the build:**
> - **Coffee bags, not cups.** The 3D object is a stand-up coffee pouch (Stride's pillow geometry with a crimped top seal), and the hero shows the **7 bean products** (p052–p058), not 5 drinks. Front: logo, name, price per kilo; back: the product's real options. Code: `js/bag.js`, `js/stage.js`, `css/stage.css`.
> - **Drinks and bakery removed from the menu**; the menu is the 7 coffee products only. Section 2 steps: بنختار أجود بن / بنحمّصه عندنا / وبنطحنه على كيفك / the bag's name. The builder (§13) uses the same 7 products.
> - **No import map**: it would be an inline script, which the CSP forbids. `vendor/three/RoomEnvironment.js` imports `./three.module.min.js?v=6` directly; three loads only after the catalogue arrives.
> - **Ink text, not cream,** on the coloured hero, section 2 and cards: cream on these colours is ~2:1 contrast. Hero colours are lightened where needed to reach ≥ 4.5:1 with ink.
> - Nav labels: البن / حكايتنا / المنيو / اعمل كيسك. On phones the next arrow sits at the left edge beside the centre bag.
> - The intro video is optional (`introVideo` in `js/config.js`); without it the logo stamp plays.

Redesign the Divan Coffee (ديفان كوفي) ordering site so it looks and moves like the Stride reference page, while it stays a working Arabic ordering site. The page sells coffee and drinks from a cafe in X Mall, Fifth Settlement, Cairo. Its centrepiece is a real-time 3D takeaway cup (Three.js / WebGL). Every cup on the hero arc is 3D. The cup you pick in the hero then travels down the page as one object:
- It flies into a pinned "from bean to cup" section and turns 180° at every step.
- It spins through a storm of its own ingredients.
- It lands exactly on its own card in the "signature drinks" grid, right above the full menu.

The background of the hero and section 2 always takes the active drink's colour. When the drink changes, the new colour grows out as a circle from behind the centre cup.

This replaces the "no redesign" rule of the earlier production fix-up. Everything else from that work stays: Supabase backend, ordering flows, admin dashboard, security, cPanel hosting, tests.

---

## 0. Hard constraints (carry over from the existing site)

- **Static and cPanel-compatible.** Plain HTML/CSS/JS, no framework, no build step. Keep the `?v=` cache-busting convention; this release is `?v=6`.
- **Arabic, RTL, Egyptian dialect.** `<html lang="ar" dir="rtl">`. Keep every existing Arabic string unless this spec replaces it. New copy is Egyptian Arabic, short, in the existing brand voice ("قهوتك على كيفك").
- **Ordering must keep working exactly as now:** the full 58-item menu, product sheets with required options, cart, coupon, delivery map (Leaflet + OpenStreetMap) with the radius check, pickup, table orders (`?t=N` banner + "مش على ترابيزة؟"), checkout, tracking, account, loyalty beans (حبّات), change password. The backend contract (`js/api.js`, the 26 RPCs in `supabase/schema.sql`) does not change.
- **Admin dashboard** (`admin.html`) is not part of the redesign. Leave it as it is.
- **No new network hosts.** Three.js is self-hosted (§1). The CSP in `.htaccess` stays `script-src 'self'`. Allowed hosts remain: the site itself, `*.supabase.co`, `tile.openstreetmap.org`.
- **Never** a horizontal scroll, at any width.
- **Performance budget (phone, 4G):** first menu interaction under 3 s; 3D code and textures lazy-start after the menu data has loaded; total added JS ≤ 200 KB gzipped (three.module.min.js is about 170 KB gzipped).
- **Fallbacks:** without WebGL (or with `failIfMajorPerformanceCaveat`), every 3D cup becomes a flat CSS sprite in the same place, and every section still works. The menu and ordering never depend on WebGL.

## 1. Assets

Self-host everything under the site folder. Do not hotlink.

| Asset | Path | Status | How it is used |
|---|---|---|---|
| Logo, cream on transparent | `assets/logo-cream.webp` (+ `.png`), 885 × 760 | exists | Header, intro stamp, cup sleeve print, footer |
| Logo, red on transparent | `assets/logo-red.webp` (+ `.png`) | exists | Cup lid stamp, light backgrounds |
| App icons, share image | `assets/icon-*.png`, `assets/share-1200x630.jpg` | exist | Unchanged |
| Ingredient sheet (transparent PNG, ≥ 2400 px wide) | `assets/sheet.webp` | **to generate** | One sheet holding 6 ingredient "bits" (see crop table). CSS `background-position` crops and WebGL texture crops of the same sheet. Never sliced into separate files. |
| Intro clip (≤ 6 s, 1280 px wide, ≤ 2.5 MB, MP4 H.264, muted) | `assets/intro.mp4` | **to generate** | Coffee beans, a milk splash and a cup burst toward the camera on Divan red `#961a12` |
| Three.js 0.160.0 | `vendor/three/three.module.min.js` | to vendor | Copied from `three@0.160.0/build/`. Import map: `"three": "./vendor/three/three.module.min.js?v=6"` |
| RoomEnvironment | `vendor/three/addons/environments/RoomEnvironment.js` | to vendor | Import map prefix `three/addons/` → `./vendor/three/addons/`. Soft reflections on the cup coating. |

**Until the two "to generate" assets exist**, the build must still work:
- No intro clip → skip straight to the logo stamp (§7).
- No ingredient sheet → draw the bits procedurally on canvas (coffee bean = brown ellipse with an S-shaped seam; ice cube = rounded translucent square; mint leaf = green almond shape with a centre vein; milk drop = cream teardrop; caramel cube = rounded gold square; cinnamon = two rolled brown curls). The same procedural canvases feed both the CSS sprites (`toDataURL`) and the WebGL textures.

### Ingredient bits on the sheet (fill in the measured source pixels once generated)

| Bit | Content | Box `[x, y, w, h]` |
|---|---|---|
| 0 | roasted coffee beans (3–4 beans) | TBD |
| 1 | milk splash / drop | TBD |
| 2 | caramel cube with a drip | TBD |
| 3 | ice cubes | TBD |
| 4 | mint leaves with a lime wedge | TBD |
| 5 | cinnamon sticks | TBD |

**CSS sprite crop**, same rule as before: for a box `(x, y, w, h)` with padding `pad`, enlarge it by `pad` on every side, then `background-size: SW/w × 100%, SH/h × 100%` and `background-position: x/(SW − w) × 100%, y/(SH − h) × 100%`, where SW × SH is the sheet size. Bits use pad = 0.

## 2. The five signature drinks

The hero shows five drinks: the five popular drinks from `js/seed.js`. Names, prices and options always come from the live catalogue (`get_catalog`), never hard-coded. Only the colour and the 3D/print details below are design data, kept in a `SIGNATURE` table in `js/app.js` keyed by product ID.

| # | Product ID | Name (from catalogue) | Drink colour `--flav` | Ingredient bit (storm) | Cup |
|---|---|---|---|---|---|
| 0 | p002 | قهوة تركي دوبل | `#a0634a` | bit 0 (beans) | paper, hot |
| 1 | p009 | لاتيه | `#c99b72` | bit 1 (milk) | paper, hot |
| 2 | p012 | سبانش لاتيه | `#d6a85c` | bit 2 (caramel) | paper, hot |
| 3 | p028 | آيس سبانش لاتيه | `#8fb2c4` | bit 3 (ice) | clear, iced |
| 4 | p029 | موهيتو | `#8fbf8c` | bit 4 (mint) | clear, iced |

- If a signature product is hidden, deleted or sold out (`available === false`) in the dashboard, its cup stays on the arc but its CTA says "خلص النهارده" and is disabled. If fewer than 3 signature products are active, the hero falls back to the static hero (§13 fallback).
- Each colour must keep ink text `#2a120d` at a contrast of ≥ 4.5:1 on the title. Check every colour; darken by 8% steps until it passes.
- Starting drink: لاتيه (index 1, counter "02").

## 3. Fonts

All already self-hosted in `fonts/` (WOFF2, Arabic + Latin subsets, `font-display: swap`).

| Family | Weights | Role (Stride equivalent) |
|---|---|---|
| Reem Kufi | 700 | Display (Archivo Black): hero title, section headlines, outline numbers, card names. Class `.disp`, line-height 1.05. |
| Readex Pro | 400, 500, 600, 700 | UI text (Inter) and captions (DM Mono). Captions use 500 with `font-variant-numeric: tabular-nums`. |

Rules:
- **No `letter-spacing` on Arabic text, ever.** It breaks the joined letters. Latin-only labels (e.g. "01") may use tracking.
- Before drawing the cup prints on canvas, await `document.fonts.load` for Reem Kufi 700 and Readex Pro 500 and 700, in Arabic (`"700 40px 'Reem Kufi'", "قهوة"`).

## 4. Head, tokens and scaling

- **Head:** keep the existing title, description, OG/Twitter tags, JSON-LD, canonical and manifest. Add the import map and `<link rel="modulepreload" href="vendor/three/three.module.min.js?v=6">`, but only start loading three after the catalogue arrives.
- **Tokens:** keep the existing `:root` tokens (`--red #961a12`, `--red-2`, `--red-3`, `--ink #2a120d`, `--cream #f6e7d2`, `--paper #fbf3e6`, `--gold #c8963e`, …). Add:
  - `--flav` (live drink colour, default `#c99b72`)
  - `--dark: #1f0f0b` (section 4 background)
  - `--ease: cubic-bezier(.22,.8,.24,1)`
- **Scaling** (same system as Stride): hero unit `--u = min(100vw/1440, 100svh/900)` on a 1440 × 900 frame; scrolling sections `--w = 100vw/1440`; nav `--n = min(100vw/1440, 1px)`. Section 2 uses a fixed 1440 × 900 frame (390 × 780 on phones) scaled from the viewport centre. Below 820 px wide, the phone layout applies.
- **Mirroring for RTL:** every left/right value in the Stride spec is mirrored. "Next" is the drink to the **left** of the centre cup; the arc's positive k runs to the left; the counter sits at the left edge, the next button's arrow points left (←), and the keyboard ← key means "next".
- **Body:** `overflow-x: hidden`; class `locked` (`overflow: hidden`) while the intro plays.

## 5. Layering

One `<canvas id="gl">`, the first element in `<body>`: `position: fixed; inset: 0; width: 100vw; height: innerHeight px; z-index: 2; pointer-events: none`. Every 3D cup is drawn into it. Section backgrounds have no z-index, so they paint under it.

| Above the canvas | Under the canvas |
|---|---|
| intro (z 100), the bottom sheets and scrim (z 60–61), toast (z 80), map picker (z 75), cart bar (z 45 → raise to 55), header (z 50), hero title / next / autoplay (z 60), section 2 front layer `#inFront` (fixed, z 3) | hero counter (z 1), rings, floating bits, section 2 outline number, everything in the shop and the full menu |

The hero must not create a stacking context (no `isolation`, `transform`, `filter` or `opacity < 1` on `#hero`), or the title would fall under the canvas.

## 6. The 3D cup

### Geometry (shared by every cup)

A 12 oz takeaway cup, 1 unit wide at the rim, CH = 1.32 units tall. Built with `LatheGeometry` from a profile (radius, height), 64 radial segments:

| Part | Profile |
|---|---|
| Body | bottom radius 0.36 at y = 0, straight taper to rim radius 0.5 at y = 1.12 |
| Rolled rim | a half-torus of tube radius 0.018 at y = 1.12 |
| Sleeve (paper cups only) | a separate band from y = 0.30 to y = 0.82, pushed out 0.012, own material |
| Lid (hot) | dome: flat ring radius 0.52 at y = 1.13, rising to a 0.42-radius plateau at y = 1.24, with a sip-hole bump (small capsule) at the front |
| Lid (iced) | flat lid radius 0.52 at y = 1.13 and a dome of radius 0.4 to y = 1.30, plus a straw: cylinder radius 0.022, from y = 0.6 inside the cup to y = 1.62, tilted 8° |
| Liquid (iced, clear cups only) | a second lathe inside the body at 0.97 scale, from y = 0.04 to y = 0.92, coloured with the drink colour; ice cubes as 5 small rounded boxes floating near the top |

Origin at the cup's centre of height so rotation looks natural.

### Textures (per drink, canvas-drawn)

**Sleeve / paper body print (front half, then the back half of the same 2048 × 512 canvas, wrapped around the lathe UV):**
- Paper cups: body = cream `#f6e7d2`. Sleeve = the drink colour with a 6 px darker border top and bottom.
- Front half of the sleeve (u 0.25–0.75 faces the camera at ry = 0): the cream logo centred, 62% of the sleeve height; under it the drink name in Reem Kufi 700, cream, 9% of the sleeve height.
- Back half (u 0.75–1.25, seen after a 180° turn): a "recipe card" in the same layout logic as Stride's nutrition panel, in Readex Pro, right-aligned (RTL):
  - Title "الوصفة" in Reem Kufi 700.
  - Rows with a hairline under each, label on the right, value on the left. Rows come from the product's option groups in the catalogue (e.g. "السكر: سادة · ع الريحة · مظبوط · زيادة") plus fixed design rows per drink:
    - قهوة تركي دوبل: "البن: توليفة ديفان" / "التحميص: وسط" / "الحجم: دوبل"
    - لاتيه: "إسبريسو: شوت واحد" / "اللبن: مبخّر" / "الحجم: 12 أونصة"
    - سبانش لاتيه: "إسبريسو: شوت واحد" / "اللبن المكثّف: محلّي" / "الحجم: 12 أونصة"
    - آيس سبانش لاتيه: "إسبريسو: شوت واحد" / "اللبن المكثّف: محلّي" / "تلج: على كيفك"
    - موهيتو: "نعناع: فريش" / "ليمون: فريش" / "سفن أب" (from the product description)
  - Under the rows: "قهوتك على كيفك" and the handle "@divancoffee.eg" (Latin, may use tracking).
- Clear cups: no sleeve; the logo and name are printed straight on the plastic in cream with 85% opacity; the back shows the recipe card on a cream label patch.

Textures: `CanvasTexture`, `colorSpace = SRGBColorSpace`, `anisotropy = min(8, max)`.

### Materials, lighting, camera

- **Paper body and sleeve:** `MeshPhysicalMaterial`, roughness 0.62, clearcoat 0.25, clearcoatRoughness 0.5, envMapIntensity 0.35.
- **Lid:** `MeshPhysicalMaterial`, colour `#f3ece4` (hot) or clear (iced: `transmission 0.92`, `thickness 0.05`, roughness 0.18, ior 1.45).
- **Clear cup body:** transmission 0.9, roughness 0.12, thickness 0.04. On phones, replace transmission with `transparent: true`, opacity 0.35 (transmission is too heavy).
- Each cup has its own material instances so it can fade on its own.
- **Lighting:** `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)`; ambient white 0.55; directional key white 1.1 from (0.6, 0.9, 1.4) (mirrored for RTL); renderer `antialias`, `alpha`, sRGB output, no tone mapping; pixel ratio min(dpr, 2), 1.75 below 820 px.
- **Contact shadow:** an ellipse plane under the cup (not behind it), 1.2 × 0.35 units, radial-gradient canvas rgba(60,10,5,.5) → transparent, `depthWrite: false`, `renderOrder −1`, at the cup's base, opacity 0.5·opacity·shadow factor.
- **Camera:** identical to Stride: D = clamp(1500·min(vw/1440, vh/900), 1000, 2200); `PerspectiveCamera` at (0, 0, D), fov = 2·atan((vh/2)/D), near 10, far 4D. One world unit = one CSS px at z = 0.
- **Placing a cup from a screen-space state** `{x, y, h, rz, ry, rx, z, op, sx, sy, shadow}`: position (x − vw/2, vh/2 − y, z), scale h/CH (× sx, × sy), rotation order `ZYX`, rotation (rx·π/180, ry·π/180, −rz·π/180); hidden when op ≤ 0.01.

## 7. Intro → hero entrance

- **Show the intro at most once per 24 h** (`localStorage` key `dv_intro_at`), never on a `?t=` table visit, never under reduced motion, never when the cart already has items. Repeat customers go straight to the hero.
- **Intro layer** `#intro`: fixed, inset 0, z 100, background `#961a12`, video `object-fit: cover`, muted, `playsinline`, `preload="auto"`.
- **Skip pill:** top 28u, left 36u (RTL), 38 px tall, cream at 85% with an 8 px backdrop blur, Readex Pro 600 13 px, "تخطّي".
- **Playback:** from 0.3 s once `readyState ≥ 3` (else on `canplay`). At 4.2 s (or `ended`, `error`, or no playback after 3 s) switch to the logo stamp on cream `#f6e7d2`: `logo-red.webp` at 260u, popping from scale 0.72 / opacity 0 → 1.04 at 70% → 1 over 380 ms ease-out, holding 600 ms. Failsafe: enter the hero after 8 s regardless.
- **Hero entrance:** intro fades out; body unlocks; header slides down from −110% over 900 ms `cubic-bezier(.22,.9,.24,1)`; rings fade and scale 0.85 → 1 over 1100 ms; next button, counter and autoplay fade in at 500 / 620 / 740 ms; `pos` tweens from −2.6 to 1 over 1700 ms `cubic-bezier(.16,1,.3,1)`, so the cups sweep in from the left (RTL) and land on the arc.

## 8. Section 1 — Hero carousel (`#hero`)

Replaces the current hero (big logo + sprig + mode buttons). The order-mode switch (توصيل / استلام / ترابيزة) moves into the header as a compact segmented control (§12); the table banner stays above the header.

- **Size:** 100svh (min 560 px), `overflow: hidden`, background `var(--flav)`.
- **Children, in order:** `.reveal` (colour circle, `clip`/mask as Stride), `.rings` (same gradient, white at 13% / 2%), `.bits` (five floating ingredient sprites), `.arc` (hit area, `touch-action: pan-y`), then the next button, the title, the price + CTA row, the counter and the Autoplay toggle.

### Arc

Same layout table as Stride, mirrored (positive k to the left), with heights scaled for a cup (CH 1.32 vs the bar's 2.085):

| \|k\| | dx (u) | dy (u) | height (u) | rz (°) | ry (°) |
|---|---|---|---|---|---|
| 0 | 0 | 0 | 360 | 0 | 0 |
| 1 | 250 | 26 | 280 | −4 | −16 |
| 2 | 460 | 48 | 262 | −8 | −26 |
| 3 | 670 | 84 | 248 | −12 | −34 |
| 4 | 870 | 120 | 236 | −15 | −40 |

(dx, rz, ry take the sign of k, then the whole layout is mirrored for RTL.) z = −|k|·34u; opacity 1 up to |k| = 3.3, 0 by 3.9. Pool of 11 cups; the selected cup is the traveller (§11). Idle float: b = sin(now/4600·2π + 1.37j); y −= (0.5b + 0.5)·9u; rz += 0.4b; plus a slow lid-catching turn ry += 4·sin(now/7000·2π + j).

### Text and controls

- **Title** `#title` (h1, Reem Kufi 700, ink, `aria-live="polite"`): the drink name from the catalogue, centred, top 50% + 250u, size min(92u, 760u·100/w) where w is the measured width at 100 px. **Animate per word, not per letter** (Arabic letters must stay joined): each word is an inline-block that rises from +110% / fades in (620 ms, `cubic-bezier(.22,1,.36,1)`, 120 ms + 60 ms per word); old words leave to −110% (300 ms, 30 ms per word).
- **Price + CTA row** (new, under the title): the live price "65 ج" in Readex Pro 700 (ink) and a cream pill button "اطلبه دلوقتي" (Readex Pro 700, 46u tall, min 44 px). It opens the product sheet for that drink (the existing `openProduct`). Disabled with "خلص النهارده" when the product is sold out.
- **Counter** `#count`: Reem Kufi 700 200u, transparent fill, 1.5 px rgba(255,255,255,.9) stroke, Latin digits "01"–"05", top 50% + 200u, **left** 28u, z 1.
- **Next button** `#next` (aria-label "المشروب اللي بعده"): cream circle 52u at 50% / 50% + 185u, an ink ← arrow; hover scale 1.08 and the arrow nudges 2 px left; active 0.94.
- **Autoplay** `#auto`: left 40u, top 50% + 160u; ring + pause/play glyph + "تشغيل تلقائي" (Readex Pro 500, 12 px, cream). 3200 ms of no interaction, only while the hero is ≥ 60% visible and the tab is visible. `aria-pressed`. On by default, off under reduced motion.
- **Floating bits** (blurred 1.5 px), mirrored from Stride:

  | Position (x / y of the hero) | Size (u) | Rotation | Bit |
  |---|---|---|---|
  | .88 / .20 | 120 | 18° | 0 |
  | .14 / .18 | 96 | −22° | 2 |
  | .93 / .74 | 84 | −12° | 3 |
  | .345 / .15 | 78 | 10° | 1 |
  | .795 / .885 | 70 | −30° | 5 |

  Same fade-in and composite drift as Stride; 1.3× on phones with bits 1, 3, 5 hidden.

### Changing drink

Identical behaviour to Stride (drag with 6 px threshold, slotPx = 250u·spread, velocity flick to ±2, `goTo` timings, tap-raycast, keys, cursor, slide 650 ms + 160 ms per extra slot with `cubic-bezier(.25,.75,.2,1)`, colour reveal at 12% over 420 ms with a feathered mask, counter crossfade), with three changes:
- Drag direction is mirrored: dragging right brings the next drink (pos = pos0 + dx/slotPx).
- The title uses the per-word animation above.
- On every change, the price + CTA row crossfades with the counter timing, and the matching signature card in section 3 gets class `live`.

**Smooth wheel scrolling:** as Stride (desktop mouse/trackpad only, exp-glide 120 ms, skipped for ctrl+wheel, horizontal wheel, touch, reduced motion, intro lock). It must also stop while any bottom sheet, the map picker or the account sheet is open, and never intercept wheel events inside a scrollable sheet.

## 9. Section 2 — "من الحبة للفنجان" (`#inside`), pinned, with the cup turning

Same mechanics as Stride's section 2 (500vh, sticky `.pin`, `.in-dark`, back frame with the outline number and the `#inBar` box renamed `#inCup`, fixed front layer `#inFront` at z 3 replaying sticky, steps from scroll, time-based flip tween 720 ms per 180° with sine ease-in-out, text crossfade at 38%, storm at p > 0.76).

- **Frame boxes** (mirrored): `.in-num` Reem Kufi 428 px at right 510 / top 240 / width 640; `#inCup` right 665 / top 150, 330 × 560; headline right 40 / top 300, Reem Kufi 84 px, cream, line-height 1.05; step icons at left 82 / top 310; caption left-aligned at left 42 / top 596, Readex Pro 500 15 px, cream at 92%.
- **Step icons** (4 circles, 66 px): bean, flame (roast), cup, heart.

| Step | Headline | Caption | Cup angle (ry) |
|---|---|---|---|
| 01 | بنختار / أجود بن | يمني، كولومبي، كيني، برازيلي. | 0° (front: logo + name) |
| 02 | بنحمّصه / عندنا | تحميص فاتح، وسط أو غامق — على كيفك. | 180° (back: recipe card) |
| 03 | بيتعمل / قدامك | طازة في كل فنجان. | 360° (front) |
| 04 | the selected drink's name, one word per line (0.72em if a word is longer than 9 letters) | price "65 ج" + "+ حبّات على كل طلب" (cashback % from settings) | 720° |

- The step 01 caption lists the origins from `settings.origins` (live data), joined with "،".
- **Pose:** rz = −10° (the top leans left), bob sin(now/2600·2π)·6 px, shadow factor 1.
- **Storm:** as Stride (20 pieces, one wave, 70% the drink's bit, the rest random among the six bits, spin, the bar's extra 720°·q turn, `.in-dark` to 0.42 using `#1f0f0b`). Hidden under reduced motion.

## 10. Section 3 — Signature cards + the full menu (`#menu`)

### Signature cards ("الأكثر طلبًا")

- Background `var(--paper)`. Padding 96w / 39w / 40w.
- **Headline** "الأكثر / طلبًا" (Reem Kufi 94w, line-by-line reveal from 105%, 1 s `--ease`, second line +80 ms, at 18% visibility).
- **Caption** (left side): "خمس مشروبات / الناس بتطلبها كل يوم. / اختار مشروبك." Readex Pro 500 16w, fades up 24 px.
- **Cards:** 5-column grid, 18w gaps, perspective 1200 px. Each card 390w tall, radius 22w, background = the drink colour, `preserve-3d`.
  - Name: Reem Kufi 30w, `#fbf3e6`, centred at top 26w, up to two lines.
  - Cup sprite `.pk`: 150w × 200w, centred at top 104w, `translateZ(30px)`. Without WebGL it is a flat PNG render of the cup (generated once at load from the WebGL scene with `toDataURL`, or the drink's category icon from `js/art.js` if WebGL never ran).
  - Price "65 ج" bottom-right 16w (RTL: bottom-left), Readex Pro 700.
  - "+" button 44w (min 44 px), dark, cream ring. **It opens the product sheet** (options such as sugar are required), it does not add blindly. After "ضيف للسلة" in the sheet, the cup flies into the header cart (§12).
- Tilt, press and poke interactions exactly as Stride. On the live card the 3D cup replaces the sprite (`.gl .card.live .pk { visibility: hidden }`).

### Full menu (unchanged in function, restyled)

Directly under the cards: the existing category rail (`#rail`, sticky under the header) and every category section with its rows (`#menuRoot`), exactly the current markup and behaviour (rows open the product sheet, sold-out rows, kg note, "متوفر لدينا كمان" origins block). Visual updates only:
- Section titles in Reem Kufi with the outline-number style used in section 2 (category index "01"–"07" as a 120w outline number behind the title).
- Rows keep their current layout; the row thumbnail uses the product photo when one exists (`assets/menu/<id>.webp`), otherwise the category icon.
- Loading, empty and error states stay as they are now (skeletons → "بنحاول نوصل للسيرفر…" → error with retry + phone/WhatsApp).

## 11. The traveller: one cup, hero → section 2 → its card

Exactly as Stride §10 with these anchors:
- **A (hero):** the arc state at k = jT − pos, with idle float.
- **B (section 2):** centre and height of `#inCup`; rz −10°, ry = flip + storm spin, bob.
- **C (card):** centre and height of that drink's `.pk` rect; rz 0, ry = nearest whole turn of B + tiltX·14°, rx = −tiltY·14°, z 30, shadow 0.7.
- Blending with p1 / p3 and easeInOut as Stride; other hero cups fade by (1 − clamp(1.6·p1)). On phones, the card strip scrolls to centre the selected card the first time p3 > 0.

## 12. Header (replaces the current top bar and the nav)

- Fixed, z 50, 84n tall (64 px on phones), padding 0 40n. Ink on the hero (the drink colours are light), cream over section 4.
- **Right (RTL start):** the cream/red logo (switches with the theme), 48n tall, linking to `#hero`.
- **Centre:** a frosted pill (1.5 px white border, white 10%, 10 px blur) with four links: "المشروبات" (#hero), "حكايتنا" (#inside), "المنيو" (#menu), "البن" (#beans). Active-link highlight slides under the active link (0.5 s `--ease`); the active link is the last section whose top is above 35% of the viewport. Over the menu: `.light`; over section 4: `.dark`.
- **Left (RTL end):** the existing header buttons, restyled as 37n chips: the order-mode segmented control (توصيل / استلام, or "ترابيزة N" when a table is set), حبّاتي (beans count), حسابي, and the cart chip with the item badge (pops in from scale 0 and bounces 1.5 → 1 over 350 ms; the chip bumps 1 → 1.18 → 1 when a cup lands).
- The existing open/closed status ("بنستقبل طلبات" / "الطلب الأونلاين مقفول") becomes a small dot + label under the logo.
- **Phones:** the pill links move to a fixed bottom bar (bottom 14 px + safe area). The existing cart bar ("كمّل طلبك") sits above it, so neither covers the other.

## 13. Section 4 — "خد البن معاك" (`#beans`), build your bag

Adapts Stride's "Build your 3 pack" to the real coffee-bean products (categories `blends` and `french`, 7 products sold by weight).

- Background `var(--dark)`, cream text, min-height 100svh, padding as Stride.
- **Headline** "خد البن / معاك [للبيت]" with "للبيت" in a cream rounded box (Reem Kufi 72w, line-by-line reveal).
- **Glow** circle (600w) behind the bag, `--g` = the selected blend's colour at 0.72 (colours: توليفة ديفان `#b07a4f`, توليفة سبيشيال `#c8963e`, توليفة VIP `#9a6a8c`, بن إسبريسو `#6e4a3a`, بن فرنساوي `#a8845e`, بن فرنساوي بندق قطع `#b8946a`, بن فرنساوي نكهات `#c29a7a`). Pulses 0.55 → 1 over 600 ms on change.
- **Centre:** a flat coffee-bag sprite drawn on canvas (kraft bag, cream label with the logo and the blend name), 200w × 280w, rising from −40w / 0.8 over 550 ms on change.
- **Pickers** (from the live product options, never hard-coded):
  - Blend thumbnails: a row of the 7 products (107w squares in their colour, the bag sprite, name in Readex Pro 700 11w).
  - Weight chips (الوزن: ربع كيلو / نص كيلو / كيلو), then the product's other required groups (التحويجة, درجة التحميص, الطحن) as chips.
- **Price:** live, computed with `DV.lineUnit(product, selections)` (the same rule the server uses), shown as "240 ج" in Readex Pro 700.
- **Buy button** `#beanBuy`: cream pill 54w (min 44 px), "ضيف للسلة" + the price; disabled with "اختار [group]" until every required group is chosen. Clicking adds the line to the real cart (same cart as the menu), the bag flies into the header cart (fly-to-cart keyframes as Stride §11), and the button shows "اتضاف للسلة ✓" on `#2f7a43` for 1600 ms.
- **Starts filled:** first time 30% in view, preselect توليفة ديفان, نص كيلو, and the first choice of each other required group.

## 14. Kept sections

- **"نوّرنا في الكافيه" (visit)** and the **footer**: unchanged content (map card, address, phone, WhatsApp, hours, socials, handle, credit), restyled to the new type scale.
- **Cart, product sheet, checkout, map picker, tracking, account, table banner, toasts, demo bar:** unchanged behaviour. Restyle only colours/radii to match. The fly-to-cart animation runs after "ضيف للسلة" in the product sheet as well.

## 15. Phone layout (< 820 px) and other sizes

Mirror Stride §13, with:
- **Hero:** title at bottom 150 px + safe area, clamp(36px, 11vw, 60px), wrapping between words; price + CTA row under it; counter top 76 / left 14, 56 px; autoplay top 142 / left 16; next button 48 px above the title. The bottom nav bar and the cart bar must not cover the CTA.
- **Section 2:** 390 × 780 frame; headline right 16 / top 84, 38 px; outline number top 250, 200 px; cup box right 115 / top 210, 160 × 270; icons row bottom 118; caption bottom 80, 12 px.
- **Signature cards:** horizontal snap strip, 68vw cards (max 300 px), min(100vw, 420px) tall.
- **Beans builder:** stacked: bag + glow (min(100%, 360px)), blend thumbnails in a scrollable row, chips wrap, full-width buy button.
- **≤ 359 px:** hide the logo text-lockup, pill links 13 px with 11 px padding, card names 20 px.
- **Landscape phones and short desktops:** as Stride.
- **Static hero fallback** (no WebGL, < 3 signature drinks, or the catalogue failed): the current logo hero with the "شوف المنيو واطلب" CTA, on `--red`.

## 16. Reduced motion

`prefers-reduced-motion: reduce`: no intro, Autoplay off, instant drink changes (no slide or reveal), no idle float or bob, instant turns in section 2, no storm pieces or storm spin, static bits at 0.55 opacity, instant scrolling, no fly-to-cart (badge updates directly), no tilt.

## 17. Accessibility

- The hero carousel is a `role="region"` with `aria-roledescription="carousel"`, label "المشروبات المميزة"; the title is the live region; each cup has an invisible button in `.arc` ("لاتيه — 65 ج") so screen readers and keyboard users can pick a drink.
- Every control ≥ 44 × 44 px on touch; visible focus rings (2 px cream + 2 px ink).
- Colour contrast ≥ 4.5:1 for all text; check the five drink colours and the seven blend colours.
- The canvas is `aria-hidden="true"`.

## 18. Tests and delivery

- Extend `tests/site.e2e.js`:
  - the arc shows 7 cups (WebGL) or 7 sprites (WebGL disabled via `--disable-webgl`);
  - drag / click / ← → change the drink, the colour, the title and the price;
  - the hero CTA opens the right product sheet and an order completes (pickup, delivery inside the radius, table);
  - the cup lands on its card (screen rect within 4 px of `.pk`);
  - the beans builder price equals `DV.lineUnit` and the line reaches the cart and the server total;
  - the intro shows once, never with `?t=`, and Skip works;
  - no horizontal overflow at 1440 × 900, 390 × 844, 320 × 640, 844 × 390, 768 × 1024;
  - no console or CSP errors; the only hosts are the site, `*.supabase.co` and `tile.openstreetmap.org`.
- `tests/rpc.test.js` must still pass unchanged (131 checks).
- Bump `?v=` to 6 everywhere, rebuild with `python3 -I tools/build-zip.py` (add `vendor/three/` and the new assets to the release checks), update `README.md`, `CHANGELOG.md` and `MISSING.md` (intro clip and ingredient sheet as new items to generate).

## 19. Acceptance checklist

1. First visit: the intro plays (or the logo stamp, if there is no clip), then the hero enters with the cups sweeping in on the arc. Skip works. Second visit within 24 h, a table QR visit and reduced motion all go straight to the hero.
2. Seven 3D cups sit on the arc with perspective, a soft shadow and a gentle float; the centre cup is the largest; hot cups have dome lids, iced cups clear bodies, ice and a straw.
3. Dragging (mirrored for RTL), clicking a cup, the ← button or the arrow keys slide the arc with a fast start and a soft 650 ms glide, a feathered colour circle grows from behind the centre cup, and the drink name rises word by word with the letters still joined. Counter 01–05, price and CTA update.
4. "اطلبه دلوقتي" opens the real product sheet; required options are enforced; the order goes through Supabase and appears in the dashboard.
5. Autoplay advances every 3.2 s and can be paused.
6. Scrolling lifts the centre cup into section 2 while the others fade; each step turns it 180° (the back shows the recipe card); step 04 shows the drink name and price.
7. The storm darkens the page while one wave of 20 ingredient pieces flies outward and the cup spins.
8. The cup lands exactly on its own signature card, follows the card's tilt and squashes on click. The full menu below works exactly as before.
9. The beans builder prices every combination exactly like the server, adds to the same cart, and the bag flies into the header cart.
10. No horizontal scroll and nothing cut off at 1440 × 900, 390 × 844, 320 px, 844 × 390, 768 × 1024; the bottom nav, the cart bar and the hero CTA never overlap.
11. With WebGL disabled, every section still works with flat sprites, and ordering is unaffected.
12. No new network hosts; no console or CSP errors; both test suites pass.
