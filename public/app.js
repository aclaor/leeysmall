// LeeysPremium storefront — stage 1 (design + cart). Payments and supplier sync arrive in stage 2.
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const FREE_SHIP = 49;
const money = (n) => "$" + n.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let PRODUCTS = [], COLLECTIONS = [], CONFIG = { countries: {} };

/* ---------- Product art (placeholder visuals until real supplier photos are imported) ---------- */
const ICONS = {
  buds: '<rect x="70" y="95" width="60" height="45" rx="22"/><circle cx="82" cy="80" r="16"/><circle cx="118" cy="80" r="16"/><path d="M82 96v14M118 96v14"/>',
  speaker: '<rect x="62" y="60" width="76" height="90" rx="28"/><circle cx="100" cy="112" r="20"/><circle cx="100" cy="78" r="5"/>',
  battery: '<rect x="66" y="52" width="68" height="104" rx="14"/><path d="M104 80l-14 24h20l-14 24"/>',
  charger: '<ellipse cx="100" cy="140" rx="54" ry="12"/><rect x="88" y="56" width="40" height="72" rx="8"/><rect x="60" y="104" width="22" height="26" rx="8"/>',
  cable: '<path d="M60 60c0 40 80 20 80 70"/><rect x="50" y="44" width="20" height="24" rx="4"/><rect x="130" y="128" width="20" height="24" rx="4"/>',
  bulb: '<path d="M100 50a32 32 0 0 0-18 58v16h36v-16a32 32 0 0 0-18-58z"/><path d="M86 136h28M90 146h20"/>',
  plug: '<rect x="70" y="62" width="60" height="78" rx="16"/><path d="M90 92v12M110 92v12"/><circle cx="100" cy="124" r="4"/>',
  strip: '<path d="M50 120h100"/><circle cx="62" cy="120" r="5"/><circle cx="82" cy="120" r="5"/><circle cx="102" cy="120" r="5"/><circle cx="122" cy="120" r="5"/><circle cx="142" cy="120" r="5"/><path d="M60 90l10 12M100 84v14M140 90l-10 12"/>',
  mount: '<circle cx="100" cy="88" r="30"/><circle cx="100" cy="88" r="12"/><path d="M100 118v30M80 148h40"/>',
  stand: '<rect x="82" y="48" width="44" height="78" rx="8" transform="rotate(-12 104 87)"/><path d="M70 150h70M96 126l-10 24M116 126l8 24"/>',
  lamp: '<path d="M70 150h60M100 150V90l30-26"/><path d="M118 52l30 18-10 14-30-18z"/>',
  home: '<path d="M52 104 100 62l48 42"/><rect x="66" y="100" width="68" height="52" rx="4"/><rect x="92" y="120" width="16" height="32"/>',
  shirt: '<path d="M80 54 56 68l10 24 12-6v62h44V86l12 6 10-24-24-14c-4 10-12 14-20 14s-16-4-20-14z"/>',
  heart: '<path d="M100 148s-46-28-46-62a24 24 0 0 1 46-10 24 24 0 0 1 46 10c0 34-46 62-46 62z"/>',
  ball: '<circle cx="100" cy="100" r="44"/><path d="M60 82c26 10 54 10 80 0M60 118c26-10 54-10 80 0M100 56v88"/>',
  toy: '<rect x="62" y="88" width="76" height="52" rx="10"/><circle cx="82" cy="146" r="9"/><circle cx="118" cy="146" r="9"/><rect x="78" y="62" width="40" height="28" rx="6"/>',
  paw: '<ellipse cx="100" cy="124" rx="26" ry="22"/><circle cx="70" cy="92" r="11"/><circle cx="88" cy="70" r="11"/><circle cx="112" cy="70" r="11"/><circle cx="130" cy="92" r="11"/>',
  car: '<path d="M52 122h96v-14l-14-6-12-24H78L66 102l-14 6z"/><circle cx="76" cy="126" r="11"/><circle cx="124" cy="126" r="11"/>',
  bag: '<path d="M62 76h76l-6 74H68z"/><path d="M84 76v-8a16 16 0 0 1 32 0v8"/>',
  hub: '<rect x="56" y="80" width="88" height="44" rx="12"/><path d="M144 102h20"/><rect x="68" y="96" width="10" height="12" rx="2"/><rect x="86" y="96" width="10" height="12" rx="2"/><rect x="104" y="96" width="10" height="12" rx="2"/><rect x="122" y="96" width="10" height="12" rx="2"/>',
};
function art(p, variant = 0) {
  if (p.images && p.images.length) {
    const src = p.images[variant % p.images.length];
    return `<div class="art photo"><img src="${esc(src)}" alt="${esc(p.title)}" loading="lazy"></div>`;
  }
  // Blue-spotlight studio scene: silver product on deep navy, like a premium ad.
  const h = 200 + ((p.hue ?? 210) % 50), id = "g" + String(p.id).replace(/\W/g, "") + variant;
  const tilt = [0, -8, 8, 0][variant] || 0, scale = [1, 1.12, 0.92, 1.25][variant] || 1;
  const sx = [150, 60, 140, 100][variant] ?? 150, sy = [40, 50, 160, 30][variant] ?? 40;
  return `<svg class="art" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(p.title)}" style="width:100%;height:100%">
    <defs>
      <radialGradient id="${id}s" cx="${sx / 200}" cy="${sy / 200}" r=".85"><stop offset="0" stop-color="hsl(${h} 95% 55% / .55)"/><stop offset=".45" stop-color="hsl(${h + 10} 90% 30% / .25)"/><stop offset="1" stop-color="#050812" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}m" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#f4f7ff"/><stop offset=".45" stop-color="#9aa8c4"/><stop offset="1" stop-color="#2b3550"/></linearGradient>
      <radialGradient id="${id}f" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="hsl(${h} 100% 60% / .45)"/><stop offset="1" stop-color="hsl(${h} 100% 60% / 0)"/></radialGradient>
    </defs>
    <rect width="200" height="200" fill="#060a16"/>
    <rect width="200" height="200" fill="url(#${id}s)"/>
    <ellipse cx="100" cy="166" rx="62" ry="10" fill="url(#${id}f)"/>
    <g fill="#fff"><circle cx="${30 + variant * 37 % 140}" cy="34" r="1.2" opacity=".9"/><circle cx="172" cy="${120 - variant * 13}" r="1" opacity=".7"/><circle cx="24" cy="150" r=".8" opacity=".6"/><path d="M168 30l1.2 4 4 1.2-4 1.2-1.2 4-1.2-4-4-1.2 4-1.2z" opacity=".85"/></g>
    <g transform="translate(100 100) rotate(${tilt}) scale(${scale}) translate(-100 -100)" fill="url(#${id}m)" stroke="hsl(${h} 100% 78%)" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon] || ICONS.hub}</g>
  </svg>`;
}
const COLL_LOOK = { electronics: [210, "buds"], "home-kitchen": [25, "home"], fashion: [330, "shirt"], "beauty-health": [300, "heart"], "sports-outdoors": [140, "ball"], "toys-kids": [45, "toy"], pets: [15, "paw"], automotive: [0, "car"] };
const coverProduct = (c) => {
  const inCat = PRODUCTS.filter((x) => x.collection === c.id);
  return (c.cover && PRODUCTS.find((x) => x.id === c.cover)) || inCat.find((x) => x.images?.length) || inCat[0];
};
const collArt = (c) => { const lk = COLL_LOOK[c.id], p = coverProduct(c);
  if (p?.images?.length) return art(p);
  return art({ id: "c-" + c.id, title: c.name, hue: lk?.[0] ?? p?.hue ?? (c.id.length * 47) % 360, icon: lk?.[1] ?? p?.icon ?? "bag" }); };

/* ---------- Cart ---------- */
const cart = {
  items: (() => { try { return JSON.parse(localStorage.getItem("lm_cart")) || []; } catch { return []; } })(),
  save() { try { localStorage.setItem("lm_cart", JSON.stringify(this.items)); } catch {} updateCount(); },
  add(id, variant, qty = 1) {
    const key = id + "|" + (variant || "");
    const line = this.items.find((l) => l.key === key);
    if (line) line.qty += qty; else this.items.push({ key, id, variant, qty });
    this.save();
  },
  set(key, qty) { const l = this.items.find((x) => x.key === key); if (!l) return; l.qty = Math.max(0, qty); this.items = this.items.filter((x) => x.qty > 0); this.save(); },
  lines() { return this.items.map((l) => ({ ...l, p: PRODUCTS.find((p) => p.id === l.id) })).filter((l) => l.p); },
  subtotal() { return this.lines().reduce((s, l) => s + l.p.price * l.qty, 0); },
  count() { return this.items.reduce((s, l) => s + l.qty, 0); },
};
function updateCount() { const n = cart.count(), el = $("#cartCount"); el.textContent = n; el.classList.toggle("zero", n === 0); }

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200); }

function shipProgress(sub) {
  const left = FREE_SHIP - sub, pct = Math.min(100, (sub / FREE_SHIP) * 100);
  return `<div class="ship-progress">${left > 0 ? `You're <b>${money(left)}</b> away from free US shipping` : "🎉 You've unlocked <b>free US shipping</b>"}<div class="bar"><i style="width:${pct}%"></i></div></div>`;
}
function qtyCtl(key, q) { return `<div class="qty"><button data-q="${key}" data-d="-1" aria-label="Decrease">−</button><input value="${q}" readonly aria-label="Quantity"><button data-q="${key}" data-d="1" aria-label="Increase">+</button></div>`; }

function renderDrawer() {
  const d = $("#drawer"), lines = cart.lines(), sub = cart.subtotal();
  d.innerHTML = `<div class="drawer-head"><h3>Your cart (${cart.count()})</h3><button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
  ${lines.length ? shipProgress(sub) + `<div class="drawer-items">${lines.map((l) => `
    <div class="line"><a class="thumb" href="/products/${l.id}" data-link>${variantImg(l.p, l.variant) ? photoTag(variantImg(l.p, l.variant), l.p.title) : art(l.p)}</a>
      <div><div class="t">${esc(l.p.title)}</div>${l.variant ? `<div class="v">${esc(l.variant)}</div>` : ""}<div style="margin-top:8px">${qtyCtl(l.key, l.qty)}</div><button class="rm" data-rm="${l.key}">Remove</button></div>
      <b>${money(l.p.price * l.qty)}</b></div>`).join("")}${giftRows(cartGifts(lines))}</div>
    <div class="drawer-foot"><div class="row-between"><span>Subtotal</span><b>${money(sub)}</b></div><small class="muted">Taxes and shipping calculated at checkout.</small>
      <a class="btn accent block" href="/checkout" data-link>Checkout</a><a class="btn ghost block" href="/cart" data-link>View cart</a></div>`
  : `<div class="empty"><p>Your cart is empty.</p><a class="btn" href="/collections/all" data-link>Start shopping</a></div>`}`;
}
function openDrawer() { renderDrawer(); $("#drawer").hidden = false; $("#overlay").hidden = false; }
function closeAll() { $("#drawer").hidden = true; $("#overlay").hidden = true; $("#mobileNav").hidden = true; }

