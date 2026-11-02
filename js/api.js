/* طبقة الاتصال: نفس الأوامر بالظبط سواء على Supabase أو نسخة العرض */
(function () {
  const cfg = window.DV_CONFIG;
  const live = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  let sb = null;
  if (live) sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, storageKey: "dv_admin_auth" } });

  function friendly(e) {
    const m = (e && (e.message || e.error_description)) || String(e || "");
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "النت فاصل أو السيرفر مش بيرد، جرّب تاني";
    if (/JWT|not authorized|permission denied|42501/i.test(m)) return "مش مسموح، ادخل تاني بحساب الأدمن";
    return m.replace(/^.*?:\s(?=[؀-ۿ])/, "");
  }

  async function rpc(name, args) {
    try {
      if (!live) return await DV.demoBackend.rpc(name, args);
      const { data, error } = await sb.rpc(name, args || {});
      if (error) throw error;
      return data;
    } catch (e) { throw new Error(friendly(e)); }
  }

  /* تصغير الصور قبل الرفع: أقصى عرض 900px بصيغة webp */
  function shrink(file, max = 900) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? res(b) : rej(new Error("الصورة مش مدعومة")), "image/webp", 0.85);
      };
      img.onerror = () => rej(new Error("الصورة مش مدعومة"));
      img.src = url;
    });
  }

  const admin = {
    async login(email, password) {
      if (!live) {
        if (password !== "divan2026") throw new Error("الباسورد غلط (في نسخة العرض: divan2026)");
        sessionStorage.setItem("dv_demo_admin", "1"); return true;
      }
      const { error } = await sb.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) throw new Error(/Invalid login/i.test(error.message) ? "الإيميل أو الباسورد غلط" : friendly(error));
      const ok = await rpc("is_admin");
      if (!ok) { await sb.auth.signOut(); throw new Error("الحساب ده مش أدمن"); }
      return true;
    },
    async session() {
      if (!live) return sessionStorage.getItem("dv_demo_admin") === "1";
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      try { return !!(await rpc("is_admin")); } catch (e) { return false; }
    },
    async logout() { if (!live) sessionStorage.removeItem("dv_demo_admin"); else await sb.auth.signOut(); },
    async upload(file) {
      const blob = await shrink(file);
      if (!live) return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await sb.storage.from("menu").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw new Error(friendly(error));
      return sb.storage.from("menu").getPublicUrl(path).data.publicUrl;
    }
  };

  window.DV.api = { live, rpc, admin, resetDemo: () => DV.demoBackend.reset() };
})();
