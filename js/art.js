/* رسومات خطّية بنفس روح المنيو المطبوع — كلها SVG فبتطلع حادة على أي شاشة */
(function () {
  const S = (vb, body, cls = "") => `<svg class="${cls}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  const ART = {
    cup: S("0 0 64 64", `<path d="M24 9c-2 3 2 5 0 8M32 7c-2 3 2 5 0 8M40 9c-2 3 2 5 0 8" class="steam"/>
      <path d="M13 24h34v8c0 10-7.6 17-17 17s-17-7-17-17z"/><path d="M47 28h3a6 6 0 0 1 0 12h-4.5"/>
      <path d="M6 53c4 3 13 4 24 4s20-1 24-4"/><path d="M18 30c2 6 6 9 11 10" opacity=".55"/>`),
    iced: S("0 0 64 64", `<path d="M17 18h30l-4 40H21z"/><path d="M15 18h34"/><path d="M36 18l6-13h6"/>
      <rect x="23" y="25" width="7" height="7" rx="1.5" transform="rotate(-12 26 28)"/><rect x="32" y="31" width="7" height="7" rx="1.5" transform="rotate(10 35 34)"/>
      <path d="M19.5 40h25" opacity=".55"/>`),
    glass: S("0 0 64 64", `<path d="M14 12h36L32 34z"/><path d="M32 34v20M22 56h20"/><path d="M19 17h26" opacity=".55"/>
      <circle cx="46" cy="12" r="6"/><path d="M46 6v12M40 12h12" opacity=".6"/><path d="M27 6c4 2 6 6 5 11" />`),
    juice: S("0 0 64 64", `<path d="M18 20h28l-3 36H21z"/><path d="M38 20l5-14"/><path d="M19.5 34h25" opacity=".55"/>
      <path d="M44 20a8 8 0 0 1 12-6" /><path d="M46 14c3-1 6 0 8 2"/><circle cx="27" cy="44" r="2"/><circle cx="35" cy="48" r="1.6"/>`),
    croissant: S("0 0 64 64", `<path d="M8 40c2-9 9-16 17-18l7 13-7 9c-7 1-13-1-17-4z"/><path d="M56 40c-2-9-9-16-17-18l-7 13 7 9c7 1 13-1 17-4z"/>
      <path d="M25 22c4-3 10-3 14 0l-7 13z"/><path d="M14 33l6 4M50 33l-6 4M28 27l4 4M36 27l-4 4" opacity=".55"/><path d="M8 50h48" opacity=".4"/>`),
    beans: S("0 0 64 64", `<ellipse cx="24" cy="34" rx="11" ry="15" transform="rotate(-25 24 34)"/><path d="M18 22c6 6 6 18 12 24" />
      <ellipse cx="42" cy="28" rx="10" ry="13.5" transform="rotate(30 42 28)"/><path d="M46 17c-6 4-8 16-8 22"/>`),
    bag: S("0 0 64 64", `<path d="M16 22c-3 10-3 24 2 34h28c5-10 5-24 2-34"/><path d="M14 22c6-4 12 3 18-1s12 3 18-1"/>
      <path d="M20 22c0-6 3-11 6-14M44 22c0-6-3-11-6-14" opacity=".55"/><ellipse cx="27" cy="38" rx="3.5" ry="5" transform="rotate(-20 27 38)"/>
      <ellipse cx="37" cy="44" rx="3.5" ry="5" transform="rotate(25 37 44)"/><path d="M22 50h20" opacity=".4"/>`),
    hero: S("0 0 240 220", `<g class="steam"><path d="M96 20c-8 12 8 18 0 32"/><path d="M120 10c-8 12 8 18 0 32"/><path d="M144 20c-8 12 8 18 0 32"/></g>
      <path d="M58 74h124v26c0 38-28 64-62 64S58 138 58 100z"/><path d="M182 86h10a20 20 0 0 1 0 40h-14"/>
      <ellipse cx="120" cy="80" rx="58" ry="6" opacity=".6"/><path d="M76 98c4 22 18 36 38 40" opacity=".5"/>
      <path d="M22 176c18 12 54 16 98 16s80-4 98-16"/><path d="M50 184c20 6 44 8 70 8" opacity=".45"/>
      <g opacity=".75"><ellipse cx="34" cy="204" rx="7" ry="10" transform="rotate(-30 34 204)"/><path d="M30 196c4 4 4 12 8 16"/>
      <ellipse cx="206" cy="202" rx="7" ry="10" transform="rotate(35 206 202)"/><path d="M210 194c-4 4-4 12-8 16"/></g>`, "hero-art"),
    divider: `<svg class="divider" viewBox="0 0 320 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M8 12h110M202 12h110"/><circle cx="4" cy="12" r="2.5"/><circle cx="316" cy="12" r="2.5"/><path d="M118 12c10-10 22-10 30 0-8 10-20 10-30 0zM202 12c-10-10-22-10-30 0 8 10 20 10 30 0z"/><ellipse cx="160" cy="12" rx="6" ry="9" transform="rotate(20 160 12)"/><path d="M157 4c4 4 4 12 6 16"/></svg>`,
    sprig: `<svg class="sprig" viewBox="0 0 200 40" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M100 30C70 30 40 22 10 24M100 30c30 0 60-8 90-6"/>${[30, 50, 70, 130, 150, 170].map((x, i) => `<path d="M${x} ${i < 3 ? 25 + i : 26 - (i - 3)}c-4-8 0-14 8-16 2 8-2 14-8 16z"/>`).join("")}</svg>`
  };

  const I = (body, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
  const ICON = {
    cart: I(`<path d="M6 7h13l-1.4 8.2a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.7L5.6 4H3"/><circle cx="9.5" cy="20" r="1.2"/><circle cx="16" cy="20" r="1.2"/>`),
    user: I(`<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.4-7 8-7s7 2.5 8 7"/>`),
    bean: I(`<ellipse cx="12" cy="12" rx="6.5" ry="9" transform="rotate(25 12 12)"/><path d="M9 5c4 4 2 10 6 14"/>`),
    pin: I(`<path d="M12 22s7-6.6 7-12.5A7 7 0 0 0 5 9.5C5 15.4 12 22 12 22z"/><circle cx="12" cy="9.5" r="2.5"/>`),
    phone: I(`<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2"/>`),
    wa: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5 0 1.5-.6 1.7-1.2s.2-1.1.1-1.2l-.4-.2z"/></svg>`,
    plus: I(`<path d="M12 5v14M5 12h14"/>`),
    minus: I(`<path d="M5 12h14"/>`),
    x: I(`<path d="M6 6l12 12M18 6L6 18"/>`),
    check: I(`<path d="M5 12.5l4.5 4.5L19 7.5"/>`),
    clock: I(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`),
    table: I(`<path d="M3 9h18M5 9l-1 11M19 9l1 11M8 9v6h8V9"/><path d="M12 4v5"/>`),
    scooter: I(`<path d="M2.5 6.5h11v9.5h-11z"/><path d="M13.5 9.5h4l3.5 3.5v3h-7.5"/><circle cx="6.5" cy="17.5" r="1.9"/><circle cx="17" cy="17.5" r="1.9"/>`),
    bag: I(`<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>`),
    trash: I(`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`),
    gift: I(`<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1.5S9 8 12 8c3 0 6-1 6-1.5S14 4 12 8z"/>`),
    tag: I(`<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>`),
    repeat: I(`<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5"/>`),
    arrow: I(`<path d="M15 5l-7 7 7 7"/>`),
    ext: I(`<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`),
    fb: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v7h4v-7h3l.5-4h-3.5V9c0-.6.4-1 1-1z"/></svg>`,
    ig: I(`<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/>`),
    tt: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.4 2.3 1.8 3.8 4 4v3.2a7.6 7.6 0 0 1-4-1.2v6.4A5.6 5.6 0 1 1 11 9.9v3.3a2.4 2.4 0 1 0 2.3 2.4V3z"/></svg>`
  };

  window.DV = window.DV || {};
  window.DV.ART = ART; window.DV.ICON = ICON;
})();
