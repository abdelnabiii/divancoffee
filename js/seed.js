/* المنيو الأساسي لديفان كوفي — منقول من المنيو المطبوع.
   ده بيتحمّل مرة واحدة بس في قاعدة البيانات، وبعد كده كل التعديل من لوحة التحكم. */
(function (root) {
  const WEIGHT = { id: "weight", name: "الوزن", type: "single", required: true, choices: [
    { name: "ربع كيلو", factor: 0.25 }, { name: "نص كيلو", factor: 0.5 }, { name: "كيلو", factor: 1 }] };
  const ROAST = { id: "roast", name: "درجة التحميص", type: "single", required: true, choices: [
    { name: "فاتح" }, { name: "وسط" }, { name: "غامق", price: 80 }] };
  const GRIND = { id: "grind", name: "الطحن", type: "single", required: true, choices: [
    { name: "مطحون ناعم" }, { name: "مطحون وسط" }, { name: "حبوب صحيحة" }] };

  const categories = [
    { id: "bakery", name: "المخبوزات", icon: "croissant", sort: 3 },
    { id: "blends", name: "توليفات البن", icon: "beans", sort: 1 },
    { id: "french", name: "بن فرنساوي", icon: "bag", sort: 2 }
  ];

  // p001–p045 كانت المشروبات (اتشالت من المنيو) — العدّ بيبدأ من 45 عشان أكواد الأصناف الباقية ماتتغيرش
  let n = 45;
  const P = (category, name, price, extra) => Object.assign({
    id: "p" + String(++n).padStart(3, "0"), category, name, price,
    description: "", options: [], popular: false, active: true, image: "", sort: n
  }, extra || {});

  const products = [
    // المخبوزات
    P("bakery", "كرواسون سادة", 65),
    P("bakery", "كرواسون جبنة", 85),
    P("bakery", "كرواسون تركي", 90),
    P("bakery", "كرواسون لوز", 80),
    P("bakery", "كرواسون شوكولاتة", 80),
    P("bakery", "كرواسون تركي بالجبنة", 95, { popular: true }),
    // توليفات البن — السعر للكيلو، والوزن بيضرب فيه
    P("blends", "توليفة ديفان", 800, { description: "توليفة البيت", options: [WEIGHT, { id: "spice", name: "التحويجة", type: "single", required: true, choices: [{ name: "سادة" }, { name: "محوّج", price: 80 }] }, ROAST, GRIND] }),
    P("blends", "توليفة سبيشيال", 1000, { options: [WEIGHT, { id: "spice", name: "التحويجة", type: "single", required: true, choices: [{ name: "سادة" }, { name: "محوّج", price: 120 }] }, ROAST, GRIND] }),
    P("blends", "توليفة VIP", 1200, { description: "أعلى توليفة عندنا", options: [WEIGHT, { id: "spice", name: "التحويجة", type: "single", required: true, choices: [{ name: "سادة" }, { name: "محوّج", price: 120 }] }, ROAST, GRIND] }),
    P("blends", "بن إسبريسو", 800, { options: [WEIGHT, GRIND] }),
    // بن فرنساوي
    P("french", "بن فرنساوي", 640, { options: [WEIGHT, GRIND] }),
    P("french", "بن فرنساوي بندق قطع", 720, { options: [WEIGHT, GRIND] }),
    P("french", "بن فرنساوي نكهات", 680, { options: [WEIGHT, { id: "flavor", name: "النكهة", type: "single", required: true, choices: [{ name: "كراميل" }, { name: "بندق" }, { name: "فانيليا" }] }, GRIND] })
  ];

  const settings = {
    accepting: true,
    delivery_enabled: true,
    pickup_enabled: true,
    table_enabled: true,
    delivery_fee: 30,
    min_order: 0,
    cashback_rate: 0.10,
    points_cap: 100,
    point_value: 1,
    tables_count: 15,
    whatsapp: "201000160277",
    phone: "01000160277",
    hours: "",
    delivery_note: "التوصيل في التجمع الخامس والمناطق القريبة",
    cafe_lat: 30.043304,
    cafe_lng: 31.4685865,
    delivery_radius_km: 50,
    origins: [
      { name: "بن يمني", note: "نكهة أصيلة من جبال اليمن" },
      { name: "بن كولومبي", note: "توازن مثالي ونكهة غنية" },
      { name: "بن كيني", note: "قوة الطبيعة في كل فنجان" },
      { name: "بن برازيلي", note: "نكهة ناعمة ورائحة جذابة" }
    ]
  };

  /* صور الأصناف (assets/menu/<id>.webp) — بيتعدّل بـ tools/add-photo.py */
  const IMAGES = {
  };
  products.forEach(p => { if (IMAGES[p.id]) p.image = IMAGES[p.id]; });

  const SEED = { categories, products, settings };
  if (typeof module !== "undefined" && module.exports) module.exports = SEED;
  else root.DV_SEED = SEED;
})(typeof window !== "undefined" ? window : globalThis);