/* ---------- UI pieces ---------- */
/* ---------- Promos, delivery estimates, countdowns ---------- */
let PROMO = { promos: [], vouchers: [], schedules: [], gifts: [] };
const giftFor = (p) => (PROMO.gifts || []).find((g) => (g.scope === "collection" ? g.target === p.collection : (g.target || []).includes(p.id)) && g.gift.id !== p.id);
// Gifts earned by the current cart (the server adds them to the order for real at checkout)
function cartGifts(lines) {
  return (PROMO.gifts || []).map((g) => {
    const q = lines.filter((l) => (g.scope === "collection" ? g.target === l.p.collection : (g.target || []).includes(l.id))).reduce((s, l) => s + l.qty, 0);
    return q ? { ...g.gift, qty: g.perItem ? Math.min(q, 10) : 1, label: g.label } : null;
  }).filter(Boolean);
}
const giftRows = (gs) => gs.map((g) => `<div class="line gift-line"><div class="thumb">${g.image ? `<img src="${esc(g.image)}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<div class="gift-ico">🎁</div>`}</div>
  <div><div class="t">🎁 ${esc(g.title)}</div><div class="v">${g.variant ? esc(g.variant) + " · " : ""}Free gift${g.qty > 1 ? " × " + g.qty : ""}${g.value ? ` · worth ${money(g.value * g.qty)}` : ""}</div></div><b class="free">FREE</b></div>`).join("");
const schedFor = (p) => (PROMO.schedules || []).filter((s) => s.scope === "all" || (s.scope === "collection" && s.target === p.collection) || (s.scope === "products" && (s.target || []).includes(p.id))).sort((a, b) => b.percent - a.percent)[0];
const schedForCat = (id) => (PROMO.schedules || []).filter((s) => s.scope === "all" || (s.scope === "collection" && s.target === id)).sort((a, b) => b.percent - a.percent)[0];
const shopCountry = () => { try { return localStorage.getItem("lp_country") || CONFIG.country || "US"; } catch { return CONFIG.country || "US"; } };
const setShopCountry = (c) => { try { localStorage.setItem("lp_country", c); } catch {} };
function etaDays(p, country) {
  if (country === "US") return p.ships === "us" ? [3, 7] : [8, 15];
  if (["CA", "GB", "AU"].includes(country)) return [7, 14];
  return [10, 20];
}
function etaShort(p, country = shopCountry()) {
  const [a, b] = etaDays(p, country), d1 = new Date(), d2 = new Date();
  d1.setDate(d1.getDate() + a); d2.setDate(d2.getDate() + b);
  const m = (d) => d.toLocaleDateString("en-US", { month: "short" });
  return m(d1) === m(d2) ? `${m(d1)} ${d1.getDate()}–${d2.getDate()}` : `${m(d1)} ${d1.getDate()} – ${m(d2)} ${d2.getDate()}`;
}
function timeLeft(iso) {
  const s = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return s <= 0 ? "ended" : d ? `${d}d ${h}h ${pad(mi)}m` : `${pad(h)}:${pad(mi)}:${pad(se)}`;
}
setInterval(() => document.querySelectorAll("[data-ends]").forEach((el) => (el.textContent = timeLeft(el.dataset.ends))), 1000);
// Vouchers can cover the whole store, one category, or chosen products
const vMatches = (v, p) => !v.scope || v.scope === "all" || (v.scope === "collection" ? p.collection === v.target : (v.target || []).includes(p.id));
const vouchersFor = (p) => PROMO.vouchers.filter((v) => vMatches(v, p));
const bestVoucher = (p) => (p ? vouchersFor(p) : PROMO.vouchers)[0] || null;
const vScopeText = (v) => v.scope === "collection" ? `${COLLECTIONS.find((c) => c.id === v.target)?.name || "Category"} only` : v.scope === "products" ? "Selected items only" : "";
// Photo for a chosen option, e.g. "Black" or "Black / XL" (CJ sends one per option)
const variantImg = (p, variant) => {
  const vi = p.variantImages || {};
  if (!variant) return null;
  if (vi[variant]) return vi[variant];
  const parts = String(variant).split(" / ");
  const k = Object.keys(vi).find((key) => parts.every((x) => key.toLowerCase().includes(x.toLowerCase())));
  return k ? vi[k] : null;
};
const optionImg = (p, value) => { const vi = p.variantImages || {}; if (vi[value]) return vi[value]; const k = Object.keys(vi).find((key) => key.split(/[-/ ]+/).some((w) => w.toLowerCase() === String(value).toLowerCase())); return k ? vi[k] : null; };
const photoTag = (src, alt) => `<div class="art photo"><img src="${esc(src)}" alt="${esc(alt)}"></div>`;
const videoTag = (p, controls) => `<video class="pvideo" src="${esc(p.video)}" ${controls ? "controls" : ""} autoplay muted playsinline loop preload="metadata" ${p.images?.[0] ? `poster="${esc(p.images[0])}"` : ""}></video>`;
const offPct = (p) => (p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0);

const stars = (r, n) => `<div class="stars"><i>${"★".repeat(Math.round(r))}${"☆".repeat(5 - Math.round(r))}</i>${r.toFixed(1)} (${n.toLocaleString()})</div>`;
function card(p) {
  const off = offPct(p), v = bestVoucher(p), freeShip = p.price >= FREE_SHIP;
  return `<div class="card"><div class="media-wrap"><a href="/products/${p.id}" data-link><div class="media">
      ${p.stock === 0 ? `<span class="badge out">Sold out</span>` : p.promo ? `<span class="badge flash">⚡<span class="fl-txt"> ${esc(p.promo.label)}</span></span>` : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
      ${off ? `<span class="badge sale">-${off}%</span>` : ""}${art(p)}
      <div class="ribbons">${giftFor(p) ? `<span class="rb gift">🎁 Free gift</span>` : ""}${p.video ? `<span class="rb vid">▶ Video</span>` : ""}${freeShip ? `<span class="rb ship">Free shipping</span>` : p.ships === "us" ? `<span class="rb us">US warehouse</span>` : ""}${v ? `<span class="rb voucher">${v.type === "shipping" ? "Free ship voucher" : v.type === "amount" ? `${money(v.amount).replace(".00", "")} off voucher` : `Voucher ${v.percent}% off`}</span>` : ""}</div></div></a>
    ${p.stock > 0 ? `<button class="btn quick-add" data-add="${p.id}">Quick add</button>` : ""}</div>
    <a href="/products/${p.id}" data-link><h3>${esc(p.title)}</h3></a>
    <div class="price ${off ? "sale" : ""}"><b>${money(p.price)}</b>${p.compareAt && p.compareAt > p.price ? `<s>${money(p.compareAt)}</s>` : ""}</div>
    ${p.promo ? `<div class="promo-line">⚡ ${p.promo.percent}% off · ends in <span data-ends="${p.promo.endsAt}">${timeLeft(p.promo.endsAt)}</span></div>`
      : (() => { const s = schedFor(p); return s ? `<div class="sched-line">📅 ${s.percent}% off · ${esc(s.text.split(",")[0])}</div>` : ""; })()}
    <div class="card-meta"><span class="eta">🚚 ${etaShort(p)}</span>${p.sold ? `<span>${p.sold.toLocaleString()} sold</span>` : ""}</div></div>`;
}
const trustIcons = {
  truck: '<path d="M2 7h12v9H2zM14 10h4l3 3v3h-7z"/><circle cx="6" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  return: '<path d="M4 10h11a5 5 0 0 1 0 10H8"/><path d="m8 6-4 4 4 4"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
};
const trust = () => `<section class="trust"><div class="wrap trust-row">${[
  ["truck", "Fast US shipping", "3–7 days from US warehouses"], ["shield", "Secure checkout", "PayPal & major cards"],
  ["return", "30-day returns", "Hassle-free refunds"], ["chat", "Real support", "Reply within 24 hours"],
].map(([i, a, b]) => `<div class="trust-item"><svg viewBox="0 0 24 24">${trustIcons[i]}</svg><div><b>${a}</b><span class="muted">${b}</span></div></div>`).join("")}</div></section>`;

/* ---------- Pages ---------- */
/* ---------- Homepage showcase (rotating, current slide grows big) ---------- */
let SHOW = { slides: [], cur: 0, timer: null };
function showcaseSlides() {
  const withPhoto = (p) => p && p.images?.length;
  const chosen = (CONFIG.heroSlides || []).map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean)
    .map((p) => ({ p, tag: COLLECTIONS.find((c) => c.id === p.collection)?.name || "Featured", label: p.title, price: p.price, compareAt: p.compareAt, href: "/products/" + p.id }));
  if (chosen.length) return chosen;
  const used = new Set(), out = [];
  for (const c of COLLECTIONS) {
    const p = coverProduct(c);
    if (p && !used.has(p.id)) { used.add(p.id); out.push({ p, tag: "Shop category", label: c.name, href: "/collections/" + c.id, cta: "Explore →" }); }
  }
  for (const p of [...PRODUCTS].filter(withPhoto).sort((a, b) => b.reviews - a.reviews)) {
    if (out.length >= 5) break;
    if (!used.has(p.id)) { used.add(p.id); out.push({ p, tag: "Best seller", label: p.title, price: p.price, compareAt: p.compareAt, href: "/products/" + p.id }); }
  }
  return out.length ? out : PRODUCTS.slice(0, 5).map((p) => ({ p, tag: "Featured", label: p.title, price: p.price, href: "/products/" + p.id }));
}
function showcaseHTML() {
  SHOW.slides = showcaseSlides(); SHOW.cur = 0;
  return `<div class="showcase" id="showcase" aria-roledescription="carousel">
    <div class="sc-orbit"><i></i><i></i><i></i></div>
    <div class="sc-stage">${SHOW.slides.map((s, i) => `<a class="sc-card" data-sc="${i}" href="${s.href}" data-link aria-label="${esc(s.label)}">
      <div class="sc-media">${art(s.p, 0)}</div>
      <div class="sc-info"><span class="sc-tag">${esc(s.tag)}</span><b>${esc(s.label)}</b>
        <span class="sc-price">${s.price != null ? `${money(s.price)}${s.compareAt ? ` <s>${money(s.compareAt)}</s>` : ""}` : esc(s.cta || "Shop now →")}</span></div></a>`).join("")}</div>
    <div class="sc-dots">${SHOW.slides.map((_, i) => `<button data-dot="${i}" aria-label="Show slide ${i + 1}"></button>`).join("")}</div></div>`;
}
function layoutShowcase() {
  const n = SHOW.slides.length;
  document.querySelectorAll("#showcase .sc-card").forEach((el, i) => {
    let d = (i - SHOW.cur + n) % n; if (d > n / 2) d -= n;
    el.dataset.pos = Math.abs(d) > 2 ? "hidden" : String(d);
    el.tabIndex = d === 0 ? 0 : -1;
  });
  document.querySelectorAll("#showcase [data-dot]").forEach((b, i) => b.classList.toggle("on", i === SHOW.cur));
}
function startShowcase() {
  clearInterval(SHOW.timer);
  const box = $("#showcase");
  if (!box || !SHOW.slides.length) return;
  const go = (i) => { SHOW.cur = (i + SHOW.slides.length) % SHOW.slides.length; layoutShowcase(); };
  layoutShowcase();
  box.querySelectorAll(".sc-card").forEach((el) => el.addEventListener("click", (e) => {
    if (el.dataset.pos !== "0") { e.preventDefault(); e.stopPropagation(); go(Number(el.dataset.sc)); }
  }, true));
  box.querySelectorAll("[data-dot]").forEach((b) => (b.onclick = () => go(Number(b.dataset.dot))));
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const play = () => { clearInterval(SHOW.timer); if (!reduce && SHOW.slides.length > 1) SHOW.timer = setInterval(() => { if (!document.body.contains(box)) return clearInterval(SHOW.timer); go(SHOW.cur + 1); }, 3600); };
  box.onmouseenter = () => clearInterval(SHOW.timer); box.onmouseleave = play;
  let sx = null;
  box.ontouchstart = (e) => { sx = e.touches[0].clientX; clearInterval(SHOW.timer); };
  box.ontouchend = (e) => { if (sx != null) { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(SHOW.cur + (dx < 0 ? 1 : -1)); } sx = null; play(); };
  play();
}
function marquee() {
  const items = [...COLLECTIONS.map((c) => `<a href="/collections/${c.id}" data-link>${esc(c.name)}</a>`), "<span>Free US shipping over $" + FREE_SHIP + "</span>", "<span>30-day returns</span>", "<span>Secure checkout</span>"];
  const row = items.map((x) => x + "<em>✦</em>").join("");
  return `<div class="marquee" aria-hidden="false"><div class="mq-track"><div>${row}</div><div aria-hidden="true">${row}</div></div></div>`;
}

// Amazon-style homepage in the LeeysPremium theme: promo-card carousel, category quad cards and product shelves.
const pimg = (p) => (p.images && p.images[0] ? photoTag(p.images[0], p.title) : art(p));
function home() {
  if (!PRODUCTS.length) { app.innerHTML = `<div class="wrap prose"><h1>New products coming soon</h1></div>`; return; }
  const inStock = PRODUCTS.filter((p) => p.stock > 0);
  const best = [...PRODUCTS].sort((a, b) => (b.sold || 0) - (a.sold || 0) || (b.rating || 0) - (a.rating || 0)).slice(0, 24);
  const maxOff = Math.max(0, ...PRODUCTS.map(offPct));
  const onSale = PRODUCTS.filter((p) => p.promo).sort((a, b) => b.promo.percent - a.promo.percent);
  const flashEnds = onSale.length ? onSale.map((p) => p.promo.endsAt).sort()[0] : null;
  const fresh = [...PRODUCTS].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 24);
  const under25 = inStock.filter((p) => p.price <= 25).sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 16);
  const usFast = inStock.filter((p) => p.ships === "us").slice(0, 16);
  const cats = COLLECTIONS.map((c) => ({ c, items: PRODUCTS.filter((p) => p.collection === c.id) })).filter((x) => x.items.length).sort((a, b) => b.items.length - a.items.length);
  const pick4 = (list) => [...list].sort((a, b) => (b.sold || 0) - (a.sold || 0) || ((b.images || []).length ? 1 : 0) - ((a.images || []).length ? 1 : 0)).slice(0, 4);
  const shelf = (title, href, list, extra = "") => list.length ? `<section class="az-shelf"><div class="wrap"><div class="az-panel">
    <div class="az-shelf-head"><h2>${title}</h2>${extra}<a href="${href}" data-link>See more ›</a></div>
    <div class="az-rail" data-rail>${list.map(card).join("")}</div><button class="az-arrow l" data-rl="-1" aria-label="Scroll left">‹</button><button class="az-arrow r" data-rl="1" aria-label="Scroll right">›</button></div></div></section>` : "";
  const quad = ({ c, items }) => `<div class="az-quad"><h3>${esc(c.name)}</h3><div class="az-q4">${pick4(items).map((p) => `<a href="/products/${p.id}" data-link><div class="az-qimg">${pimg(p)}</div><span>${esc(p.title.split(/[,(|-]/)[0].trim().slice(0, 28))}</span></a>`).join("")}</div><a class="az-more" href="/collections/${c.id}" data-link>See more</a></div>`;
  // Promo cards (Amazon's tall tiles). Admin can pick up to 2 products per tile; otherwise products with videos first, then most popular, then priciest.
  const rank = (a, b) => (b.video ? 1 : 0) - (a.video ? 1 : 0) || (b.sold || 0) - (a.sold || 0) || b.price - a.price;
  const used = new Set(Object.values(CONFIG.homeTiles || {}).flat()); // automatic picks avoid repeating products other tiles show
  const pickTile = (key, pool) => {
    const chosen = ((CONFIG.homeTiles || {})[key] || []).map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
    const sorted = [...(pool.length ? pool : PRODUCTS)].sort(rank).filter((p) => !chosen.includes(p));
    const auto = [...sorted.filter((p) => !used.has(p.id)), ...sorted.filter((p) => used.has(p.id))];
    const out = [...chosen, ...auto].slice(0, 2); out.forEach((p) => used.add(p.id)); return out;
  };
  const tiles = [
    { key: "ship", cls: "t-blue", eb: "Get what you need fast", h: `Free US delivery over $${FREE_SHIP}`, btn: "Shop now", href: "/collections/all", pool: usFast },
    onSale.length && { key: "flash", cls: "t-violet", eb: "⚡ Flash sale · limited time", h: `Up to ${Math.max(...onSale.map((p) => p.promo.percent))}% off`, timer: flashEnds, href: "/collections/all?sort=deals", pool: onSale },
    ...cats.slice(0, 4).map(({ c, items }, i) => ({ key: "cat:" + c.id, cls: ["t-teal", "t-magenta", "t-navy", "t-amber"][i], eb: "Top picks in", h: esc(c.name), href: "/collections/" + c.id, pool: items })),
    { key: "live", cls: "t-red", eb: CONFIG.live?.status === "live" ? "● On air now" : "Watch & shop", h: "Premium Live", href: "/live", pool: PRODUCTS },
    { key: "new", cls: "t-indigo", eb: "Just landed", h: "New arrivals", href: "/collections/all?sort=latest", pool: fresh },
    under25.length && { key: "under25", cls: "t-green", eb: "Little prices", h: "Deals under $25", href: "/collections/all?sort=price-asc", pool: under25 },
    { key: "video", cls: "t-slate", eb: "See it in action", h: "Premium Video", href: "/videos", pool: PRODUCTS.filter((p) => p.video) },
  ].filter(Boolean).map((t) => ({ ...t, imgs: pickTile(t.key, t.pool) }));
  const tileMedia = (p, i) => i === 0 && p.video
    ? `<div class="az-ti az-ti0 az-tv"><video data-src="${esc(p.video)}" muted loop playsinline preload="none" ${p.images?.[0] ? `poster="${esc(p.images[0])}"` : ""}></video><span class="az-play">▶</span></div>`
    : `<div class="az-ti az-ti${i}">${pimg(p)}</div>`;
  document.title = "LeeysPremium — Everything you need, delivered fast";
  app.innerHTML = `
  <section class="az-hero"><div class="wrap az-hero-wrap">
    <div class="az-tiles" data-rail>${tiles.map((t) => `<a class="az-tile ${t.cls}" href="${t.href}" data-link>
      <span class="az-eb">${t.eb}</span><b class="az-h">${t.h}</b>
      ${t.timer ? `<span class="az-pill">Ends in <b data-ends="${t.timer}">${timeLeft(t.timer)}</b></span>` : t.btn ? `<span class="az-pill">${t.btn}</span>` : ""}
      <div class="az-tile-art">${t.imgs.map(tileMedia).join("")}</div></a>`).join("")}</div>
    <button class="az-arrow l" data-rl="-1" aria-label="Previous">‹</button><button class="az-arrow r" data-rl="1" aria-label="Next">›</button></div></section>
  ${marquee()}
  ${homeOffers()}
  ${cats.length ? `<section class="az-quads"><div class="wrap az-quad-grid" style="--n:${Math.min(5, cats.length)}">${cats.slice(0, 5).map(quad).join("")}</div></section>` : ""}
  ${onSale.length ? `<section class="az-bleed"><div class="wrap"><div class="az-bleed-head"><h2>⚡ Flash sale</h2><span class="flash-timer">Ends in <b data-ends="${flashEnds}">${timeLeft(flashEnds)}</b></span><a href="/collections/all?sort=deals" data-link>See all deals ›</a></div>
    <div class="az-rel"><div class="az-rail" data-rail>${onSale.slice(0, 20).map(card).join("")}</div><button class="az-arrow l" data-rl="-1" aria-label="Scroll left">‹</button><button class="az-arrow r" data-rl="1" aria-label="Scroll right">›</button></div></div></section>` : ""}
  ${shelf("Top picks for you", "/collections/all?sort=top", best)}
  <section class="az-spot"><div class="wrap"><div class="az-panel az-spot-in">
    <div class="az-spot-copy"><span class="eyebrow">LeeysPremium spotlight${maxOff >= 10 ? ` · Up to ${maxOff}% off` : ""}</span><h2>Everything you need, in one place.</h2>
      <p>Home, tech, fashion, beauty, outdoors and more — fairly priced and shipped fast, with US warehouses for quicker delivery.</p>
      <div class="hero-ctas"><a class="btn accent" href="/collections/all" data-link>Shop all products</a><a class="btn live-btn ${CONFIG.live?.status === "live" ? "on" : ""}" href="/live" data-link><i></i>Premium Live${CONFIG.live?.status === "live" ? " · now" : ""}</a><a class="btn ghost video-btn" href="/videos" data-link>▶ Video</a></div></div>
    ${showcaseHTML()}</div></div></section>
  ${shelf("New arrivals", "/collections/all?sort=latest", fresh)}
  ${cats.length > 5 ? `<section class="az-quads"><div class="wrap az-quad-grid" style="--n:${Math.min(5, cats.length - 5)}">${cats.slice(5, 10).map(quad).join("")}</div></section>` : ""}
  ${shelf("Deals under $25", "/collections/all?sort=price-asc", under25)}
  ${shelf("Fast delivery from US warehouses", "/collections/all", usFast)}
  ${trust()}`;
  app.querySelectorAll("[data-rl]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); const r = b.parentElement.querySelector("[data-rail]"); r.scrollBy({ left: Number(b.dataset.rl) * r.clientWidth * 0.85, behavior: "smooth" }); }));
  startShowcase();
  bindVouchers();
  tileVideos();
}
// Tile videos load and play only while visible (keeps the page fast and data-light on phones).
let tileObs = null;
function tileVideos() {
  tileObs?.disconnect();
  const vids = [...app.querySelectorAll(".az-tv video")];
  if (!vids.length) return;
  if (!("IntersectionObserver" in window)) { vids.forEach((v) => { v.src = v.dataset.src; v.play().catch(() => {}); }); return; }
  tileObs = new IntersectionObserver((es) => es.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.4 });
  vids.forEach((v) => tileObs.observe(v));
}
/* ---------- Vouchers (Shopee-style) ---------- */
const wallet = () => { try { const w = JSON.parse(localStorage.getItem("lp_vouchers") || "[]"); const old = localStorage.getItem("lp_voucher"); return old && !w.includes(old) ? [...w, old] : w; } catch { return []; } };
const saveWallet = (w) => { try { localStorage.setItem("lp_vouchers", JSON.stringify([...new Set(w)].slice(-30))); } catch {} };
function vCheck(v, q) {
  // q: last quote — subtotal and shipping before vouchers. Scoped vouchers only count matching cart items.
  const scoped = v.scope === "collection" || v.scope === "products";
  const sub = scoped ? cart.lines().filter((l) => vMatches(v, l.p)).reduce((s, l) => s + l.p.price * l.qty, 0) : (q?.subtotal || 0), ship = (q?.shipping || 0);
  if (scoped && !sub) return { ok: false, reason: v.scope === "collection" ? `Only for ${vScopeText(v).replace(" only", "")} items` : "Only for selected items" };
  if (v.ends_at && new Date(v.ends_at.replace(" ", "T") + "Z") < new Date()) return { ok: false, reason: "Expired" };
  if (sub < (v.min_spend || 0)) return { ok: false, reason: `Add ${money(v.min_spend - sub)} more${scoped ? " of eligible items" : ""} to use` };
  if (v.type === "shipping") { if (!(ship > 0)) return { ok: false, reason: "Your shipping is already free" }; return { ok: true, amount: Math.min(ship, v.amount > 0 ? v.amount : ship) }; }
  if (v.type === "amount") return { ok: true, amount: Math.min(v.amount, sub) };
  let a = sub * v.percent / 100; if (v.max_off > 0) a = Math.min(a, v.max_off); return { ok: true, amount: Math.round(a * 100) / 100 };
}
function bestVouchers(q) {
  const all = [...PROMO.vouchers, ...(q.extraVouchers || [])];
  const pick = (list) => list.map((v) => [v, vCheck(v, q)]).filter(([, r]) => r.ok).sort((a, b) => b[1].amount - a[1].amount)[0]?.[0]?.code || "";
  return { code: pick(all.filter((v) => v.type !== "shipping")), shipCode: pick(all.filter((v) => v.type === "shipping")) };
}
const vLeft = (v) => v.type === "shipping" ? `<b>FREE</b><span>SHIPPING</span>` : v.type === "amount" ? `<b>${money(v.amount).replace(".00", "")}</b><span>OFF</span>` : `<b>${v.percent}%</b><span>OFF</span>`;
const vSub = (v) => [vScopeText(v), v.min_spend ? `Min. spend ${money(v.min_spend)}` : "No min. spend", v.type === "percent" && v.max_off ? `max ${money(v.max_off)} off` : v.type === "shipping" && v.amount ? `up to ${money(v.amount)}` : "",
  v.first_order ? "First order" : "", v.ends_at ? `Valid till ${new Date(v.ends_at.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""].filter(Boolean).join(" · ");
function voucherSheet(V, done) {
  const q = V.last || {};
  let sel = { code: V.code, shipCode: V.shipCode };
  const all = () => [...PROMO.vouchers, ...V.extra.filter((x) => !PROMO.vouchers.some((v) => v.code === x.code))];
  const ov = document.createElement("div"); ov.className = "vsheet-bg";
  document.body.classList.add("vsheet-open");
  ov.remove = function () { document.body.classList.remove("vsheet-open"); Element.prototype.remove.call(this); };
  const row = (v) => { const r = vCheck(v, q), key = v.type === "shipping" ? "shipCode" : "code", on = sel[key] === v.code;
    return `<button class="vrow ${v.type} ${r.ok ? "" : "off"} ${on ? "on" : ""}" data-vc="${esc(v.code)}" data-vk="${key}" ${r.ok ? "" : "disabled"}>
      <div class="vrow-left">${vLeft(v)}</div><div class="vrow-mid"><b>${esc(v.label || v.title)}</b><span>${esc(vSub(v))}</span>${r.ok ? `<small>Save ${money(r.amount)}</small>` : `<small class="why">${esc(r.reason)}</small>`}</div>
      <span class="vradio"></span></button>`; };
  const render = () => {
    const list = all(), ship = list.filter((v) => v.type === "shipping"), disc = list.filter((v) => v.type !== "shipping");
    const usable = (l) => l.filter((v) => vCheck(v, q).ok), unusable = list.filter((v) => !vCheck(v, q).ok);
    ov.innerHTML = `<div class="vsheet" role="dialog" aria-label="Select voucher"><header><button class="icon-btn" data-vclose aria-label="Close"><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg></button><h3>Select voucher</h3><span></span></header>
      <form class="vcode"><input name="c" placeholder="Enter voucher code" autocomplete="off"><button class="btn sm">Apply</button></form>
      <div class="vlist">
        ${usable(ship).length ? `<h4>Shipping vouchers</h4>${usable(ship).map(row).join("")}` : ""}
        ${usable(disc).length ? `<h4>Discount vouchers</h4>${usable(disc).map(row).join("")}` : ""}
        ${unusable.length ? `<h4>Unavailable vouchers</h4>${unusable.map(row).join("")}` : ""}
        ${!list.length ? `<p class="muted" style="text-align:center;padding:30px">No vouchers right now. Have a code? Enter it above.</p>` : ""}</div>
      <footer><div><span id="vcount"></span><b id="vsave"></b></div><button class="btn accent block" data-vok>OK</button></footer></div>`;
    const n = [sel.code, sel.shipCode].filter(Boolean).length, save = [sel.code, sel.shipCode].filter(Boolean).map((c) => all().find((v) => v.code === c)).reduce((s, v) => s + (v ? vCheck(v, q).amount || 0 : 0), 0);
    ov.querySelector("#vcount").textContent = n ? `${n} voucher${n > 1 ? "s" : ""} selected` : "No voucher selected";
    ov.querySelector("#vsave").textContent = save ? ` · You save ${money(save)}` : "";
    ov.querySelectorAll("[data-vc]").forEach((b) => (b.onclick = () => { const k = b.dataset.vk; sel[k] = sel[k] === b.dataset.vc ? "" : b.dataset.vc; render(); }));
    ov.querySelector("[data-vclose]").onclick = () => ov.remove();
    ov.querySelector("[data-vok]").onclick = () => { Object.assign(V, sel, { manual: true }); saveWallet([...wallet(), sel.code, sel.shipCode].filter(Boolean)); ov.remove(); done(); };
    ov.querySelector(".vcode").onsubmit = async (e) => {
      e.preventDefault(); const c = e.target.c.value.trim(); if (!c) return;
      try { const v = await api("/api/discount", { code: c }); if (!all().some((x) => x.code === v.code)) V.extra.push(v); sel[v.type === "shipping" ? "shipCode" : "code"] = v.code; toast(`${v.title} added`); render(); }
      catch (er) { toast(er.message); }
    };
  };
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov); render();
}

function voucherStrip(catId) {
  const list = catId ? PROMO.vouchers.filter((v) => !v.scope || v.scope === "all" || (v.scope === "collection" && v.target === catId) || (v.scope === "products" && PRODUCTS.some((p) => p.collection === catId && (v.target || []).includes(p.id)))) : PROMO.vouchers;
  if (!list.length) return "";
  const have = wallet();
  return `<section class="vouchers"><div class="wrap"><div class="v-rail">${list.map((v) => `<div class="vcard ${v.type}"><div class="v-left">${vLeft(v)}</div>
    <div class="v-mid"><b>${esc(v.label || v.title)}</b><span>${esc(vSub(v))}</span></div>
    ${have.includes(v.code) ? `<button class="btn sm ghost" disabled>Claimed ✓</button>` : `<button class="btn sm accent" data-claim="${esc(v.code)}">Claim</button>`}</div>`).join("")}</div></div></section>`;
}
// Homepage: vouchers + weekly deals together in one panel, all cards the same shape.
function homeOffers() {
  const vs = PROMO.vouchers || [], ss = PROMO.schedules || [];
  if (!vs.length && !ss.length) return "";
  const have = wallet();
  const vc = vs.map((v) => `<div class="vcard ${v.type}"><div class="v-left">${vLeft(v)}</div>
    <div class="v-mid"><b>${esc(v.label || v.title)}</b><span>${esc(vSub(v))}</span></div>
    ${have.includes(v.code) ? `<button class="btn sm ghost" disabled>Claimed ✓</button>` : `<button class="btn sm accent" data-claim="${esc(v.code)}">Claim</button>`}</div>`);
  const sc = ss.map((x) => `<a class="vcard sched" href="${x.scope === "collection" ? "/collections/" + x.target : "/collections/all"}" data-link><div class="v-left"><b>${x.percent}%</b><span>OFF</span></div>
    <div class="v-mid"><b>${esc(x.label)}</b><span>${x.scope === "collection" ? esc(COLLECTIONS.find((c) => c.id === x.target)?.name || "") + " · " : ""}${esc(x.text)}</span></div><span class="btn sm ghost">Shop ›</span></a>`);
  return `<section class="az-shelf"><div class="wrap"><div class="az-panel"><div class="az-shelf-head"><h2>🎟 Vouchers & weekly deals</h2><a href="/collections/all?sort=deals" data-link>See deals ›</a></div>
    <div class="az-offers">${[...vc, ...sc].join("")}</div></div></div></section>`;
}
function bindVouchers() {
  document.querySelectorAll("[data-claim]").forEach((b) => (b.onclick = () => {
    saveWallet([...wallet(), b.dataset.claim]);
    navigator.clipboard?.writeText(b.dataset.claim).catch(() => {});
    b.textContent = "Claimed ✓"; b.disabled = true; toast(`Voucher ${b.dataset.claim} saved — it's applied automatically at checkout`);
  }));
}

function collection(id, params) {
  const c = COLLECTIONS.find((x) => x.id === id);
  const q = (params.get("q") || "").toLowerCase();
  let list = id === "all" ? [...PRODUCTS] : PRODUCTS.filter((p) => p.collection === id);
  if (q) list = PRODUCTS.filter((p) => (p.title + " " + p.description).toLowerCase().includes(q));
  const title = q ? `Search: “${params.get("q")}”` : c ? c.name : "All products";
  document.title = title + " — LeeysPremium";
  const sortParam = params.get("sort");
  const state = { sort: ["popular", "latest", "top", "price-asc", "price-desc", "deals"].includes(sortParam) ? sortParam : sortParam === "best" ? "top" : "popular",
    stock: params.get("stock") === "1", max: Number(params.get("max")) || 0, us: params.get("us") === "1" };
  const catPromo = c ? PROMO.promos.find((x) => (x.scope === "collection" && x.target === c.id) || x.scope === "all") : PROMO.promos.find((x) => x.scope === "all");
  const cover = c ? coverProduct(c) : null;
  const apply = () => {
    let l = list.filter((p) => (!state.stock || p.stock > 0) && (!state.max || p.price <= state.max) && (!state.us || p.ships === "us") && (state.sort !== "deals" || offPct(p) > 0));
    const s = { latest: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")), top: (a, b) => (b.sold || 0) - (a.sold || 0),
      "price-asc": (a, b) => a.price - b.price, "price-desc": (a, b) => b.price - a.price, deals: (a, b) => offPct(b) - offPct(a) }[state.sort];
    if (s) l.sort(s);
    $("#results").innerHTML = l.length ? l.map(card).join("") : `<div class="empty" style="grid-column:1/-1">No products match these filters.</div>`;
    $("#count").textContent = l.length + " product" + (l.length === 1 ? "" : "s");
    document.querySelectorAll("[data-sort]").forEach((t) => t.classList.toggle("on", t.dataset.sort === state.sort || (t.dataset.sort === "price" && state.sort.startsWith("price"))));
    const pt = $("[data-sort=price] i"); if (pt) pt.textContent = state.sort === "price-asc" ? "↑" : state.sort === "price-desc" ? "↓" : "↕";
  };
  app.innerHTML = `<div class="wrap">
    ${!q ? `<div class="cat-banner">${cover ? `<div class="cat-thumb">${art(cover)}</div>` : ""}<div class="cat-info"><div class="crumbs"><a href="/" data-link>Home</a> / <a href="/categories" data-link>Categories</a> / ${esc(title)}</div>
      <h1>${esc(title)}</h1><p class="muted">${c ? esc(c.blurb || "") + " · " : ""}${list.length} products · 🚚 delivery from ${etaShort({ ships: "us" })}</p>
      ${catPromo ? `<div class="promo-line big">⚡ ${esc(catPromo.label)} — ${catPromo.percent}% off · ends in <b data-ends="${catPromo.endsAt}">${timeLeft(catPromo.endsAt)}</b></div>`
        : (() => { const s = c ? schedForCat(c.id) : null; return s ? `<div class="sched-line big">📅 ${esc(s.label)}: ${s.percent}% off — ${esc(s.text)}</div>` : ""; })()}</div></div>`
    : `<div class="page-head"><div class="crumbs"><a href="/" data-link>Home</a> / Search</div><h1>${esc(title)}</h1></div>`}
    ${q ? "" : `<div class="chips"><a class="chip ${id === "all" ? "on" : ""}" href="/collections/all" data-link>All</a>${COLLECTIONS.map((x) => `<a class="chip ${x.id === id ? "on" : ""}" href="/collections/${x.id}" data-link>${esc(x.name)}</a>`).join("")}</div>`}
    ${voucherStrip(q ? null : id === "all" ? null : id)}
    <div class="sort-tabs">${[["popular", "Popular"], ["latest", "Latest"], ["top", "Top sales"], ["deals", "Deals"]].map(([v, t]) => `<button data-sort="${v}">${t}</button>`).join("")}<button data-sort="price">Price <i>↕</i></button></div>
    <div class="toolbar"><div class="filters">
      <label><input type="checkbox" id="fStock" ${state.stock ? "checked" : ""}> In stock</label>
      <label><input type="checkbox" id="fUs" ${state.us ? "checked" : ""}> Ships from US</label>
      <select class="select" id="fMax"><option value="0">Any price</option>${[10, 20, 30, 50, 100].map((v) => `<option value="${v}" ${state.max === v ? "selected" : ""}>Under $${v}</option>`).join("")}</select></div>
      <span class="muted" id="count"></span></div>
    <div class="grid" id="results"></div><div style="height:56px"></div></div>`;
  document.querySelectorAll("[data-sort]").forEach((t) => (t.onclick = () => {
    state.sort = t.dataset.sort === "price" ? (state.sort === "price-asc" ? "price-desc" : "price-asc") : t.dataset.sort; apply();
  }));
  $("#fStock").onchange = (e) => { state.stock = e.target.checked; apply(); };
  $("#fUs").onchange = (e) => { state.us = e.target.checked; apply(); };
  $("#fMax").onchange = (e) => { state.max = Number(e.target.value); apply(); };
  bindVouchers();
  apply();
}

/* ---------- Premium Video: swipeable feed of product videos ---------- */
let VFEED = { obs: null, muted: true };
function videosPage() {
  document.title = "Premium Video — LeeysPremium";
  const list = PRODUCTS.filter((p) => p.video).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (!list.length) { app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><h1>▶ Premium Video</h1><p>Product videos are coming soon. Meanwhile, catch us on <a href="/live" data-link style="color:var(--blue-2)">Premium Live</a>.</p></div>`; return; }
  app.innerHTML = `<div class="wrap vpage"><div class="vhead"><h1>▶ Premium Video</h1><p class="muted">Watch before you buy · ${list.length} product video${list.length === 1 ? "" : "s"} · swipe or scroll</p></div>
    <div class="vfeed" id="vfeed">${list.map((p, i) => `<section class="vslide" data-vi="${i}">
      <video src="${esc(p.video)}" muted playsinline loop preload="${i < 2 ? "auto" : "metadata"}" ${p.images?.[0] ? `poster="${esc(p.images[0])}"` : ""}></video>
      <button class="vmute" aria-label="Sound on/off">🔇</button>
      <div class="vover">${p.promo ? `<span class="badge flash" style="position:static;display:inline-block;margin-bottom:8px">⚡ ${esc(p.promo.label)} · ${p.promo.percent}% off</span>` : ""}
        <a class="vtitle" href="/products/${p.id}" data-link>${esc(p.title)}</a>
        <div class="price ${offPct(p) ? "sale" : ""}"><b>${money(p.price)}</b>${p.compareAt ? `<s>${money(p.compareAt)}</s>` : ""}<span class="muted" style="font-size:13px;margin-left:8px">🚚 ${etaShort(p)}</span></div>
        <div class="vbtns"><button class="btn accent" data-add="${p.id}" ${p.stock > 0 ? "" : "disabled"}>${p.stock > 0 ? "Add to cart" : "Sold out"}</button><a class="btn ghost" href="/products/${p.id}" data-link>View product</a></div></div></section>`).join("")}</div></div>`;
  const vids = [...document.querySelectorAll(".vslide video")];
  VFEED.obs?.disconnect();
  VFEED.obs = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target.querySelector("video");
    if (e.isIntersecting && e.intersectionRatio > 0.6) { v.muted = VFEED.muted; v.play().catch(() => {}); } else v.pause();
  }), { threshold: [0, 0.6, 1] });
  document.querySelectorAll(".vslide").forEach((s) => VFEED.obs.observe(s));
  document.querySelectorAll(".vmute").forEach((b) => (b.onclick = () => { VFEED.muted = !VFEED.muted; vids.forEach((v) => (v.muted = VFEED.muted)); document.querySelectorAll(".vmute").forEach((x) => (x.textContent = VFEED.muted ? "🔇" : "🔊")); }));
  document.querySelectorAll(".vslide video").forEach((v) => (v.onclick = () => (v.paused ? v.play() : v.pause())));
}

/* ---------- Premium Live: stream + pinned products + live comments ---------- */
let LIVE = { timer: null, lastId: 0, status: null };
async function livePage() {
  document.title = "Premium Live — LeeysPremium";
  clearInterval(LIVE.timer);
  app.innerHTML = `<div class="wrap prose"><p class="muted">Loading Premium Live…</p></div>`;
  let d; try { d = await api("/api/live"); } catch { app.innerHTML = `<div class="wrap prose"><h1>Premium Live</h1><p>Couldn't load the live page. Please refresh.</p></div>`; return; }
  if (location.pathname !== "/live") return;
  LIVE.status = d.status; LIVE.lastId = d.comments.length ? d.comments[d.comments.length - 1].id : 0;
  const pinned = d.pinned.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
  const badge = { live: `<span class="live-badge">● LIVE</span>`, replay: `<span class="live-badge replay">▶ REPLAY</span>`, scheduled: `<span class="live-badge sched">📅 UPCOMING</span>`, off: "" }[d.status];
  const player = d.status === "live" || d.status === "replay"
    ? (d.status === "replay" && d.video ? `<video src="${esc(d.video)}" controls autoplay muted playsinline></video>` : d.embed ? `<iframe src="${esc(d.embed.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Live stream"></iframe>` : "")
    : `<div class="live-idle">${d.status === "scheduled" ? `<div><div class="muted">Next live starts in</div><div class="live-count" data-ends="${esc(d.startsAt)}">${timeLeft(d.startsAt)}</div>
        <div class="muted">${new Date(d.startsAt).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>`
      : `<div><div style="font-size:42px">📺</div><b>We're not live right now</b><p class="muted">Follow along next time — meanwhile, watch our <a href="/videos" data-link style="color:var(--blue-2)">product videos</a>.</p></div>`}</div>`;
  const name = (() => { try { return localStorage.getItem("lp_name") || ""; } catch { return ""; } })();
  app.innerHTML = `<div class="wrap live-page">
    <div class="live-main"><div class="live-player">${player}${badge}</div>
      <div class="live-title"><h1>${esc(d.title || "Premium Live")}</h1>${d.note ? `<p class="muted">${esc(d.note)}</p>` : ""}</div>
      ${pinned.length ? `<div class="live-pins"><h3>🛍 Featured in this live</h3><div class="rail">${pinned.map(card).join("")}</div></div>` : ""}</div>
    <aside class="live-chat"><div class="lc-head"><b>Live chat</b><span class="muted" id="lcCount"></span></div>
      <div class="lc-log" id="lcLog"></div>
      <form class="lc-form" id="lcForm">${name ? "" : `<input name="name" placeholder="Your name" maxlength="40" required>`}<div class="flex" style="gap:8px"><input name="body" placeholder="Say something or ask a question…" maxlength="300" required autocomplete="off"><button class="btn accent">Send</button></div></form></aside></div>`;
  const log = $("#lcLog");
  const add = (cs) => { log.insertAdjacentHTML("beforeend", cs.map((c) => `<div class="lc-msg ${c.is_host ? "host" : ""}" data-cid="${c.id}"><b>${esc(c.name)}${c.is_host ? " ✓" : ""}</b> ${esc(c.body)}</div>`).join("")); log.scrollTop = log.scrollHeight; };
  add(d.comments);
  $("#lcForm").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, nm = f.name?.value?.trim() || name;
    try { await api("/api/live/comment", { name: nm, body: f.body.value }); try { localStorage.setItem("lp_name", nm); } catch {} if (f.name) f.name.remove(); f.body.value = ""; poll(); }
    catch (er) { toast(er.message); }
  };
  const poll = async () => {
    if (location.pathname !== "/live") return clearInterval(LIVE.timer);
    if (document.visibilityState !== "visible") return;
    try {
      const r = await api(`/api/live/comments?after=${LIVE.lastId}`);
      if (r.comments.length) { add(r.comments); LIVE.lastId = r.comments[r.comments.length - 1].id; }
      r.hidden.forEach((id) => log.querySelector(`[data-cid="${id}"]`)?.remove());
      if (r.status !== LIVE.status || JSON.stringify(r.pinned) !== JSON.stringify(d.pinned)) livePage();
    } catch {}
  };
  LIVE.timer = setInterval(poll, 4000);
}

function categoriesPage() {
  document.title = "Categories — LeeysPremium";
  const count = (id) => PRODUCTS.filter((p) => p.collection === id).length;
  app.innerHTML = `<div class="wrap prose" style="max-width:820px"><div class="crumbs"><a href="/" data-link>Home</a> / Categories</div><h1>Categories</h1>
    <div class="cat-list">${COLLECTIONS.filter((c) => count(c.id)).map((c) => `<a class="cat-row" href="/collections/${c.id}" data-link><div class="cat-ico">${collArt(c)}</div>
      <div><b>${esc(c.name)}</b> <span class="muted">(${count(c.id)})</span><small>${esc(c.blurb || "")}</small></div><span class="chev">›</span></a>`).join("")}
      <a class="cat-row" href="/collections/all" data-link><div class="cat-ico all">LP</div><div><b>All products</b> <span class="muted">(${PRODUCTS.length})</span><small>Everything in the store</small></div><span class="chev">›</span></a></div></div>`;
}

function deliveryText(p, country) {
  const add = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  if (country === "US") return p.ships === "us" ? `Arrives ${add(3)} – ${add(7)}` : `Arrives ${add(8)} – ${add(15)}`;
  if (["CA", "GB", "AU"].includes(country)) return `Arrives ${add(7)} – ${add(14)}`;
  return `Arrives ${add(10)} – ${add(20)}`;
}

function product(id) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return notFound();
  document.title = p.title + " — LeeysPremium";
  const sel = Object.fromEntries(p.variants.map((v) => [v.name, v.options[0]]));
  let img = 0, qty = 1, country = "US";
  const off = offPct(p);
  country = shopCountry();
  // Most similar first: shared words in the name, same category, then best sellers
  const STOP = new Set(["for", "and", "with", "the", "new", "men", "women", "mens", "womens", "a", "of", "in", "to", "set", "pcs", "style"]);
  const words = (t) => new Set(String(t).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)));
  const mine = words(p.title);
  const related = PRODUCTS.filter((x) => x.id !== p.id && x.stock > 0)
    .map((x) => { let s = 0; for (const w of words(x.title)) if (mine.has(w)) s += 3; if (x.collection === p.collection) s += 4; return [x, s + Math.min(2, (x.sold || 0) / 50)]; })
    .sort((a, b) => b[1] - a[1]).map(([x]) => x).slice(0, 48);
  let shown = 12;
  const coll = COLLECTIONS.find((c) => c.id === p.collection) || { id: "all", name: "All products" };
  const stockTxt = p.stock === 0 ? `<div class="stock none">Sold out</div>` : p.stock < 60 ? `<div class="stock low">Only ${p.stock} left — order soon</div>` : `<div class="stock">In stock, ready to ship</div>`;
  app.innerHTML = `<div class="wrap"><div class="pdp">
    <div class="gallery"><div class="main" id="mainImg">${p.video ? videoTag(p, true) : art(p, 0)}</div><div class="thumbs">${p.video ? `<button data-video class="on vthumb" aria-label="Play video">${art(p, 0)}<span>▶</span></button>` : ""}${[...Array(Math.min(4, p.images?.length || 4)).keys()].map((i) => `<button data-img="${i}" class="${i === 0 && !p.video ? "on" : ""}" aria-label="Image ${i + 1}">${art(p, i)}</button>`).join("")}</div></div>
    <div><button class="back-link" id="pdpBack">← Back</button><div class="crumbs"><a href="/" data-link>Home</a> / <a href="/collections/${coll.id}" data-link>${esc(coll.name)}</a></div>
      <h1>${esc(p.title)}</h1>${p.sold ? `<div class="muted" style="font-size:14px">${p.sold.toLocaleString()} sold</div>` : ""}
      ${p.promo ? `<div class="flash-bar"><span>⚡ ${esc(p.promo.label)}</span><span>Ends in <b data-ends="${p.promo.endsAt}">${timeLeft(p.promo.endsAt)}</b></span></div>`
        : (() => { const s = schedFor(p); return s ? `<div class="sched-line big" style="margin-top:12px">📅 ${esc(s.label)}: ${s.percent}% off this item — ${esc(s.text)}</div>` : ""; })()}
      <div class="price ${off ? "sale" : ""}" style="margin:14px 0"><b>${money(p.price)}</b>${p.compareAt && p.compareAt > p.price ? `<s>${money(p.compareAt)}</s><span class="save">Save ${off}%</span>` : ""}</div>
      ${vouchersFor(p).length ? `<div class="pdp-vouchers">${vouchersFor(p).map((v) => `<button class="vchip ${v.type}" data-claim="${esc(v.code)}">${v.type === "shipping" ? "🚚" : "🎟"} ${esc(v.label || v.title)}${v.min_spend ? ` · min ${money(v.min_spend)}` : ""}</button>`).join("")}</div>` : ""}
      ${(() => { const g = giftFor(p); return g ? `<div class="gift-box">${g.gift.image ? `<img src="${esc(g.gift.image)}" alt="">` : `<div class="gift-ico">🎁</div>`}<div><b>🎁 FREE GIFT with this item</b>
        <span>${esc(g.gift.title)}${g.gift.variant ? " (" + esc(g.gift.variant) + ")" : ""}${g.gift.value ? ` — worth ${money(g.gift.value)}` : ""}</span><small>Added to your order automatically${g.perItem ? " — one per item you buy" : ""}.</small></div></div>` : ""; })()}
      ${p.price >= FREE_SHIP ? `<div class="perk">✓ Free US shipping on this item</div>` : `<div class="perk">Free US shipping on orders over ${money(FREE_SHIP)}</div>`}
      ${stockTxt}
      ${p.variants.map((v) => `<div class="opt"><div class="opt-label">${esc(v.name)}: <span data-sel="${esc(v.name)}">${esc(sel[v.name])}</span></div><div class="opt-values">${v.options.map((o) => { const im = optionImg(p, o);
        return `<button data-opt="${esc(v.name)}" data-val="${esc(o)}" class="${o === sel[v.name] ? "on" : ""} ${im ? "swatch" : ""}">${im ? `<img src="${esc(im)}" alt="" loading="lazy">` : ""}<span>${esc(o)}</span></button>`; }).join("")}</div></div>`).join("")}
      <div class="opt"><div class="opt-label">Quantity</div><div class="qty"><button id="qMinus">−</button><input id="qVal" value="1" readonly><button id="qPlus">+</button></div></div>
      <div class="buy-row"><button class="btn ghost" id="addBtn" ${p.stock === 0 ? "disabled" : ""}>Add to cart</button><button class="btn accent" id="buyBtn" ${p.stock === 0 ? "disabled" : ""}>Buy it now</button></div>
      <div class="ship-box">
        <div>🚚 <span>Ship to</span><select class="select" id="country">${[["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"], ["PH", "Philippines"], ["OT", "Other countries"]].map(([v, t]) => `<option value="${v}" ${v === (["US", "CA", "GB", "AU", "PH"].includes(country) ? country : "OT") ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div>📦 <b id="eta">${deliveryText(p, country)}</b></div>
        <div>↩️ <span>30-day returns · Secure checkout with PayPal & cards</span></div></div>
      <details class="acc" open><summary>Description</summary><p>${esc(p.description)}</p></details>
      <details class="acc"><summary>Shipping</summary><p>US orders ship from our US warehouses where available (3–7 business days). International orders ship worldwide in 7–20 business days with tracking. Free US shipping over $${FREE_SHIP}.</p></details>
      <details class="acc"><summary>Returns</summary><p>Not happy? Return it within 30 days of delivery for a full refund. Damaged or faulty items are replaced free.</p></details>
    </div></div>
    <section class="section" style="padding-top:0"><div class="section-head"><h2>You may also like</h2></div><div class="grid" id="related">${related.slice(0, shown).map(card).join("")}</div>
      ${related.length > shown ? `<div style="text-align:center;margin-top:26px"><button class="btn ghost" id="moreRelated">Show more</button></div>` : ""}</section></div>`;
  const variantStr = () => Object.values(sel).join(" / ");
  $("#pdpBack").onclick = goBack;
  const more = $("#moreRelated");
  if (more) more.onclick = () => { $("#related").insertAdjacentHTML("beforeend", related.slice(shown, shown + 12).map(card).join("")); shown += 12; if (shown >= related.length) more.remove(); };
  app.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => {
    sel[b.dataset.opt] = b.dataset.val;
    app.querySelectorAll(`[data-opt="${CSS.escape(b.dataset.opt)}"]`).forEach((x) => x.classList.toggle("on", x === b));
    app.querySelector(`[data-sel="${CSS.escape(b.dataset.opt)}"]`).textContent = b.dataset.val;
    const im = variantImg(p, Object.values(sel).join(" / ")) || optionImg(p, b.dataset.val);
    if (im) {
      $("#mainImg").innerHTML = photoTag(im, p.title + " — " + b.dataset.val);
      app.querySelectorAll("[data-img], [data-video]").forEach((x) => x.classList.remove("on"));
    }
  }));
  app.querySelectorAll("[data-img]").forEach((b) => (b.onclick = () => {
    img = Number(b.dataset.img); $("#mainImg").innerHTML = art(p, img);
    app.querySelectorAll("[data-img], [data-video]").forEach((x) => x.classList.toggle("on", x === b));
  }));
  const vb = app.querySelector("[data-video]");
  if (vb) vb.onclick = () => { $("#mainImg").innerHTML = videoTag(p, true); app.querySelectorAll("[data-img], [data-video]").forEach((x) => x.classList.toggle("on", x === vb)); };
  $("#qMinus").onclick = () => { qty = Math.max(1, qty - 1); $("#qVal").value = qty; };
  $("#qPlus").onclick = () => { qty = Math.min(10, qty + 1); $("#qVal").value = qty; };
  $("#country").onchange = (e) => { country = e.target.value; setShopCountry(country); $("#eta").textContent = deliveryText(p, country); };
  bindVouchers();
  $("#addBtn").onclick = () => { cart.add(p.id, variantStr(), qty); openDrawer(); };
  // Buy it now = check out only this item (like Amazon); the cart is left as it is.
  $("#buyBtn").onclick = () => { const v = variantStr(); try { sessionStorage.setItem("lp_buynow", JSON.stringify([{ key: p.id + "|" + (v || ""), id: p.id, variant: v, qty }])); } catch { cart.add(p.id, v, qty); return go("/checkout"); } go("/checkout?buy=1"); };
}

function cartPage() {
  document.title = "Cart — LeeysPremium";
  const lines = cart.lines(), sub = cart.subtotal();
  app.innerHTML = `<div class="wrap prose" style="max-width:900px"><h1>Your cart</h1>${lines.length ? `
    ${shipProgress(sub)}${lines.map((l) => `<div class="line"><a class="thumb" href="/products/${l.id}" data-link>${variantImg(l.p, l.variant) ? photoTag(variantImg(l.p, l.variant), l.p.title) : art(l.p)}</a><div><div class="t">${esc(l.p.title)}</div>${l.variant ? `<div class="v">${esc(l.variant)}</div>` : ""}<div style="margin-top:8px">${qtyCtl(l.key, l.qty)}</div><button class="rm" data-rm="${l.key}">Remove</button></div><b>${money(l.p.price * l.qty)}</b></div>`).join("")}
    ${giftRows(cartGifts(lines))}    <div class="row-between" style="margin:24px 0 8px;font-size:18px"><span>Subtotal</span><b>${money(sub)}</b></div><p class="muted">Taxes and shipping calculated at checkout.</p>
    <a class="btn accent" href="/checkout" data-link>Checkout</a>`
  : `<div class="empty"><p>Your cart is empty.</p><a class="btn" href="/collections/all" data-link>Start shopping</a></div>`}</div>`;
}

const COUNTRY_OPTS = () => Object.entries(CONFIG.countries).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
let paypalLoad = null;
function loadPaypal() {
  if (!CONFIG.paypalClientId) return Promise.reject(new Error("no client id"));
  return (paypalLoad ||= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CONFIG.paypalClientId)}&currency=USD&intent=capture&components=buttons&enable-funding=card`;
    s.onload = ok; s.onerror = () => { paypalLoad = null; fail(new Error("PayPal failed to load")); }; document.head.appendChild(s);
  }));
}
async function api(path, data) {
  const r = await fetch(path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong");
  return j;
}

function checkout() {
  document.title = "Checkout — LeeysPremium";
  let buy = null;
  if (new URLSearchParams(location.search).get("buy")) try { buy = JSON.parse(sessionStorage.getItem("lp_buynow") || "null"); } catch {}
  const bag = buy && buy.length ? {
    items: buy, save() { try { sessionStorage.setItem("lp_buynow", JSON.stringify(this.items)); } catch {} },
    lines() { return this.items.map((l) => ({ ...l, p: PRODUCTS.find((p) => p.id === l.id) })).filter((l) => l.p); },
    set(key, qty) { const l = this.items.find((x) => x.key === key); if (!l) return; l.qty = Math.max(0, qty); this.items = this.items.filter((x) => x.qty > 0); this.save(); },
  } : cart;
  const lines = bag.lines();
  if (!lines.length) return go("/cart", true);
  const V = { code: "", shipCode: "", manual: false, last: null, extra: [] };
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("lp_addr") || "{}") || {}; } catch {}
  const val = (k) => esc(saved[k] || "");
  app.innerHTML = `<div class="wrap"><div class="co-top"><h1>Checkout <span class="muted" id="coCount"></span></h1><span class="co-secure">🔒 Secure checkout</span></div><div class="checkout amz">
    <form class="co-form" id="coForm" novalidate>
      <section class="co-step"><div class="co-head"><span class="co-n">1</span><h2>Delivery address</h2><button type="button" class="co-change" id="ch1" hidden>Change</button></div>
        <div class="co-sum" id="addrSum" hidden></div>
        <div class="co-body" id="addrForm">
          <div class="field"><input name="email" type="email" required placeholder="Email (for your receipt and tracking)" autocomplete="email" value="${val("email")}"></div>
          <div class="field"><select name="country" id="coCountry" autocomplete="country">${COUNTRY_OPTS()}</select></div>
          <div class="two"><div class="field"><input name="firstName" required placeholder="First name" autocomplete="given-name" value="${val("firstName")}"></div><div class="field"><input name="lastName" required placeholder="Last name" autocomplete="family-name" value="${val("lastName")}"></div></div>
          <div class="field"><input name="address1" required placeholder="Street address" autocomplete="address-line1" value="${val("address1")}"></div><div class="field"><input name="address2" placeholder="Apartment, suite, unit, building (optional)" autocomplete="address-line2" value="${val("address2")}"></div>
          <div class="two"><div class="field"><input name="city" required placeholder="City" autocomplete="address-level2" value="${val("city")}"></div><div class="field"><input name="province" placeholder="State / Province" autocomplete="address-level1" value="${val("province")}"></div></div>
          <div class="two"><div class="field"><input name="zip" required placeholder="ZIP / Postal code" autocomplete="postal-code" value="${val("zip")}"></div><div class="field"><input name="phone" placeholder="Phone (for delivery updates)" autocomplete="tel" value="${val("phone")}"></div></div>
          <label class="muted" style="font-size:14px;display:block;margin:2px 0 14px"><input type="checkbox" name="marketing" checked> Email me with news and offers</label>
          <button type="button" class="btn accent" id="useAddr">Use this address</button>
        </div></section>
      <section class="co-step"><div class="co-head"><span class="co-n">2</span><h2>Payment method</h2></div>
        <div class="co-body"><div class="pm-row"><span class="pm-ico">💳</span><div><b>PayPal, debit or credit card</b><span class="muted">Pay with the button in your order summary. Card details are handled by PayPal and never stored by us.</span></div></div>
          <button type="button" class="vpick" id="vpick"><span>🎟 <b>Vouchers & promotional codes</b></span><span id="vpickSel" class="muted">Select or enter code ›</span></button></div></section>
      <section class="co-step"><div class="co-head"><span class="co-n">3</span><h2>Review items and delivery</h2></div><div class="co-body" id="coItems"></div></section>
      <div id="coError" class="note err" hidden></div>
    </form>
    <aside class="co-summary"><div id="paypal-buttons" style="min-height:50px"></div>
      <p class="co-fine">By placing your order, you agree to LeeysPremium's <a href="/pages/privacy" data-link>privacy notice</a> and <a href="/pages/terms" data-link>terms of service</a>.</p>
      <h3>Order Summary</h3><div class="totals" id="totals"></div>
      <p class="co-fine">🔁 30-day easy returns · 📦 Tracking on every order</p></aside></div></div>`;
  if (saved.country) $("#coCountry").value = saved.country;
  const renderItems = () => {
    const ls = bag.lines(), n = ls.reduce((t, l) => t + l.qty, 0), c = $("#coCountry").value;
    if (!ls.length) return go("/cart", true);
    $("#coCount").textContent = `(${n} item${n === 1 ? "" : "s"})`;
    $("#coItems").innerHTML = ls.map((l) => `<div class="co-item"><div class="co-arrive">${esc(deliveryText(l.p, c))}</div>
      <div class="co-irow"><div class="thumb"><div>${variantImg(l.p, l.variant) ? photoTag(variantImg(l.p, l.variant), l.p.title) : art(l.p)}</div></div>
        <div class="co-iinfo"><a class="t" href="/products/${l.p.id}" data-link>${esc(l.p.title)}</a>${l.variant ? `<div class="v">${esc(l.variant)}</div>` : ""}<b class="co-price">${money(l.p.price)}</b>
          <div class="co-qty"><button type="button" data-cq="${esc(l.key)}" data-d="-1" aria-label="Decrease">${l.qty === 1 ? "🗑" : "−"}</button><span>${l.qty}</span><button type="button" data-cq="${esc(l.key)}" data-d="1" aria-label="Increase">+</button></div>
          <div class="muted" style="font-size:13px">${l.p.ships === "us" && c === "US" ? "Ships from a US warehouse" : "Standard shipping with tracking"}</div></div></div></div>`).join("");
  };
  renderItems();
  const form = $("#coForm"), err = (m) => { const e = $("#coError"); e.textContent = m || ""; e.hidden = !m; };
  const items = () => bag.items.map((l) => ({ id: l.id, variant: l.variant, qty: l.qty }));
  const quote = async () => {
    try {
      const q = await api("/api/quote", { items: items(), code: V.code, shipCode: V.shipCode, country: form.country.value, email: form.email.value });
      V.last = q;
      if (!V.manual && !V.autoDone) { V.autoDone = true; const best = bestVouchers(q); if (best.code !== V.code || best.shipCode !== V.shipCode) { Object.assign(V, best); return quote(); } }
      $("#vpickSel").innerHTML = [q.shipCode && `<span class="vtag ship">${esc(q.shipCode)}</span>`, q.code && `<span class="vtag">${esc(q.code)}</span>`].filter(Boolean).join(" ") || "Select or enter code ›";
      const n = bag.items.reduce((t, l) => t + l.qty, 0);
      $("#totals").innerHTML = `<div class="row-between"><span>Items (${n}):</span><span>${money(q.subtotal)}</span></div>
        ${q.discount ? `<div class="row-between"><span>Voucher (${esc(q.code)})</span><span>−${money(q.discount)}</span></div>` : ""}
        ${q.codeNote ? `<div class="muted" style="font-size:13px">🎟 ${esc(q.codeNote)}</div>` : ""}
        ${(q.gifts || []).map((g) => `<div class="row-between"><span>🎁 ${esc(g.title)}${g.qty > 1 ? " × " + g.qty : ""}</span><span class="free">FREE</span></div>`).join("")}
        <div class="row-between"><span>Shipping & handling:</span><span>${q.shipping ? money(q.shipping) : "FREE"}</span></div>
        ${q.shipDiscount ? `<div class="row-between"><span>Shipping voucher (${esc(q.shipCode)})</span><span>−${money(q.shipDiscount)}</span></div>` : ""}
        <div class="row-between grand"><span>Order total:</span><span>${money(q.total)}</span></div>
        ${q.discount + (q.shipDiscount || 0) > 0 ? `<div class="co-save">You save ${money(q.discount + (q.shipDiscount || 0))} on this order</div>` : ""}`;
      err("");
    } catch (e) { err(e.message); }
  };
  quote();
  const addr = () => { const f = form; return { email: f.email.value.trim(), country: f.country.value, firstName: f.firstName.value.trim(), lastName: f.lastName.value.trim(), address1: f.address1.value.trim(), address2: f.address2.value.trim(), city: f.city.value.trim(), province: f.province.value.trim(), zip: f.zip.value.trim(), phone: f.phone.value.trim() }; };
  const showAddr = (open) => {
    $("#addrForm").hidden = !open; $("#addrSum").hidden = open; $("#ch1").hidden = open;
    if (!open) { const a = addr(), cn = $("#coCountry").selectedOptions[0]?.textContent || a.country;
      $("#addrSum").innerHTML = `<b>${esc(a.firstName + " " + a.lastName)}</b><br>${esc(a.address1)}${a.address2 ? ", " + esc(a.address2) : ""}<br>${esc([a.city, a.province, a.zip].filter(Boolean).join(", "))}<br>${esc(cn)}${a.phone ? "<br>Phone: " + esc(a.phone) : ""}<div class="muted" style="margin-top:4px">${esc(a.email)}</div>`; }
  };
  $("#useAddr").onclick = () => { if (!valid()) return; try { localStorage.setItem("lp_addr", JSON.stringify(addr())); } catch {} showAddr(false); };
  $("#ch1").onclick = () => showAddr(true);
  if (saved.address1 && saved.email) showAddr(false);
  $("#coItems").onclick = (e) => { const b = e.target.closest("[data-cq]"); if (!b) return; const l = bag.items.find((x) => x.key === b.dataset.cq); if (!l) return; bag.set(l.key, l.qty + Number(b.dataset.d)); renderItems(); quote(); };
  form.country.onchange = () => { renderItems(); quote(); };
  form.email.addEventListener("change", quote);
  $("#vpick").onclick = () => voucherSheet(V, () => quote());
  const valid = () => {
    for (const el of form.querySelectorAll("[required]")) if (!el.value.trim()) { showAddr(true); el.focus(); err("Please fill in " + el.placeholder.toLowerCase().replace(/ \(.*\)/, "") + "."); return false; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.value.trim())) { showAddr(true); form.email.focus(); err("Please enter a valid email."); return false; }
    err(""); return true;
  };
  form.onsubmit = (e) => e.preventDefault();
  let localId = null;
  loadPaypal().then(() => {
    window.paypal.Buttons({
      style: { layout: "vertical", shape: "pill", label: "pay", height: 48 },
      onClick: (_, actions) => (valid() ? actions.resolve() : actions.reject()),
      createOrder: async () => {
        const f = form, r = await api("/api/checkout", {
          items: items(), code: V.code, shipCode: V.shipCode, country: f.country.value, email: f.email.value, marketing: f.marketing.checked,
          address: { firstName: f.firstName.value, lastName: f.lastName.value, address1: f.address1.value, address2: f.address2.value, city: f.city.value, province: f.province.value, zip: f.zip.value, phone: f.phone.value },
        }).catch((e) => { err(e.message); throw e; });
        localId = r.orderId; return r.paypalOrderId;
      },
      onApprove: async () => {
        try { const r = await api("/api/checkout/capture", { orderId: localId }); if (bag === cart) { cart.items = []; cart.save(); } else { try { sessionStorage.removeItem("lp_buynow"); } catch {} } go("/thank-you?order=" + encodeURIComponent(r.orderId)); }
        catch (e) { err(e.message + ". You have not been charged — please try again."); }
      },
      onError: () => err("Payment couldn't be completed. Please try again or use another method."),
    }).render("#paypal-buttons");
  }).catch(() => { $("#paypal-buttons").innerHTML = `<div class="note">Payments are being set up — checkout opens very soon.</div>`; });
}

