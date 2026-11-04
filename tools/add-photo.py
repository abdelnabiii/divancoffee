#!/usr/bin/env python3
"""Add (or replace) a product photo.

    python3 -I tools/add-photo.py <product-id> <photo-file>

1. Converts the photo to WebP, max 900 px on the long side, quality 85, EXIF rotation applied, metadata stripped.
2. Saves it as assets/menu/<product-id>.webp.
3. Records it in js/seed.js (IMAGES map) and regenerates the seed block in supabase/schema.sql.
4. Appends an UPDATE to supabase/photos.sql for a database that is already live.
Needs Pillow (pip install pillow). Not part of the site.
"""
import json, re, subprocess, sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
pid, src = sys.argv[1], Path(sys.argv[2])
if not re.fullmatch(r"p\d{3}|p[0-9a-f]{8}", pid):
    sys.exit("product id looks wrong: " + pid)
ids = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./js/seed.js').products.map(p=>p.id)))"], cwd=ROOT))
if pid not in ids:
    sys.exit(pid + " is not in js/seed.js")

im = ImageOps.exif_transpose(Image.open(src))
im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
before = im.size
im.thumbnail((900, 900), Image.LANCZOS)
out = ROOT / "assets" / "menu" / f"{pid}.webp"
out.parent.mkdir(parents=True, exist_ok=True)
im.save(out, "WEBP", quality=85, method=6)
rel = f"assets/menu/{pid}.webp"

seed = ROOT / "js" / "seed.js"
s = seed.read_text(encoding="utf-8")
m = re.search(r"const IMAGES = \{\n(.*?)  \};", s, re.S)
entries = dict(re.findall(r'\s*(p\w+): "([^"]+)",?', m.group(1)))
entries[pid] = rel
body = "".join(f'    {k}: "{v}",\n' for k, v in sorted(entries.items()))
s = s[:m.start()] + "const IMAGES = {\n" + body + "  };" + s[m.end():]
seed.write_text(s, encoding="utf-8")

subprocess.check_call(["node", "tools/gen-seed.js"], cwd=ROOT)

photos = ROOT / "supabase" / "photos.sql"
head = "-- Product photos added after the database was created. Safe to run more than once.\n"
txt = photos.read_text(encoding="utf-8") if photos.exists() else head
line = f"update public.products set image = '{rel}' where id = '{pid}';\n"
if line not in txt:
    txt += line
photos.write_text(txt, encoding="utf-8")
print(f"{pid}: {src.name} {before[0]}x{before[1]} -> {rel} {im.size[0]}x{im.size[1]}, {out.stat().st_size // 1024} KB")
