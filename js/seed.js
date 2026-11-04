/* المنيو الأساسي لديفان كوفي — منقول من المنيو المطبوع.
   ده بيتحمّل مرة واحدة بس في قاعدة البيانات، وبعد كده كل التعديل من لوحة التحكم. */
(function (root) {
  const SUGAR = { id: "sugar", name: "السكر", type: "single", required: true, choices: [
    { name: "سادة" }, { name: "ع الريحة" }, { name: "مظبوط" }, { name: "زيادة" }] };
  const SUGAR_OPT = { id: "sugar", name: "السكر", type: "single", required: false, choices: [
    { name: "من غير سكر" }, { name: "سكر خفيف" }, { name: "سكر عادي" }, { name: "سكر زيادة" }] };
  const WEIGHT = { id: "weight", name: "الوزن", type: "single", required: true, choices: [
    { name: "ربع كيلو", factor: 0.25 }, { name: "نص كيلو", factor: 0.5 }, { name: "كيلو", factor: 1 }] };
  const ROAST = { id: "roast", name: "درجة التحميص", type: "single", required: true, choices: [
    { name: "فاتح" }, { name: "وسط" }, { name: "غامق", price: 80 }] };
  const GRIND = { id: "grind", name: "الطحن", type: "single", required: true, choices: [
    { name: "مطحون ناعم" }, { name: "مطحون وسط" }, { name: "حبوب صحيحة" }] };
  const ICE = { id: "ice", name: "التلج", type: "single", required: false, choices: [
    { name: "تلج عادي" }, { name: "تلج خفيف" }, { name: "من غير تلج" }] };

  const categories = [
    { id: "hot", name: "المشروبات الساخنة", icon: "cup", sort: 1 },
    { id: "iced", name: "القهوة الباردة", icon: "iced", sort: 2 },
    { id: "mocktails", name: "الكوكتيل", icon: "glass", sort: 3 },
    { id: "juices", name: "العصائر", icon: "juice", sort: 4 },
    { id: "bakery", name: "المخبوزات", icon: "croissant", sort: 5 },
    { id: "blends", name: "توليفات البن", icon: "beans", sort: 6 },
    { id: "french", name: "بن فرنساوي", icon: "bag", sort: 7 }
  ];

  let n = 0;
  const P = (category, name, price, extra) => Object.assign({
    id: "p" + String(++n).padStart(3, "0"), category, name, price,
    description: "", options: [], popular: false, active: true, image: "", sort: n
  }, extra || {});

  const products = [
    // المشروبات الساخنة
    P("hot", "قهوة تركي سنجل", 25, { options: [SUGAR] }),
    P("hot", "قهوة تركي دوبل", 40, { options: [SUGAR], popular: true }),
    P("hot", "قهوة فرنساوي", 40, { options: [SUGAR_OPT] }),
    P("hot", "قهوة فرنساوي بالنكهة", 50, { options: [{ id: "flavor", name: "النكهة", type: "single", required: true, choices: [{ name: "كراميل بندق" }, { name: "بندق قطع" }] }, SUGAR_OPT] }),
    P("hot", "إسبريسو", 35, { options: [SUGAR_OPT] }),
    P("hot", "إسبريسو دوبل", 50, { options: [SUGAR_OPT] }),
    P("hot", "أمريكانو", 50, { options: [SUGAR_OPT] }),
    P("hot", "ماكياتو", 40, { options: [SUGAR_OPT] }),
    P("hot", "لاتيه", 65, { options: [SUGAR_OPT], popular: true }),
    P("hot", "كابتشينو", 60, { options: [SUGAR_OPT] }),
    P("hot", "فلات وايت", 50, { options: [SUGAR_OPT] }),
    P("hot", "سبانش لاتيه", 80, { popular: true }),
    P("hot", "كوفي موكا", 70, { options: [SUGAR_OPT] }),
    P("hot", "كومبانا", 65, { options: [SUGAR_OPT] }),
    P("hot", "شاي", 20, { options: [{ id: "tea", name: "النوع", type: "single", required: true, choices: [{ name: "أحمر" }, { name: "أخضر" }, { name: "أخضر بالنعناع" }] }, SUGAR_OPT] }),
    P("hot", "شاي بالحليب", 30, { options: [SUGAR_OPT] }),
    P("hot", "نسكافيه", 55, { options: [SUGAR_OPT] }),
    P("hot", "هوت سيدر", 60),
    P("hot", "هوت شوكولت", 65),
    // القهوة الباردة
    P("iced", "فرابيه شوكليت", 90, { options: [ICE] }),
    P("iced", "فرابيه كراميل", 90, { options: [ICE] }),
    P("iced", "فرابيه بندق", 90, { options: [ICE] }),
    P("iced", "فرابتشينو", 85, { options: [ICE] }),
    P("iced", "فرابتشينو كراميل", 90, { options: [ICE] }),
    P("iced", "فرابتشينو بندق", 90, { options: [ICE] }),
    P("iced", "آيس لاتيه", 75, { options: [ICE, SUGAR_OPT] }),
    P("iced", "آيس موكا", 85, { options: [ICE] }),
    P("iced", "آيس سبانش لاتيه", 85, { options: [ICE], popular: true }),
    // الكوكتيل
    P("mocktails", "موهيتو", 60, { description: "سفن أب، موهيتو سيرب، نعناع، ليمون", popular: true }),
    P("mocktails", "موهيتو بالتوت الأحمر", 70, { description: "موهيتو كلاسيك مع توت أحمر" }),
    P("mocktails", "موهيتو بلو كوراساو", 70, { description: "موهيتو كلاسيك مع بلو كوراساو" }),
    P("mocktails", "صن شاين", 55, { description: "سفن أب، لايم سيرب، رمان" }),
    P("mocktails", "شيكو بلو", 60, { description: "سفن أب، لايم سيرب، رمان، بلو كوراساو" }),
    P("mocktails", "إكزوتيك", 90, { description: "مانجو، أناناس، ريحان" }),
    P("mocktails", "وايلد", 85, { description: "جوافة، توت أحمر، باشون فروت" }),
    P("mocktails", "تروبيكانا", 90, { description: "مانجو، برتقال، جوافة، رمان، باشون فروت" }),
    P("mocktails", "جرين أورانج", 75, { description: "برتقال ونعناع" }),
    // العصائر
    P("juices", "عصير ليمون", 50, { options: [SUGAR_OPT] }),
    P("juices", "ليمون نعناع", 55, { options: [SUGAR_OPT] }),
    P("juices", "عصير برتقال", 70, { options: [SUGAR_OPT] }),
    P("juices", "عصير مانجو", 80, { options: [SUGAR_OPT] }),
    P("juices", "عصير جوافة", 70, { options: [SUGAR_OPT] }),
    P("juices", "عصير أناناس", 55, { options: [SUGAR_OPT] }),
    P("juices", "عصير تفاح", 55, { options: [SUGAR_OPT] }),
    P("juices", "بلادي ليمون", 60, { description: "ليمون وتوت أحمر" }),
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
