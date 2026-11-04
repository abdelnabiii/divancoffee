#!/usr/bin/env python3
"""Build divan-upload-to-cpanel.zip — the files to upload to cPanel public_html.

    python3 -I tools/build-zip.py [output.zip]

Default output: ../divan-upload-to-cpanel.zip (next to the site folder, never inside it).
Same layout as the original upload: index.html, admin.html, .htaccess, robots.txt, sitemap.xml,
manifest.webmanifest, assets/, css/, fonts/, js/, vendor/. Dev folders (tests, tools, supabase, audit)
and notes (*.md) are left out.

Release checks (the build stops if any fails):
  - every local file referenced by the HTML/CSS/manifest exists
  - every ?v= in the HTML is the same number
  - JS files parse (node --check), manifest is valid JSON
  - no demo password in the HTML, no secret/service-role key anywhere
If the site address is not set yet (tools/set-domain.js), the tags that need it are left out of the
zip copy (instead of shipping a broken "%SITE_URL%") and a warning is printed.
"""
import json, re, subprocess, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT.parent / "divan-upload-to-cpanel.zip"
SHIP = ["index.html", "admin.html", ".htaccess", "robots.txt", "sitemap.xml", "manifest.webmanifest",
        "assets", "css", "fonts", "js", "vendor"]
errors, warnings = [], []
if ROOT in OUT.parents:
    sys.exit("Refusing to write the zip inside the site folder: " + OUT)

files = []
for name in SHIP:
    p = ROOT / name
    if p.is_dir():
        files += sorted(x for x in p.rglob("*") if x.is_file() and not x.name.startswith("."))
    elif p.is_file():
        files.append(p)
    else:
        errors.append(f"missing {name}")
text = {f: f.read_text(encoding="utf-8") for f in files if f.suffix in (".html", ".css", ".js", ".webmanifest", ".txt", ".xml") or f.name == ".htaccess"}

# --- references exist
def check_ref(base, ref):
    ref = ref.split("?")[0].split("#")[0]
    if not ref or re.match(r"^(https?:|data:|mailto:|tel:|blob:|%SITE_URL%|//|#|%23)", ref) or ref in (".", "./"):
        return
    if not (base.parent / ref).resolve().exists():
        errors.append(f"{base.relative_to(ROOT)} → missing {ref}")
for f in (ROOT / "index.html", ROOT / "admin.html"):
    for ref in re.findall(r'(?:src|href)="([^"$`{]+)"', text[f]):
        check_ref(f, ref)
for f in files:
    if f.suffix == ".css":
        for ref in re.findall(r'url\(["\']?([^)"\']+)', text[f]):
            check_ref(f, ref)
man = ROOT / "manifest.webmanifest"
try:
    for icon in json.loads(text[man])["icons"]:
        check_ref(man, icon["src"])
except Exception as e:
    errors.append(f"manifest.webmanifest: {e}")
for ref in re.findall(r'"(vendor/[^"?]+)', text[ROOT / "js" / "app.js"]):
    check_ref(ROOT / "index.html", ref)

# --- one cache version
vs = set()
for f in (ROOT / "index.html", ROOT / "admin.html", ROOT / "js" / "app.js"):
    vs |= set(re.findall(r"\?v=(\d+)", text[f]))
if len(vs) != 1:
    errors.append(f"mixed ?v= numbers: {sorted(vs)}")
version = vs.pop() if len(vs) == 1 else "?"

# --- JS parses
for f in files:
    if f.suffix == ".js" and "vendor" not in f.parts:
        r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
        if r.returncode:
            errors.append(f"{f.relative_to(ROOT)} does not parse: {r.stderr.strip()[:200]}")

# --- secrets / demo leftovers
for f, t in text.items():
    if "vendor" in f.parts:
        continue
    if f.suffix == ".html" and "divan2026" in t:
        errors.append(f"demo password visible in {f.name}")
    if re.search(r"service_role|sb_secret_[A-Za-z0-9]", t):
        errors.append(f"secret key pattern in {f.relative_to(ROOT)}")
    for jwt in re.findall(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", t):
        import base64
        p = jwt.split(".")[1]; p += "=" * (-len(p) % 4)
        role = json.loads(base64.urlsafe_b64decode(p)).get("role")
        if role != "anon":
            errors.append(f"non-anon JWT ({role}) in {f.relative_to(ROOT)}")

# --- config status
cfg = text[ROOT / "js" / "config.js"]
url = (re.search(r'supabaseUrl:\s*"([^"]*)"', cfg) or [None, ""])[1]
if not url:
    warnings.append("js/config.js has no supabaseUrl → this zip runs in DEMO mode (orders stay in the visitor's browser)")
elif "dergispbnahqslvcvwuz" in url:
    warnings.append("js/config.js still points at the old Supabase project that no longer exists → the live menu will not load")

# --- site address
patched = {}
idx = ROOT / "index.html"
if "%SITE_URL%" in text[idx]:
    warnings.append("site address not set (node tools/set-domain.js https://…) → canonical/og:url/og:image/sitemap left out of the zip")
    h = text[idx]
    h = re.sub(r"\n<link rel=\"canonical\"[^>]*%SITE_URL%[^>]*>", "", h)
    h = re.sub(r"\n<meta (?:property|name)=\"[^\"]+\" content=\"%SITE_URL%[^\"]*\">", "", h)
    m = re.search(r'(<script type="application/ld\+json">)(.*?)(</script>)', h, re.S)
    ld = json.loads(m.group(2))
    for k in [k for k, v in ld.items() if "%SITE_URL%" in json.dumps(v, ensure_ascii=False)]:
        del ld[k]
    h = h[:m.start(2)] + "\n" + json.dumps(ld, ensure_ascii=False, indent=2) + "\n" + h[m.end(2):]
    patched[idx] = h
    patched[ROOT / "robots.txt"] = re.sub(r"\n*Sitemap: %SITE_URL%.*\n?", "\n", text[ROOT / "robots.txt"])
    files = [f for f in files if f.name != "sitemap.xml"]
    if "%SITE_URL%" in h:
        errors.append("index.html still has %SITE_URL% after stripping")

if errors:
    print("BUILD FAILED:\n - " + "\n - ".join(errors)); sys.exit(1)

OUT.unlink(missing_ok=True)
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for f in files:
        arc = f.relative_to(ROOT).as_posix()
        if f in patched:
            z.writestr(arc, patched[f])
        else:
            z.write(f, arc)
size = OUT.stat().st_size
print(f"OK  {OUT}  ({len(files)} files, {size / 1024:.0f} KB, ?v={version})")
for w in warnings:
    print("WARNING: " + w)
