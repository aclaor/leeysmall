// LeeysMall storefront — stage 1 (design + cart). Payments and supplier sync arrive in stage 2.
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const FREE_SHIP = 49;
const money = (n) => "$" + n.toFixed(2);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let PRODUCTS = [], COLLECTIONS = [];

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
  hub: '<rect x="56" y="80" width="88" height="44" rx="12"/><path d="M144 102h20"/><rect x="68" y="96" width="10" height="12" rx="2"/><rect x="86" y="96" width="10" height="12" rx="2"/><rect x="104" y="96" width="10" height="12" rx="2"/><rect x="122" y="96" width="10" height="12" rx="2"/>',
};
function art(p, variant = 0) {
  const h = p.hue ?? 210, h2 = (h + 40 + variant * 25) % 360;
  const id = "g" + p.id + variant;
  const tilt = [0, -8, 8, 0][variant] || 0, scale = [1, 1.15, 0.9, 1.3][variant] || 1;
  return `<svg class="art" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(p.title)}" style="width:100%;height:100%">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 85% 94%)"/><stop offset="1" stop-color="hsl(${h2} 80% 84%)"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#${id})"/>
    <circle cx="150" cy="44" r="${30 + variant * 6}" fill="hsl(${h} 90% 98% / .7)"/>
    <g transform="translate(100 100) rotate(${tilt}) scale(${scale}) translate(-100 -100)" fill="hsl(${h} 30% 18%)" fill-opacity=".9" stroke="hsl(${h} 80% 92%)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon] || ICONS.hub}</g>
  </svg>`;
}
const collArt = (c) => art({ id: "c-" + c.id, title: c.name, hue: PRODUCTS.find((p) => p.collection === c.id)?.hue, icon: PRODUCTS.find((p) => p.collection === c.id)?.icon });

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
    <div class="line"><a class="thumb" href="/products/${l.id}" data-link>${art(l.p)}</a>
      <div><div class="t">${esc(l.p.title)}</div>${l.variant ? `<div class="v">${esc(l.variant)}</div>` : ""}<div style="margin-top:8px">${qtyCtl(l.key, l.qty)}</div><button class="rm" data-rm="${l.key}">Remove</button></div>
      <b>${money(l.p.price * l.qty)}</b></div>`).join("")}</div>
    <div class="drawer-foot"><div class="row-between"><span>Subtotal</span><b>${money(sub)}</b></div><small class="muted">Taxes and shipping calculated at checkout.</small>
      <a class="btn accent block" href="/checkout" data-link>Checkout</a><a class="btn ghost block" href="/cart" data-link>View cart</a></div>`
  : `<div class="empty"><p>Your cart is empty.</p><a class="btn" href="/collections/all" data-link>Start shopping</a></div>`}`;
}
function openDrawer() { renderDrawer(); $("#drawer").hidden = false; $("#overlay").hidden = false; }
function closeAll() { $("#drawer").hidden = true; $("#overlay").hidden = true; $("#mobileNav").hidden = true; }

/* ---------- UI pieces ---------- */
const stars = (r, n) => `<div class="stars"><i>${"★".repeat(Math.round(r))}${"☆".repeat(5 - Math.round(r))}</i>${r.toFixed(1)} (${n.toLocaleString()})</div>`;
function card(p) {
  const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  return `<div class="card"><a href="/products/${p.id}" data-link><div class="media">
      ${p.stock === 0 ? `<span class="badge out">Sold out</span>` : p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
      ${off ? `<span class="badge sale">-${off}%</span>` : ""}${art(p)}</div></a>
    ${p.stock > 0 ? `<button class="btn quick-add" data-add="${p.id}">Quick add</button>` : ""}
    <a href="/products/${p.id}" data-link><h3>${esc(p.title)}</h3></a>${stars(p.rating, p.reviews)}
    <div class="price ${off ? "sale" : ""}"><b>${money(p.price)}</b>${p.compareAt ? `<s>${money(p.compareAt)}</s>` : ""}</div></div>`;
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
function home() {
  const best = [...PRODUCTS].sort((a, b) => b.reviews - a.reviews).slice(0, 8);
  const hero = PRODUCTS.find((p) => p.id === "aero-buds-pro"), h2 = PRODUCTS.find((p) => p.id === "halo-desk-lamp"), h3 = PRODUCTS.find((p) => p.id === "volt-20k-powerbank");
  const deal = PRODUCTS.find((p) => p.id === "trio-wireless-station");
  document.title = "LeeysMall — Smart gadgets, fast US shipping";
  app.innerHTML = `
  <section class="hero"><div class="wrap hero-inner">
    <div><span class="eyebrow">New season · Up to 45% off</span>
      <h1>Smart gadgets for everyday life.</h1>
      <p>Earbuds, chargers, smart home and desk upgrades — hand-picked, fairly priced and shipped fast from US warehouses.</p>
      <div class="hero-ctas"><a class="btn accent" href="/collections/all" data-link>Shop all gadgets</a><a class="btn ghost" href="/collections/audio" data-link>Shop audio</a></div></div>
    <div class="hero-art"><a class="tile t1" href="/products/${hero.id}" data-link>${art(hero, 1)}</a><a class="tile t2" href="/products/${h2.id}" data-link>${art(h2, 2)}</a><a class="tile t3" href="/products/${h3.id}" data-link>${art(h3, 3)}</a></div>
  </div></section>
  ${trust()}
  <section class="section"><div class="wrap"><div class="section-head"><h2>Shop by category</h2><a class="link-arrow" href="/collections/all" data-link>View all →</a></div>
    <div class="coll-grid">${COLLECTIONS.map((c) => `<a class="coll-card" href="/collections/${c.id}" data-link>${collArt(c)}<div class="name">${esc(c.name)}</div></a>`).join("")}</div></div></section>
  <section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>Best sellers</h2><a class="link-arrow" href="/collections/all" data-link>Shop all →</a></div>
    <div class="grid">${best.map(card).join("")}</div></div></section>
  <section class="section" style="padding-top:0"><div class="wrap"><div class="banner">
    <div class="copy"><span class="eyebrow">Deal of the week</span><h2>${esc(deal.title)}</h2><p>One pad for your phone, earbuds and watch. Now ${money(deal.price)} — was ${money(deal.compareAt)}.</p><a class="btn accent" href="/products/${deal.id}" data-link>Grab the deal</a></div>
    ${art(deal, 2)}</div></div></section>
  <section class="section" style="padding-top:0"><div class="wrap"><div class="section-head"><h2>Loved by customers</h2></div>
    <div class="reviews">${[
      ["Fast shipping to Texas and the earbuds sound way better than the price suggests.", "Marcus T.", "AeroBuds Pro"],
      ["The 3-in-1 charger cleaned up my whole nightstand. Arrived in 4 days.", "Jenna R.", "Trio Charging Station"],
      ["Power bank charged my phone four times on a camping trip. Solid build.", "Daniel K.", "Volt 20,000mAh"],
    ].map(([t, w, p]) => `<div class="review">${stars(5, 1).replace(/\s*5\.0 \(1\)/, "")}<p>“${t}”</p><div class="who">${w} <span>✓ Verified buyer</span></div><small class="muted">${p}</small></div>`).join("")}</div></div></section>`;
}

function collection(id, params) {
  const c = COLLECTIONS.find((x) => x.id === id);
  const q = (params.get("q") || "").toLowerCase();
  let list = id === "all" ? [...PRODUCTS] : PRODUCTS.filter((p) => p.collection === id);
  if (q) list = PRODUCTS.filter((p) => (p.title + " " + p.description).toLowerCase().includes(q));
  const title = q ? `Search: “${params.get("q")}”` : c ? c.name : "All gadgets";
  document.title = title + " — LeeysMall";
  const state = { sort: params.get("sort") || "featured", stock: params.get("stock") === "1", max: Number(params.get("max")) || 0, us: params.get("us") === "1" };
  const apply = () => {
    let l = list.filter((p) => (!state.stock || p.stock > 0) && (!state.max || p.price <= state.max) && (!state.us || p.ships === "us"));
    const s = { "price-asc": (a, b) => a.price - b.price, "price-desc": (a, b) => b.price - a.price, rating: (a, b) => b.rating - a.rating, best: (a, b) => b.reviews - a.reviews }[state.sort];
    if (s) l.sort(s);
    $("#results").innerHTML = l.length ? l.map(card).join("") : `<div class="empty" style="grid-column:1/-1">No products match these filters.</div>`;
    $("#count").textContent = l.length + " product" + (l.length === 1 ? "" : "s");
  };
  app.innerHTML = `<div class="wrap"><div class="page-head"><div class="crumbs"><a href="/" data-link>Home</a> / ${esc(title)}</div><h1>${esc(title)}</h1>${c ? `<p class="muted">${esc(c.blurb)}</p>` : ""}</div>
    ${q ? "" : `<div class="chips"><a class="chip ${id === "all" ? "on" : ""}" href="/collections/all" data-link>All</a>${COLLECTIONS.map((x) => `<a class="chip ${x.id === id ? "on" : ""}" href="/collections/${x.id}" data-link>${esc(x.name)}</a>`).join("")}</div>`}
    <div class="toolbar"><div class="filters">
      <label><input type="checkbox" id="fStock" ${state.stock ? "checked" : ""}> In stock</label>
      <label><input type="checkbox" id="fUs" ${state.us ? "checked" : ""}> Ships from US</label>
      <select class="select" id="fMax"><option value="0">Any price</option>${[20, 30, 40, 50].map((v) => `<option value="${v}" ${state.max === v ? "selected" : ""}>Under $${v}</option>`).join("")}</select>
      <span class="muted" id="count"></span></div>
      <select class="select" id="fSort">${[["featured", "Featured"], ["best", "Best selling"], ["price-asc", "Price: low to high"], ["price-desc", "Price: high to low"], ["rating", "Top rated"]].map(([v, t]) => `<option value="${v}" ${state.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select></div>
    <div class="grid" id="results"></div><div style="height:56px"></div></div>`;
  $("#fStock").onchange = (e) => { state.stock = e.target.checked; apply(); };
  $("#fUs").onchange = (e) => { state.us = e.target.checked; apply(); };
  $("#fMax").onchange = (e) => { state.max = Number(e.target.value); apply(); };
  $("#fSort").onchange = (e) => { state.sort = e.target.value; apply(); };
  apply();
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
  document.title = p.title + " — LeeysMall";
  const sel = Object.fromEntries(p.variants.map((v) => [v.name, v.options[0]]));
  let img = 0, qty = 1, country = "US";
  const off = p.compareAt ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  const related = PRODUCTS.filter((x) => x.collection === p.collection && x.id !== p.id).concat(PRODUCTS.filter((x) => x.collection !== p.collection)).slice(0, 4);
  const coll = COLLECTIONS.find((c) => c.id === p.collection);
  const stockTxt = p.stock === 0 ? `<div class="stock none">Sold out</div>` : p.stock < 60 ? `<div class="stock low">Only ${p.stock} left — order soon</div>` : `<div class="stock">In stock, ready to ship</div>`;
  app.innerHTML = `<div class="wrap"><div class="pdp">
    <div class="gallery"><div class="main" id="mainImg">${art(p, 0)}</div><div class="thumbs">${[0, 1, 2, 3].map((i) => `<button data-img="${i}" class="${i === 0 ? "on" : ""}" aria-label="Image ${i + 1}">${art(p, i)}</button>`).join("")}</div></div>
    <div><div class="crumbs"><a href="/" data-link>Home</a> / <a href="/collections/${coll.id}" data-link>${esc(coll.name)}</a></div>
      <h1>${esc(p.title)}</h1>${stars(p.rating, p.reviews)}
      <div class="price ${off ? "sale" : ""}" style="margin:14px 0"><b>${money(p.price)}</b>${p.compareAt ? `<s>${money(p.compareAt)}</s><span class="save">Save ${off}%</span>` : ""}</div>
      ${stockTxt}
      ${p.variants.map((v) => `<div class="opt"><div class="opt-label">${esc(v.name)}: <span data-sel="${esc(v.name)}">${esc(sel[v.name])}</span></div><div class="opt-values">${v.options.map((o) => `<button data-opt="${esc(v.name)}" data-val="${esc(o)}" class="${o === sel[v.name] ? "on" : ""}">${esc(o)}</button>`).join("")}</div></div>`).join("")}
      <div class="opt"><div class="opt-label">Quantity</div><div class="qty"><button id="qMinus">−</button><input id="qVal" value="1" readonly><button id="qPlus">+</button></div></div>
      <div class="buy-row"><button class="btn ghost" id="addBtn" ${p.stock === 0 ? "disabled" : ""}>Add to cart</button><button class="btn accent" id="buyBtn" ${p.stock === 0 ? "disabled" : ""}>Buy it now</button></div>
      <div class="ship-box">
        <div>🚚 <span>Ship to</span><select class="select" id="country">${[["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"], ["PH", "Philippines"], ["OT", "Other countries"]].map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></div>
        <div>📦 <b id="eta">${deliveryText(p, "US")}</b></div>
        <div>↩️ <span>30-day returns · Secure checkout with PayPal & cards</span></div></div>
      <details class="acc" open><summary>Description</summary><p>${esc(p.description)}</p></details>
      <details class="acc"><summary>Shipping</summary><p>US orders ship from our US warehouses where available (3–7 business days). International orders ship worldwide in 7–20 business days with tracking. Free US shipping over $${FREE_SHIP}.</p></details>
      <details class="acc"><summary>Returns</summary><p>Not happy? Return it within 30 days of delivery for a full refund. Damaged or faulty items are replaced free.</p></details>
    </div></div>
    <section class="section" style="padding-top:0"><div class="section-head"><h2>You may also like</h2></div><div class="grid">${related.map(card).join("")}</div></section></div>`;
  const variantStr = () => Object.values(sel).join(" / ");
  app.querySelectorAll("[data-opt]").forEach((b) => (b.onclick = () => {
    sel[b.dataset.opt] = b.dataset.val;
    app.querySelectorAll(`[data-opt="${CSS.escape(b.dataset.opt)}"]`).forEach((x) => x.classList.toggle("on", x === b));
    app.querySelector(`[data-sel="${CSS.escape(b.dataset.opt)}"]`).textContent = b.dataset.val;
  }));
  app.querySelectorAll("[data-img]").forEach((b) => (b.onclick = () => {
    img = Number(b.dataset.img); $("#mainImg").innerHTML = art(p, img);
    app.querySelectorAll("[data-img]").forEach((x) => x.classList.toggle("on", x === b));
  }));
  $("#qMinus").onclick = () => { qty = Math.max(1, qty - 1); $("#qVal").value = qty; };
  $("#qPlus").onclick = () => { qty = Math.min(10, qty + 1); $("#qVal").value = qty; };
  $("#country").onchange = (e) => { country = e.target.value; $("#eta").textContent = deliveryText(p, country); };
  $("#addBtn").onclick = () => { cart.add(p.id, variantStr(), qty); openDrawer(); };
  $("#buyBtn").onclick = () => { cart.add(p.id, variantStr(), qty); go("/checkout"); };
}

function cartPage() {
  document.title = "Cart — LeeysMall";
  const lines = cart.lines(), sub = cart.subtotal();
  app.innerHTML = `<div class="wrap prose" style="max-width:900px"><h1>Your cart</h1>${lines.length ? `
    ${shipProgress(sub)}${lines.map((l) => `<div class="line"><a class="thumb" href="/products/${l.id}" data-link>${art(l.p)}</a><div><div class="t">${esc(l.p.title)}</div>${l.variant ? `<div class="v">${esc(l.variant)}</div>` : ""}<div style="margin-top:8px">${qtyCtl(l.key, l.qty)}</div><button class="rm" data-rm="${l.key}">Remove</button></div><b>${money(l.p.price * l.qty)}</b></div>`).join("")}
    <div class="row-between" style="margin:24px 0 8px;font-size:18px"><span>Subtotal</span><b>${money(sub)}</b></div><p class="muted">Taxes and shipping calculated at checkout.</p>
    <a class="btn accent" href="/checkout" data-link>Checkout</a>`
  : `<div class="empty"><p>Your cart is empty.</p><a class="btn" href="/collections/all" data-link>Start shopping</a></div>`}</div>`;
}

const DISCOUNTS = { WELCOME10: 0.1 };
function checkout() {
  document.title = "Checkout — LeeysMall";
  const lines = cart.lines();
  if (!lines.length) return go("/cart", true);
  let code = "", country = "US", pay = "paypal";
  const render = () => {
    const sub = cart.subtotal(), disc = DISCOUNTS[code] ? sub * DISCOUNTS[code] : 0;
    const ship = country === "US" ? (sub >= FREE_SHIP ? 0 : 4.99) : 12.99;
    $("#totals").innerHTML = `<div class="row-between"><span>Subtotal</span><span>${money(sub)}</span></div>
      ${disc ? `<div class="row-between"><span>Discount (${code})</span><span>−${money(disc)}</span></div>` : ""}
      <div class="row-between"><span>Shipping</span><span>${ship ? money(ship) : "Free"}</span></div>
      <div class="row-between"><span class="muted">Estimated tax</span><span class="muted">Calculated next</span></div>
      <div class="row-between grand"><span>Total</span><span>USD ${money(sub - disc + ship)}</span></div>`;
  };
  app.innerHTML = `<div class="wrap"><div class="checkout">
    <form class="co-form" id="coForm"><div class="crumbs"><a href="/cart" data-link>Cart</a> / Information / Payment</div>
      <h2>Contact</h2><div class="field"><input type="email" required placeholder="Email"></div>
      <label class="muted" style="font-size:14px"><input type="checkbox" checked> Email me with news and offers</label>
      <h2>Delivery</h2>
      <div class="field"><select id="coCountry">${[["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"], ["AU", "Australia"], ["PH", "Philippines"], ["OT", "Other"]].map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></div>
      <div class="two"><div class="field"><input required placeholder="First name"></div><div class="field"><input required placeholder="Last name"></div></div>
      <div class="field"><input required placeholder="Address"></div><div class="field"><input placeholder="Apartment, suite, etc. (optional)"></div>
      <div class="two"><div class="field"><input required placeholder="City"></div><div class="field"><input required placeholder="ZIP / Postal code"></div></div>
      <div class="field"><input placeholder="Phone (for delivery updates)"></div>
      <h2>Payment</h2><div class="pay-opts">
        <label class="pay-opt on"><input type="radio" name="pay" value="paypal" checked> PayPal</label>
        <label class="pay-opt"><input type="radio" name="pay" value="card"> Credit or debit card</label></div>
      <div class="note">Preview mode: payments connect in the next stage, so no charge will be made.</div>
      <button class="btn accent block" style="margin-top:18px;padding:16px">Pay now</button></form>
    <div class="co-summary">${lines.map((l) => `<div class="line"><div class="thumb"><div>${art(l.p)}</div><span class="q">${l.qty}</span></div><div><div class="t">${esc(l.p.title)}</div><div class="v">${esc(l.variant || "")}</div></div><b>${money(l.p.price * l.qty)}</b></div>`).join("")}
      <div class="discount"><input id="code" placeholder="Discount code (try WELCOME10)"><button type="button" class="btn" id="applyCode">Apply</button></div>
      <div class="totals" id="totals"></div></div></div></div>`;
  render();
  $("#coCountry").onchange = (e) => { country = e.target.value; render(); };
  $("#applyCode").onclick = () => { const c = $("#code").value.trim().toUpperCase(); if (DISCOUNTS[c]) { code = c; toast("Discount applied"); } else toast("That code isn't valid"); render(); };
  app.querySelectorAll('input[name="pay"]').forEach((r) => (r.onchange = () => { pay = r.value; app.querySelectorAll(".pay-opt").forEach((o) => o.classList.toggle("on", o.contains(r))); }));
  $("#coForm").onsubmit = (e) => { e.preventDefault(); const n = "LM" + Date.now().toString().slice(-6); cart.items = []; cart.save(); go("/thank-you?order=" + n); };
}

function thankYou(params) {
  const n = esc(params.get("order") || "");
  app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><div style="font-size:48px">✅</div><h1>Thank you for your order!</h1><p>Order <b>#${n}</b> is confirmed (preview). You'll get an email with tracking once it ships.</p><a class="btn" href="/collections/all" data-link>Continue shopping</a></div>`;
}

function track() {
  document.title = "Track your order — LeeysMall";
  app.innerHTML = `<div class="wrap prose"><h1>Track your order</h1><p>Enter the order number from your confirmation email.</p>
    <form class="card-box" id="tForm"><div class="field"><input required placeholder="Order number, e.g. LM123456"></div><div class="field"><input type="email" required placeholder="Email used at checkout"></div><button class="btn block">Track</button></form><div id="tOut"></div></div>`;
  $("#tForm").onsubmit = (e) => { e.preventDefault(); $("#tOut").innerHTML = `<p class="muted" style="margin-top:16px">Order lookup goes live with the order system in the next stage.</p>`; };
}

function account() {
  document.title = "Account — LeeysMall";
  app.innerHTML = `<div class="wrap prose"><h1>Sign in</h1><form class="card-box" onsubmit="event.preventDefault()"><div class="field"><input type="email" placeholder="Email"></div><button class="btn block">Continue</button><p class="muted" style="font-size:14px">Customer accounts with order history arrive in the next stage.</p></form></div>`;
}

const PAGES = {
  shipping: ["Shipping", `<p>We ship to the United States and worldwide.</p><ul><li><b>United States:</b> 3–7 business days for items in our US warehouses; 8–15 days for other items.</li><li><b>Canada, UK, Australia:</b> 7–14 business days.</li><li><b>Rest of world:</b> 10–20 business days.</li></ul><p>Every order includes tracking. US orders over $${FREE_SHIP} ship free.</p>`],
  returns: ["Returns & refunds", `<p>You can return most items within 30 days of delivery. Items must be unused and in original packaging. Damaged or faulty items are replaced or refunded at no cost to you — just email us a photo.</p><p>Refunds go back to your original payment method within 5–10 business days of approval.</p>`],
  contact: ["Contact us", `<p>Questions about an order? Email <b>support@leeysmall.com</b> and we'll reply within 24 hours, Monday to Saturday.</p>`],
  privacy: ["Privacy policy", `<p>We collect only what's needed to process your order: your name, contact details, shipping address and order history. Payments are processed by our payment providers; we never store card numbers. We share your shipping details only with the supplier fulfilling your order and the carrier delivering it.</p>`],
  terms: ["Terms of service", `<p>By using LeeysMall you agree to these terms. Prices are in USD. We may cancel an order if an item becomes unavailable, in which case you receive a full refund.</p>`],
};
function contentPage(slug) { const pg = PAGES[slug]; if (!pg) return notFound(); document.title = pg[0] + " — LeeysMall"; app.innerHTML = `<div class="wrap prose"><h1>${pg[0]}</h1>${pg[1]}</div>`; }
function notFound() { app.innerHTML = `<div class="wrap prose" style="text-align:center;margin:0 auto"><h1>Page not found</h1><a class="btn" href="/" data-link>Back to home</a></div>`; }

/* ---------- Router ---------- */
function route() {
  const { pathname, search } = location, params = new URLSearchParams(search);
  closeAll(); window.scrollTo(0, 0);
  let m;
  if (pathname === "/") home();
  else if (pathname === "/search") collection("all", params);
  else if ((m = pathname.match(/^\/collections\/([\w-]+)$/))) collection(m[1], params);
  else if ((m = pathname.match(/^\/products\/([\w-]+)$/))) product(m[1]);
  else if (pathname === "/cart") cartPage();
  else if (pathname === "/checkout") checkout();
  else if (pathname === "/thank-you") thankYou(params);
  else if (pathname === "/track") track();
  else if (pathname === "/account") account();
  else if ((m = pathname.match(/^\/pages\/([\w-]+)$/))) contentPage(m[1]);
  else notFound();
  document.querySelectorAll(".nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === pathname));
}
function go(url, replace) { history[replace ? "replaceState" : "pushState"]({}, "", url); route(); }

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
$("#menuBtn").onclick = () => { $("#mobileNav").hidden = false; $("#overlay").hidden = false; };
window.addEventListener("popstate", route);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

(async function init() {
  $("#year").textContent = new Date().getFullYear();
  try {
    [PRODUCTS, COLLECTIONS] = await Promise.all([fetch("/api/products").then((r) => r.json()), fetch("/api/collections").then((r) => r.json())]);
  } catch { app.innerHTML = `<div class="wrap prose"><h1>Store is loading slowly</h1><p>Please refresh the page.</p></div>`; return; }
  const links = `<a href="/collections/all" data-link>Shop all</a>` + COLLECTIONS.map((c) => `<a href="/collections/${c.id}" data-link>${esc(c.name)}</a>`).join("");
  $("#nav").innerHTML = links;
  $("#mobileNav").innerHTML = links + `<a href="/track" data-link>Track order</a>`;
  $("#footerCollections").innerHTML = links;
  updateCount(); route();
})();
