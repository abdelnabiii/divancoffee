/* طبقة الاتصال: نفس الأوامر بالظبط سواء على Supabase أو نسخة العرض.
   نسخة العرض بتشتغل بس لما supabaseUrl يكون فاضي في config.js.
   لو الإعدادات موجودة وحاجة باظت (المكتبة ما اتحمّلتش، السيرفر مش بيرد…) بنوري غلط واضح —
   عمرنا ما نرجع لنسخة العرض في الإنتاج، عشان الطلبات ماتتحفظش على جهاز العميل وتضيع. */
(function () {
  const cfg = window.DV_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let sb = null, setupError = null;
  if (configured) {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, storageKey: "dv_admin_auth" } });
    } else {
      setupError = "vendor/supabase.min.js did not load";
      console.error("[Divan] " + setupError + " — refusing to fall back to demo mode.");
    }
  }

  const MSG = {
    offline: "النت فاصل عندك — اتأكد من الاتصال وجرّب تاني",
    network: "السيرفر مش بيرد دلوقتي — جرّب تاني بعد شوية",
    setup: "الموقع مش قادر يوصل للسيرفر دلوقتي — جرّب تاني بعد شوية أو كلمنا",
    auth: "مش مسموح، ادخل تاني بحساب الأدمن",
    server: "حصلت مشكلة عندنا — جرّب تاني، ولو استمرت كلمنا"
  };
  const arabic = /[؀-ۿ]/;
  function fail(kind, message, detail) {
    const e = new Error(message || MSG[kind]); e.kind = kind;
    if (detail) console.error("[Divan]", kind, detail);
    return e;
  }
  /* بيحوّل أي غلط لرسالة عربي مفهومة، وبيحتفظ بالتفاصيل التقنية في الكونسول */
  function friendly(err) {
    const m = (err && (err.message || err.error_description)) || String(err || "");
    const code = err && err.code;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return fail("offline", null, m);
    if (/Failed to fetch|NetworkError|Load failed|fetch failed|ERR_|timed? ?out/i.test(m)) return fail("network", null, m);
    if (code === "42501" || /JWT|not authorized|permission denied/i.test(m)) return fail("auth", null, m);
    if (arabic.test(m)) return fail("app", m.replace(/^.*?:\s(?=[؀-ۿ])/, ""));   // رسايل قاعدة البيانات نفسها
    return fail("server", null, (code ? code + " " : "") + m);
  }

  async function rpc(name, args) {
    if (!configured) {
      try { return await DV.demoBackend.rpc(name, args); } catch (e) { throw fail("app", e.message); }
    }
    if (!sb) throw fail("setup", null, setupError);
    let res;
    try { res = await sb.rpc(name, args || {}); } catch (e) { throw friendly(e); }
    if (res.error) throw friendly(res.error);
    const data = res.data;
    // login بيرجّع غلطه كـ {_err} عشان محاولات الدخول الغلط تتسجّل (supabase/schema.sql)
    if (data && typeof data === "object" && !Array.isArray(data) && data._err) throw fail("app", data._err);
    return data;
  }

  /* تصغير الصور قبل الرفع: أقصى طول 900px بصيغة webp */
  function shrink(file, max = 900) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error("الصورة مش مدعومة")), "image/webp", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("الصورة مش مدعومة")); };
      img.src = url;
    });
  }

  const admin = {
    async login(email, password) {
      if (!configured) {
        // نسخة العرض بس (من غير Supabase) — الباسورد مكتوب في README
        if (password !== "divan2026") throw new Error("الباسورد غلط");
        sessionStorage.setItem("dv_demo_admin", "1"); return true;
      }
      if (!sb) throw fail("setup", null, setupError);
      let r;
      try { r = await sb.auth.signInWithPassword({ email: String(email).trim(), password }); } catch (e) { throw friendly(e); }
      if (r.error) throw /Invalid login/i.test(r.error.message) ? new Error("الإيميل أو الباسورد غلط") : friendly(r.error);
      const ok = await rpc("is_admin");
      if (!ok) { await sb.auth.signOut(); throw new Error("الحساب ده مش أدمن"); }
      return true;
    },
    async session() {
      if (!configured) return sessionStorage.getItem("dv_demo_admin") === "1";
      if (!sb) return false;
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      try { return !!(await rpc("is_admin")); } catch (e) { return false; }
    },
    async logout() { if (!configured) sessionStorage.removeItem("dv_demo_admin"); else if (sb) await sb.auth.signOut(); },
    async upload(file) {
      if (!/^image\/(webp|png|jpeg)$/.test(file.type) && !/\.(webp|png|jpe?g)$/i.test(file.name)) throw new Error("ارفع صورة webp أو png أو jpg");
      const blob = await shrink(file);
      if (!configured) return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      if (!sb) throw fail("setup", null, setupError);
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await sb.storage.from("menu").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw friendly(error);
      return sb.storage.from("menu").getPublicUrl(path).data.publicUrl;
    }
  };

  window.DV.api = { live: configured, demo: !configured, setupError, rpc, admin, resetDemo: () => DV.demoBackend.reset() };
})();
