/* كيس البن بتاع ديفان: الطباعة (Canvas) + الصورة المسطّحة + المجسّم الـ 3D (Three.js).
   نفس الرسمة للـ WebGL وللكروت وللطيران للسلة وللبديل لو الـ WebGL مش شغال.
   الاسم والسعر والاختيارات (الوزن، التحميص، الطحن…) بييجوا من المنيو؛ هنا الألوان بس. */

/* color = لون الكيس نفسه، bg = لون الخلفية (فاتح كفاية إن الكتابة الغامقة تتقري عليه ≥ 4.5:1) */
export const BAGS = [
  { id: "p052", color: "#b07a4f", bg: "#b07a4f", bit: 3 },
  { id: "p053", color: "#c8963e", bg: "#c8963e", bit: 4 },
  { id: "p054", color: "#9a6a8c", bg: "#a27695", bit: 0 },
  { id: "p055", color: "#6e4a3a", bg: "#977d71", bit: 0 },
  { id: "p056", color: "#a8845e", bg: "#a8845e", bit: 5 },
  { id: "p057", color: "#b8946a", bg: "#b8946a", bit: 1 },
  { id: "p058", color: "#c29a7a", bg: "#c29a7a", bit: 2 }
];
export const BW = 1, BH = 1.42;     // عرض وطول الكيس (وحدات) — scale = h/BH
const INK = "#2a120d", CREAM = "#f6e7d2", PAPER = "#fbf3e6";
const CR = 0.075;                    // شريط اللحام فوق

