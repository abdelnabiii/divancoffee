/* التصميم الجديد (v6): كيس بن واحد بيسافر في الصفحة — الهيرو ← "من الحبة للفنجان" ← كارته.
   ده "عرض" بس فوق js/app.js: المنيو والسلة والطلب كله هناك. لو حاجة هنا وقعت، الصفحة بترجع للتصميم القديم. */
import { BAGS, BH, BW, ready, bagFactory, spriteURL, backCanvas, bitCanvas, mix } from "./bag.js?v=6";

const $ = s => document.querySelector(s);
const root = document.documentElement, body = document.body;
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(pointer: fine)").matches;
const isPhone = () => innerWidth < 820;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const sineIO = t => -(Math.cos(Math.PI * t) - 1) / 2;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, ds = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let t = x; for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = ds(t); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; t -= e / d; }
    return sy(clamp(t));
  };
}
const GLIDE = bezier(.25, .75, .2, 1), ENTER = bezier(.16, 1, .3, 1);
const money = x => { const v = Math.round(Number(x) * 100) / 100; return (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)) + " ج"; };
const two = n => String(n).padStart(2, "0");

/* ---------- الحالة ---------- */
let N = 0, LIST = [];                 // الأكياس الشغالة [{bag, p}]
let pos = 0, target = 0, posTween = null;
let gl = null, mode = "none";          // "gl" | "2d"
let started = false, entered = false, introDone = false;
let lastInteract = performance.now(), autoOn = !RM;
let reveal = null, poke = null, heroVis = 1;
const S = { flip: 0, flipTween: null, step: -1 };
const anim = (el, kf, o) => (RM || !el.animate) ? null : el.animate(kf, o);

/* ========== البداية: الافتتاحية بتبدأ على طول، والمسرح بيستنى المنيو ========== */
body.classList.add("stage");
const introShown = runIntro();
const app = () => window.DV && window.DV.app;
if (app() && app().loaded) start(); else document.addEventListener("dv:catalog", () => start(), { once: true });
document.addEventListener("dv:catalogerror", () => { if (!started) teardown(); });

function teardown() {                 // نرجع للتصميم القديم
  body.classList.remove("stage", "locked", "gl");
  const i = $("#intro"); if (i) i.hidden = true;
  $("#heroStatic").hidden = false;
}

/* ---------- الافتتاحية ---------- */
function runIntro() {
  const cfg = window.DV_CONFIG || {}, q = new URLSearchParams(location.search);
  let last = 0; try { last = Number(localStorage.getItem("dv_intro_at")) || 0; } catch (e) { }
  let cartN = 0; try { cartN = (JSON.parse(localStorage.getItem("dv_cart")) || []).length; } catch (e) { }
  const skip = RM || q.has("t") || /(^|&)t=/.test(location.hash.slice(1)) || Date.now() - last < 24 * 3600e3 || cartN > 0;
  if (skip) { introDone = true; return Promise.resolve(); }
  try { localStorage.setItem("dv_intro_at", String(Date.now())); } catch (e) { }
  const el = $("#intro"), v = $("#introVid"), stamp = $("#stamp");
  el.hidden = false; body.classList.add("locked");
  return new Promise(done => {
    let finished = false;
    const finish = () => { if (finished) return; finished = true; el.classList.add("out"); body.classList.remove("locked"); setTimeout(() => { el.hidden = true; }, 450); introDone = true; done(); maybeEnter(); };
    const toStamp = () => {
      if (el.classList.contains("stamped")) return;
      try { v.pause(); } catch (e) { }
      el.classList.add("stamped"); stamp.hidden = false;
      anim(stamp, [{ transform: "scale(.72)", opacity: 0 }, { transform: "scale(1.04)", opacity: 1, offset: .7 }, { transform: "scale(1)", opacity: 1 }], { duration: 380, easing: "ease-out", fill: "both" });
      setTimeout(finish, 380 + 650);
    };
    $("#skipIntro").onclick = finish;
    setTimeout(finish, 8000);                                  // أمان
    if (!cfg.introVideo) return toStamp();
    v.src = cfg.introVideo; v.preload = "auto";
    const play = () => { try { v.currentTime = 0.3; } catch (e) { } v.play().catch(toStamp); };
    v.addEventListener("ended", toStamp); v.addEventListener("error", toStamp);
    v.addEventListener("timeupdate", () => { if (v.currentTime >= 4.2) toStamp(); });
    if (v.readyState >= 3) play(); else v.addEventListener("canplay", play, { once: true });
    setTimeout(() => { if (v.paused || v.currentTime < 0.35) toStamp(); }, 3000);
  });
}