function thankYou(params) {
  const n = esc(params.get("order") || "");
  app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><div style="font-size:48px">✅</div><h1>Thank you for your order!</h1><p>Order <b>#${n}</b> is confirmed. Save this number — you can use it on the <a href="/track" data-link style="text-decoration:underline">tracking page</a> with your email. Tracking appears once your order ships (usually within 1–3 business days).</p><a class="btn" href="/collections/all" data-link>Continue shopping</a></div>`;
}

const STATUS_TEXT = { paid: "Payment received", processing: "Preparing your order", action_needed: "Preparing your order", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
function track(params) {
  document.title = "Track your order — LeeysPremium";
  app.innerHTML = `<div class="wrap prose"><h1>Track your order</h1><p>Enter the order number from your confirmation and the email you used at checkout.</p>
    <form class="card-box" id="tForm"><div class="field"><input name="id" required placeholder="Order number, e.g. LP7K2QX9A1B" value="${esc(params.get("order") || "")}"></div><div class="field"><input name="email" type="email" required placeholder="Email used at checkout"></div><button class="btn block">Track</button></form><div id="tOut"></div></div>`;
  $("#tForm").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, out = $("#tOut");
    try {
      const o = await api(`/api/orders/lookup?id=${encodeURIComponent(f.id.value)}&email=${encodeURIComponent(f.email.value)}`);
      const steps = ["paid", "processing", "shipped", "delivered"], cur = Math.max(0, steps.indexOf(o.status === "action_needed" ? "processing" : o.status));
      out.innerHTML = `<div class="card-box" style="margin-top:18px;max-width:none"><div class="row-between"><b>Order #${esc(o.id)}</b><span class="eyebrow" style="margin:0">${esc(STATUS_TEXT[o.status] || o.status)}</span></div>
        <div class="bar" style="margin:14px 0 6px"><i style="width:${((cur + 1) / steps.length) * 100}%"></i></div>
        <div class="row-between muted" style="font-size:12px">${steps.map((s) => `<span>${STATUS_TEXT[s]}</span>`).join("")}</div>
        ${o.tracking_number ? `<p style="margin-top:16px">Tracking number: <b>${esc(o.tracking_number)}</b>${o.tracking_carrier ? ` (${esc(o.tracking_carrier)})` : ""}<br><a style="text-decoration:underline" target="_blank" rel="noopener" href="https://t.17track.net/en#nums=${encodeURIComponent(o.tracking_number)}">Follow your package →</a></p>` : `<p class="muted" style="margin-top:16px">Your tracking number will appear here once the order ships.</p>`}
        ${o.items.map((l) => `<div class="row-between" style="font-size:14px;padding:6px 0;border-top:1px solid var(--line)"><span>${l.qty} × ${esc(l.title)}${l.variant ? " · " + esc(l.variant) : ""}</span><span>${money(l.price * l.qty)}</span></div>`).join("")}
        <div class="row-between" style="font-weight:700;padding-top:8px"><span>Total</span><span>${money(o.total)}</span></div></div>`;
    } catch (er) { out.innerHTML = `<p class="note err">${esc(er.message)}</p>`; }
  };
}