export function mix(a, b, k) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = p(a), y = p(b);
  return "#" + x.map((v, i) => Math.round(v * (1 - k) + y[i] * k).toString(16).padStart(2, "0")).join("");
}
const money = x => { const v = Math.round(Number(x) * 100) / 100; return (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)) + " ج"; };
function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
let LOGO = null;
export async function ready() {
  if (LOGO) return;
  const fonts = document.fonts ? Promise.all([
    document.fonts.load("700 40px 'Reem Kufi'", "توليفة ديفان"), document.fonts.load("500 20px 'Readex Pro'", "الوزن"),
    document.fonts.load("700 20px 'Readex Pro'", "800 ج"), document.fonts.load("500 20px 'Readex Pro'", "@divancoffee.eg")]).catch(() => { }) : null;
  const [red] = await Promise.all([loadImg(new URL("../assets/logo-red.webp", import.meta.url).href), fonts]);
  LOGO = { red };
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fit(c, text, weight, family, size, maxW) {
  let s = size; c.font = `${weight} ${s}px ${family}`;
  while (c.measureText(text).width > maxW && s > 10) { s -= 1; c.font = `${weight} ${s}px ${family}`; }
  return s;
}
function wrapLines(c, text, maxW) {
  const words = String(text).split(/\s+/), out = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}

/* شكل الكيس (alpha): مستطيل بزوايا تحت مدوّرة، واللحام فوق مسنّن */
function bagPath(c, W, H) {
  const r = W * 0.06, teeth = 34, th = H * 0.012;
  c.beginPath(); c.moveTo(0, th);
  for (let i = 0; i < teeth; i++) { const x0 = W * i / teeth; c.lineTo(x0 + W / teeth / 2, 0); c.lineTo(x0 + W / teeth, th); }
  c.lineTo(W, H - r); c.quadraticCurveTo(W, H, W - r, H); c.lineTo(r, H); c.quadraticCurveTo(0, H, 0, H - r); c.closePath();
}
/* الخلفية المشتركة: لون الكيس + ورق كرافت خفيف + اللحام + الضل */
function base(c, W, H, col, mirror) {
  c.save(); bagPath(c, W, H); c.clip();
  c.fillStyle = col; c.fillRect(0, 0, W, H);
  // حبيبات الورق
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) { c.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"; c.fillRect(rnd() * W, rnd() * H, 1.6, 1.6); }
  // اللحام فوق: أغمق بخطوط رأسي
  const sh = H * CR;
  c.fillStyle = "rgba(0,0,0,.16)"; c.fillRect(0, 0, W, sh);
  c.fillStyle = "rgba(255,255,255,.10)";
  for (let x = 0; x < W; x += W / 68) c.fillRect(x, H * 0.012, W / 200, sh - H * 0.02);
  c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(0, sh - 2, W, 3);
  // حز القطع (tear notch)
  c.fillStyle = "rgba(0,0,0,.35)"; const nx = mirror ? W * 0.035 : W * 0.965;
  c.beginPath(); c.moveTo(nx, sh + H * 0.012); c.lineTo(nx + (mirror ? -W * 0.035 : W * 0.035), sh + H * 0.004); c.lineTo(nx + (mirror ? -W * 0.035 : W * 0.035), sh + H * 0.02); c.fill();
  // لمعة عرضية
  const g = c.createLinearGradient(0, 0, W, 0);
  [[0, "rgba(0,0,0,.14)"], [.28, "rgba(255,255,255,.12)"], [.5, "rgba(255,255,255,0)"], [.8, "rgba(0,0,0,.04)"], [1, "rgba(0,0,0,.16)"]].forEach(([o, cc]) => g.addColorStop(o, cc));
  c.fillStyle = g; c.fillRect(0, sh, W, H - sh);
  c.restore();
}

/* وش الكيس: اللوجو، اسم التوليفة، وصف، السعر للكيلو، الصمام */
export function frontCanvas(bag, p, scale = 1) {
  const W = Math.round(640 * scale), H = Math.round(W * BH), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), col = mix(bag.color, INK, 0.22), ink = mix(bag.color, INK, 0.85);
  base(c, W, H, col, false);
  // صمام التهوية
  const vy = H * 0.135; c.fillStyle = "rgba(0,0,0,.18)"; c.beginPath(); c.arc(W / 2, vy, W * 0.045, 0, 7); c.fill();
  c.fillStyle = mix(col, "#ffffff", 0.25); c.beginPath(); c.arc(W / 2, vy, W * 0.032, 0, 7); c.fill();
  c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(W / 2, vy, W * 0.008, 0, 7); c.fill();
  // الليبل
  const lx = W * 0.12, ly = H * 0.205, lw = W * 0.76, lh = H * 0.6;
  c.save(); c.shadowColor = "rgba(0,0,0,.18)"; c.shadowBlur = W * 0.02; c.shadowOffsetY = W * 0.006;
  c.fillStyle = PAPER; rrect(c, lx, ly, lw, lh, W * 0.04); c.fill(); c.restore();
  c.strokeStyle = mix(bag.color, PAPER, 0.4); c.lineWidth = W * 0.006; rrect(c, lx + W * 0.022, ly + W * 0.022, lw - W * 0.044, lh - W * 0.044, W * 0.03); c.stroke();
  if (LOGO && LOGO.red) { const h = lh * 0.3, w = h * LOGO.red.width / LOGO.red.height; c.drawImage(LOGO.red, W / 2 - w / 2, ly + lh * 0.06, w, h); }
  c.direction = "rtl"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = ink;
  const name = (p && p.name) || "";
  const parts = name.length > 12 && name.includes(" ") ? [name.slice(0, name.lastIndexOf(" ", Math.ceil(name.length / 2) + 3)), name.slice(name.lastIndexOf(" ", Math.ceil(name.length / 2) + 3) + 1)] : [name];
  let fs = W * 0.1; parts.forEach(t => { fs = Math.min(fs, fit(c, t, 700, '"Reem Kufi"', W * 0.1, lw * 0.84)); });
  c.font = `700 ${fs}px "Reem Kufi"`;
  const ny = ly + lh * (parts.length > 1 ? 0.47 : 0.52);
  parts.forEach((t, i) => c.fillText(t, W / 2, ny + i * fs * 1.12));
  const ry = ly + lh * 0.72; c.fillStyle = mix(bag.color, PAPER, 0.15); c.fillRect(lx + lw * 0.3, ry, lw * 0.4, W * 0.006);
  c.fillStyle = ink; fit(c, (p && p.description) || "بن طازة — بيتحمّص عندنا", 500, '"Readex Pro"', W * 0.046, lw * 0.84);
  c.fillText((p && p.description) || "بن طازة — بيتحمّص عندنا", W / 2, ry + lh * 0.08);
  if (p) { c.font = `700 ${W * 0.05}px "Readex Pro"`; c.fillText(money(p.price) + " / كيلو", W / 2, ry + lh * 0.19); }
  // تحت
  c.fillStyle = CREAM; c.direction = "ltr"; c.font = `500 ${W * 0.036}px "Readex Pro"`; c.fillText("@divancoffee.eg", W / 2, H * 0.9);
  c.direction = "rtl"; c.font = `700 ${W * 0.042}px "Reem Kufi"`; c.fillText("قهوتك على كيفك", W / 2, H * 0.855);
  return cv;
}