/* ========== تشغيل المسرح ========== */
async function start() {
  if (started) return; started = true;
  try {
    const A = app(), cat = A.cat;
    LIST = BAGS.map(bag => ({ bag, p: cat.products.find(p => p.id === bag.id) })).filter(x => x.p);
    N = LIST.length;
    if (N < 3) return teardown();
    await ready();
    buildBits(); buildCards(); buildInside(); buildBeans(); buildHeader();
    target = 0; pos = RM ? 0 : -2.6;
    setFlavour(0, true);
    await initRenderer();
    bindHero(); bindScroll();
    document.addEventListener("dv:catalog", onCatalog);
    document.addEventListener("dv:added", e => flyToCart(e.detail));
    requestAnimationFrame(loop);
    entered = false; maybeEnter();
  } catch (e) { console.error("[Divan stage]", e); teardown(); }
}
function maybeEnter() {
  if (entered || !introDone || !LIST.length || !mode || mode === "none") return;
  entered = true; body.classList.add("entered");
  if (!RM) {
    anim($("#hdr"), [{ transform: "translateY(-110%)" }, { transform: "none" }], { duration: 900, easing: "cubic-bezier(.22,.9,.24,1)" });
    anim($("#hero .rings"), [{ opacity: 0, transform: "translate(-50%,-50%) scale(.85)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }], { duration: 1100, easing: "ease-out" });
    [["#next", 500], ["#count", 620], ["#auto", 740], ["#hcta", 600]].forEach(([s, d]) => anim($(s), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: d, fill: "backwards" }));
    tweenPos(-2.6, 0, 1700, ENTER);
    document.querySelectorAll("#bits .bit").forEach((b, i) => {
      anim(b, [{ opacity: 0 }, { opacity: .6 }], { duration: 900, delay: 300 + 90 * i, fill: "both" });
      anim(b, [{ translate: "0 0", rotate: "0deg" }, { translate: `${i % 2 ? -13 : 12}px -${22 + 3 * i}px`, rotate: `${i % 2 ? -11 : 10}deg` }, { translate: "0 0", rotate: "0deg" }],
        { duration: 7000 + 900 * i, iterations: Infinity, easing: "ease-in-out", composite: "add" });
    });
  }
  lastInteract = performance.now();
}
function onCatalog() {
  const cat = app().cat;
  LIST.forEach(x => { const p = cat.products.find(q => q.id === x.bag.id); if (p) x.p = p; });
  buildCards(); setFlavour(mod(target), true); paintBeans();
}
const mod = j => ((Math.round(j) % N) + N) % N;
const cur = () => LIST[mod(target)];

/* ========== العارض: WebGL أو بديل 2D بنفس الحالة ========== */
async function initRenderer() {
  const cv = $("#gl");
  let THREE = null, RoomEnvironment = null;
  try {
    const t = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true }) || document.createElement("canvas").getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!t) throw new Error("no webgl");
    [THREE, { RoomEnvironment }] = await Promise.all([import("../vendor/three/three.module.min.js?v=6"), import("../vendor/three/RoomEnvironment.js?v=6")]);
  } catch (e) { THREE = null; }
  if (THREE) {
    try {
      const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping;
      const scene = new THREE.Scene();
      const env = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(0.6, 0.9, 1.4); scene.add(key);
      const cam = new THREE.PerspectiveCamera(30, 1, 10, 9000);
      const F = bagFactory(THREE, env, Math.min(8, r.capabilities.getMaxAnisotropy()));
      const make = () => { const b = F.make(); scene.add(b.obj, b.shadow); b.obj.rotation.order = "ZYX"; return b; };
      gl = { THREE, r, scene, cam, pool: Array.from({ length: 11 }, make), trav: make(), dirty: true };
      mode = "gl"; body.classList.add("gl"); resize(); addEventListener("resize", resize);
      return;
    } catch (e) { console.warn("[Divan stage] WebGL failed, using 2D", e); gl = null; }
  }
  mode = "2d"; body.classList.add("flat");
  const box = $("#arc2d");
  const mk = () => { const d = document.createElement("div"); d.className = "b2d"; d.innerHTML = `<img alt="" draggable="false"><img alt="" class="bk" draggable="false">`; box.appendChild(d); return d; };
  gl = { pool: Array.from({ length: 11 }, mk), trav: (() => { const d = mk(); d.classList.add("trav"); return d; })() };
}
function resize() {
  if (mode !== "gl") return;
  const vw = innerWidth, vh = innerHeight, D = clamp(1500 * Math.min(vw / 1440, vh / 900), 1000, 2200);
  gl.r.setPixelRatio(Math.min(devicePixelRatio || 1, vw < 820 ? 1.75 : 2));
  gl.r.setSize(vw, vh, false); gl.r.domElement.style.height = vh + "px";
  gl.cam.fov = 2 * Math.atan((vh / 2) / D) * 180 / Math.PI; gl.cam.aspect = vw / vh; gl.cam.near = 10; gl.cam.far = 4 * D;
  gl.cam.position.set(0, 0, D); gl.cam.updateProjectionMatrix(); gl.D = D;
}
const backURLs = new Map();
function backURL(x) { const k = x.bag.id + x.p.name + x.p.price; if (!backURLs.has(k)) backURLs.set(k, backCanvas(x.bag, x.p, 0.6).toDataURL("image/png")); return backURLs.get(k); }
/* بيحط كيس على الشاشة من حالة {x,y,h,rz,ry,rx,z,op,sx,sy,shadow} (بيكسل الشاشة + درجات CSS) */
function place(obj, x, st) {
  if (mode === "gl") {
    obj.setBag(x.bag, x.p);
    const vis = st.op > 0.01; obj.obj.visible = obj.shadow.visible = vis; if (!vis) return;
    const vw = innerWidth, vh = innerHeight, s = st.h / BH;
    obj.obj.position.set(st.x - vw / 2, vh / 2 - st.y, st.z || 0);
    obj.obj.scale.set(s * (st.sx || 1), s * (st.sy || 1), s);
    obj.obj.rotation.set((st.rx || 0) * Math.PI / 180, st.ry * Math.PI / 180, -st.rz * Math.PI / 180);
    obj.setOpacity(st.op, st.shadow ?? 1);
    obj.shadow.position.set(st.x - vw / 2, vh / 2 - st.y - st.h * 0.05, (st.z || 0) - 0.32 * st.h);
    obj.shadow.rotation.set(0, 0, -st.rz * Math.PI / 180);
    obj.shadow.scale.set(s * Math.max(0.3, Math.abs(Math.cos(st.ry * Math.PI / 180))), s, 1);
    return;
  }
  const el = obj, vis = st.op > 0.01; el.style.display = vis ? "" : "none"; if (!vis) return;
  const [f, b] = el.children, key = x.bag.id + x.p.name + x.p.price;
  if (el._k !== key) { el._k = key; f.src = spriteURL(x.bag, x.p); b.src = backURL(x); }
  const h = st.h, w = h * BW / BH, ry = st.ry * Math.PI / 180, c = Math.cos(ry);
  el.style.width = w + "px"; el.style.height = h + "px"; el.style.opacity = st.op;
  el.style.zIndex = String(Math.round(100 - (st.k || 0) * 10));
  el.style.transform = `translate(${st.x - w / 2}px,${st.y - h / 2}px) rotate(${st.rz}deg) scale(${Math.max(0.04, Math.abs(c)) * (st.sx || 1)},${st.sy || 1})`;
  el.classList.toggle("back", c < 0);
}