function account() {
  document.title = "Account — LeeysPremium";
  app.innerHTML = `<div class="wrap prose"><h1>Sign in</h1><form class="card-box" onsubmit="event.preventDefault()"><div class="field"><input type="email" placeholder="Email"></div><button class="btn block">Continue</button><p class="muted" style="font-size:14px">Customer accounts with order history arrive in the next stage.</p></form></div>`;
}

const PAGES = {
  shipping: ["Shipping", `<p>We ship to the United States and worldwide.</p><ul><li><b>United States:</b> 3–7 business days for items in our US warehouses; 8–15 days for other items.</li><li><b>Canada, UK, Australia:</b> 7–14 business days.</li><li><b>Rest of world:</b> 10–20 business days.</li></ul><p>Every order includes tracking. US orders over $${FREE_SHIP} ship free.</p>`],
  returns: ["Returns & refunds", `<p>You can return most items within 30 days of delivery. Items must be unused and in original packaging. Damaged or faulty items are replaced or refunded at no cost to you — just email us a photo.</p><p>Refunds go back to your original payment method within 5–10 business days of approval.</p>`],
  contact: ["Contact us", `<p>Questions about an order? Email <b>support@leeyspremium.com</b> and we'll reply within 24 hours, Monday to Saturday.</p><p>Or chat with us right now:</p><button class="btn accent" onclick="openChat()">Start a chat</button>`],
  privacy: ["Privacy policy", `<p>We collect only what's needed to process your order: your name, contact details, shipping address and order history. Payments are processed by our payment providers; we never store card numbers. We share your shipping details only with the supplier fulfilling your order and the carrier delivering it.</p>`],
  terms: ["Terms of service", `<p>By using LeeysPremium you agree to these terms. Prices are in USD. We may cancel an order if an item becomes unavailable, in which case you receive a full refund.</p>`],
};
function contentPage(slug) { const pg = PAGES[slug]; if (!pg) return notFound(); document.title = pg[0] + " — LeeysPremium"; app.innerHTML = `<div class="wrap prose"><h1>${pg[0]}</h1>${pg[1]}</div>`; }
function notFound() { app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><h1>Page not found</h1><a class="btn" href="/" data-link>Back to home</a></div>`; }

/* ---------- Router ---------- */
function route() {
  const { pathname, search } = location, params = new URLSearchParams(search);
  closeAll(); window.scrollTo(0, 0); clearInterval(SHOW.timer); clearInterval(LIVE.timer); VFEED.obs?.disconnect();
  let m;
  if (pathname === "/") home();
  else if (pathname === "/search") collection("all", params);
  else if ((m = pathname.match(/^\/collections\/([\w-]+)$/))) collection(m[1], params);
  else if ((m = pathname.match(/^\/products\/([\w-]+)$/))) product(m[1]);
  else if (pathname === "/categories") categoriesPage();
  else if (pathname === "/videos") videosPage();
  else if (pathname === "/live") livePage();
  else if (pathname === "/cart") cartPage();
  else if (pathname === "/checkout") checkout();
  else if (pathname === "/thank-you") thankYou(params);
  else if (pathname === "/track") track(params);
  else if (pathname === "/account") account();
  else if ((m = pathname.match(/^\/pages\/([\w-]+)$/))) contentPage(m[1]);
  else notFound();
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === pathname));
  $("#backBtn").hidden = pathname === "/";
  document.body.classList.toggle("home-wide", pathname === "/");
}
// Each in-store page remembers how deep we are, so Back returns to the previous store page
// (or a sensible parent page when someone lands straight on a product from Google or a shared link).
function go(url, replace) { const d = history.state?.d || 0; history[replace ? "replaceState" : "pushState"]({ d: replace ? d : d + 1 }, "", url); route(); }
function goBack() {
  if ((history.state?.d || 0) > 0) return history.back();
  const m = location.pathname.match(/^\/products\/([\w-]+)/), p = m && PRODUCTS.find((x) => x.id === m[1]);
  go(p && p.collection ? "/collections/" + p.collection : location.pathname.startsWith("/collections/") ? "/categories" : "/", true);
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey) { e.preventDefault(); go(a.getAttribute("href")); return; }
  const add = e.target.closest("[data-add]");
  if (add) { const p = PRODUCTS.find((x) => x.id === add.dataset.add); cart.add(p.id, p.variants.map((v) => v.options[0]).join(" / ")); openDrawer(); return; }
  const q = e.target.closest("[data-q]");
  if (q) { const l = cart.items.find((x) => x.key === q.dataset.q); cart.set(q.dataset.q, l.qty + Number(q.dataset.d)); refreshCartViews(); return; }
  const rm = e.target.closest("[data-rm]");
  if (rm) { cart.set(rm.dataset.rm, 0); refreshCartViews(); return; }
  if (e.target.closest("[data-close]") || e.target.id === "overlay") closeAll();
});
function refreshCartViews() { if (!$("#drawer").hidden) renderDrawer(); if (location.pathname === "/cart") cartPage(); }

$("#cartBtn").onclick = openDrawer;
$("#searchBtn").onclick = () => { const b = $("#searchBar"); b.hidden = !b.hidden; if (!b.hidden) $("#searchInput").focus(); };
$("#searchBar").onsubmit = (e) => { e.preventDefault(); const q = $("#searchInput").value.trim(); if (q) { $("#searchBar").hidden = true; go("/search?q=" + encodeURIComponent(q)); } };
$("#newsletter").onsubmit = async (e) => { e.preventDefault(); const f = e.target; try { await api("/api/subscribe", { email: f.querySelector("input").value }); f.innerHTML = "<p>Thanks! You're subscribed.</p>"; } catch (er) { toast(er.message); } };
$("#menuBtn").onclick = () => { $("#mobileNav").hidden = false; $("#overlay").hidden = false; };
window.addEventListener("popstate", route);
$("#backBtn").onclick = goBack;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

(async function init() {
  $("#year").textContent = new Date().getFullYear();
  try {
    [PRODUCTS, COLLECTIONS, CONFIG, PROMO] = await Promise.all(["/api/products", "/api/collections", "/api/config", "/api/promos"].map((u) => fetch(u).then((r) => { if (!r.ok) throw 0; return r.json(); })));
  } catch { app.innerHTML = `<div class="wrap prose"><h1>Store is loading slowly</h1><p>Please refresh the page.</p></div>`; return; }
  const link = (c) => `<a href="/collections/${c.id}" data-link>${esc(c.name)}</a>`, allLink = `<a href="/collections/all" data-link>Shop all</a><a href="/categories" data-link>Categories</a><a href="/live" data-link class="nav-live ${CONFIG.live?.status === "live" ? "on" : ""}">Premium Live</a><a href="/videos" data-link>Premium Video</a>`;
  const links = allLink + COLLECTIONS.map(link).join("");
  $("#nav").innerHTML = allLink + COLLECTIONS.slice(0, 2).map(link).join("");
  $("#mobileNav").innerHTML = links + `<a href="/track" data-link>Track order</a>`;
  $("#footerCollections").innerHTML = links;
  updateCount(); route();
})();

/* ---------- Installable app (PWA) ---------- */
(function pwa() {
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  const pill = $("#installPill"), icon = $("#installIcon");
  const snoozed = () => { try { return Date.now() < Number(localStorage.getItem("lp_install_snooze") || 0); } catch { return false; } };
  const snooze = (days) => { try { localStorage.setItem("lp_install_snooze", String(Date.now() + days * 864e5)); } catch {} };
  let deferred = null;
  const show = () => { icon.hidden = false; if (!snoozed()) setTimeout(() => (pill.hidden = false), 4000); };
  const install = async () => {
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice; deferred = null; pill.hidden = true; if (r.outcome === "accepted") { icon.hidden = true; toast("Installing LeeysPremium…"); } }
    else if (isIOS) { pill.hidden = false; $("#installHint").innerHTML = "Tap <b>Share</b> <span aria-hidden='true'>⎋</span> then <b>Add to Home Screen</b>."; $("#installBtn").hidden = true; }
  };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener("appinstalled", () => { pill.hidden = true; icon.hidden = true; toast("LeeysPremium app installed 🎉"); });
  if (isIOS && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)) { icon.hidden = false; if (!snoozed()) setTimeout(() => { pill.hidden = false; $("#installHint").innerHTML = "Tap <b>Share</b> then <b>Add to Home Screen</b>."; $("#installBtn").hidden = true; }, 6000); }
  $("#installBtn").onclick = install; icon.onclick = install;
  $("#installClose").onclick = () => { pill.hidden = true; snooze(7); };
})();

/* ---------- Live chat widget ---------- */
(function chat() {
  const KEY = "lp_chat";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  let st = load(), msgs = [], open = false, timer = null, lastId = 0, sending = false;
  const fab = document.createElement("button");
  fab.className = "chat-fab"; fab.setAttribute("aria-label", "Chat with us");
  fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg><span class="chat-dot" hidden></span>`;
  const panel = document.createElement("section");
  panel.className = "chat-panel"; panel.hidden = true; panel.setAttribute("aria-label", "Chat");
  panel.innerHTML = `<header><div class="chat-av">LP</div><div><b>LeeysPremium support</b><span><i></i> We usually reply within a few hours</span></div>
      <button class="icon-btn" data-chat-close aria-label="Close chat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    <div class="chat-log" role="log" aria-live="polite"></div>
    <form class="chat-who" ${st.email ? "hidden" : ""}><input name="name" placeholder="Your name (optional)" autocomplete="name" maxlength="80">
      <input name="email" type="email" placeholder="Email — so we can reply if you leave" autocomplete="email" maxlength="200"></form>
    <form class="chat-send"><textarea name="body" rows="1" placeholder="Type your message…" maxlength="2000" required></textarea>
      <button class="btn accent" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></svg></button></form>`;
  document.body.append(fab, panel);
  const log = panel.querySelector(".chat-log"), form = panel.querySelector(".chat-send"), who = panel.querySelector(".chat-who"), dot = fab.querySelector(".chat-dot");
  const time = (t) => { const d = t ? new Date(t.replace(" ", "T") + "Z") : new Date(); return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
  const render = () => {
    const greet = `<div class="msg admin"><p>Hi! 👋 Ask us anything about products, shipping or your order.</p></div>`;
    log.innerHTML = greet + msgs.map((m) => `<div class="msg ${m.sender}"><p>${esc(m.body).replace(/\n/g, "<br>")}</p><time>${time(m.created_at)}</time></div>`).join("");
    log.scrollTop = log.scrollHeight;
  };
  const poll = async (seen) => {
    if (!st.id) return;
    try {
      const r = await fetch(`/api/chat/poll?id=${encodeURIComponent(st.id)}&token=${encodeURIComponent(st.token)}&after=${lastId}&seen=${seen ? 1 : 0}`);
      if (r.status === 404) { st = {}; save(st); msgs = []; return; }
      const d = await r.json();
      if (d.messages?.length) { msgs.push(...d.messages); lastId = msgs[msgs.length - 1].id; if (open) render(); }
      dot.hidden = open || !d.unread;
    } catch {}
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(async () => { await poll(open); schedule(); }, open ? 4000 : 30000); };
  const show = async (v) => {
    open = v; panel.hidden = !v; fab.classList.toggle("on", v); dot.hidden = true;
    if (v) { render(); await poll(true); render(); setTimeout(() => form.body.focus(), 50); }
    schedule();
  };
  fab.onclick = () => show(!open);
  panel.querySelector("[data-chat-close]").onclick = () => show(false);
  form.body.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.body.addEventListener("input", () => { form.body.style.height = "auto"; form.body.style.height = Math.min(120, form.body.scrollHeight) + "px"; });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = form.body.value.trim();
    if (!text || sending) return;
    const email = who.email.value.trim();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("Please check your email address"); who.email.focus(); return; }
    sending = true; form.querySelector("button").disabled = true;
    try {
      const r = await fetch("/api/chat/send", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: st.id, token: st.token, body: text, name: who.name.value.trim(), email, page: location.pathname }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Message not sent");
      st = { id: d.id, token: d.token, email: email || st.email }; save(st);
      msgs = d.messages; lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
      form.body.value = ""; form.body.style.height = "auto";
      if (email) who.hidden = true;
      render(); schedule();
    } catch (er) { toast(er.message); }
    sending = false; form.querySelector("button").disabled = false;
  };
  window.openChat = () => show(true);
  if (st.id) { poll(false).then(schedule); }
})();

