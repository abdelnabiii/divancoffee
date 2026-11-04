# Deploying to cPanel

Upload = the contents of `divan-upload-to-cpanel.zip` (built with `python3 -I tools/build-zip.py`).
It contains: `index.html`, `admin.html`, `.htaccess`, `robots.txt`, `sitemap.xml` (once the domain is set), `manifest.webmanifest`, `assets/`, `css/`, `fonts/`, `js/`, `vendor/`.

## Before the first upload (once)
- [ ] Supabase project created, `supabase/schema.sql` run, admin user added (`README.md` §2–3), `tests/rpc.test.js` passes against it.
- [ ] `js/config.js` has the new `supabaseUrl` + publishable/anon key. The build prints **no** "old Supabase project" / "DEMO mode" warning.
- [ ] Domain set with `node tools/set-domain.js https://…` (otherwise share previews have no image — the site still works).
- [ ] Supabase → Authentication → URL Configuration → **Site URL** = the domain; public sign-ups **off**.

## Upload checklist
1. **Back up what's live** (rollback copy): cPanel → **File Manager** → `public_html` → select all → **Compress** → `backup-YYYY-MM-DD.zip` → download it. First install: skip.
2. **Show hidden files**: File Manager → **Settings** (top right) → tick **Show Hidden Files (dotfiles)**. `.htaccess` is a hidden file.
3. **Upload**: open `public_html` (or the subdomain's folder) → **Upload** → `divan-upload-to-cpanel.zip`.
4. **Extract**: right-click the zip → **Extract** → into `/public_html` → confirm overwrite. Then delete the uploaded zip from `public_html`.
5. **Check the layout**: `public_html/index.html`, `public_html/.htaccess`, `public_html/js/config.js` must sit directly in `public_html`, not in a sub-folder like `public_html/divan-upload-to-cpanel/`. If they did land in a sub-folder, select its contents → **Move** → `/public_html`.
6. **Permissions** (normally automatic): folders `755`, files `644`.

## SSL / HTTPS
1. cPanel → **SSL/TLS Status** → make sure the domain (and `www.`) show a valid certificate. If not: **Run AutoSSL** (or install Let's Encrypt from the hosting panel).
2. cPanel → **Domains** → turn on **Force HTTPS Redirect** for the domain (the `.htaccess` also redirects to https; both together are fine).
3. After SSL works, the site sends `Strict-Transport-Security` (browsers then always use https). Don't turn SSL off afterwards.
4. Behind Cloudflare: set SSL mode to **Full** (not "Flexible"). The `.htaccess` redirect checks `X-Forwarded-Proto`, so it won't loop either way.

## `.htaccess` — what it does (tested on Apache 2.4)
- http → https (301), no loop behind a proxy/CDN.
- Cache: pages (`.html`, manifest, sitemap, robots) are always re-checked; CSS/JS/fonts/images cached for 7 days — that's why `?v=` must be bumped on every update.
- Security headers: Content-Security-Policy (own files, Supabase, OpenStreetMap tiles only), HSTS (https only), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (location for the delivery map only), `X-Frame-Options`.
- `admin.html`: `noindex`, can't be framed.
- If dev folders/notes (`tests/`, `tools/`, `supabase/`, `*.md`) were uploaded by mistake they return 403 — but delete them anyway.
- If the host shows **500 Internal Server Error** right after upload: rename `.htaccess` to `htaccess.off`, reload. If that fixes it, the host lacks `mod_headers`/`mod_rewrite` — ask support to enable them, then rename it back.

## Smoke test after every upload (5 minutes, phone + laptop)
Open the site in a private/incognito window (so nothing old is cached).

**Customer site — `https://your-domain/`**
- [ ] Address bar shows the padlock; `http://your-domain` redirects to `https://`.
- [ ] **No** black "نسخة عرض" bar at the top (that would mean demo mode).
- [ ] Menu loads with all categories; the popular strip shows; prices look right.
- [ ] Open a product with options (e.g. قهوة تركي دوبل) → required choice is enforced → add to cart → the bottom cart bar shows the total.
- [ ] **Pickup order**: cart → استلام → name + your phone → أكّد الطلب → tracking screen with an order number.
- [ ] **Delivery order**: cart → توصيل → اختار على الخريطة → the map loads → confirm a spot → address → order. A spot far away must say "الزون ده مش متاح".
- [ ] **Table order**: open `https://your-domain/?t=1` → yellow banner "ترابيزة 1" → order. Then tap "مش على ترابيزة؟" → delivery/pickup come back.
- [ ] Account: register with a phone → after the admin marks your order "اتسلّم" the beans/points appear.

**Dashboard — `https://your-domain/admin.html`**
- [ ] Log in with the admin email → the three test orders appear (turn on the sound).
- [ ] Move one order new → preparing → ready → **done**; cancel the others.
- [ ] Menu: toggle one product "خلص" → it shows as sold out on the site → toggle back.
- [ ] Upload a photo to one product → it shows on the site.
- [ ] Settings → print the table QR codes page opens.

**Browser console** (laptop, F12 → Console): no red errors on either page.

## Rollback
**Site files** (the usual case):
1. File Manager → `public_html` → delete the new files (keep any folder that isn't part of the site).
2. Upload the `backup-YYYY-MM-DD.zip` from step 1 → Extract into `public_html` → overwrite.
3. Open the site in a private window and re-run the smoke test.
Customers' browsers may hold the new CSS/JS for up to a week only if they share the same `?v=` number — the backup has the older number, so they fetch the old files.

**Database** (rarely needed): `schema.sql` never deletes data, so re-running an older copy of it restores the older functions. Orders, customers and menu edits stay. Before risky changes, export tables from Supabase → Table Editor → each table → **Export to CSV**. (Point-in-time backups need a paid Supabase plan.)

**Emergency "stop orders"** without touching files: dashboard → الطلبات → switch **بنستقبل طلبات** off. Customers still see the menu but can't order.
