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
    this.save(); trk("cart", id); setTimeout(cartOfferPopup, 450);
  },
  set(key, qty) { const l = this.items.find((x) => x.key === key); if (!l) return; l.qty = Math.max(0, qty); this.items = this.items.filter((x) => x.qty > 0); this.save(); },
  lines() { return this.items.map((l) => ({ ...l, p: PRODUCTS.find((p) => p.id === l.id) })).filter((l) => l.p); },
  subtotal() { return this.lines().reduce((s, l) => s + l.p.price * l.qty, 0); },
  count() { return this.items.reduce((s, l) => s + l.qty, 0); },
};
/* ---------- Visitor insights (anonymous daily counts) + add-to-cart offer ---------- */
const TQ = [];
function trk(k, t = "-") {
  try { const key = "lp_t_" + k + ":" + t; if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
  TQ.push({ k, t: String(t).slice(0, 80) });
  clearTimeout(trk.tm); trk.tm = setTimeout(flushTrack, 250);
}
function flushTrack() {
  if (!TQ.length) return; const data = JSON.stringify({ e: TQ.splice(0, 10) });
  try { if (!(navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([data], { type: "application/json" })))) fetch("/api/track", { method: "POST", body: data, headers: { "content-type": "application/json" }, keepalive: true }); } catch {}
  if (TQ.length) flushTrack();
}
// Time on page: counts only while the tab is visible. Product time is per product; visit time is the whole session.
const timer = { pid: null, pt: 0, vt: Date.now() };
function endProductTime() { if (timer.pid && timer.pt) { const s = (Date.now() - timer.pt) / 1000; if (s >= 1) TQ.push({ k: "ptime", t: timer.pid, v: Math.min(600, s) }); } timer.pid = null; timer.pt = 0; }
function startProductTime(id) { endProductTime(); timer.pid = id; timer.pt = document.visibilityState === "visible" ? Date.now() : 0; }
function pauseTime() {
  if (timer.pid && timer.pt) { const s = (Date.now() - timer.pt) / 1000; if (s >= 1) TQ.push({ k: "ptime", t: timer.pid, v: Math.min(600, s) }); timer.pt = 0; }
  if (timer.vt) { const s = (Date.now() - timer.vt) / 1000; if (s >= 1) TQ.push({ k: "vtime", t: "-", v: Math.min(1800, s) }); timer.vt = 0; }
  flushTrack();
}
function resumeTime() { timer.vt = Date.now(); if (timer.pid) timer.pt = Date.now(); }
addEventListener("pagehide", pauseTime);
setInterval(() => { if (document.visibilityState === "visible") { pauseTime(); resumeTime(); } }, 15000); // send time in small pieces so it isn't lost if the tab is closed
document.addEventListener("visibilitychange", () => (document.visibilityState === "hidden" ? pauseTime() : resumeTime()));
const offerCode = () => { try { return CONFIG.cartOffer && localStorage.getItem("lp_offer") === CONFIG.cartOffer.code ? CONFIG.cartOffer.code : ""; } catch { return ""; } };
function cartOfferPopup() {
  const o = CONFIG.cartOffer; if (!o) return;
  try { if (localStorage.getItem("lp_offer") === o.code) return; localStorage.setItem("lp_offer", o.code); } catch { return; }
  const m = document.createElement("div"); m.className = "offer-bg";
  m.innerHTML = `<div class="offer" role="dialog" aria-label="Discount unlocked"><button class="offer-x" aria-label="Close">✕</button>
    <div class="offer-burst">🎉</div><span class="offer-eb">You unlocked</span><div class="offer-big">${o.percent}% OFF</div><p>your order — we've added it for you. It applies automatically at checkout.</p>
    <div class="offer-code">Code <b>${esc(o.code)}</b></div>
    <a class="btn accent block" href="/checkout" data-link data-offgo>Checkout now & save ${o.percent}%</a><button class="btn ghost block" data-offclose>Keep shopping</button></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.onclick = (e) => { if (e.target === m || e.target.closest(".offer-x,[data-offclose],[data-offgo]")) close(); };
  if ($("#drawer") && !$("#drawer").hidden) renderDrawer();
}
function updateCount() { const n = cart.count(), el = $("#cartCount"); el.textContent = n; el.classList.toggle("zero", n === 0); }

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200); }

function spinProgress(sub) {
  const ps = SPINS.promos || []; if (!ps.length) return "";
  const next = ps.filter((p) => p.minSpend > sub).sort((a, b) => a.minSpend - b.minSpend)[0], got = ps.filter((p) => p.minSpend <= sub);
  if (next) return `<div class="spin-progress">🎡 Add <b>${money(next.minSpend - sub)}</b> more to unlock a <b>free spin</b> — every spin wins a gift<div class="bar"><i style="width:${Math.min(100, (sub / next.minSpend) * 100)}%"></i></div></div>`;
  return got.length ? `<div class="spin-progress done">🎉 This order unlocks <b>${got.length > 1 ? got.length + " free spins" : "a free spin"}</b> — spin after you pay!</div>` : "";
}
function shipProgress(sub) {
  const left = FREE_SHIP - sub, pct = Math.min(100, (sub / FREE_SHIP) * 100);
  return `<div class="ship-progress">${left > 0 ? `You're <b>${money(left)}</b> away from free US shipping` : "🎉 You've unlocked <b>free US shipping</b>"}<div class="bar"><i style="width:${pct}%"></i></div></div>`;
}
function qtyCtl(key, q) { return `<div class="qty"><button data-q="${key}" data-d="-1" aria-label="Decrease">−</button><input value="${q}" readonly aria-label="Quantity"><button data-q="${key}" data-d="1" aria-label="Increase">+</button></div>`; }

function renderDrawer() {
  const d = $("#drawer"), lines = cart.lines(), sub = cart.subtotal();
  d.innerHTML = `<div class="drawer-head"><h3>Your cart (${cart.count()})</h3><button class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
  ${lines.length ? shipProgress(sub) + spinProgress(sub) + (offerCode() ? `<div class="offer-strip">🎉 <b>${CONFIG.cartOffer.percent}% off</b> applied at checkout · code ${esc(offerCode())}</div>` : "") + `<div class="drawer-items">${lines.map((l) => `
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
// Sales that have ended go back to the regular price straight away (even if the product list was cached a few minutes)
function expirePromos() {
  const now = Date.now(); let n = 0;
  for (const p of PRODUCTS) if (p.promo && new Date(p.promo.endsAt).getTime() <= now) { if (p.compareAt) p.price = p.compareAt; p.compareAt = null; p.promo = null; n++; }
  if (PROMO.promos) PROMO.promos = PROMO.promos.filter((x) => !x.endsAt || new Date(x.endsAt).getTime() > now);
  return n;
}
setInterval(() => {
  let ended = false;
  document.querySelectorAll("[data-ends]").forEach((el) => {
    if (new Date(el.dataset.ends).getTime() > Date.now()) { el.textContent = timeLeft(el.dataset.ends); return; }
    ended = true;
    const box = el.closest(".promo-line, .flash-timer, .az-pill"); // replace the whole "ends in …" text
    if (box) { box.textContent = "Sale ended"; box.classList.add("ended"); } else el.textContent = "ended";
    el.removeAttribute("data-ends");
  });
  if (ended) expirePromos(); // next page shows regular prices; checkout always uses the server's current price
}, 1000);
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
    ${(() => { const cc = COLLECTIONS.find((x) => x.id === p.collection); return cc ? `<a class="rc-cat" href="/collections/${cc.id}" data-link>${esc(cc.name)}</a>` : ""; })()}<a href="/products/${p.id}" data-link><h3>${esc(p.title)}</h3></a>
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
    <div class="az-shelf-head"><h2><a class="hlink" href="${href}" data-link>${title}</a></h2>${extra}<a href="${href}" data-link>See more ›</a></div>
    <div class="az-rail" data-rail>${list.map(card).join("")}</div><button class="az-arrow l" data-rl="-1" aria-label="Scroll left">‹</button><button class="az-arrow r" data-rl="1" aria-label="Scroll right">›</button></div></div></section>` : "";
  const quad = ({ c, items }) => `<div class="az-quad"><h3><a class="hlink" href="/collections/${c.id}" data-link>${esc(c.name)} ›</a></h3><div class="az-q4">${pick4(items).map((p) => `<a href="/products/${p.id}" data-link><div class="az-qimg">${pimg(p)}</div><span>${esc(p.title.split(/[,(|-]/)[0].trim().slice(0, 28))}</span></a>`).join("")}</div><a class="az-more" href="/collections/${c.id}" data-link>See more</a></div>`;
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
  ${onSale.length ? `<section class="az-bleed"><div class="wrap"><div class="az-bleed-head"><h2><a class="hlink" href="/collections/all?deal=today" data-link>⚡ Flash sale ›</a></h2><span class="flash-timer">Ends in <b data-ends="${flashEnds}">${timeLeft(flashEnds)}</b></span><a href="/collections/all?sort=deals" data-link>See all deals ›</a></div>
    <div class="az-rel"><div class="az-rail" data-rail>${onSale.slice(0, 20).map(card).join("")}</div><button class="az-arrow l" data-rl="-1" aria-label="Scroll left">‹</button><button class="az-arrow r" data-rl="1" aria-label="Scroll right">›</button></div></div></section>` : ""}
  ${shelf("Top picks for you", "/collections/all?sort=top", best)}
  <section class="spin-home" id="spinSlot"></section>
  <section class="az-spot" id="draw"><div class="wrap"><div class="az-panel az-spot-in" id="drawSlot">
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
  loadDraw();
  renderSpinHome();
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
  return `<section class="az-shelf"><div class="wrap"><div class="az-panel"><div class="az-shelf-head"><h2><a class="hlink" href="/collections/all?deal=any" data-link>🎟 Vouchers & weekly deals</a></h2><a href="/collections/all?sort=deals" data-link>See deals ›</a></div>
    <div class="az-offers">${[...vc, ...sc].join("")}</div></div></div></section>`;
}
function bindVouchers() {
  document.querySelectorAll("[data-claim]").forEach((b) => (b.onclick = () => {
    saveWallet([...wallet(), b.dataset.claim]);
    navigator.clipboard?.writeText(b.dataset.claim).catch(() => {});
    b.textContent = "Claimed ✓"; b.disabled = true; toast(`Voucher ${b.dataset.claim} saved — it's applied automatically at checkout`);
  }));
}