/* ضهر الكيس: "عن البن" — من الاختيارات الحقيقية للصنف */
export function backCanvas(bag, p, scale = 1) {
  const W = Math.round(640 * scale), H = Math.round(W * BH), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"), col = mix(bag.color, INK, 0.22), ink = mix(bag.color, INK, 0.85);
  base(c, W, H, col, true);
  const lx = W * 0.1, ly = H * 0.12, lw = W * 0.8, lh = H * 0.74, pad = lw * 0.08;
  c.fillStyle = "rgba(251,243,230,.94)"; rrect(c, lx, ly, lw, lh, W * 0.035); c.fill();
  c.direction = "rtl"; c.textBaseline = "middle"; c.fillStyle = ink; c.textAlign = "center";
  c.font = `700 ${W * 0.075}px "Reem Kufi"`; c.fillText("عن البن", W / 2, ly + lh * 0.07);
  c.font = `500 ${W * 0.034}px "Readex Pro"`; c.fillText((p && p.name) || "", W / 2, ly + lh * 0.135);
  c.fillRect(lx + pad, ly + lh * 0.175, lw - 2 * pad, Math.max(2, W * 0.006));
  const rows = [];
  if (p) {
    rows.push(["السعر", money(p.price) + " / كيلو"]);
    for (const g of p.options || []) rows.push([g.name, g.choices.map(ch => ch.name.replace(/^مطحون /, "")).join(" · ")]);
  }
  let y = ly + lh * 0.24; const rh = lh * 0.085;
  rows.slice(0, 6).forEach(([k, v], i) => {
    c.textAlign = "right"; c.font = `${i === 0 ? 700 : 600} ${W * 0.036}px "Readex Pro"`; c.fillText(k, lx + lw - pad, y);
    c.textAlign = "left"; fit(c, v, i === 0 ? 700 : 400, '"Readex Pro"', W * 0.034, lw * 0.58); c.fillText(v, lx + pad, y);
    c.globalAlpha = 0.3; c.fillRect(lx + pad, y + rh * 0.48, lw - 2 * pad, 1.5); c.globalAlpha = 1; y += rh;
  });
  c.textAlign = "center"; c.font = `500 ${W * 0.032}px "Readex Pro"`;
  y = Math.max(y + rh * 0.3, ly + lh * 0.72);
  wrapLines(c, "بيتحمّص ويتعبّى في ديفان كوفي — X Mall، التجمع الخامس", lw * 0.84).forEach((t, i) => c.fillText(t, W / 2, y + i * W * 0.045));
  // باركود
  const bx = W / 2 - lw * 0.28, by = ly + lh * 0.86, bw = lw * 0.56, bh = lh * 0.085;
  let s = bag.id.charCodeAt(3) * 97; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  c.fillStyle = "#fff"; rrect(c, bx - 8, by - 6, bw + 16, bh + W * 0.04, 6); c.fill(); c.fillStyle = INK;
  for (let x = bx; x < bx + bw;) { const w = 1 + Math.floor(rnd() * 4); if (rnd() > 0.4) c.fillRect(x, by, w, bh); x += w + 1 + Math.floor(rnd() * 2); }
  c.direction = "ltr"; c.font = `500 ${W * 0.024}px "Readex Pro"`; c.fillText("6 22" + String(1000 + s % 9000) + " 0" + bag.id.slice(1) + "1", W / 2, by + bh + W * 0.02);
  return cv;
}