/* ========== الهيرو ========== */
const SLOTS = [[0, 0, 400, 0, 0], [245, 24, 312, 4, 16], [452, 44, 294, 8, 26], [660, 80, 278, 12, 34], [860, 118, 262, 15, 40]];
function heroGeom() {
  const hr = $("#hero").getBoundingClientRect(), H = hr.height, vw = innerWidth;
  let u, cx = vw / 2, cy, spread = 1;
  if (isPhone()) { u = Math.min(vw / 560, H / 980); cy = hr.top + H * 0.40; spread = 1.02; }
  else { u = Math.min(vw / 1440, H / 900); cy = hr.top + H / 2 - 78 * u; }
  return { u, cx, cy, spread, top: hr.top, H, w: vw };
}
function arcState(k, G, j, now) {
  const a = Math.min(Math.abs(k), 4), i = Math.min(3, Math.floor(a)), f = a - i, sg = k < 0 ? -1 : 1;
  const A = SLOTS[i], B = SLOTS[i + 1] || SLOTS[4], v = n => lerp(A[n], B[n], a >= 4 ? 1 : f);
  // RTL: اللي بعده على الشمال → نعكس x و rz و ry
  let x = G.cx - sg * v(0) * G.u * G.spread, y = G.cy + v(1) * G.u, rz = -sg * v(3), ry = -sg * v(4);
  if (!RM) { const b = Math.sin(now / 4600 * 2 * Math.PI + 1.37 * j); y -= (0.5 * b + 0.5) * 9 * G.u; rz += 0.4 * b; }
  const op = a <= 3.3 ? 1 : clamp(1 - (a - 3.3) / 0.6);
  return { x, y, h: v(2) * G.u, rz, ry, rx: 0, z: -a * 34 * G.u, op, k: a, shadow: 1 };
}
function tweenPos(from, to, dur, ease = GLIDE) {
  if (RM || dur <= 0) { pos = to; posTween = null; return; }
  posTween = { from, to, t0: performance.now(), dur, ease };
}
function goTo(n, dur) {
  const old = mod(target);
  target = Math.round(n);
  const d = dur ?? (650 + 160 * Math.max(0, Math.abs(target - pos) - 1));
  tweenPos(pos, target, d);
  if (mod(target) !== old) setTimeout(() => setFlavour(mod(target)), RM ? 0 : d * 0.12);
  lastInteract = performance.now();
}
/* تغيير الكيس: لون الخلفية (دايرة)، العنوان، العداد، السعر */
function setFlavour(i, instant) {
  const x = LIST[i]; if (!x) return;
  const col = x.bag.bg;
  if (instant || RM) { root.style.setProperty("--flav", col); finishReveal(); }
  else {
    finishReveal();
    const G = heroGeom(), cr = [[0, G.top], [G.w, G.top], [0, G.top + G.H], [G.w, G.top + G.H]].reduce((m, [px, py]) => Math.max(m, Math.hypot(px - G.cx, py - G.cy)), 0);
    reveal = { col, t0: performance.now(), dur: 420, R: 1.45 * cr, cx: G.cx, cy: G.cy - G.top };
    $("#reveal").style.setProperty("--rv", col);
  }
  setTitle(x.p.name, instant);
  swapSoft($("#count"), two(i + 1), instant);
  swapSoft($("#hprice"), money(x.p.price) + " / كيلو", instant);
  const out = x.p.available === false, hb = $("#hbuy");
  hb.disabled = out; hb.textContent = out ? "خلص النهارده" : "اطلبه دلوقتي";
  hb.setAttribute("aria-label", out ? `${x.p.name} خلص النهارده` : `اطلب ${x.p.name}`);
  document.querySelectorAll("#cards .card").forEach(c => c.classList.toggle("live", c.dataset.pid === x.bag.id));
  if (S.step === 3) setInsideText(3, true);
  if (!beansTouched) selectBean(x.bag.id, true);
}
function finishReveal() {
  if (!reveal) return;
  root.style.setProperty("--flav", reveal.col);
  const r = $("#reveal"); r.style.removeProperty("--rv"); r.style.webkitMaskImage = r.style.maskImage = ""; reveal = null;
}
function stepReveal(now) {
  if (!reveal) return;
  const t = clamp((now - reveal.t0) / reveal.dur), r = reveal.R * GLIDE(t), f = Math.max(60, 0.35 * r);
  const m = `radial-gradient(circle at ${reveal.cx}px ${reveal.cy}px, #000 ${Math.max(0, r - f)}px, transparent ${r}px)`;
  const el = $("#reveal"); el.style.webkitMaskImage = el.style.maskImage = m;
  if (t >= 1) finishReveal();
}
/* العنوان: كلمة كلمة (الحروف العربي لازم تفضل متوصّلة) */
const measure = (() => { const c = document.createElement("canvas").getContext("2d"); return (t, f) => { c.font = f; return c.measureText(t).width; }; })();
function titleSize(name) {
  const vw = innerWidth;
  if (isPhone()) { const longest = Math.max(...name.split(/\s+/).map(w => measure(w, "700 100px 'Reem Kufi'"))); return Math.min(clamp(vw * 0.11, 36, 60), (vw - 36) * 100 / longest); }
  const u = Math.min(vw / 1440, $("#hero").clientHeight / 900); return Math.min(92 * u, 760 * u * 100 / measure(name, "700 100px 'Reem Kufi'"));
}
function setTitle(name, instant) {
  const el = $("#title"), html = name.split(/\s+/).map(w => `<span class="w"><span class="wi">${esc(w)}</span></span>`).join(" ");
  const fwd = true;
  const paint = () => {
    el.style.fontSize = titleSize(name) + "px"; el.innerHTML = html; el.dataset.name = name;
    if (!instant) el.querySelectorAll(".wi").forEach((w, i) => anim(w, [{ transform: `translateY(${fwd ? 110 : -110}%)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 620, delay: 120 + 60 * i, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" }));
  };
  if (instant || RM || !el.children.length) return paint();
  const outs = [...el.querySelectorAll(".wi")].map((w, i) => anim(w, [{ transform: "none", opacity: 1 }, { transform: "translateY(-110%)", opacity: 0 }], { duration: 300, delay: 30 * i, easing: "cubic-bezier(.45,0,.75,.3)", fill: "forwards" }));
  setTimeout(paint, 300);
}
function swapSoft(el, text, instant) {
  if (instant || RM) { el.textContent = text; return; }
  anim(el, [{ translate: "0 0", opacity: 1 }, { translate: "0 -10px", opacity: 0 }], { duration: 220, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
  setTimeout(() => { el.textContent = text; anim(el, [{ translate: "0 14px", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" }); }, 280);
}

function bindHero() {
  const arc = $("#arc");
  // زراير مخفية لقارئ الشاشة والكيبورد
  arc.innerHTML = LIST.map((x, i) => `<button type="button" class="sr" data-i="${i}">${esc(x.p.name)} — ${esc(money(x.p.price))} للكيلو</button>`).join("");
  arc.querySelectorAll(".sr").forEach(b => b.onclick = () => { const i = +b.dataset.i; goTo(target + shortest(mod(target), i)); });
  $("#next").onclick = () => goTo(target + 1);
  $("#hbuy").onclick = () => { const x = cur(); if (x) app().openProduct(x.bag.id); };
  const auto = $("#auto");
  const paintAuto = () => { auto.setAttribute("aria-pressed", String(autoOn)); auto.classList.toggle("off", !autoOn); };
  auto.onclick = () => { autoOn = !autoOn; paintAuto(); lastInteract = performance.now(); }; paintAuto();
  addEventListener("keydown", e => {
    if (e.target.closest("input,textarea,select,[contenteditable]") || !$("#sheet").hidden || heroVis < 0.5) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); goTo(target + 1); }      // RTL: الشمال = اللي بعده
    if (e.key === "ArrowRight") { e.preventDefault(); goTo(target - 1); }
  });
  // سحب / فليك / ضغطة
  let drag = null;
  arc.addEventListener("pointerdown", e => {
    if (e.button !== 0 || e.target.closest(".sr")) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, pos0: pos, on: false, v: 0, lx: e.clientX, lt: performance.now() };
  });
  arc.addEventListener("pointermove", e => {
    if (FINE && !drag) arc.style.cursor = hit(e.clientX, e.clientY) != null ? "pointer" : "grab";
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.on) { if (Math.abs(dx) <= 6) return; drag.on = true; posTween = null; arc.setPointerCapture(e.pointerId); body.classList.add("dragging"); }
    const G = heroGeom(), slot = 245 * G.u * G.spread;
    pos = drag.pos0 + dx / slot;                                    // RTL: سحب لليمين = اللي بعده
    const t = performance.now(), dt = Math.max(1, t - drag.lt), inst = (e.clientX - drag.lx) / slot / dt;
    drag.v = lerp(drag.v, inst, 0.4); drag.lx = e.clientX; drag.lt = t; lastInteract = t;
  });
  const end = (e, cancel) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; body.classList.remove("dragging");
    if (!d.on) { if (!cancel) { const k = hit(e.clientX, e.clientY); if (k != null) goTo(target + k); } return; }
    if (cancel && Math.abs(pos - Math.round(pos)) < 0.02) { goTo(Math.round(pos)); return; }
    const to = Math.round(pos + clamp(d.v * 220, -2, 2));
    goTo(to, Math.max(380, 650 * Math.min(1, Math.abs(to - pos) + 0.35)));
  };
  arc.addEventListener("pointerup", e => end(e, false));
  arc.addEventListener("pointercancel", e => end(e, true));
  // الهيرو باين قد إيه (للتشغيل التلقائي والكيبورد)
  // شريط "كمّل طلبك" بيستخبى طول ما الهيرو قدامك (كان بيغطي "اطلبه دلوقتي") — زرار السلة في الهيدر موجود دايمًا
  new IntersectionObserver(es => es.forEach(x => { heroVis = x.intersectionRatio; body.classList.toggle("hero-on", heroVis >= 0.35); }), { threshold: [0, .25, .35, .5, .6, .75, 1] }).observe($("#hero"));
}
const shortest = (from, to) => { let d = to - from; if (d > N / 2) d -= N; if (d < -N / 2) d += N; return d; };
let lastStates = [];
function hit(x, y) {
  let best = null;
  for (const s of lastStates) {
    if (s.op < 0.3) continue;
    const w = s.h * BW / BH * Math.max(0.3, Math.abs(Math.cos(s.ry * Math.PI / 180)));
    if (Math.abs(x - s.x) < w / 2 && Math.abs(y - s.y) < s.h / 2 && (best == null || Math.abs(s.kk) < Math.abs(best))) best = s.kk;
  }
  return best == null ? null : Math.round(best);
}

/* ========== قسم "من الحبة للفنجان" ========== */
const ICONS = [
  `<path d="M12 3c4 2.5 6 6 6 9.5S15.3 20 12 21c-3.3-1-6-4-6-8.5S8 5.5 12 3z"/><path d="M12 5c-1.6 3-1.6 6.5 0 9.5s1.6 4.5 0 6"/>`,
  `<path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-6 4.5-10 2 2 3 3.5 3 6 1-1 1.7-2 2-3.5 1.7 1.8 3.5 4.2 3.5 7.5 0 3.4-2.5 6-6.5 6z"/>`,
  `<path d="M4 9h16M6 9l1 11h10l1-11"/><path d="M9 5l1.5 4M15 5l-1.5 4"/>`,
  `<path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z"/>`
];
const STEPS = [
  { head: ["بنختار", "أجود بن"], cap: () => { const o = (app().cat.settings.origins || []).map(x => x.name.replace(/^بن\s+/, "")); return o.length ? o.join("، ") + "." : "من أحسن المزارع."; }, ry: 0 },
  { head: ["بنحمّصه", "عندنا"], cap: () => "تحميص فاتح، وسط أو غامق — على كيفك.", ry: 180 },
  { head: ["وبنطحنه", "على كيفك"], cap: () => "ناعم، وسط، أو حبوب صحيحة.", ry: 360 },
  { head: null, cap: () => { const x = cur(), s = app().cat.settings, pct = Math.round((s.cashback_rate || 0) * 100); return `${money(x.p.price)} / كيلو${pct ? ` · ${pct}% حبّات على كل طلب` : ""}`; }, ry: 720 }
];
function buildInside() {
  $("#inIcons").innerHTML = ICONS.map((d, i) => `<button type="button" data-st="${i}" aria-label="الخطوة ${i + 1}"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg></button>`).join("");
  $("#inIcons").onclick = e => {
    const b = e.target.closest("[data-st]"); if (!b) return;
    const sec = $("#inside"), top = sec.getBoundingClientRect().top + scrollY, span = sec.offsetHeight - innerHeight;
    scrollToY(top + span * ((+b.dataset.st + 0.5) * 0.19));
  };
  // قطع العاصفة
  const st = $("#storm"); let s = 3;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const urls = Array.from({ length: 6 }, (_, i) => bitCanvas(i).toDataURL("image/png"));
  st.innerHTML = "";
  STORM.length = 0;
  for (let i = 0; i < 20; i++) {
    const own = rnd() < 0.7, d = document.createElement("i");
    st.appendChild(d);
    STORM.push({ el: d, own, bit: Math.floor(rnd() * 6), a: rnd() * Math.PI * 2, ph: i / 20 + rnd() * 0.03, spin: (rnd() < 0.5 ? -1 : 1) * 360, size: 0.7 + rnd() * 0.7, urls });
  }
  setInsideText(0, true);
}
const STORM = [];
function setInsideText(i, instant) {
  const x = cur(), st = STEPS[i];
  const head = st.head || x.p.name.split(/\s+/);
  const big = head.some(w => w.length > 9);
  const h = `<span class="${big ? "sm" : ""}">${head.map(esc).join("<br>")}</span>`;
  const set = () => { $("#inHead").innerHTML = h; $("#inNum").textContent = two(i + 1); $("#inCap").textContent = st.cap(); };
  document.querySelectorAll("#inIcons button").forEach((b, k) => b.setAttribute("aria-current", k === i ? "step" : "false"));
  if (instant || RM) return set();
  [$("#inHead"), $("#inNum"), $("#inCap")].forEach(el => anim(el, [{ translate: "0 0", opacity: 1 }, { translate: "0 -10px", opacity: 0 }], { duration: 240, fill: "forwards" }));
  setTimeout(() => { set(); [$("#inHead"), $("#inNum"), $("#inCap")].forEach(el => anim(el, [{ translate: "0 14px", opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: 460, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" })); }, 280);
}
function insideTick(now) {
  const sec = $("#inside"), r = sec.getBoundingClientRect(), vh = innerHeight;
  const p = clamp(-r.top / (r.height - vh)), q = clamp((p - 0.76) / 0.24);
  const step = Math.floor(Math.min(p, 0.759) / 0.19);
  // الطبقة الأمامية بتقلّد sticky
  const front = $("#inFront"), visible = r.top < vh && r.bottom > 0;
  front.style.visibility = visible ? "visible" : "hidden";
  const pinY = r.top > 0 ? r.top : (r.bottom < vh ? r.bottom - vh : 0);
  front.style.transform = `translateY(${pinY}px)`;
  if (visible && step !== S.step) {
    const first = S.step < 0; S.step = step;
    const to = STEPS[step].ry, from = S.flip, half = clamp(Math.abs(to - from) / 180, 0.4, 2);
    const dur = RM || first ? 0 : 720 * half;
    S.flipTween = dur ? { from, to, t0: now, dur } : null; if (!dur) S.flip = to;
    if (first) setInsideText(step, true); else setTimeout(() => setInsideText(step), 0.38 * Math.min(dur, 720));
  }
  if (S.flipTween) { const t = clamp((now - S.flipTween.t0) / S.flipTween.dur); S.flip = lerp(S.flipTween.from, S.flipTween.to, sineIO(t)); if (t >= 1) S.flipTween = null; }
  // العاصفة
  const fade = 1 - clamp(4 * q);
  $("#inFrame").style.opacity = fade; $("#inNum").style.opacity = fade;
  $("#inDark").style.opacity = clamp(3.5 * q) * 0.42;
  const vw = innerWidth, R = 0.55 * Math.hypot(vw, vh), base = 0.085 * Math.min(vw, vh), cx = vw / 2, cy = vh / 2;
  const bit = cur().bag.bit;
  for (const s of STORM) {
    const t = clamp((q - 0.45 * s.ph) / 0.55);
    if (RM || q <= 0 || q >= 1 || t <= 0 || t >= 1) { s.el.style.opacity = 0; continue; }
    const b = s.own ? bit : s.bit;
    if (s.el._b !== b) { s.el._b = b; s.el.style.backgroundImage = `url(${s.urls[b]})`; }
    const rad = (0.06 + Math.pow(t, 1.5) * 0.95) * R, sc = (0.2 + 1.7 * t) * s.size, sz = base;
    s.el.style.width = s.el.style.height = sz + "px";
    s.el.style.transform = `translate(${cx + Math.cos(s.a) * rad - sz / 2}px,${cy + Math.sin(s.a) * rad * 0.8 - sz / 2}px) rotate(${s.spin * t}deg) scale(${sc})`;
    s.el.style.opacity = Math.sin(Math.PI * t) * clamp(5 * q) * clamp(6 * (1 - q));
  }
  return { p, q, top: r.top };
}

/* ========== الكروت (الأكياس السبعة) ========== */
function buildCards() {
  const box = $("#cards");
  box.innerHTML = LIST.map(x => {
    const out = x.p.available === false;
    return `<article class="card${out ? " out" : ""}" data-pid="${esc(x.bag.id)}" style="--c:${x.bag.bg}">
      <h3 class="disp">${esc(x.p.name)}</h3>
      <img class="pk" src="${spriteURL(x.bag, x.p)}" alt="" draggable="false">
      <span class="pr num">${esc(money(x.p.price))}<small> / كيلو</small></span>
      <button type="button" class="add" ${out ? "disabled" : ""} aria-label="${out ? esc(x.p.name) + " خلص النهارده" : "اطلب " + esc(x.p.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
    </article>`;
  }).join("");
  box.querySelectorAll(".card").forEach(card => {
    const pid = card.dataset.pid;
    card.querySelector(".add").onclick = e => { e.stopPropagation(); app().openProduct(pid); };
    card.querySelector(".pk").onclick = () => { card.classList.remove("poke"); void card.offsetWidth; card.classList.add("poke"); if (card.classList.contains("live")) poke = { t0: performance.now() }; };
    if (FINE && !RM) {
      card.addEventListener("pointermove", e => {
        const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card._tilt = { x, y }; card.style.transform = `translateY(-8px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg)`; card.classList.add("tilt");
      });
      card.addEventListener("pointerleave", () => { card._tilt = null; card.style.transform = ""; card.classList.remove("tilt", "press"); });
    }
    card.addEventListener("pointerdown", () => card.classList.add("press"));
    card.addEventListener("pointerup", () => card.classList.remove("press"));
  });
  const x = cur(); if (x) box.querySelectorAll(".card").forEach(c => c.classList.toggle("live", c.dataset.pid === x.bag.id));
  reveals();
}
let stripCentered = false;

/* ========== الطيران للسلة ========== */
function flyToCart(d) {
  if (!d || !d.src || !d.rect || RM) return bumpCart();
  const tgt = $("#cartBtn").getBoundingClientRect(), r = d.rect;
  if (!r.width || !tgt.width) return bumpCart();
  const ghost = d.src.cloneNode(true); ghost.classList.add("fly"); ghost.removeAttribute("id");
  Object.assign(ghost.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: 0, zIndex: 90, pointerEvents: "none" });
  document.body.appendChild(ghost);
  const dx = tgt.left + tgt.width / 2 - (r.left + r.width / 2), dy = tgt.top + tgt.height / 2 - (r.top + r.height / 2);
  const k = Math.min(0.2, 30 / r.height), lift = Math.min(160, 0.35 * Math.abs(dy) + 60);
  const a = ghost.animate([
    { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
    { transform: `translate(${dx * 0.4}px,${dy * 0.4 - lift}px) scale(${0.45 + k}) rotate(10deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px,${dy}px) scale(${k}) rotate(18deg)`, opacity: 0.15 }
  ], { duration: 900, easing: "cubic-bezier(.5,0,.2,1)", fill: "forwards" });
  a.onfinish = () => { ghost.remove(); bumpCart(); };
}
function bumpCart() { anim($("#cartBtn"), [{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 320 }); }

/* ========== "خد البن معاك" ========== */
let beanPid = null, beanSel = {}, beansTouched = false;
function buildBeans() {
  const pick = $("#bPick");
  pick.innerHTML = `<div class="b-thumbs" id="bThumbs" role="group" aria-label="اختار البن"></div>
    <div class="b-groups" id="bGroups"></div>
    <div class="b-buy"><span class="b-price num" id="bPrice"></span><button type="button" class="b-btn" id="bBtn"></button></div>`;
  $("#bThumbs").onclick = e => { const b = e.target.closest("[data-pid]"); if (b) { beansTouched = true; selectBean(b.dataset.pid); } };
  $("#bGroups").onclick = e => {
    const c = e.target.closest("[data-g]"); if (!c) return; beansTouched = true;
    const g = c.dataset.g, i = +c.dataset.i, p = app().byId(beanPid), grp = p.options.find(x => x.id === g);
    const curSel = beanSel[g] || [];
    beanSel[g] = grp.type === "multi" ? (curSel.includes(i) ? curSel.filter(x => x !== i) : [...curSel, i]) : (curSel.includes(i) && !grp.required ? [] : [i]);
    paintBeans();
  };
  $("#bBtn").onclick = () => {
    const p = app().byId(beanPid); if (!p) return;
    const miss = (p.options || []).filter(g => g.required && !(beanSel[g.id] || []).length);
    if (miss.length) return app().toast("لازم تختار " + miss.map(g => g.name).join(" و "));
    const img = $("#bBag img");
    app().addLine(p.id, beanSel, 1, "", img);
    const b = $("#bBtn"); b.classList.add("done"); b.textContent = "اتضاف للسلة ✓";
    setTimeout(() => { b.classList.remove("done"); paintBeans(); }, 1600);
  };
  selectBean(LIST[0].bag.id, true);
  new IntersectionObserver((es, o) => es.forEach(x => { if (x.intersectionRatio >= 0.3) { o.disconnect(); if (!beansTouched) selectBean(beanPid, false, true); } }), { threshold: [0.3] }).observe($("#beans"));
}
function selectBean(pid, quiet, fill) {
  const p = app().byId(pid); if (!p) return;
  const changed = pid !== beanPid; beanPid = pid;
  if (changed || fill) {
    beanSel = {};
    for (const g of p.options || []) {
      if (!g.required) continue;
      const want = g.id === "weight" ? g.choices.findIndex(c => /نص/.test(c.name)) : 0;
      beanSel[g.id] = [want >= 0 ? want : 0];
    }
  }
  paintBeans(changed && !quiet);
}
function paintBeans(pop) {
  const p = app().byId(beanPid); if (!p) return;
  const x = LIST.find(l => l.bag.id === beanPid) || LIST[0];
  $("#bThumbs").innerHTML = LIST.map(l => `<button type="button" data-pid="${esc(l.bag.id)}" aria-pressed="${l.bag.id === beanPid}" style="--c:${l.bag.color}">
    <span class="tb"><img src="${spriteURL(l.bag, l.p)}" alt=""></span><span class="tn">${esc(l.p.name)}</span></button>`).join("");
  $("#bGroups").innerHTML = (p.options || []).map(g => `<div class="bg-row"><span class="bg-n">${esc(g.name)}</span><div class="chips">${g.choices.map((c, i) =>
    `<button type="button" class="chip" data-g="${esc(g.id)}" data-i="${i}" aria-pressed="${(beanSel[g.id] || []).includes(i)}">${esc(c.name)}${c.price ? `<small class="num"> +${esc(money(c.price))}</small>` : ""}</button>`).join("")}</div></div>`).join("");
  const miss = (p.options || []).filter(g => g.required && !(beanSel[g.id] || []).length);
  let price = null; try { price = DV.lineUnit(p, beanSel).unit; } catch (e) { }
  $("#bPrice").textContent = price != null && !miss.length ? money(price) : "";
  const b = $("#bBtn");
  if (!b.classList.contains("done")) {
    const out = p.available === false;
    b.disabled = out || !!miss.length;
    b.innerHTML = out ? "خلص النهارده" : miss.length ? `اختار ${esc(miss[0].name)}` : `ضيف للسلة`;
  }
  $("#bGlow").style.setProperty("--g", mix(x.bag.color, "#000000", 0) + "b8");
  const bag = $("#bBag"), src = spriteURL(x.bag, p);
  if (!bag.firstChild || bag.firstChild.getAttribute("src") !== src) {
    bag.innerHTML = `<img src="${src}" alt="${esc(p.name)}">`;
    if (pop) { anim(bag.firstChild, [{ transform: "translateY(-40px) scale(.8)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 550, easing: "cubic-bezier(.22,1,.36,1)" }); anim($("#bGlow"), [{ opacity: .55 }, { opacity: 1 }], { duration: 600 }); }
  }
}

/* ========== الهيدر ========== */
function buildHeader() {
  // الهيرو = الشاشة ناقص أي شريط فوقه (نسخة العرض / الترابيزة)
  const bars = [$("#demoBar"), $("#tableBan")];
  const fit = () => root.style.setProperty("--bn", bars.reduce((a, el) => a + (el && !el.hidden ? el.offsetHeight : 0), 0) + "px");
  const ro = new ResizeObserver(fit); bars.forEach(el => el && ro.observe(el));
  new MutationObserver(fit).observe($("#tableBan"), { attributes: true, attributeFilter: ["hidden"] }); fit();
  const pill = $("#navPill"), hl = pill.querySelector(".hl");
  const links = [...pill.querySelectorAll("a")];
  links.forEach(a => a.onclick = e => { const t = document.getElementById(a.dataset.s); if (!t) return; e.preventDefault(); scrollToY(t.getBoundingClientRect().top + scrollY - (a.dataset.s === "menu" ? 70 : 0)); });
  let active = null, solid = null, dark = null;
  const hdr = $("#hdr"), logo = hdr.querySelector(".brand img");
  headerTick = () => {
    const vh = innerHeight; let a = links[0];
    const sol = $("#hero").getBoundingClientRect().bottom < hdr.offsetHeight + 2;
    if (sol !== solid) { solid = sol; hdr.classList.toggle("solid", sol); }
    const dk = hdr.classList.contains("dark");
    if (dk !== dark) { dark = dk; logo.src = dk ? "assets/logo-cream.webp" : "assets/logo-red.webp"; }
    for (const l of links) { const s = document.getElementById(l.dataset.s); if (s && s.getBoundingClientRect().top <= vh * 0.35) a = l; }
    if (a !== active) {
      active = a; links.forEach(l => { l.classList.toggle("on", l === a); l.toggleAttribute("aria-current", l === a); });
      hl.style.width = a.offsetWidth + "px"; hl.style.transform = `translateX(${a.offsetLeft}px)`;
      const s = a.dataset.s; $("#hdr").classList.toggle("dark", s === "beans"); $("#hdr").classList.toggle("light", s === "menu");
    }
  };
  addEventListener("resize", () => { active = null; });
}
let headerTick = () => { };

/* ========== سكرول ناعم (ماوس/تراك باد على الديسكتوب بس) ========== */
let sTarget = null, sLast = 0;
function bindScroll() {
  if (RM || !FINE) return;
  addEventListener("wheel", e => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || body.classList.contains("locked") || body.style.overflow === "hidden" || $(".picker")) { sTarget = null; return; }
    if (e.target.closest && e.target.closest(".sheet,.picker,.modal,#bThumbs,.chips,.rail")) { sTarget = null; return; }
    e.preventDefault();
    const max = document.documentElement.scrollHeight - innerHeight, d = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
    sTarget = clamp((sTarget ?? scrollY) + d, 0, max); sLast = performance.now();
  }, { passive: false });
  const stop = () => { sTarget = null; };
  addEventListener("keydown", stop); addEventListener("pointerdown", stop); addEventListener("touchstart", stop, { passive: true });
}
function scrollToY(y) { if (RM || !FINE) { scrollTo({ top: y, behavior: RM ? "auto" : "smooth" }); return; } sTarget = clamp(y, 0, document.documentElement.scrollHeight - innerHeight); sLast = performance.now(); }
function scrollTick(now) {
  if (sTarget == null) return;
  const dt = Math.min(64, now - (scrollTick.t || now)); scrollTick.t = now;
  const y = scrollY, n = y + (sTarget - y) * (1 - Math.exp(-dt / 120));
  if (Math.abs(sTarget - n) < 0.5) { scrollTo({ top: sTarget, behavior: "instant" }); sTarget = null; return; }
  scrollTo({ top: n, behavior: "instant" });
}

/* ========== قطع البن الطايرة في الهيرو ========== */
function buildBits() {
  const B = [[.88, .20, 120, 18, 0], [.14, .18, 96, -22, 2], [.93, .74, 84, -12, 3], [.345, .15, 78, 10, 1], [.795, .885, 70, -30, 5]];
  $("#bits").innerHTML = B.map(([x, y, s, r, b], i) => `<i class="bit b${i}" style="--x:${x};--y:${y};--s:${s};--r:${r}deg;background-image:url(${bitCanvas(b).toDataURL("image/png")})"></i>`).join("");
}

/* ظهور العناوين سطر سطر */
function reveals() {
  const io = new IntersectionObserver((es, o) => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add("in"); o.unobserve(x.target); } }), { threshold: 0.18 });
  document.querySelectorAll(".sig-h, .sig-cap, .b-h, #cards").forEach(el => io.observe(el));
}

/* ========== اللوب ========== */
function loop(now) {
  requestAnimationFrame(loop);
  scrollTick(now);
  if (posTween) { const t = clamp((now - posTween.t0) / posTween.dur); pos = lerp(posTween.from, posTween.to, posTween.ease(t)); if (t >= 1) posTween = null; }
  stepReveal(now);
  headerTick();
  // تشغيل تلقائي
  if (autoOn && entered && !posTween && heroVis >= 0.6 && !document.hidden && $("#sheet").hidden && now - lastInteract > 3200 && !body.classList.contains("dragging")) goTo(target + 1);
  if (!LIST.length || !gl) return;
  const vh = innerHeight, vw = innerWidth;
  const G = heroGeom(), I = insideTick(now);
  const p1 = clamp(1 - I.top / vh);
  const shop = $("#cards").getBoundingClientRect(), p3 = clamp((vh - shop.top) / (0.7 * vh));
  // الأكياس اللي على القوس
  const jT = Math.round(target), base = Math.floor(pos), fadeOthers = 1 - clamp(1.6 * p1);
  const heroOn = G.top + G.H > -50 && fadeOthers > 0;
  lastStates = [];
  let n = 0;
  for (let j = base - 5; j <= base + 5; j++) {
    if (j === jT) continue;
    const o = gl.pool[n++]; if (!o) break;
    const x = LIST[((j % N) + N) % N];
    if (!heroOn) { place(o, x, { op: 0 }); continue; }
    const s = arcState(j - pos, G, j, now); s.op *= fadeOthers; s.kk = j - pos;
    place(o, x, s); lastStates.push(s);
  }
  while (n < gl.pool.length) place(gl.pool[n++], LIST[0], { op: 0 });
  // المسافر
  const tx = LIST[mod(jT)];
  const A = arcState(jT - pos, G, jT, now); A.kk = jT - pos; lastStates.push(A);
  let st = A;
  if (p1 > 0) {
    const ib = $("#inBag").getBoundingClientRect();
    const bob = RM ? 0 : Math.sin(now / 2600 * 2 * Math.PI) * 6;
    const spin = RM ? 0 : 720 * I.q;
    const B = { x: ib.left + ib.width / 2, y: ib.top + ib.height / 2 + bob, h: ib.height, rz: -12, ry: S.flip + spin, rx: 0, z: 0, op: 1, shadow: 1 };
    st = mixState(A, B, easeIO(p1));
    if (p3 > 0) {
      const card = document.querySelector(`#cards .card[data-pid="${tx.bag.id}"]`);
      if (card) {
        if (isPhone() && !stripCentered) { stripCentered = true; const strip = $("#cards"); strip.scrollTo({ left: card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2, behavior: RM ? "auto" : "smooth" }); }
        const pk = card.querySelector(".pk").getBoundingClientRect(), t = card._tilt || { x: 0, y: 0 };
        const C = { x: pk.left + pk.width / 2, y: pk.top + pk.height / 2, h: pk.height, rz: 0, ry: Math.round((S.flip + spin) / 360) * 360 + t.x * 14, rx: -t.y * 14, z: 30, op: 1, shadow: 0.7 };
        st = mixState(B, C, easeIO(p3));
      }
    }
  }
  if (poke) {
    const t = (now - poke.t0) / 500;
    if (t >= 1) poke = null;
    else { const k = t < 0.3 ? t / 0.3 : t < 0.6 ? (t - 0.3) / 0.3 : (t - 0.6) / 0.4, [a, b] = t < 0.3 ? [[1, 1], [1.06, 0.93]] : t < 0.6 ? [[1.06, 0.93], [0.97, 1.04]] : [[0.97, 1.04], [1, 1]];
      st = { ...st, sx: lerp(a[0], b[0], k), sy: lerp(a[1], b[1], k) }; }
  }
  const onScreen = st.y + st.h > -50 && st.y - st.h < vh + 50;
  place(gl.trav, tx, onScreen ? st : { op: 0 });
  lastTrav = onScreen ? { x: st.x, y: st.y, h: st.h, ry: st.ry, op: st.op, id: tx.bag.id } : null;
  if (mode === "gl") {
    const any = heroOn || onScreen;
    if (any || gl.dirty) { gl.r.render(gl.scene, gl.cam); gl.dirty = any; }
  }
}
/* للاختبارات بس (قراءة) */
let lastTrav = null;
window.DV = window.DV || {};
window.DV.stage = { get mode() { return mode; }, get pos() { return pos; }, get target() { return target; }, get N() { return N; },
  get flip() { return S.flip; }, get step() { return S.step; }, get trav() { return lastTrav; }, states: () => lastStates.map(s => ({ x: s.x, y: s.y, h: s.h, op: s.op, k: s.kk })) };
function mixState(a, b, t) {
  const o = {}; for (const k of ["x", "y", "h", "rz", "ry", "rx", "z", "op", "shadow"]) o[k] = lerp(a[k] ?? 0, b[k] ?? 0, t);
  return o;
}