/* ---------- Category / search results: Amazon-style (filter sidebar, sort menu, big photos, pages) ---------- */
const GENDERS = [["Women", /\b(women'?s?|woman|ladies|lady|female|girls?'? ?women)\b/i], ["Men", /\b(men'?s?|man|male|gentlemen)\b/i],
  ["Boys", /\b(boys?'?s?)\b/i], ["Girls", /\b(girls?'?s?)\b/i], ["Kids & Baby", /\b(kids?|children'?s?|child|baby|toddlers?|infants?)\b/i], ["Unisex", /\bunisex\b/i]];
const genderOf = (p) => { const t = p.title; const g = GENDERS.filter(([, r]) => r.test(t)).map(([n]) => n); return g.includes("Women") ? g.filter((x) => x !== "Men") : g; };
const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "6XL"];
const sizeKey = (v) => { const u = v.toUpperCase().trim(); const i = SIZE_ORDER.indexOf(u); return i >= 0 ? i : 100 + (parseFloat(u) || 999); };
const sizesOf = (p) => (p.variants || []).filter((v) => /size|尺/i.test(v.name)).flatMap((v) => v.options.map((o) => String(o).trim().toUpperCase())).filter((o) => o.length <= 6);
const COLORS = [["Black", "#111"], ["White", "#fff"], ["Grey", "#8a8f99"], ["Silver", "#c7ccd4"], ["Gold", "#d4af37"], ["Red", "#d62b2b"], ["Pink", "#f48fb1"], ["Orange", "#f08a24"],
  ["Yellow", "#f5d90a"], ["Green", "#2e9d57"], ["Blue", "#2f6fdf"], ["Navy", "#1b2a59"], ["Purple", "#7b3fc4"], ["Brown", "#7a4b2a"], ["Beige", "#d9c7a5"]];
const colorsOf = (p) => { const txt = (p.variants || []).filter((v) => /colou?r|style|颜色/i.test(v.name)).flatMap((v) => v.options).join(" ").toLowerCase().replace(/gray/g, "grey").replace(/khaki|apricot|cream/g, "beige").replace(/coffee|camel/g, "brown").replace(/rose|fuchsia/g, "pink").replace(/sky|light blue|royal/g, "blue");
  return COLORS.map(([n]) => n).filter((n) => new RegExp("\\b" + n.toLowerCase() + "\\b").test(txt)); };
const PRICE_BANDS = [[0, 10, "Under $10"], [10, 25, "$10 to $25"], [25, 50, "$25 to $50"], [50, 100, "$50 to $100"], [100, 0, "$100 & above"]];
const SORTS = [["featured", "Featured"], ["price-asc", "Price: Low to High"], ["price-desc", "Price: High to Low"], ["review", "Avg. Customer Review"], ["latest", "Newest Arrivals"], ["top", "Best Sellers"], ["deals", "Biggest Discount"]];
function rcard(p) {
  const off = offPct(p), r = p.rating || 0, sw = (p.variants || []).reduce((t, v) => Math.max(t, v.options.length), 0);
  const img = (p.images || [])[0];
  return `<div class="rcard"><div class="rc-img"><a href="/products/${p.id}" data-link>${img ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy">` : art(p)}</a>
      ${p.promo ? `<span class="rc-flag">⚡ ${p.promo.percent}% off</span>` : p.video ? `<span class="rc-flag vid">▶ Video</span>` : ""}${p.stock === 0 ? `<span class="rc-flag out">Sold out</span>` : ""}
      ${p.stock > 0 ? `<button class="rc-add" data-add="${p.id}" aria-label="Add to cart" title="Add to cart">+</button>` : ""}</div>
    <div class="rc-body">${(() => { const cc = COLLECTIONS.find((x) => x.id === p.collection); return cc ? `<a class="rc-cat" href="/collections/${cc.id}" data-link>${esc(cc.name)}</a>` : ""; })()}<a class="rc-t" href="/products/${p.id}" data-link>${esc(p.title)}</a>
      <div class="rc-meta">${r && p.reviews > 0 ? `<span class="rc-stars"><b>${r.toFixed(1)}</b> ${starIcons(r)}${p.reviews ? ` <span>(${p.reviews >= 1000 ? (p.reviews / 1000).toFixed(1) + "K" : p.reviews})</span>` : ""}</span>` : ""}${sw > 1 ? `<span class="rc-sw">+${sw} options</span>` : ""}</div>
      ${p.sold >= 50 ? `<div class="rc-sold">${p.sold >= 1000 ? (p.sold / 1000).toFixed(1) + "K+" : p.sold + "+"} bought</div>` : ""}
      <div class="rc-price">${off ? `<span class="rc-off">-${off}%</span>` : ""}<span class="rc-now"><sup>$</sup>${Math.floor(p.price)}<sup>${String(Math.round((p.price % 1) * 100)).padStart(2, "0")}</sup></span>${off ? `<s>${money(p.compareAt)}</s>` : ""}</div>
      ${p.promo ? `<div class="promo-line">Ends in <span data-ends="${p.promo.endsAt}">${timeLeft(p.promo.endsAt)}</span></div>` : ""}
      <div class="rc-ship">${p.price >= FREE_SHIP ? "<b>FREE delivery</b> " : ""}${etaShort(p)}${p.ships === "us" ? " · US warehouse" : ""}</div></div></div>`;
}
function collection(id, params) {
  const c = COLLECTIONS.find((x) => x.id === id);
  const qRaw = params.get("q") || "", q = qRaw.toLowerCase().trim();
  if (q) trk("search", q); else trk("category", id);
  const words = q.split(/\s+/).filter(Boolean);
  let base = id === "all" || q ? [...PRODUCTS] : PRODUCTS.filter((p) => p.collection === id);
  if (q) base = base.filter((p) => { const t = (p.title + " " + (p.description || "") + " " + (COLLECTIONS.find((x) => x.id === p.collection)?.name || "")).toLowerCase(); return words.every((w) => t.includes(w)); });
  const title = q ? qRaw : c ? c.name : "All products";
  document.title = (q ? `Results for “${qRaw}”` : title) + " — LeeysPremium";
  const meta = new Map(base.map((p) => [p.id, { g: genderOf(p), s: sizesOf(p), c: colorsOf(p) }]));
  const list = (k) => (params.get(k) || "").split(",").filter(Boolean);
  const sortP = params.get("sort");
  const st = { sort: SORTS.some(([v]) => v === sortP) ? sortP : sortP === "best" ? "top" : sortP === "popular" ? "featured" : "featured",
    cat: list("cat"), g: list("g"), sz: list("sz"), col: list("col"), band: params.get("band") || "", min: Number(params.get("min")) || 0, max: Number(params.get("max")) || 0,
    rate: Number(params.get("rate")) || 0, us: params.get("us") === "1", stock: params.get("stock") === "1", free: params.get("free") === "1", deal: params.get("deal") || "", page: Math.max(1, Number(params.get("page")) || 1) };
  if (sortP === "deals" && !st.deal) st.deal = "";
  const PER = 24;
  const catPromo = c ? PROMO.promos.find((x) => (x.scope === "collection" && x.target === c.id) || x.scope === "all") : PROMO.promos.find((x) => x.scope === "all");
  // facet values that exist in this result set
  const count = (fn) => { const m = new Map(); base.forEach((p) => fn(p).forEach((v) => m.set(v, (m.get(v) || 0) + 1))); return m; };
  const gC = count((p) => meta.get(p.id).g), sC = count((p) => meta.get(p.id).s), cC = count((p) => meta.get(p.id).c), catC = count((p) => [p.collection]);
  const sizes = [...sC.keys()].filter((k) => sC.get(k) >= 1).sort((a, b) => sizeKey(a) - sizeKey(b)).slice(0, 30);
  const pass = (p, skip) => {
    const m = meta.get(p.id);
    if (skip !== "cat" && st.cat.length && !st.cat.includes(p.collection)) return false;
    if (skip !== "g" && st.g.length && !st.g.some((g) => m.g.includes(g))) return false;
    if (skip !== "sz" && st.sz.length && !st.sz.some((x) => m.s.includes(x))) return false;
    if (skip !== "col" && st.col.length && !st.col.some((x) => m.c.includes(x))) return false;
    if (st.band) { const [lo, hi] = st.band.split("-").map(Number); if (p.price < lo || (hi && p.price >= hi)) return false; }
    if (st.min && p.price < st.min) return false; if (st.max && p.price > st.max) return false;
    if (st.rate && (p.rating || 0) < st.rate) return false;
    if (st.us && p.ships !== "us") return false; if (st.stock && !(p.stock > 0)) return false; if (st.free && p.price < FREE_SHIP) return false;
    if (st.deal === "today" && !p.promo) return false; if (st.deal === "any" && !offPct(p)) return false;
    return true;
  };
  const sorter = { "price-asc": (a, b) => a.price - b.price, "price-desc": (a, b) => b.price - a.price, review: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.reviews || 0) - (a.reviews || 0),
    latest: (a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")), top: (a, b) => (b.sold || 0) - (a.sold || 0), deals: (a, b) => offPct(b) - offPct(a),
    featured: (a, b) => (b.stock > 0) - (a.stock > 0) || ((b.images || []).length > 0) - ((a.images || []).length > 0) || (b.sold || 0) - (a.sold || 0) || (b.rating || 0) - (a.rating || 0) };
  const syncUrl = () => {
    const u = new URLSearchParams(); if (qRaw) u.set("q", qRaw);
    if (st.sort !== "featured") u.set("sort", st.sort);
    for (const k of ["cat", "g", "sz", "col"]) if (st[k].length) u.set(k, st[k].join(","));
    if (st.band) u.set("band", st.band); if (st.min) u.set("min", st.min); if (st.max) u.set("max", st.max); if (st.rate) u.set("rate", st.rate);
    for (const k of ["us", "stock", "free"]) if (st[k]) u.set(k, "1"); if (st.deal) u.set("deal", st.deal); if (st.page > 1) u.set("page", st.page);
    history.replaceState(history.state, "", location.pathname + (u.toString() ? "?" + u : ""));
  };
  const chk = (key, val, label, n) => `<label class="fl-c"><input type="checkbox" data-f="${key}" value="${esc(val)}" ${st[key].includes(val) ? "checked" : ""}> ${esc(label)}${n != null ? ` <span>(${n})</span>` : ""}</label>`;
  const sidebar = () => `<div class="fl-head"><b>Filters</b><button class="fl-x" id="flClose" aria-label="Close filters">✕</button></div>
    ${(q || id === "all") && catC.size > 1 ? `<div class="fl-g"><h4>Department</h4>${[...catC.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => chk("cat", k, COLLECTIONS.find((x) => x.id === k)?.name || "Other", n)).join("")}</div>`
      : !q && c ? `<div class="fl-g"><h4>Department</h4><a class="fl-link" href="/collections/all" data-link>‹ Any department</a><b class="fl-cur">${esc(c.name)}</b>${COLLECTIONS.filter((x) => x.id !== id).slice(0, 12).map((x) => `<a class="fl-link sub" href="/collections/${x.id}" data-link>${esc(x.name)}</a>`).join("")}</div>` : ""}
    ${gC.size ? `<div class="fl-g"><h4>Gender</h4>${GENDERS.map(([n]) => n).filter((n) => gC.has(n)).map((n) => chk("g", n, n, gC.get(n))).join("")}</div>` : ""}
    ${!base.some((p) => p.reviews > 0) ? "" : `<div class="fl-g"><h4>Customer Reviews</h4>${[4, 3].map((r) => `<button class="fl-rate ${st.rate === r ? "on" : ""}" data-rate="${r}"><i>${"★".repeat(r)}${"☆".repeat(5 - r)}</i> & Up</button>`).join("")}</div>`}
    ${sizes.length ? `<div class="fl-g"><h4>Size</h4><div class="fl-sizes">${sizes.map((x) => `<button class="fl-size ${st.sz.includes(x) ? "on" : ""}" data-sz="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>` : ""}
    ${cC.size ? `<div class="fl-g"><h4>Color</h4><div class="fl-colors">${COLORS.filter(([n]) => cC.has(n)).map(([n, hex]) => `<button class="fl-col ${st.col.includes(n) ? "on" : ""}" data-col="${n}" title="${n} (${cC.get(n)})" style="--c:${hex}"></button>`).join("")}</div></div>` : ""}
    <div class="fl-g"><h4>Price</h4>${PRICE_BANDS.map(([lo, hi, t]) => `<button class="fl-link ${st.band === lo + "-" + hi ? "on" : ""}" data-band="${lo}-${hi}">${t}</button>`).join("")}
      <div class="fl-minmax"><input class="inp" id="fMin" inputmode="decimal" placeholder="$ Min" value="${st.min || ""}"><input class="inp" id="fMax" inputmode="decimal" placeholder="$ Max" value="${st.max || ""}"><button class="btn sm ghost" id="fGo">Go</button></div></div>
    <div class="fl-g"><h4>Deals & Discounts</h4><button class="fl-link ${st.deal === "any" ? "on" : ""}" data-deal="any">All Discounts</button><button class="fl-link ${st.deal === "today" ? "on" : ""}" data-deal="today">Today's Deals (flash sale)</button></div>
    <div class="fl-g"><h4>Delivery</h4><label class="fl-c"><input type="checkbox" data-t="us" ${st.us ? "checked" : ""}> Ships from US warehouse</label><label class="fl-c"><input type="checkbox" data-t="free" ${st.free ? "checked" : ""}> FREE shipping eligible</label><label class="fl-c"><input type="checkbox" data-t="stock" ${st.stock ? "checked" : ""}> In stock only</label></div>
    <button class="btn ghost sm fl-clear" id="flClear">Clear all filters</button>`;
  const activeN = () => st.cat.length + st.g.length + st.sz.length + st.col.length + (st.band ? 1 : 0) + (st.min || st.max ? 1 : 0) + (st.rate ? 1 : 0) + st.us + st.stock + st.free + (st.deal ? 1 : 0);
  app.innerHTML = `<div class="az-res-top"><div class="wrap az-res-bar"><span id="resCount"></span>
      <div class="flex" style="gap:8px"><button class="btn sm ghost fl-open" id="flOpen">⚙ Filters <span id="flN"></span></button>
      <label class="az-sort">Sort by: <select id="sortSel">${SORTS.filter(([v]) => v !== "review" || PRODUCTS.some((p) => p.reviews > 0)).map(([v, t]) => `<option value="${v}" ${st.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select></label></div></div></div>
    <div class="wrap az-res">
      <aside class="az-filters" id="filters"></aside>
      <section class="az-main">
        ${!q && c ? `<div class="az-res-h"><div class="crumbs"><a href="/" data-link>Home</a> › <a href="/categories" data-link>Categories</a> › ${esc(title)}</div><h1>${esc(title)}</h1></div>` : `<div class="az-res-h"><h1>Results</h1><p class="muted">Check each product page for other buying options. Price and other details may vary based on product size and color.</p></div>`}
        ${catPromo ? `<div class="promo-line big">⚡ ${esc(catPromo.label)} — ${catPromo.percent}% off · ends in <b data-ends="${catPromo.endsAt}">${timeLeft(catPromo.endsAt)}</b></div>` : ""}
        ${voucherStrip(q ? null : id === "all" ? null : id)}
        <div class="az-chips" id="chips"></div>
        <div class="az-grid" id="results"></div><nav class="az-pages" id="pages"></nav></section></div>
    <div class="fl-scrim" id="flScrim" hidden></div>`;
  const draw = (scroll) => {
    const all = base.filter((p) => pass(p)).sort(sorter[st.sort] || sorter.featured);
    const pages = Math.max(1, Math.ceil(all.length / PER)); st.page = Math.min(st.page, pages);
    const slice = all.slice((st.page - 1) * PER, st.page * PER);
    $("#results").innerHTML = slice.length ? slice.map(rcard).join("") : `<div class="empty" style="grid-column:1/-1">No results match these filters. <button class="btn sm ghost" data-clear>Clear filters</button></div>`;
    const from = all.length ? (st.page - 1) * PER + 1 : 0, to = Math.min(all.length, st.page * PER);
    $("#resCount").innerHTML = `${from}-${to} of ${all.length.toLocaleString()} result${all.length === 1 ? "" : "s"}${q ? ` for <b class="az-q">"${esc(qRaw)}"</b>` : c ? ` in <b class="az-q">${esc(c.name)}</b>` : ""}`;
    const n = activeN(); $("#flN").textContent = n ? `(${n})` : "";
    const chips = [...st.cat.map((v) => ["cat", v, COLLECTIONS.find((x) => x.id === v)?.name || v]), ...st.g.map((v) => ["g", v, v]), ...st.sz.map((v) => ["sz", v, "Size " + v]), ...st.col.map((v) => ["col", v, v]),
      ...(st.band ? [["band", "", PRICE_BANDS.find(([lo, hi]) => lo + "-" + hi === st.band)?.[2]]] : []), ...(st.min || st.max ? [["mm", "", `$${st.min || 0} – ${st.max ? "$" + st.max : "any"}`]] : []),
      ...(st.rate ? [["rate", "", st.rate + "★ & up"]] : []), ...(st.deal ? [["deal", "", st.deal === "today" ? "Today's Deals" : "All Discounts"]] : []),
      ...(st.us ? [["us", "", "US warehouse"]] : []), ...(st.free ? [["free", "", "FREE shipping"]] : []), ...(st.stock ? [["stock", "", "In stock"]] : [])];
    $("#chips").innerHTML = chips.map(([k, v, t]) => `<button class="az-chip" data-rm="${k}" data-v="${esc(v)}">${esc(t)} ✕</button>`).join("") + (chips.length > 1 ? `<button class="az-chip clear" data-clear>Clear all</button>` : "");
    const pg = (i, t = i, dis) => `<button class="${i === st.page ? "on" : ""}" data-page="${i}" ${dis ? "disabled" : ""}>${t}</button>`;
    const nums = [...new Set([1, st.page - 1, st.page, st.page + 1, pages].filter((i) => i >= 1 && i <= pages))].sort((a, b) => a - b);
    $("#pages").innerHTML = pages > 1 ? pg(st.page - 1, "‹ Previous", st.page === 1) + nums.map((i, k) => (k && i - nums[k - 1] > 1 ? `<span>…</span>` : "") + pg(i)).join("") + pg(st.page + 1, "Next ›", st.page === pages) : "";
    $("#filters").innerHTML = sidebar(); bindSide();
    syncUrl();
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reset = () => { Object.assign(st, { cat: [], g: [], sz: [], col: [], band: "", min: 0, max: 0, rate: 0, us: false, stock: false, free: false, deal: "", page: 1 }); draw(); };
  const toggle = (k, v) => { st[k] = st[k].includes(v) ? st[k].filter((x) => x !== v) : [...st[k], v]; st.page = 1; draw(); };
  const closeF = () => { document.body.classList.remove("fl-show"); $("#flScrim").hidden = true; };
  function bindSide() {
    const f = $("#filters");
    f.querySelectorAll("[data-f]").forEach((el) => (el.onchange = () => toggle(el.dataset.f, el.value)));
    f.querySelectorAll("[data-t]").forEach((el) => (el.onchange = () => { st[el.dataset.t] = el.checked; st.page = 1; draw(); }));
    f.querySelectorAll("[data-rate]").forEach((el) => (el.onclick = () => { const r = Number(el.dataset.rate); st.rate = st.rate === r ? 0 : r; st.page = 1; draw(); }));
    f.querySelectorAll("[data-sz]").forEach((el) => (el.onclick = () => toggle("sz", el.dataset.sz)));
    f.querySelectorAll("[data-col]").forEach((el) => (el.onclick = () => toggle("col", el.dataset.col)));
    f.querySelectorAll("[data-band]").forEach((el) => (el.onclick = () => { st.band = st.band === el.dataset.band ? "" : el.dataset.band; st.min = st.max = 0; st.page = 1; draw(); }));
    f.querySelectorAll("[data-deal]").forEach((el) => (el.onclick = () => { st.deal = st.deal === el.dataset.deal ? "" : el.dataset.deal; st.page = 1; draw(); }));
    $("#fGo").onclick = () => { st.min = Math.max(0, parseFloat($("#fMin").value) || 0); st.max = Math.max(0, parseFloat($("#fMax").value) || 0); st.band = ""; st.page = 1; draw(); };
    $("#flClear").onclick = reset; $("#flClose").onclick = closeF;
  }
  $("#sortSel").onchange = (e) => { st.sort = e.target.value; st.page = 1; draw(); };
  $("#flOpen").onclick = () => { document.body.classList.add("fl-show"); $("#flScrim").hidden = false; };
  $("#flScrim").onclick = closeF;
  app.querySelector(".az-main").addEventListener("click", (e) => {
    const pb = e.target.closest("[data-page]"); if (pb && !pb.disabled) { st.page = Number(pb.dataset.page); return draw(true); }
    if (e.target.closest("[data-clear]")) return reset();
    const rm = e.target.closest("[data-rm]"); if (!rm) return;
    const k = rm.dataset.rm, v = rm.dataset.v;
    if (["cat", "g", "sz", "col"].includes(k)) st[k] = st[k].filter((x) => x !== v); else if (k === "mm") st.min = st.max = 0; else if (k === "band" || k === "deal") st[k] = ""; else if (k === "rate") st.rate = 0; else st[k] = false;
    st.page = 1; draw();
  });
  bindVouchers();
  draw();
}

/* ---------- Premium Video: swipeable feed of product videos ---------- */
let VFEED = { obs: null, muted: true };
function videosPage() {
  document.title = "Premium Video — LeeysPremium";
  const list = PRODUCTS.filter((p) => p.video).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  if (!list.length) { app.innerHTML = `${lvSwitch("video")}<div class="wrap prose" style="text-align:center;margin:0 auto"><h1>▶ Premium Video</h1><p>Product videos are coming soon. Meanwhile, catch us on <a href="/live" data-link style="color:var(--blue-2)">Premium Live</a>.</p></div>`; return; }
  app.innerHTML = `<div class="wrap vpage">${lvSwitch("video")}<div class="vhead"><h1>▶ Premium Video</h1><p class="muted">Watch before you buy · ${list.length} product video${list.length === 1 ? "" : "s"} · swipe or scroll</p></div>
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
  LIVE.status = d.status; LIVE.switchHtml = lvSwitch("live"); LIVE.lastId = d.comments.length ? d.comments[d.comments.length - 1].id : 0;
  const pinned = d.pinned.map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean);
  const badge = { live: `<span class="live-badge">● LIVE</span>`, replay: `<span class="live-badge replay">▶ REPLAY</span>`, scheduled: `<span class="live-badge sched">📅 UPCOMING</span>`, off: "" }[d.status];
  const player = d.status === "live" || d.status === "replay"
    ? (d.status === "replay" && d.video ? `<video src="${esc(d.video)}" controls autoplay muted playsinline></video>` : d.embed ? `<iframe src="${esc(d.embed.src)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Live stream"></iframe>` : "")
    : `<div class="live-idle">${d.status === "scheduled" ? `<div><div class="muted">Next live starts in</div><div class="live-count" data-ends="${esc(d.startsAt)}">${timeLeft(d.startsAt)}</div>
        <div class="muted">${new Date(d.startsAt).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div></div>`
      : `<div><div style="font-size:42px">📺</div><b>We're not live right now</b><p class="muted">Follow along next time — meanwhile, watch our <a href="/videos" data-link style="color:var(--blue-2)">product videos</a>.</p></div>`}</div>`;
  const name = (() => { try { return localStorage.getItem("lp_name") || ""; } catch { return ""; } })();
  app.innerHTML = `<div class="wrap live-page">${LIVE.switchHtml || ""}
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
  trk("product", id); startProductTime(id);
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return notFound();
  setTimeout(() => loadReviews(p), 0);
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
      <h1>${esc(p.title)}</h1><div class="pdp-rate">${p.reviews > 0 ? `<a href="#reviews" class="pdp-stars" data-jump="reviews">${starIcons(p.rating)} <b>${p.rating.toFixed(1)}</b> <span>${p.reviews} verified review${p.reviews === 1 ? "" : "s"}</span></a>` : ""}${p.sold ? `<span class="muted" style="font-size:14px">${p.sold.toLocaleString()} sold</span>` : ""}</div>
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
    <section class="section" id="reviews" style="padding-top:0"><div class="section-head"><h2>Customer reviews</h2></div><div id="revBox" class="rev-box"><p class="muted">Loading reviews…</p></div></section>
    <section class="section" style="padding-top:0"><div class="section-head"><h2>You may also like</h2><a class="hlink more" href="/collections/${coll.id}" data-link>More in ${esc(coll.name)} ›</a></div><div class="grid" id="related">${related.slice(0, shown).map(card).join("")}</div>
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
    ${shipProgress(sub)}${spinProgress(sub)}${lines.map((l) => `<div class="line"><a class="thumb" href="/products/${l.id}" data-link>${variantImg(l.p, l.variant) ? photoTag(variantImg(l.p, l.variant), l.p.title) : art(l.p)}</a><div><div class="t">${esc(l.p.title)}</div>${l.variant ? `<div class="v">${esc(l.variant)}</div>` : ""}<div style="margin-top:8px">${qtyCtl(l.key, l.qty)}</div><button class="rm" data-rm="${l.key}">Remove</button></div><b>${money(l.p.price * l.qty)}</b></div>`).join("")}
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
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(CONFIG.paypalClientId)}&currency=USD&intent=capture&components=buttons&enable-funding=card,venmo,paylater`;
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
  document.title = "Checkout — LeeysPremium"; trk("checkout");
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
    <aside class="co-summary"><div id="paypal-buttons" style="min-height:50px"></div>${CONFIG.crypto ? `<button type="button" class="btn block crypto-btn" id="cryptoPay"><span>₿</span> Pay with crypto <small>BTC · ETH · USDT · 300+ coins</small></button>` : ""}
      <p class="co-fine">By placing your order, you agree to LeeysPremium's <a href="/pages/privacy" data-link>privacy notice</a> and <a href="/pages/terms" data-link>terms of service</a>.</p>
      <h3>Order Summary</h3><div class="totals" id="totals"></div><div id="coSpin"></div>
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
      if (!V.offerTried) { V.offerTried = true;
        const mine = [offerCode(), ...wallet()].filter((c) => c && !PROMO.vouchers.some((v) => v.code === c)).slice(0, 12);
        await Promise.all(mine.map(async (c) => { try { const v = await api("/api/discount", { code: c }); if (!V.extra.some((x) => x.code === v.code)) V.extra.push(v); } catch {} })); }
      const q = await api("/api/quote", { items: items(), code: V.code, shipCode: V.shipCode, country: form.country.value, email: form.email.value });
      q.extraVouchers = [...(q.extraVouchers || []), ...V.extra];
      V.last = q;
      if (!V.manual && !V.autoDone) { V.autoDone = true; const best = bestVouchers(q); if (best.code !== V.code || best.shipCode !== V.shipCode) { Object.assign(V, best); return quote(); } }
      $("#vpickSel").innerHTML = [q.shipCode && `<span class="vtag ship">${esc(q.shipCode)}</span>`, q.code && `<span class="vtag">${esc(q.code)}</span>`].filter(Boolean).join(" ") || "Select or enter code ›";
      const n = bag.items.reduce((t, l) => t + l.qty, 0);
      if ($("#coSpin")) $("#coSpin").innerHTML = spinProgress(Math.max(0, q.subtotal - (q.discount || 0)));
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
  if ($("#cryptoPay")) $("#cryptoPay").onclick = async () => {
    if (!valid()) return; const btn = $("#cryptoPay"), f = form; btn.disabled = true; btn.firstChild.nextSibling.textContent = " Opening crypto payment…";
    try {
      const r = await api("/api/checkout/crypto", { device: deviceId(), items: items(), code: V.code, shipCode: V.shipCode, country: f.country.value, email: f.email.value, marketing: f.marketing.checked,
        address: { firstName: f.firstName.value, lastName: f.lastName.value, address1: f.address1.value, address2: f.address2.value, city: f.city.value, province: f.province.value, zip: f.zip.value, phone: f.phone.value } });
      rememberOrder(r.orderId, f.email.value);
      try { sessionStorage.setItem("lp_crypto", JSON.stringify({ id: r.orderId, cart: bag === cart })); } catch {}
      location.href = r.url;
    } catch (e) { err(e.message); btn.disabled = false; btn.firstChild.nextSibling.textContent = " Pay with crypto "; }
  };
  loadPaypal().then(() => {
    window.paypal.Buttons({
      style: { layout: "vertical", shape: "pill", label: "pay", height: 48 },
      onClick: (_, actions) => (valid() ? actions.resolve() : actions.reject()),
      createOrder: async () => {
        const f = form, r = await api("/api/checkout", { device: deviceId(),
          items: items(), code: V.code, shipCode: V.shipCode, country: f.country.value, email: f.email.value, marketing: f.marketing.checked,
          address: { firstName: f.firstName.value, lastName: f.lastName.value, address1: f.address1.value, address2: f.address2.value, city: f.city.value, province: f.province.value, zip: f.zip.value, phone: f.phone.value },
        }).catch((e) => { err(e.message); throw e; });
        localId = r.orderId; return r.paypalOrderId;
      },
      onApprove: async () => {
        try { const r = await api("/api/checkout/capture", { orderId: localId }); if (bag === cart) { cart.items = []; cart.save(); } else { try { sessionStorage.removeItem("lp_buynow"); } catch {} } trk("buy"); rememberOrder(r.orderId, form.email.value); go("/thank-you?order=" + encodeURIComponent(r.orderId)); }
        catch (e) { err(e.message + ". You have not been charged — please try again."); }
      },
      onError: () => err("Payment couldn't be completed. Please try again or use another method."),
    }).render("#paypal-buttons");
  }).catch(() => { $("#paypal-buttons").innerHTML = `<div class="note">Payments are being set up — checkout opens very soon.</div>`; });
}

function thankYou(params) {
  const n = esc(params.get("order") || "");
  if (params.get("crypto")) return cryptoWait(params.get("order") || "");
  setTimeout(() => showSpinsFor({ order: params.get("order") || "" }, "#tySpins"), 900);
  setTimeout(async () => { try { const t = ((await api("/api/draw/mine", { device: deviceId() })).tickets || []).filter((x) => x.orderId === (params.get("order") || "")); const box = $("#tyEntries");
    if (box && t.length) box.innerHTML = `<div class="dz-tix" style="text-align:left;margin:14px 0"><b>🎟 Your order earned ${t.length} prize-draw entr${t.length > 1 ? "ies" : "y"}!</b>${t.map((x) => `<div class="dz-tk"><code>${esc(x.code)}</code><span>${esc(x.drawTitle)}</span></div>`).join("")}<a href="/#draw" data-link style="text-decoration:underline">See the prize draw ›</a></div>`; } catch {} }, 1200);
  app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><div style="font-size:48px">✅</div><h1>Thank you for your order!</h1><p>Order <b>#${n}</b> is confirmed. Save this number — you can use it on the <a href="/track" data-link style="text-decoration:underline">tracking page</a> with your email. Tracking appears once your order ships (usually within 1–3 business days).</p><div id="tySpins"></div><div id="tyEntries"></div><p class="muted">Once your items arrive, you can rate them from the <a href="/track?order=${n}" data-link style="text-decoration:underline">order page</a> or on each product's page.</p><a class="btn" href="/collections/all" data-link>Continue shopping</a></div>`;
}

/* ---------- Spin & Win: $X+ orders unlock a spin, every spin wins ---------- */
const SPINS = { promos: [], loaded: false };
async function loadSpins(force) { if (SPINS.loaded && !force) return SPINS.promos; try { SPINS.promos = (await api("/api/spins")).promos || []; } catch { SPINS.promos = []; } SPINS.loaded = true; return SPINS.promos; }
async function mySpins(q = {}) { try { return (await api("/api/spins/mine", { device: deviceId(), ...q })).spins || []; } catch { return []; } }
async function renderSpinHome() {
  const [ps, mine] = await Promise.all([loadSpins(), mySpins()]), slot = $("#spinSlot"); if (!slot || !ps.length) return;
  const ready = mine.filter((x) => !x.prizeId);
  // Your title is the headline; any "$200"-style amount in it is highlighted
  const head = (t) => esc(t).replace(/\$\s?\d[\d,]*(\.\d{1,2})?/g, (m) => `<span class="dz-worth">${m}</span>`);
  slot.innerHTML = `<div class="wrap">${ps.map((p) => `<div class="spin-card"><div class="spin-copy"><span class="eyebrow">🎡 Spin & Win · every spin wins</span>
      <h2>${head(p.title)}</h2><p>One order of <b>${money(p.minSpend)}</b> or more unlocks a free spin — every spin wins one of these ${p.prizes.length} prizes, shipped free. Ends ${new Date(p.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.</p>
      ${ready.some((x) => x.promoId === p.id) ? `<button class="btn accent" data-spin-now="${esc(ready.find((x) => x.promoId === p.id).code)}">🎉 You have a spin waiting — spin now</button>` : `<a class="btn accent" href="/collections/all" data-link>Shop now</a>`}</div>
    <div class="spin-prizes" style="--n:${Math.min(4, Math.max(2, Math.ceil(p.prizes.length / 2)))}">${p.prizes.slice(0, 8).map((z) => `<a href="/products/${z.id}" data-link title="${esc(z.title)}">${z.image ? `<img src="${esc(z.image)}" alt="" loading="lazy">` : "<span>🎁</span>"}<small>${money(z.value)}</small></a>`).join("")}</div></div>`).join("")}</div>`;
  slot.querySelectorAll("[data-spin-now]").forEach((b) => (b.onclick = () => spinModal(b.dataset.spinNow, ps.find((p) => p.id === mine.find((x) => x.code === b.dataset.spinNow)?.promoId))));
}
async function showSpinsFor(q, sel) {
  const [ps, list] = await Promise.all([loadSpins(true), mySpins(q)]), box = $(sel); if (!box) return;
  const these = list.filter((x) => x.order === (q.order || "").toUpperCase());
  if (!these.length) return;
  box.innerHTML = these.map((x) => x.prizeId ? `<div class="spin-done">🎁 Your free spin won <b>${esc((PRODUCTS.find((p) => p.id === x.prizeId) || {}).title || "a prize")}</b> — it ships free as order <b>#${esc(x.giftOrder || "")}</b>.</div>`
    : `<div class="spin-ready"><div><b>🎉 Your order unlocked a free spin!</b><span>${esc(x.promo)} — every spin wins a free gift.</span></div><button class="btn accent" data-spin-now="${esc(x.code)}">Spin the wheel</button></div>`).join("");
  box.querySelectorAll("[data-spin-now]").forEach((b) => (b.onclick = () => spinModal(b.dataset.spinNow, ps.find((p) => p.id === these.find((x) => x.code === b.dataset.spinNow)?.promoId), () => showSpinsFor(q, sel))));
}
function spinModal(code, promo, done) {
  const prizes = promo?.prizes || [], m = document.createElement("div"); m.className = "offer-bg";
  m.innerHTML = `<div class="offer dz-modal spin-modal"><button class="offer-x" aria-label="Close">✕</button><span class="offer-eb">${esc(promo?.title || "Spin & Win")}</span><h3>Every spin wins!</h3>
    <div class="spin-wheel">${wheelSVG(prizes)}</div><div id="spRes"></div><button class="btn accent block" id="spGo">🎡 Spin</button></div>`;
  document.body.appendChild(m);
  m.onclick = (e) => { if (e.target === m || e.target.closest(".offer-x")) { m.remove(); renderSpinHome(); done?.(); } };
  $("#spGo", m).onclick = async () => {
    const b = $("#spGo", m); b.disabled = true; b.textContent = "Spinning…";
    let r; try { r = await api("/api/spins/" + encodeURIComponent(code), {}); } catch (e) { $("#spRes", m).innerHTML = `<div class="note err">${esc(e.message)}</div>`; b.remove(); return; }
    const idx = Math.max(0, prizes.findIndex((p) => p.id === r.prizeId)), len = prizes.length || 1, n = len ? Math.max(6, Math.ceil(8 / len) * len) : 8;
    const segs = [...Array(n).keys()].filter((i) => i % len === idx), j = segs[Math.floor(Math.random() * segs.length)] ?? 0;
    const g = m.querySelector(".wheel-rot"); g.style.animation = "none"; g.getBoundingClientRect();
    g.style.transition = "transform 4.6s cubic-bezier(.12,.75,.12,1)"; g.style.transform = `rotate(${360 * 6 - ((j + 0.5) * 360) / n}deg)`;
    setTimeout(() => {
      const z = prizes[idx] || { title: r.title || "your prize" };
      $("#spRes", m).innerHTML = `<div class="spin-win">${z.image ? `<img src="${esc(z.image)}" alt="">` : ""}<div><b>You won ${esc(z.title.slice(0, 70))}!</b><span>${z.value ? `Worth ${money(z.value)} · ` : ""}Ships free to the address on your order. Gift order <b>#${esc(r.giftOrder || "")}</b> — track it like any order.</span></div></div>`;
      b.textContent = "Done"; b.disabled = false; b.onclick = () => { m.remove(); renderSpinHome(); done?.(); }; confetti();
    }, r.already ? 300 : 4700);
  };
}

/* ---------- Prize draw: wheel, free one-tap entry, $1 voucher entry, tickets, results ---------- */
const DRAW = { d: null, timer: null, mine: [], site: "", vapid: "" };
const deviceId = () => { try { let d = localStorage.getItem("lp_device"); if (!d) { d = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""); localStorage.setItem("lp_device", d); } return d; } catch { return ""; } };
const myCodes = () => { try { return JSON.parse(localStorage.getItem("lp_tickets") || "[]"); } catch { return []; } };
const saveCodes = (c) => { try { localStorage.setItem("lp_tickets", JSON.stringify([...new Set([...c, ...myCodes()])].slice(0, 60))); } catch {} };
const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
function countdown(iso) {
  let s = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000)); const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = (n) => String(n).padStart(2, "0");
  return `${d ? `<b>${d}</b>d ` : ""}<b>${p(h)}</b>h <b>${p(m)}</b>m <b>${p(x)}</b>s`;
}
function wheelSVG(prizes) {
  const n = prizes.length ? Math.max(6, Math.ceil(8 / prizes.length) * prizes.length) : 8, R = 150, C = 160, cols = ["#2f8cff", "#8b3dff", "#ff3d6e", "#11a7a0", "#f08a24", "#5468ff"];
  const pt = (a, r) => [C + r * Math.sin(a), C - r * Math.cos(a)];
  let seg = "", img = "", defs = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI, [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), mid = (a0 + a1) / 2, [ix, iy] = pt(mid, R * 0.64);
    seg += `<path d="M${C},${C} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0,1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${cols[i % cols.length]}" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>`;
    const pz = prizes[i % (prizes.length || 1)];
    if (pz && pz.image) { defs += `<clipPath id="wc${i}"><circle cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" r="27"/></clipPath>`;
      img += `<circle cx="${ix.toFixed(1)}" cy="${iy.toFixed(1)}" r="29" fill="#fff"/><image href="${esc(pz.image)}" x="${(ix - 27).toFixed(1)}" y="${(iy - 27).toFixed(1)}" width="54" height="54" clip-path="url(#wc${i})" preserveAspectRatio="xMidYMid slice"/>`; }
    else img += `<text x="${ix.toFixed(1)}" y="${(iy + 8).toFixed(1)}" text-anchor="middle" font-size="26">🎁</text>`;
  }
  for (let i = 0; i < 24; i++) { const [x, y] = pt((i / 24) * 2 * Math.PI, R + 5); img += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${i % 2 ? "#ffd23f" : "#fff"}" class="wl"/>`; }
  return `<div class="wheel-wrap"><div class="wheel-ptr"></div><svg viewBox="0 0 320 320" class="wheel" role="img" aria-label="Prize wheel"><defs>${defs}</defs><circle cx="${C}" cy="${C}" r="${R + 10}" fill="#0a1022" stroke="#ffd23f" stroke-width="3"/>
    <g class="wheel-rot" style="transform-origin:160px 160px">${seg}${img}</g><circle cx="${C}" cy="${C}" r="30" fill="#070b18" stroke="#ffd23f" stroke-width="3"/><text x="${C}" y="${C + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="#fff">LP</text></svg></div>`;
}
async function loadDraw() {
  let r; try { r = await api("/api/draw"); } catch { return; }
  if (!r.draw || !$("#drawSlot")) return;
  Object.assign(DRAW, { d: r.draw, site: r.turnstileSite, vapid: r.vapid });
  await refreshMine(); renderDraw();
}
async function refreshMine() { try { DRAW.mine = (await api("/api/draw/mine", { device: deviceId(), codes: myCodes() })).tickets || []; } catch { DRAW.mine = []; } }
function renderDraw() {
  const d = DRAW.d, slot = $("#drawSlot"); if (!slot || !d) return;
  clearInterval(DRAW.timer);
  const mine = DRAW.mine.filter((t) => t.drawId === d.id), drawn = d.status === "drawn", open = d.status === "live" && new Date(d.drawAt) > Date.now();
  const vName = d.voucherType === "shipping" ? "shipping voucher" : "store voucher";
  const prizes = d.prizes.map((p) => `<a class="dz-prize" href="/products/${p.id}" data-link>${p.image ? `<img src="${esc(p.image)}" alt="">` : "<span>🎁</span>"}<div><b>${esc(p.title.slice(0, 60))}</b><small>Worth ${money(p.value)}</small></div></a>`).join("");
  const won = mine.filter((t) => t.result === "won"), cons = mine.find((t) => t.consolation);
  let body;
  if (drawn) {
    body = `<div class="dz-result">${won.length ? `<div class="dz-win">🎉 <b>Congratulations — your ticket ${esc(won[0].code)} won!</b>${won.some((t) => !t.claimed) ? `<button class="btn accent" data-claim-t="${esc(won.find((t) => !t.claimed).code)}">Claim your prize</button><small>Claim by ${new Date(won[0].claimBy).toLocaleDateString()}</small>` : `<small>Prize claimed ✓ — we'll email you tracking.</small>`}</div>`
        : mine.length ? `<div class="dz-lose"><b>Thanks for joining!</b> Your ticket${mine.length > 1 ? "s" : ""} didn't win this time.${cons ? ` Here's a thank-you voucher: <code>${esc(cons.consolation)}</code> — saved to your vouchers, applied at checkout.` : ""}</div>` : ""}
      <h3>Winners</h3>${d.winners.map((w) => `<div class="dz-wrow"><span>🏆 ${esc(w.prize.slice(0, 50))}</span><code>${esc(w.code)}</code></div>`).join("") || `<p class="muted">No entries were received.</p>`}
      <small class="muted">Drawn ${fmtWhen(d.drawnAt.replace(" ", "T") + "Z")} · <a href="/draw-rules" data-link>Check that the draw was fair</a></small></div>`;
  } else {
    body = `<div class="dz-cd">${open ? `Draw in <span id="dzCd">${countdown(d.drawAt)}</span>` : "Drawing winners…"}<small>${fmtWhen(d.drawAt)}</small></div>
      ${d.progress != null ? `<div class="dz-prog"><div class="row-between"><span>Prize goal</span><b>${d.progress}%</b></div><i><b style="width:${d.progress}%"></b></i></div>` : ""}
      <div class="muted dz-n">${d.entries.toLocaleString()} entr${d.entries === 1 ? "y" : "ies"} so far</div>
      ${d.eligible ? `<div class="dz-btns"><button class="btn accent" id="dzFree" ${open ? "" : "disabled"}>🎟 Enter free</button><button class="btn ghost dz-pay" id="dzPay" ${open ? "" : "disabled"}>${d.voucherValue > d.entryPrice + 0.001 ? `🎟 ${money(d.voucherValue)} voucher for ${money(d.entryPrice)}` : `🎟 ${money(d.entryPrice)} voucher + entry`}<small>+ 1 entry · voucher is yours to keep</small></button></div>`
        : `<div class="note">Sorry — this draw isn't open in your country (${esc(d.country || "unknown")}).</div>`}
      ${d.orderEntryPer && d.eligible ? `<a class="dz-shop" href="/collections/all" data-link>🛍 <span><b>Every ${money(d.orderEntryPer)} you spend = 1 entry</b><small>Added automatically when your order is paid</small></span><i>Shop now ›</i></a>` : ""}
      <p class="dz-fine"><b>No purchase necessary.</b> Free and voucher entries have equal odds of winning. ${d.freePerDay === 1 ? "One free entry" : d.freePerDay + " free entries"} per day per device. Open to: ${esc(d.countries === "ALL" ? "all countries where permitted" : d.countries.split(",").join(", "))}. <a href="/draw-rules" data-link>Official rules</a>${d.permit ? ` · ${esc(d.permit)}` : ""}</p>`;
  }
  const tickets = mine.length ? `<div class="dz-tix"><div class="row-between"><b>Your tickets (${mine.length})</b>${d.notify && DRAW.vapid && "PushManager" in window && !drawn && (window.Notification?.permission !== "granted") ? `<button class="btn sm ghost" id="dzBell">🔔 Notify me of the result</button>` : ""}</div>
    ${mine.slice(0, 6).map((t) => `<div class="dz-tk"><code>${esc(t.code)}</code><span>${t.kind === "paid" ? `with ${vName}${t.voucher ? ` <code>${esc(t.voucher)}</code>` : ""}` : t.kind === "order" ? "from your order" : "free entry"}</span><button class="dz-copy" data-copy="${esc(t.code)}" title="Copy">⧉</button></div>`).join("")}
    ${mine.length > 6 ? `<small class="muted">+${mine.length - 6} more</small>` : ""}<small class="muted">Tickets are saved in this browser. Keep a copy of your ticket number in case you switch devices.</small></div>` : "";
  const top = [...d.prizes].sort((a, b) => b.value - a.value)[0], worth = d.prizes.reduce((t, p) => t + p.value, 0);
  const headline = drawn ? esc(d.title) : d.prizes.length > 1 ? `Win prizes worth <span class="dz-worth">${money(worth)}</span>` : `Win a <span class="dz-worth">${money(top?.value || 0)}</span> prize`;
  const deal = d.voucherValue > d.entryPrice + 0.001;
  const pitch = drawn ? "" : `<p class="dz-pitch">Enter free in one tap — or grab a <b>${money(d.voucherValue)} ${vName}${deal ? ` for just ${money(d.entryPrice)}` : ""}</b> that's <b>yours to keep, win or not</b>, with an entry included.${d.orderEntryPer ? ` Plus, <b>every ${money(d.orderEntryPer)} you spend = 1 entry</b>.` : ""}</p>`;
  slot.innerHTML = `<div class="az-spot-copy dz"><span class="eyebrow">🎡 ${drawn ? "LeeysPremium prize draw" : esc(d.title)}</span><h2>${headline}</h2>${pitch}<div class="dz-prizes">${prizes}</div>${body}${tickets}</div>
    <div class="dz-wheel">${wheelSVG(d.prizes)}${drawn && !sessionStorage.getItem("lp_spun_" + d.id) ? `<button class="btn accent dz-spin" id="dzSpin">Spin to reveal the winners</button>` : ""}</div>`;
  if (open && $("#dzCd")) DRAW.timer = setInterval(() => { const c = $("#dzCd"); if (!c) return clearInterval(DRAW.timer); if (new Date(d.drawAt) <= Date.now()) { clearInterval(DRAW.timer); setTimeout(loadDraw, 4000); } c.innerHTML = countdown(d.drawAt); }, 1000);
  $("#dzFree") && ($("#dzFree").onclick = freeEntry);
  $("#dzPay") && ($("#dzPay").onclick = payEntry);
  $("#dzBell") && ($("#dzBell").onclick = enablePush);
  slot.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => navigator.clipboard?.writeText(b.dataset.copy).then(() => toast("Ticket number copied")).catch(() => {})));
  slot.querySelectorAll("[data-claim-t]").forEach((b) => (b.onclick = () => claimModal(b.dataset.claimT)));
  if ($("#dzSpin")) { const res = slot.querySelector(".dz-result"); res.classList.add("dz-hidden");
    $("#dzSpin").onclick = () => { const w = slot.querySelector(".wheel-rot"); w.classList.add("spinning"); $("#dzSpin").disabled = true;
      setTimeout(() => { sessionStorage.setItem("lp_spun_" + d.id, "1"); res.classList.remove("dz-hidden"); $("#dzSpin")?.remove(); confetti(); }, 4200); }; }
  const vs = mine.map((t) => t.consolation || t.voucher).filter(Boolean); if (vs.length) saveWallet([...wallet(), ...vs]);
}
function confetti() {
  const box = document.createElement("div"); box.className = "confetti";
  box.innerHTML = Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${["#ffd23f", "#2f8cff", "#ff3d6e", "#49d79a", "#8b3dff"][i % 5]};animation-delay:${Math.random() * 0.6}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join("");
  document.body.appendChild(box); setTimeout(() => box.remove(), 3500);
}
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function freeEntry() {
  const d = DRAW.d, m = document.createElement("div"); m.className = "offer-bg";
  m.innerHTML = `<div class="offer dz-modal"><button class="offer-x" aria-label="Close">✕</button><div class="offer-burst">🎟</div><h3>Free entry</h3>
    <p>One tap — no email, no purchase. Your ticket is saved in this browser.</p><div id="tsBox" style="display:flex;justify-content:center;min-height:${DRAW.site ? 70 : 0}px"></div>
    <div id="feErr" class="note err" hidden></div><button class="btn accent block" id="feGo">Get my free ticket</button>
    <p class="dz-fine">By entering you agree to the <a href="/draw-rules" data-link>official rules</a>.</p></div>`;
  document.body.appendChild(m);
  m.onclick = (e) => { if (e.target === m || e.target.closest(".offer-x,[data-link]")) m.remove(); };
  let token = "";
  if (DRAW.site) { try { await loadTurnstile(); window.turnstile.render("#tsBox", { sitekey: DRAW.site, theme: "dark", callback: (t) => (token = t) }); } catch {} }
  $("#feGo", m).onclick = async () => {
    const err = $("#feErr", m); err.hidden = true;
    if (DRAW.site && !token) { err.textContent = "Please complete the quick human check above."; err.hidden = false; return; }
    $("#feGo", m).disabled = true;
    try {
      const r = await api(`/api/draw/${d.id}/free`, { device: deviceId(), turnstile: token });
      saveCodes([r.ticket.code]);
      m.querySelector(".dz-modal").innerHTML = `<div class="offer-burst">🎉</div><span class="offer-eb">You're in!</span><div class="dz-code">${esc(r.ticket.code)}</div>
        <p>Your ticket number. Winners are drawn ${fmtWhen(d.drawAt)}.</p>${d.notify && DRAW.vapid && "PushManager" in window ? `<button class="btn accent block" id="feBell">🔔 Notify me of the result</button>` : ""}<button class="btn ghost block" id="feOk">Done</button>`;
      $("#feOk", m).onclick = () => m.remove(); $("#feBell", m) && ($("#feBell", m).onclick = async () => { await enablePush(); m.remove(); });
      d.entries++; await refreshMine(); renderDraw();
    } catch (e) { err.textContent = e.message; err.hidden = false; $("#feGo", m).disabled = false; if (DRAW.site && window.turnstile) window.turnstile.reset("#tsBox"); token = ""; }
  };
}
function payEntry() {
  const d = DRAW.d, vName = d.voucherType === "shipping" ? "shipping voucher" : "store voucher", m = document.createElement("div"); m.className = "offer-bg";
  const top = [...d.prizes].sort((a, b) => b.value - a.value)[0], total = d.prizes.reduce((t, p) => t + p.value, 0);
  m.innerHTML = `<div class="offer dz-modal"><button class="offer-x" aria-label="Close">✕</button>
    ${top?.image ? `<img class="pe-img" src="${esc(top.image)}" alt="">` : `<div class="offer-burst">🎁</div>`}
    <span class="offer-eb">Get a ${money(d.voucherValue)} ${vName}${d.voucherValue > d.entryPrice + 0.001 ? ` for ${money(d.entryPrice)}` : ""}</span>
    <h3 class="pe-h">…and a chance to win ${d.prizes.length > 1 ? `prizes worth <b>${money(total)}</b>` : `a <b>${money(top?.value || 0)}</b> prize`}</h3>
    <ul class="pe-list"><li><b>Your ${money(d.voucherValue)} ${vName} is yours to keep</b> — win or not. Use it on any order within 180 days.${d.voucherValue > d.entryPrice + 0.001 ? ` That's ${money(d.voucherValue - d.entryPrice)} of value for free.` : ""}</li>
      <li>Each voucher includes <b>1 entry</b> to win ${top ? esc(top.title.slice(0, 48)) + (d.prizes.length > 1 ? ` + ${d.prizes.length - 1} more prize${d.prizes.length > 2 ? "s" : ""}` : "") : "the prize"}.</li>
      <li>Winners drawn ${fmtWhen(d.drawAt)}.</li></ul>
    <div class="dz-qty"><button data-q="-1">−</button><span id="pq">1</span><button data-q="1">+</button></div><div class="muted" id="pTot" style="margin:-4px 0 10px">${money(d.entryPrice)} · 1 voucher + 1 entry</div>
    <div id="dzPP"></div><div id="peErr" class="note err" hidden></div><p class="dz-fine">No purchase necessary — <a href="#" id="peFree">enter free instead</a>. Free and voucher entries have equal odds. <a href="/draw-rules" data-link>Rules</a></p></div>`;
  document.body.appendChild(m);
  let q = 1; const close = () => m.remove();
  m.onclick = (e) => { if (e.target === m || e.target.closest(".offer-x,[data-link]")) close(); };
  $("#peFree", m).onclick = (e) => { e.preventDefault(); close(); freeEntry(); };
  m.querySelectorAll("[data-q]").forEach((b) => (b.onclick = () => { q = Math.min(5, Math.max(1, q + Number(b.dataset.q))); $("#pq", m).textContent = q; $("#pTot", m).textContent = `${money(d.entryPrice * q)} · ${q} voucher${q > 1 ? "s" : ""} + ${q} entr${q > 1 ? "ies" : "y"}`; }));
  const err = (t) => { $("#peErr", m).textContent = t; $("#peErr", m).hidden = false; };
  loadPaypal().then(() => window.paypal.Buttons({
    style: { layout: "vertical", shape: "pill", height: 44 },
    createOrder: async () => (await api(`/api/draw/${d.id}/pay`, { device: deviceId(), qty: q }).catch((e) => { err(e.message); throw e; })).paypalOrderId,
    onApprove: async (data) => {
      try {
        const r = await api("/api/draw/pay/capture", { paypalOrderId: data.orderID });
        saveCodes(r.tickets.map((t) => t.code)); saveWallet([...wallet(), ...r.tickets.map((t) => t.voucher).filter(Boolean)]);
        m.querySelector(".dz-modal").innerHTML = `<div class="offer-burst">🎉</div><span class="offer-eb">You're in — ${r.tickets.length} entr${r.tickets.length > 1 ? "ies" : "y"}</span>
          ${r.tickets.map((t) => `<div class="dz-code sm">${esc(t.code)}</div>`).join("")}<p>Your ${vName}${r.tickets.length > 1 ? "s are" : " is"} saved and applied automatically at checkout.</p>
          ${d.notify && DRAW.vapid && "PushManager" in window ? `<button class="btn accent block" id="peBell">🔔 Notify me of the result</button>` : ""}<button class="btn ghost block" id="peOk">Done</button>`;
        $("#peOk", m).onclick = close; $("#peBell", m) && ($("#peBell", m).onclick = async () => { await enablePush(); close(); });
        d.entries += r.tickets.length; await refreshMine(); renderDraw();
      } catch (e) { err(e.message + " You have not been charged."); }
    },
    onError: () => err("Payment couldn't be completed. Please try again."),
  }).render("#dzPP")).catch(() => { $("#dzPP", m).innerHTML = `<div class="note">Payments are being set up — try the free entry for now.</div>`; });
}
async function enablePush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return toast("Notifications aren't supported in this browser. On iPhone, install the app first (Share → Add to Home Screen).");
    if ((await Notification.requestPermission()) !== "granted") return toast("Notifications are blocked — you can still check back here anytime.");
    const reg = await navigator.serviceWorker.ready, key = Uint8Array.from(atob(DRAW.vapid.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((DRAW.vapid.length + 3) % 4)), (c) => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    await api("/api/push/subscribe", { device: deviceId(), sub: sub.toJSON() });
    toast("🔔 We'll notify you when the winners are drawn"); renderDraw();
  } catch (e) { toast("Couldn't turn on notifications: " + e.message); }
}
function claimModal(code) {
  const m = document.createElement("div"); m.className = "offer-bg";
  m.innerHTML = `<form class="offer rev-form" novalidate><button type="button" class="offer-x" aria-label="Close">✕</button><h3>🏆 Claim your prize</h3><p class="muted" style="margin:0">Ticket <b>${esc(code)}</b> — tell us where to ship it (free shipping).</p>
    <input class="inp" name="name" placeholder="Full name" autocomplete="name"><input class="inp" name="email" type="email" placeholder="Email (for shipping updates)" autocomplete="email"><input class="inp" name="phone" placeholder="Phone (optional)" autocomplete="tel">
    <select class="inp" name="country">${COUNTRY_OPTS()}</select><input class="inp" name="address1" placeholder="Street address" autocomplete="address-line1"><input class="inp" name="address2" placeholder="Apartment, unit (optional)" autocomplete="address-line2">
    <div class="two"><input class="inp" name="city" placeholder="City" autocomplete="address-level2"><input class="inp" name="province" placeholder="State / Province" autocomplete="address-level1"></div><input class="inp" name="zip" placeholder="ZIP / Postal code" autocomplete="postal-code">
    <div id="clErr" class="note err" hidden></div><button class="btn accent block">Submit claim</button></form>`;
  document.body.appendChild(m);
  const f = m.querySelector("form"); f.country.value = CONFIG.country || "US";
  m.onclick = (e) => { if (e.target === m || e.target.closest(".offer-x")) m.remove(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/draw/claim", { code, email: f.email.value, phone: f.phone.value, address: { name: f.name.value, address1: f.address1.value, address2: f.address2.value, city: f.city.value, province: f.province.value, zip: f.zip.value, country: f.country.value } });
      m.remove(); toast("🎉 Claim received! We'll email you when your prize ships."); await refreshMine(); renderDraw(); }
    catch (er) { $("#clErr", m).textContent = er.message; $("#clErr", m).hidden = false; }
  };
}
async function drawRules() {
  document.title = "Prize draw — official rules — LeeysPremium";
  app.innerHTML = `<div class="wrap prose"><h1>Prize draw — official rules</h1><p class="muted">Loading…</p></div>`;
  let r; try { r = await api("/api/draw"); } catch { r = {}; }
  const d = r.draw, box = $(".prose"); if (!box) return;
  if (!d) { box.innerHTML = `<h1>Prize draw — official rules</h1><p>There's no prize draw running right now. Check back soon!</p>`; return; }
  const vName = d.voucherType === "shipping" ? "shipping voucher" : "store voucher", where = d.countries === "ALL" ? "all countries and territories where this promotion is permitted by law" : d.countries.split(",").map((c) => CONFIG.countries[c] || c).join(", ");
  box.innerHTML = `<h1>${esc(d.title)} — official rules</h1>
    <p><b>NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE DOES NOT INCREASE YOUR ODDS OF WINNING PER ENTRY. VOID WHERE PROHIBITED.</b></p>
    <h3>1. Sponsor</h3><p>LeeysPremium (leeyspremium.com), a Leeys Technology store.${d.permit ? ` ${esc(d.permit)}.` : ""}</p>
    <h3>2. Who can enter</h3><p>Open to individuals who have reached the age of majority where they live and are residents of: ${esc(where)}. Entries from other places are not accepted.</p>
    <h3>3. Entry period and draw date</h3><p>Entries are accepted until <b>${fmtWhen(d.drawAt)}</b>. Winners are drawn at that time, whatever the number of entries. The "prize goal" progress bar is for information only and does not change the draw date.</p>
    <h3>4. How to enter</h3><ul><li><b>Free entry:</b> tap "Enter free" on the homepage. Limit ${d.freePerDay} free entr${d.freePerDay === 1 ? "y" : "ies"} per person/device per day.</li>
      <li><b>With a voucher:</b> buy a ${money(d.voucherValue)} ${vName} for ${money(d.entryPrice)} (valid 180 days on future orders); each voucher includes one entry.</li>
      ${d.orderEntryPer ? `<li><b>With an order:</b> each ${money(d.orderEntryPer)} of products in a paid order (after discounts, before shipping) earns one entry, up to 20 per order, during the entry period.</li>` : ""}
      <li>Free entries and voucher entries are treated exactly the same in the draw. Automated or bulk entries are void.</li></ul>
    <h3>5. Prizes</h3><ul>${d.prizes.map((p) => `<li>${esc(p.title)} — approximate retail value ${money(p.value)}, shipped free to the winner.</li>`).join("")}</ul><p>One prize per winning ticket. Prizes can't be exchanged for cash. Odds depend on the number of entries received.</p>
    <h3>6. How winners are chosen</h3><p>Winners are picked at random by computer, one per prize, from all valid tickets. To make the draw verifiable, the SHA-256 fingerprint of a secret random seed is published before the draw:<br><code style="word-break:break-all">${esc(d.seedHash)}</code><br>
      After the draw, the seed and the full list of ticket numbers are published. For prize <i>i</i> (starting at 0), the winning position is SHA-256("seed:i:attempt") as a number, modulo the number of tickets; "attempt" starts at 0 and increases only if that ticket already won.</p>
    ${d.seed ? `<p><b>Seed:</b> <code style="word-break:break-all">${esc(d.seed)}</code> · <a href="/api/draw/${d.id}/tickets.txt" target="_blank" rel="noopener">Ticket list (in draw order)</a></p>` : ""}
    <h3>7. Winner notification and claiming</h3><p>Results appear on the homepage for everyone who entered on that device, and as a browser notification for those who turned notifications on. Winning ticket numbers are listed publicly. A winner must claim within ${d.claimDays} days of the draw by entering shipping details; unclaimed prizes are forfeited.</p>
    ${d.consolation ? `<h3>8. Thank-you vouchers</h3><p>Each device with a non-winning ticket receives one ${money(d.consolation.amount)} voucher${d.consolation.min ? ` for orders over ${money(d.consolation.min)}` : ""}, valid ${d.consolation.days} days. Vouchers have no cash value and can't be combined with another voucher of the same type.</p>` : ""}
    <h3>${d.consolation ? 9 : 8}. General</h3><p>The sponsor guarantees the prizes. The sponsor may cancel or modify the promotion if fraud or technical problems affect its fairness, and may disqualify anyone tampering with the entry process. This promotion is not sponsored by or associated with PayPal or any payment provider. Questions: support@leeyspremium.com.</p>`;
}

/* ---------- Verified-buyer reviews ---------- */
const starIcons = (r) => `<i class="stars-i" style="--r:${(Math.max(0, Math.min(5, r)) / 5) * 100}%" aria-label="${r.toFixed(1)} out of 5 stars">★★★★★</i>`;
document.addEventListener("click", (e) => { const j = e.target.closest("[data-jump]"); if (!j) return; e.preventDefault(); document.getElementById(j.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
const myOrders = () => { try { return JSON.parse(localStorage.getItem("lp_orders") || "[]"); } catch { return []; } };
function rememberOrder(id, email) { try { const o = myOrders().filter((x) => x.id !== id); o.unshift({ id, email: String(email).trim().toLowerCase() }); localStorage.setItem("lp_orders", JSON.stringify(o.slice(0, 20))); } catch {} }
async function loadReviews(p) {
  const box = $("#revBox"); if (!box) return;
  let d; try { d = await api("/api/reviews?product=" + encodeURIComponent(p.id)); } catch { d = { count: 0, list: [], hist: [0, 0, 0, 0, 0], avg: 0 }; }
  if (!$("#revBox")) return;
  box.innerHTML = `<div class="rev-sum">${d.count ? `<div class="rev-avg"><b>${d.avg.toFixed(1)}</b>${starIcons(d.avg)}<span>${d.count} verified review${d.count === 1 ? "" : "s"}</span></div>
      <div class="rev-hist">${d.hist.map((n, i) => `<div><span>${5 - i} star</span><i><b style="width:${d.count ? (n / d.count) * 100 : 0}%"></b></i><span>${d.count ? Math.round((n / d.count) * 100) : 0}%</span></div>`).join("")}</div>`
      : `<div class="rev-empty"><b>No reviews yet</b><span>Reviews here come only from verified buyers of this product.</span></div>`}
      <div class="rev-cta"><b>Bought this product?</b><span>Share your thoughts with other customers.</span><button class="btn accent" id="revWrite">★ Write a review</button></div></div>
    <div class="rev-list">${d.list.map((r) => `<div class="rev-item"><div class="rev-who"><span class="rev-av">${esc((r.name || "C")[0].toUpperCase())}</span><b>${esc(r.name || "Customer")}</b></div>
      <div class="rev-line">${starIcons(r.rating)} <span class="rev-ver">✔ Verified purchase</span></div>
      <div class="muted rev-meta">Reviewed ${new Date(r.created_at.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}${r.variant ? " · " + esc(r.variant) : ""}</div>
      ${r.body ? `<p>${esc(r.body)}</p>` : ""}</div>`).join("")}</div>`;
  $("#revWrite").onclick = () => reviewModal(p);
}
function reviewModal(p, preset = {}) {
  const known = preset.order ? preset : myOrders()[0] || {};
  const m = document.createElement("div"); m.className = "offer-bg";
  m.innerHTML = `<form class="offer rev-form" novalidate><button type="button" class="offer-x" aria-label="Close">✕</button>
    <h3>Rate this product</h3><p class="muted" style="margin:0 0 12px">${esc(p.title)}</p>
    <div class="rev-pick" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}</div><div class="muted" id="rpTxt" style="height:18px;font-size:13px"></div>
    <textarea class="inp" name="body" rows="4" maxlength="2000" placeholder="What did you like or dislike? How was the quality and delivery? (optional)"></textarea>
    <input class="inp" name="name" maxlength="40" placeholder="Name to show (optional — default: first name + initial)">
    <div class="rev-verify ${preset.order ? "hide" : ""}"><span class="muted" style="font-size:12px">Only verified buyers can review. Enter the order number and email from your purchase.</span>
      <input class="inp" name="order" placeholder="Order number, e.g. LP7K2QX9A1B" value="${esc(known.order || known.id || "")}"><input class="inp" name="email" type="email" placeholder="Email used at checkout" value="${esc(known.email || "")}"></div>
    <div id="rvErr" class="note err" hidden></div><button class="btn accent block">Submit review</button></form>`;
  document.body.appendChild(m);
  let rating = preset.rating || 0; const f = m.querySelector("form"), words = ["", "Hated it", "Didn't like it", "It's OK", "Liked it", "Loved it"];
  if (preset.body) f.body.value = preset.body;
  const paint = (n) => { m.querySelectorAll("[data-star]").forEach((b) => b.classList.toggle("on", Number(b.dataset.star) <= n)); $("#rpTxt", m).textContent = words[n] || ""; };
  m.querySelectorAll("[data-star]").forEach((b) => { b.onclick = () => { rating = Number(b.dataset.star); paint(rating); }; b.onmouseenter = () => paint(Number(b.dataset.star)); b.onmouseleave = () => paint(rating); });
  paint(rating);
  m.onclick = (e) => { if (e.target === m || e.target.closest(".offer-x")) m.remove(); };
  f.onsubmit = async (e) => {
    e.preventDefault(); const err = $("#rvErr", m); err.hidden = true;
    if (!rating) { err.textContent = "Please choose 1 to 5 stars."; err.hidden = false; return; }
    try {
      await api("/api/reviews", { order: f.order.value, email: f.email.value, product: p.id, rating, body: f.body.value, name: f.name.value });
      rememberOrder(f.order.value.trim().toUpperCase().replace(/^#/, ""), f.email.value);
      m.remove(); toast("Thank you! Your review is live."); p.reviews = p.reviews || 0; if ($("#revBox")) loadReviews(p); if (preset.done) preset.done();
    } catch (er) { err.textContent = er.message; err.hidden = false; if (/order/i.test(er.message)) m.querySelector(".rev-verify").classList.remove("hide"); }
  };
}

// After paying on the crypto page: wait for the blockchain confirmation, then show the normal thank-you
function cryptoWait(id) {
  const n = esc(id);
  app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><div style="font-size:48px">⏳</div><h1>Confirming your crypto payment…</h1>
    <p>Order <b>#${n}</b>. Crypto payments are confirmed by the blockchain — usually within a few minutes (Bitcoin can take up to an hour). You can safely leave this page; we'll email your receipt, and the <a href="/track?order=${n}" data-link style="text-decoration:underline">order page</a> updates once it's confirmed.</p>
    <p class="muted" id="cwStatus">Checking…</p><a class="btn ghost" href="/collections/all" data-link>Continue shopping</a></div>`;
  const labels = { waiting: "Waiting for your payment to arrive…", confirming: "Payment seen — waiting for blockchain confirmations…", confirmed: "Confirmed — finishing up…", sending: "Confirmed — finishing up…", partially_paid: "We received less than the full amount. Please contact support@leeyspremium.com with your order number.", failed: "The payment failed. You haven't been charged — please try again.", expired: "This payment expired. Please place the order again." };
  const tick = async () => {
    if (location.pathname !== "/thank-you") return;
    try {
      const s = await api("/api/orders/status?id=" + encodeURIComponent(id));
      if (s.status !== "pending") {
        try { const p = JSON.parse(sessionStorage.getItem("lp_crypto") || "null"); if (p && p.id === id) { if (p.cart) { cart.items = []; cart.save(); } else sessionStorage.removeItem("lp_buynow"); sessionStorage.removeItem("lp_crypto"); } } catch {}
        trk("buy"); return go("/thank-you?order=" + encodeURIComponent(id), true);
      }
      if ($("#cwStatus")) $("#cwStatus").textContent = labels[s.crypto] || labels.waiting;
    } catch {}
    setTimeout(tick, 8000);
  };
  tick();
}

const STATUS_TEXT = { paid: "Payment received", processing: "Preparing your order", action_needed: "Preparing your order", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded" };
function track(params) {
  document.title = "Track your order — LeeysPremium";
  app.innerHTML = `<div class="wrap prose"><h1>Track your order</h1><p>Enter the order number from your confirmation and the email you used at checkout.</p>
    <form class="card-box" id="tForm"><div class="field"><input name="id" required placeholder="Order number, e.g. LP7K2QX9A1B" value="${esc(params.get("order") || "")}"></div><div class="field"><input name="email" type="email" required placeholder="Email used at checkout" value="${esc((myOrders().find((x) => x.id === (params.get("order") || "").toUpperCase()) || {}).email || "")}"></div><button class="btn block">Track</button></form><div id="tOut"></div></div>`;
  $("#tForm").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, out = $("#tOut");
    try {
      const o = await api(`/api/orders/lookup?id=${encodeURIComponent(f.id.value)}&email=${encodeURIComponent(f.email.value)}`);
      const steps = ["paid", "processing", "shipped", "delivered"], cur = Math.max(0, steps.indexOf(o.status === "action_needed" ? "processing" : o.status));
      out.innerHTML = `<div class="card-box" style="margin-top:18px;max-width:none"><div class="row-between"><b>Order #${esc(o.id)}</b><span class="eyebrow" style="margin:0">${esc(STATUS_TEXT[o.status] || o.status)}</span></div>
        <div class="bar" style="margin:14px 0 6px"><i style="width:${((cur + 1) / steps.length) * 100}%"></i></div>
        <div class="row-between muted" style="font-size:12px">${steps.map((s) => `<span>${STATUS_TEXT[s]}</span>`).join("")}</div>
        ${o.tracking_number ? `<p style="margin-top:16px">Tracking number: <b>${esc(o.tracking_number)}</b>${o.tracking_carrier ? ` (${esc(o.tracking_carrier)})` : ""}<br><a style="text-decoration:underline" target="_blank" rel="noopener" href="https://t.17track.net/en#nums=${encodeURIComponent(o.tracking_number)}">Follow your package →</a></p>` : `<p class="muted" style="margin-top:16px">Your tracking number will appear here once the order ships.</p>`}
        ${o.items.map((l, i) => { const rv = (o.reviews || []).find((r) => r.product_id === l.id), live = PRODUCTS.find((x) => x.id === l.id);
          return `<div class="row-between" style="font-size:14px;padding:8px 0;border-top:1px solid var(--line);gap:10px;flex-wrap:wrap"><span style="flex:1;min-width:180px">${l.qty} × ${esc(l.title)}${l.variant ? " · " + esc(l.variant) : ""}</span>
            ${o.canReview && live && !l.gift ? (rv ? `<button class="btn sm ghost" data-rate-i="${i}">${starIcons(rv.rating)} Edit review</button>` : `<button class="btn sm accent" data-rate-i="${i}">★ Rate this product</button>`) : ""}<span>${money(l.price * l.qty)}</span></div>`; }).join("")}
        <div class="row-between" style="font-weight:700;padding-top:8px"><span>Total</span><span>${money(o.total)}</span></div></div>`;
      rememberOrder(o.id, f.email.value);
      out.insertAdjacentHTML("afterbegin", `<div id="trSpins"></div>`); showSpinsFor({ order: o.id, email: f.email.value }, "#trSpins");
      out.querySelectorAll("[data-rate-i]").forEach((b) => (b.onclick = () => { const l = o.items[Number(b.dataset.rateI)], rv = (o.reviews || []).find((r) => r.product_id === l.id);
        reviewModal(PRODUCTS.find((x) => x.id === l.id), { order: o.id, email: f.email.value, rating: rv?.rating, body: rv?.body, done: () => f.requestSubmit() }); }));
    } catch (er) { out.innerHTML = `<p class="note err">${esc(er.message)}</p>`; }
  };
}

/* ---------- Me: everything saved on this device (no passwords; payment details are never stored) ---------- */
async function account() {
  document.title = "Me — LeeysPremium";
  let addr = {}; try { addr = JSON.parse(localStorage.getItem("lp_addr") || "{}") || {}; } catch {}
  const orders = myOrders(), codes = myCodes(), vs = [...new Set([...wallet(), offerCode()].filter(Boolean))];
  const name = [addr.firstName, addr.lastName].filter(Boolean).join(" ");
  app.innerHTML = `<div class="wrap me">
    <div class="me-head"><div class="me-av">${esc((addr.firstName || "L")[0].toUpperCase())}</div><div><h1>${name ? `Hi, ${esc(addr.firstName)}` : "My LeeysPremium"}</h1><span class="muted">${addr.email ? esc(addr.email) : "Saved on this device · no password needed"}</span></div></div>
    <div class="me-grid">
      <a class="me-tile" href="#meOrders"><b>${orders.length}</b><span>Orders</span></a><a class="me-tile" href="#meVouchers"><b>${vs.length}</b><span>Vouchers</span></a>
      <a class="me-tile" href="/promo" data-link><b>${codes.length}</b><span>Draw tickets</span></a><a class="me-tile" href="/notifications" data-link><b>🔔</b><span>Notifications</span></a></div>
    <section class="me-card" id="meAddr"><div class="row-between"><h2>📍 Shipping address & contact</h2><button class="btn sm ghost" id="meEdit">${addr.address1 ? "Edit" : "Add"}</button></div>
      <div id="meAddrView">${addr.address1 ? `<p><b>${esc(name)}</b><br>${esc(addr.address1)}${addr.address2 ? ", " + esc(addr.address2) : ""}<br>${esc([addr.city, addr.province, addr.zip].filter(Boolean).join(", "))}<br>${esc(CONFIG.countries[addr.country] || addr.country || "")}${addr.phone ? `<br>📞 ${esc(addr.phone)}` : ""}${addr.email ? `<br>✉️ ${esc(addr.email)}` : ""}</p><p class="muted" style="font-size:13px">Filled in automatically at checkout.</p>` : `<p class="muted">No address saved yet. Add one to check out faster.</p>`}</div>
      <form id="meForm" hidden class="me-form"><input class="inp" name="email" type="email" placeholder="Email" value="${esc(addr.email || "")}"><div class="two"><input class="inp" name="firstName" placeholder="First name" value="${esc(addr.firstName || "")}"><input class="inp" name="lastName" placeholder="Last name" value="${esc(addr.lastName || "")}"></div>
        <select class="inp" name="country">${COUNTRY_OPTS()}</select><input class="inp" name="address1" placeholder="Street address" value="${esc(addr.address1 || "")}"><input class="inp" name="address2" placeholder="Apartment, unit (optional)" value="${esc(addr.address2 || "")}">
        <div class="two"><input class="inp" name="city" placeholder="City" value="${esc(addr.city || "")}"><input class="inp" name="province" placeholder="State / Province" value="${esc(addr.province || "")}"></div>
        <div class="two"><input class="inp" name="zip" placeholder="ZIP / Postal code" value="${esc(addr.zip || "")}"><input class="inp" name="phone" placeholder="Phone" value="${esc(addr.phone || "")}"></div>
        <div class="flex" style="gap:8px"><button class="btn accent">Save</button><button type="button" class="btn ghost" id="meCancel">Cancel</button></div></form></section>
    <section class="me-card"><h2>💳 Payment methods</h2><div class="pay-icons"><span>PayPal</span><span>Visa / Mastercard</span><span>Venmo</span><span>Pay Later</span>${CONFIG.crypto ? "<span>₿ Bitcoin · ETH · USDT</span>" : ""}</div>
      <p class="muted" style="font-size:13px;margin-bottom:0">For your safety we never store card or bank details. You pay securely each time through PayPal (cards, bank, Venmo) or our crypto checkout.</p></section>
    <section class="me-card" id="meOrders"><h2>📦 My orders</h2>${orders.length ? `<div id="meOrderList" class="muted">Loading…</div>` : `<p class="muted">Orders you place on this device appear here. Have an order from another device? <a href="/track" data-link style="text-decoration:underline">Track it here</a>.</p>`}</section>
    <section class="me-card" id="meVouchers"><h2>🎟 My vouchers</h2>${vs.length ? `<div class="me-vs">${vs.map((c) => `<code>${esc(c)}</code>`).join("")}</div><p class="muted" style="font-size:13px">Applied automatically at checkout when they fit your order.</p>` : `<p class="muted">No vouchers yet. <a href="/promo" data-link style="text-decoration:underline">See today's promos</a>.</p>`}</section>
    <section class="me-card"><h2>⚙️ Settings & help</h2><div class="me-links">${"PushManager" in window ? `<button class="me-link" id="mePush">🔔 Notifications on this device</button>` : ""}<a class="me-link" href="/track" data-link>🚚 Track an order</a><a class="me-link" href="/pages/returns" data-link>↩️ Returns & refunds</a><a class="me-link" href="/pages/contact" data-link>💬 Contact us</a><a class="me-link" href="/pages/privacy" data-link>🔒 Privacy</a><button class="me-link danger" id="meClear">🗑 Remove my saved details from this device</button></div></section></div>`;
  const f = $("#meForm"); f.country.value = addr.country || CONFIG.country || "US";
  $("#meEdit").onclick = () => { f.hidden = false; $("#meAddrView").hidden = true; }; $("#meCancel").onclick = () => { f.hidden = true; $("#meAddrView").hidden = false; };
  f.onsubmit = (e) => { e.preventDefault(); const a = Object.fromEntries(["email", "firstName", "lastName", "country", "address1", "address2", "city", "province", "zip", "phone"].map((k) => [k, f[k].value.trim()])); try { localStorage.setItem("lp_addr", JSON.stringify(a)); } catch {} toast("Saved"); account(); };
  $("#meClear").onclick = () => { if (!confirm("Remove your saved address, order list, vouchers and tickets from this device? (Your orders themselves aren't affected.)")) return; ["lp_addr", "lp_orders", "lp_vouchers", "lp_voucher", "lp_tickets"].forEach((k) => { try { localStorage.removeItem(k); } catch {} }); toast("Removed from this device"); account(); };
  $("#mePush") && ($("#mePush").onclick = async () => { if (!DRAW.vapid) { try { const r = await api("/api/draw"); DRAW.vapid = r.vapid; } catch {} } if (!DRAW.vapid) return toast("Notifications switch on automatically during our next prize draw"); enablePush(); });
  if (orders.length) {
    const rows = await Promise.all(orders.slice(0, 10).map(async (o) => { try { return await api(`/api/orders/lookup?id=${encodeURIComponent(o.id)}&email=${encodeURIComponent(o.email)}`); } catch { return null; } }));
    const box = $("#meOrderList"); if (!box) return;
    box.innerHTML = rows.filter(Boolean).map((o) => `<a class="me-order" href="/track?order=${esc(o.id)}" data-link><div><b>#${esc(o.id)}</b><span>${new Date(o.created_at.replace(" ", "T") + "Z").toLocaleDateString()} · ${o.items.length} item${o.items.length > 1 ? "s" : ""} · ${money(o.total)}</span></div><em class="st st-${esc(o.status)}">${esc(STATUS_TEXT[o.status] || o.status)}</em></a>`).join("") || `<p class="muted">Couldn't load your orders right now.</p>`;
  }
}

/* ---------- Promo: every promotion in one place ---------- */
async function promoPage() {
  document.title = "Promo — LeeysPremium";
  const sale = PRODUCTS.filter((p) => p.promo).sort((a, b) => b.promo.percent - a.promo.percent);
  const promos = (PROMO.promos || []);
  app.innerHTML = `<div class="promo-page"><div class="wrap"><h1 class="pp-h">🔥 Promo</h1><p class="muted" style="margin:0 0 6px">Every deal, voucher, prize draw and free spin — all in one place.</p></div>
    ${promos.length ? `<section class="wrap pp-sales">${promos.map((x) => `<a class="pp-sale" href="${x.scope === "collection" ? "/collections/" + x.target : "/collections/all?deal=today"}" data-link><b>⚡ ${esc(x.label)}</b><span>${x.percent}% off${x.scope === "collection" ? " · " + esc(COLLECTIONS.find((c) => c.id === x.target)?.name || "") : ""}</span><small class="promo-line">Ends in <span data-ends="${x.endsAt}">${timeLeft(x.endsAt)}</span></small></a>`).join("")}</section>` : ""}
    ${voucherStrip()}
    <section class="spin-home" id="spinSlot"></section>
    <section class="az-spot" id="draw"><div class="wrap"><div class="az-panel az-spot-in" id="drawSlot"><p class="muted">Loading prize draw…</p></div></div></section>
    ${(PROMO.schedules || []).length ? `<section class="wrap" style="margin:10px auto"><h2 class="pp-sub">📅 Weekly deals</h2><div class="v-rail">${PROMO.schedules.map((x) => `<a class="sched-card" href="${x.scope === "collection" ? "/collections/" + x.target : "/collections/all"}" data-link><b>📅 ${x.percent}% off</b><span>${esc(x.label)}</span><small>${esc(x.text)}</small></a>`).join("")}</div></section>` : ""}
    <section class="wrap" style="margin:14px auto 40px"><h2 class="pp-sub">${sale.length ? "🏷 On sale now" : "🛍 Picks for you"}</h2><div class="az-grid">${(sale.length ? sale : [...PRODUCTS].sort((a, b) => (b.sold || 0) - (a.sold || 0))).slice(0, 24).map(rcard).join("")}</div></section></div>`;
  bindVouchers(); renderSpinHome();
  await loadDraw(); if ($("#drawSlot") && !DRAW.d) $("#draw").remove();
}

/* ---------- Notifications: orders, spins, draw results, vouchers, live and sales ---------- */
const seenN = () => { try { return new Set(JSON.parse(localStorage.getItem("lp_seen_n") || "[]")); } catch { return new Set(); } };
async function buildNotifications() {
  const out = [], orders = myOrders();
  const [od, spins, tix] = await Promise.all([
    Promise.all(orders.slice(0, 8).map(async (o) => { try { return await api(`/api/orders/lookup?id=${encodeURIComponent(o.id)}&email=${encodeURIComponent(o.email)}`); } catch { return null; } })),
    mySpins(), api("/api/draw/mine", { device: deviceId(), codes: myCodes() }).then((r) => r.tickets || []).catch(() => [])]);
  const NOTE = { paid: "We've received your payment and are preparing your order.", processing: "Your order is being prepared by our warehouse.", action_needed: "Your order is being prepared.", shipped: "On its way! Tap to see tracking.", delivered: "Delivered — enjoy! Tap to rate your items.", cancelled: "This order was cancelled.", refunded: "Your refund has been issued." };
  for (const o of od.filter(Boolean)) out.push({ id: `o:${o.id}:${o.status}`, icon: o.status === "shipped" ? "🚚" : o.status === "delivered" ? "✅" : "📦", title: `Order #${o.id}: ${STATUS_TEXT[o.status] || o.status}`, body: NOTE[o.status] || "", href: `/track?order=${o.id}` });
  for (const x of spins.filter((x) => !x.prizeId)) out.push({ id: `s:${x.code}`, icon: "🎡", title: "You have a free spin waiting!", body: `${x.promo} — every spin wins a gift.`, href: "/promo", hot: true });
  for (const x of spins.filter((x) => x.prizeId)) out.push({ id: `sw:${x.code}`, icon: "🎁", title: "Your free spin prize is on its way", body: `Shipping as gift order #${x.giftOrder}.`, href: `/track?order=${x.giftOrder}` });
  const won = tix.find((t) => t.result === "won" && !t.claimed), lost = tix.find((t) => t.result === "lost" && t.consolation);
  if (won) out.push({ id: `w:${won.code}`, icon: "🏆", title: "You won the prize draw!", body: `Ticket ${won.code} — claim your prize before ${new Date(won.claimBy).toLocaleDateString()}.`, href: "/promo", hot: true });
  if (lost) out.push({ id: `l:${lost.code}`, icon: "🎟", title: "Prize draw results are in", body: `Not a winner this time — your thank-you voucher ${lost.consolation} is ready.`, href: "/promo" });
  const open = tix.filter((t) => !t.result); if (open.length) out.push({ id: `t:${open.length}`, icon: "🎡", title: `You have ${open.length} ticket${open.length > 1 ? "s" : ""} in the prize draw`, body: "Good luck! Results appear here.", href: "/promo" });
  if (CONFIG.live?.status === "live") out.push({ id: `live:${new Date().toISOString().slice(0, 10)}`, icon: "🔴", title: "Premium Live is on now", body: "Watch and shop live deals.", href: "/live", hot: true });
  for (const x of (PROMO.promos || []).slice(0, 3)) out.push({ id: `p:${x.id}:${x.endsAt}`, icon: "⚡", title: `${x.label}: ${x.percent}% off`, body: `Ends in ${timeLeft(x.endsAt)}.`, href: "/promo" });
  const claimable = (PROMO.vouchers || []).filter((v) => !wallet().includes(v.code)); if (claimable.length) out.push({ id: `v:${claimable.map((v) => v.code).join(",")}`, icon: "🎟", title: `${claimable.length} voucher${claimable.length > 1 ? "s" : ""} to claim`, body: claimable.slice(0, 2).map((v) => v.label || v.code).join(" · "), href: "/promo" });
  return out;
}
async function refreshNotifBadge() { try { const n = await buildNotifications(), seen = seenN(), c = n.filter((x) => !seen.has(x.id)).length; const b = $("#tabBadge"); if (b) { b.textContent = c > 9 ? "9+" : c; b.hidden = !c; } } catch {} }
async function notificationsPage() {
  document.title = "Notifications — LeeysPremium";
  app.innerHTML = `<div class="wrap notif"><h1>🔔 Notifications</h1><div id="nList" class="muted">Loading…</div></div>`;
  const list = await buildNotifications(), seen = seenN(), box = $("#nList"); if (!box) return;
  box.innerHTML = list.length ? list.map((x) => `<a class="n-item ${seen.has(x.id) ? "" : "new"} ${x.hot ? "hot" : ""}" href="${x.href}" data-link><span class="n-ic">${x.icon}</span><div><b>${esc(x.title)}</b>${x.body ? `<span>${esc(x.body)}</span>` : ""}</div></a>`).join("")
    : `<div class="n-empty"><div style="font-size:40px">🔕</div><b>You're all caught up</b><p class="muted">Order updates, prize draw results, free spins and new deals will show up here.</p><a class="btn accent" href="/promo" data-link>See today's promos</a></div>`;
  try { localStorage.setItem("lp_seen_n", JSON.stringify([...new Set([...seen, ...list.map((x) => x.id)])].slice(-200))); } catch {}
  const b = $("#tabBadge"); if (b) b.hidden = true;
}

/* ---------- Bottom app bar (phones & tablets), like a shopping app ---------- */
const lvSwitch = (on) => `<div class="lv-switch"><a href="/videos" data-link class="${on === "video" ? "on" : ""}">Video</a><a href="/live" data-link class="${on === "live" ? "on" : ""}">Live</a></div>`;
function tabBar() {
  if ($("#tabBar")) return;
  const ic = { home: '<path d="M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>', promo: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.6"/>',
    video: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>', bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>', me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>' };
  const item = (href, key, label, extra = "") => `<a href="${href}" data-link data-tab="${key}"><svg viewBox="0 0 24 24">${ic[key]}</svg><span>${label}</span>${extra}</a>`;
  document.body.insertAdjacentHTML("beforeend", `<nav class="tab-bar" id="tabBar" aria-label="App menu">${item("/", "home", "Home")}${item("/promo", "promo", "Promo")}${item("/videos", "video", "Live & Video")}${item("/notifications", "bell", "Notifications", `<i class="tab-badge" id="tabBadge" hidden></i>`)}${item("/account", "me", "Me")}</nav>`);
  refreshNotifBadge();
}
function markTab() {
  const p = location.pathname, key = p === "/" ? "home" : p === "/promo" ? "promo" : p === "/videos" || p === "/live" ? "video" : p === "/notifications" ? "bell" : p === "/account" ? "me" : "";
  document.querySelectorAll("#tabBar [data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === key));
  document.body.classList.toggle("no-tabbar", /^\/(checkout|thank-you)/.test(p));
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
  expirePromos();
  const { pathname, search } = location, params = new URLSearchParams(search);
  markTab(); closeAll(); window.scrollTo(0, 0); clearInterval(SHOW.timer); clearInterval(LIVE.timer); clearInterval(DRAW.timer); VFEED.obs?.disconnect();
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
  else if (pathname === "/draw-rules") drawRules();
  else if (pathname === "/promo") promoPage();
  else if (pathname === "/notifications") notificationsPage();
  else if ((m = pathname.match(/^\/pages\/([\w-]+)$/))) contentPage(m[1]);
  else notFound();
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === pathname));
  $("#backBtn").hidden = pathname === "/";
  document.body.classList.toggle("home-wide", pathname === "/" || pathname === "/search" || pathname.startsWith("/collections/"));
  document.body.classList.remove("fl-show");
  if (!/^\/products\//.test(pathname)) { endProductTime(); if (TQ.length) { clearTimeout(trk.tm); trk.tm = setTimeout(flushTrack, 250); } }
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
  const ql = q && cart.items.find((x) => x.key === q.dataset.q); // only real cart lines (other widgets also use data-q)
  if (ql) { cart.set(q.dataset.q, ql.qty + Number(q.dataset.d)); refreshCartViews(); return; }
  const rm = e.target.closest("[data-rm]");
  if (rm && cart.items.some((x) => x.key === rm.dataset.rm)) { cart.set(rm.dataset.rm, 0); refreshCartViews(); return; }
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
  updateCount(); trk("visit"); tabBar(); route(); loadSpins().then((ps) => { if (ps.length && typeof refreshCartViews === "function") refreshCartViews(); });
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