/* صورة مسطّحة للكيس (الكروت، الطيران، البديل) */
const spriteCache = new Map();
export function bagSprite(bag, p) {
  const key = bag.id + "|" + (p ? p.name + p.price : "");
  if (spriteCache.has(key)) return spriteCache.get(key);
  const f = frontCanvas(bag, p, 0.6), cv = document.createElement("canvas"); cv.width = f.width; cv.height = f.height;
  const c = cv.getContext("2d"); c.drawImage(f, 0, 0);
  // انتفاخ خفيف: ضل على الجناب ونور في النص
  c.globalCompositeOperation = "source-atop";
  const g = c.createLinearGradient(0, 0, cv.width, 0);
  g.addColorStop(0, "rgba(0,0,0,.22)"); g.addColorStop(.18, "rgba(0,0,0,0)"); g.addColorStop(.4, "rgba(255,255,255,.10)"); g.addColorStop(.82, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.25)");
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  const v = c.createLinearGradient(0, 0, 0, cv.height); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(.9, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.2)");
  c.fillStyle = v; c.fillRect(0, 0, cv.width, cv.height);
  spriteCache.set(key, cv); return cv;
}
export const spriteURL = (bag, p) => { const cv = bagSprite(bag, p); return cv._url || (cv._url = cv.toDataURL("image/png")); };

/* ---------- قطع البن والإضافات (رسم بالكود لحد ما نعمل شيت صور) ---------- */
const bitCache = [];
export function bitCanvas(i) {
  if (bitCache[i]) return bitCache[i];
  const S = 160, cv = document.createElement("canvas"); cv.width = cv.height = S; const c = cv.getContext("2d");
  const bean = (x, y, r, a) => {
    c.save(); c.translate(x, y); c.rotate(a);
    const g = c.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.2); g.addColorStop(0, "#8a5a3a"); g.addColorStop(1, "#3b2014");
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, r * 0.72, r, 0, 0, 7); c.fill();
    c.strokeStyle = "#1e0f08"; c.lineWidth = r * 0.12; c.beginPath(); c.moveTo(0, -r * 0.85); c.bezierCurveTo(r * 0.3, -r * 0.3, -r * 0.3, r * 0.3, 0, r * 0.85); c.stroke(); c.restore();
  };
  if (i === 0) { bean(60, 70, 34, 0.4); bean(108, 92, 30, -0.6); bean(78, 118, 26, 1.2); }
  if (i === 1) { // بندق
    [[64, 80, 34], [106, 98, 28]].forEach(([x, y, r]) => { const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); g.addColorStop(0, "#d9a066"); g.addColorStop(1, "#8a5326"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      c.fillStyle = "#e9cfa4"; c.beginPath(); c.ellipse(x, y - r * 0.75, r * 0.55, r * 0.28, 0, 0, 7); c.fill(); });
  }
  if (i === 2) { // كراميل
    c.fillStyle = "#c98a2e"; rrect(c, 36, 44, 84, 76, 14); c.fill(); c.fillStyle = "#e3a948"; rrect(c, 44, 50, 66, 26, 10); c.fill();
    c.fillStyle = "#b5741f"; c.beginPath(); c.moveTo(96, 118); c.quadraticCurveTo(102, 146, 92, 150); c.quadraticCurveTo(84, 146, 88, 118); c.fill();
  }
  if (i === 3) { // حبهان (التحويجة)
    [[60, 76, 0.5], [100, 70, -0.4], [82, 112, 1.3]].forEach(([x, y, a]) => { c.save(); c.translate(x, y); c.rotate(a); const g = c.createLinearGradient(-20, 0, 20, 0); g.addColorStop(0, "#5f7d3a"); g.addColorStop(.5, "#9dbb63"); g.addColorStop(1, "#4f6a2e"); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 17, 34, 0, 0, 7); c.fill(); c.strokeStyle = "rgba(40,60,20,.5)"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 30); c.stroke(); c.restore(); });
  }
  if (i === 4) { // قرفة
    [[0.5, 0], [0.62, 26]].forEach(([a, dy]) => { c.save(); c.translate(80, 70 + dy); c.rotate(a); c.fillStyle = "#8a4b26"; rrect(c, -60, -11, 120, 22, 11); c.fill(); c.strokeStyle = "#5b2d14"; c.lineWidth = 3; c.beginPath(); c.moveTo(-58, 0); c.lineTo(58, 0); c.stroke(); c.restore(); });
  }
  if (i === 5) { // بن مطحون
    let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 900; k++) { const a = rnd() * 7, r = Math.sqrt(rnd()) * 56; c.fillStyle = rnd() > 0.5 ? "#4a2a18" : "#6b3f25"; c.fillRect(80 + Math.cos(a) * r, 92 + Math.sin(a) * r * 0.55 - (56 - r) * 0.5, 3, 3); }
    bean(118, 50, 20, 0.8);
  }
  bitCache[i] = cv; return cv;
}

/* ---------- المجسّم (نفس فكرة Stride: وشّين منفوخين مقفولين على الأطراف) ---------- */
export function bagFactory(THREE, envMap, aniso) {
  function pillow(front) {
    const g = new THREE.PlaneGeometry(BW, BH, 30, 64), pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = uv.getX(i), v = uv.getY(i), ex = Math.abs(2 * u - 1), top = 1 - v;
      let z;
      if (top < CR) z = 0.006 + 0.006 * Math.abs(Math.sin(u * Math.PI * 34));
      else {
        const across = Math.pow(Math.max(0, 1 - Math.pow(ex, 2.6)), 0.62);
        const along = Math.min(Math.pow(Math.min(1, Math.max(0, (top - CR) / 0.11)), 0.7), Math.pow(Math.min(1, v / 0.07), 0.55));
        z = 0.012 + 0.15 * across * along + 0.004 * Math.sin(23 * u + 31 * v) * across;
      }
      pos.setZ(i, front ? z : -z);
      if (!front) uv.setX(i, 1 - u);
    }
    if (!front) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } }
    g.computeVertexNormals(); return g;
  }
  const GF = pillow(true), GB = pillow(false);
  const shadowTex = (() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const c = cv.getContext("2d");
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, "rgba(40,12,6,.55)"); g.addColorStop(1, "rgba(40,12,6,0)");
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
  })();
  const GS = new THREE.PlaneGeometry(1.25, 1.04 * BH);
  const tex = new Map();
  function texFor(bag, p, side) {
    const key = bag.id + "|" + side + "|" + (p ? p.name + "|" + p.price + "|" + JSON.stringify(p.options) : "");
    if (!tex.has(key)) {
      const t = new THREE.CanvasTexture(side === "f" ? frontCanvas(bag, p, 1) : backCanvas(bag, p, 1));
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; tex.set(key, t);
    }
    return tex.get(key);
  }
  const mat = () => new THREE.MeshPhysicalMaterial({ transparent: true, alphaTest: 0.5, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, envMap, envMapIntensity: 0.4 });
  function make() {
    const obj = new THREE.Group(), mf = mat(), mb = mat();
    obj.add(new THREE.Mesh(GF, mf), new THREE.Mesh(GB, mb));
    const sm = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const shadow = new THREE.Mesh(GS, sm); shadow.renderOrder = -1;
    let cur = null;
    return {
      obj, shadow,
      setBag(bag, p) {
        const key = bag.id + "|" + (p ? p.name + p.price : ""); if (key === cur) return; cur = key;
        mf.map = texFor(bag, p, "f"); mb.map = texFor(bag, p, "b"); mf.needsUpdate = mb.needsUpdate = true;
      },
      setOpacity(op, sh) { mf.opacity = mb.opacity = op; sm.opacity = 0.5 * op * sh; }
    };
  }
  return { make };
}
