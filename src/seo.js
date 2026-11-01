// Search-engine layer: real HTML content, meta tags and structured data for every page,
// plus sitemap.xml, robots.txt and IndexNow (instant Bing/Yandex/Seznam notifications).
import { ensureSchema, getSetting, setSetting, parse } from "./db.js";
import { activePromos, priced } from "./promos.js";

const BRAND = "LeeysPremium";
const TAGLINE = "Everything you need, delivered fast";
const HOME_DESC = "Shop home, tech, fashion, beauty, outdoors, pets and more at LeeysPremium. Fast US shipping, worldwide delivery, secure PayPal checkout and 30-day returns.";
const NOINDEX = new Set(["/cart", "/checkout", "/thank-you", "/track", "/account", "/search"]);
const PAGES = {
  shipping: ["Shipping", "LeeysPremium ships to the United States and worldwide. US orders from US warehouses arrive in 3–7 business days; every order is tracked. Free US shipping over $49."],
  returns: ["Returns & refunds", "Return most items within 30 days of delivery for a full refund. Damaged or faulty items are replaced or refunded at no cost."],
  contact: ["Contact us", "Questions about an order? Email support@leeyspremium.com and we reply within 24 hours, Monday to Saturday."],
  privacy: ["Privacy policy", "How LeeysPremium collects and uses your information: only what is needed to process and deliver your order. Card numbers are never stored."],
  terms: ["Terms of service", "The terms for shopping at LeeysPremium. Prices are in USD."],
};

export const siteUrl = (env, req) => (env.SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const money = (n) => "$" + Number(n || 0).toFixed(2);
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;

/* ---------- Page data ---------- */
async function pageFor(env, url, base) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  let m;
  if (path === "/") {
    const [cols, prods] = await Promise.all([
      env.DB.prepare("SELECT id,name,blurb FROM collections ORDER BY sort").all(),
      env.DB.prepare("SELECT id,title,price,images FROM products WHERE active=1 ORDER BY reviews DESC, created_at DESC LIMIT 24").all(),
    ]);
    return {
      status: 200, title: `${BRAND} — ${TAGLINE}`, desc: HOME_DESC, canonical: base + "/", image: base + "/icons/icon-512.png",
      ld: [{ "@context": "https://schema.org", "@type": "WebSite", name: BRAND, url: base + "/",
        potentialAction: { "@type": "SearchAction", target: base + "/search?q={search_term_string}", "query-input": "required name=search_term_string" } },
        { "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: base + "/", logo: base + "/icons/icon-512.png", email: "support@leeyspremium.com" }],
      body: `<h1>${BRAND} — ${TAGLINE}</h1><p>${esc(HOME_DESC)}</p>
        <h2>Shop by category</h2><ul>${cols.results.map((c) => `<li><a href="/collections/${c.id}">${esc(c.name)}</a> — ${esc(c.blurb || "")}</li>`).join("")}</ul>
        <h2>Popular products</h2><ul>${prods.results.map((p) => `<li><a href="/products/${p.id}">${esc(p.title)}</a> — ${money(p.price)}</li>`).join("")}</ul>`,
    };
  }
  if ((m = path.match(/^\/products\/([\w-]+)$/))) {
    const p = await env.DB.prepare("SELECT * FROM products WHERE id=? AND active=1").bind(m[1]).first();
    if (!p) return notFound(base);
    const pr = priced(p, await activePromos(env));
    p.price = pr.price; p.compare_at = pr.compareAt;
    const col = p.collection ? await env.DB.prepare("SELECT id,name FROM collections WHERE id=?").bind(p.collection).first() : null;
    const images = parse(p.images, []).filter((x) => /^https?:/.test(x));
    const url = base + "/products/" + p.id;
    const desc = clip(`${p.title} — ${money(p.price)}${p.compare_at ? ` (was ${money(p.compare_at)})` : ""}. ${p.description || ""} Fast shipping, secure checkout, 30-day returns at ${BRAND}.`, 158);
    const variants = parse(p.variants, []);
    return {
      status: 200, title: clip(`${p.title} | ${BRAND}`, 70), desc, canonical: url, image: images[0] || base + "/icons/icon-512.png", type: "product", price: p.price,
      ld: [{
        "@context": "https://schema.org", "@type": "Product", name: p.title, sku: p.id, description: clip(p.description || p.title, 4900),
        image: images.length ? images : undefined, brand: { "@type": "Brand", name: BRAND }, category: col?.name,
        offers: { "@type": "Offer", url, priceCurrency: "USD", price: Number(p.price).toFixed(2), ...(pr.promo ? { priceValidUntil: pr.promo.endsAt.slice(0, 10) } : {}), itemCondition: "https://schema.org/NewCondition",
          availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", seller: { "@type": "Organization", name: BRAND },
          hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "US", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 30, returnMethod: "https://schema.org/ReturnByMail" } },
      }, breadcrumbs(base, [col && [col.name, "/collections/" + col.id], [p.title, "/products/" + p.id]])],
      body: `<nav><a href="/">Home</a>${col ? ` / <a href="/collections/${col.id}">${esc(col.name)}</a>` : ""}</nav>
        <h1>${esc(p.title)}</h1><p><strong>${money(p.price)}</strong>${p.compare_at ? ` <s>${money(p.compare_at)}</s>` : ""} · ${p.stock > 0 ? "In stock" : "Sold out"}</p>
        ${images.slice(0, 4).map((src) => `<img src="${esc(src)}" alt="${esc(p.title)}" width="400" height="400" loading="lazy">`).join("")}
        ${variants.map((v) => `<p>${esc(v.name)}: ${v.options.map(esc).join(", ")}</p>`).join("")}
        <h2>Description</h2><p>${esc(p.description || "")}</p>
        <p>Ships to the United States and worldwide with tracking. 30-day returns.</p>`,
    };
  }
  if ((m = path.match(/^\/collections\/([\w-]+)$/))) {
    const all = m[1] === "all";
    const c = all ? { id: "all", name: "All products", blurb: "Browse every product at " + BRAND } : await env.DB.prepare("SELECT * FROM collections WHERE id=?").bind(m[1]).first();
    if (!c) return notFound(base);
    const prods = (all ? await env.DB.prepare("SELECT id,title,price,images FROM products WHERE active=1 ORDER BY reviews DESC LIMIT 100").all()
      : await env.DB.prepare("SELECT id,title,price,images FROM products WHERE active=1 AND collection=? ORDER BY reviews DESC LIMIT 100").bind(c.id).all()).results;
    const url = base + "/collections/" + c.id;
    return {
      status: 200, title: clip(`${c.name} — Shop ${c.name} Online | ${BRAND}`, 70), canonical: url,
      desc: clip(`Shop ${c.name.toLowerCase()} at ${BRAND}${c.blurb ? ": " + c.blurb.toLowerCase() : ""}. ${prods.length} product${prods.length === 1 ? "" : "s"}, fast US shipping, worldwide delivery and 30-day returns.`, 158),
      image: parse(prods[0]?.images, []).find((x) => /^https?:/.test(x)) || base + "/icons/icon-512.png",
      ld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: c.name, url,
        mainEntity: { "@type": "ItemList", itemListElement: prods.slice(0, 50).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: base + "/products/" + p.id, name: p.title })) } },
        breadcrumbs(base, [[c.name, "/collections/" + c.id]])],
      body: `<nav><a href="/">Home</a></nav><h1>${esc(c.name)}</h1><p>${esc(c.blurb || "")}</p>
        <ul>${prods.map((p) => `<li><a href="/products/${p.id}">${esc(p.title)}</a> — ${money(p.price)}</li>`).join("")}</ul>`,
    };
  }
  if (path === "/videos") {
    const vids = (await env.DB.prepare("SELECT id, title, price FROM products WHERE active=1 AND video IS NOT NULL ORDER BY updated_at DESC LIMIT 60").all()).results;
    return { status: 200, title: `Premium Video — Watch Before You Buy | ${BRAND}`, canonical: base + "/videos",
      desc: `Watch product videos from ${BRAND} and shop straight from the video. ${vids.length} products with video.`,
      body: `<h1>Premium Video</h1><ul>${vids.map((v) => `<li><a href="/products/${v.id}">${esc(v.title)}</a> — ${money(v.price)}</li>`).join("")}</ul>` };
  }
  if (path === "/live") {
    const live = parse(await getSetting(env, "live"), {}) || {};
    return { status: 200, title: `${live.status === "live" ? "🔴 LIVE: " : ""}${live.title || "Premium Live"} | ${BRAND}`, canonical: base + "/live",
      desc: live.status === "live" ? `${BRAND} is live now — watch, ask questions and shop the products on screen.` : `Live shopping from ${BRAND}: watch demos, ask questions in the chat and get live-only deals.`,
      body: `<h1>Premium Live</h1><p>${esc(live.title || "Live shopping with LeeysPremium")}</p>` };
  }
  if (path === "/categories") {
    const cols = (await env.DB.prepare("SELECT c.id, c.name, c.blurb, COUNT(p.id) n FROM collections c LEFT JOIN products p ON p.collection=c.id AND p.active=1 GROUP BY c.id ORDER BY c.sort").all()).results;
    return { status: 200, title: `Shop by Category | ${BRAND}`, canonical: base + "/categories",
      desc: clip(`Browse ${BRAND} by category: ${cols.map((c) => c.name).join(", ")}. Fast US shipping and 30-day returns.`, 158),
      ld: [breadcrumbs(base, [["Categories", "/categories"]])],
      body: `<h1>Categories</h1><ul>${cols.map((c) => `<li><a href="/collections/${c.id}">${esc(c.name)}</a> (${c.n}) — ${esc(c.blurb || "")}</li>`).join("")}</ul>` };
  }
  if ((m = path.match(/^\/pages\/([\w-]+)$/)) && PAGES[m[1]]) {
    const [t, d] = PAGES[m[1]];
    return { status: 200, title: `${t} | ${BRAND}`, desc: d, canonical: base + path, body: `<h1>${esc(t)}</h1><p>${esc(d)}</p>` };
  }
  if (NOINDEX.has(path)) return { status: 200, title: `${BRAND}`, desc: HOME_DESC, canonical: base + path, noindex: true, body: "" };
  return notFound(base);
}
const notFound = (base) => ({ status: 404, title: `Page not found | ${BRAND}`, desc: HOME_DESC, canonical: null, noindex: true, body: `<h1>Page not found</h1><p><a href="/">Back to ${BRAND}</a></p>` });
function breadcrumbs(base, items) {
  const list = [["Home", "/"], ...items.filter(Boolean)];
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: list.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: base + path })) };
}

/* ---------- HTML response with injected SEO ---------- */
export async function renderPage(req, env) {
  const url = new URL(req.url), base = siteUrl(env, req);
  await ensureSchema(env);
  const pg = await pageFor(env, url, base);
  // Always fetch the full page template (never pass the browser's "has it changed?" headers, which would return an empty 304)
  const shell = await env.ASSETS.fetch(new Request(new URL("/", req.url), { headers: { accept: "text/html" } }));
  if (shell.status !== 200) throw new Error("shell " + shell.status);
  const setAttr = (attr, val) => ({ element(el) { val == null ? el.remove() : el.setAttribute(attr, val); } });
  const head = [
    pg.noindex ? `<meta name="robots" content="noindex, follow">` : `<meta name="robots" content="index, follow, max-image-preview:large">`,
    pg.type === "product" ? `<meta property="product:price:amount" content="${Number(pg.price).toFixed(2)}"><meta property="product:price:currency" content="USD">` : "",
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(pg.title)}"><meta name="twitter:description" content="${esc(pg.desc)}"><meta name="twitter:image" content="${esc(pg.image || base + "/icons/icon-512.png")}">`,
    env.GOOGLE_SITE_VERIFICATION ? `<meta name="google-site-verification" content="${esc(env.GOOGLE_SITE_VERIFICATION)}">` : "",
    env.BING_SITE_VERIFICATION ? `<meta name="msvalidate.01" content="${esc(env.BING_SITE_VERIFICATION)}">` : "",
    ...(pg.ld || []).map(ld),
  ].join("\n  ");
  const res = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(pg.title); } })
    .on('meta[name="description"]', setAttr("content", pg.desc))
    .on('link[rel="canonical"]', setAttr("href", pg.canonical))
    .on('meta[property="og:title"]', setAttr("content", pg.title))
    .on('meta[property="og:description"]', setAttr("content", pg.desc))
    .on('meta[property="og:url"]', setAttr("content", pg.canonical || base + url.pathname))
    .on('meta[property="og:image"]', setAttr("content", pg.image || base + "/icons/icon-512.png"))
    .on("head", { element(el) { el.append(head, { html: true }); el.prepend(`<meta property="og:type" content="${pg.type === "product" ? "product" : "website"}">`, { html: true }); } })
    .on("main#app", { element(el) { if (pg.body) el.setInnerContent(`<div class="wrap prose seo-snapshot">${pg.body}</div>`, { html: true }); } })
    .transform(shell);
  const headers = new Headers(res.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  if (pg.noindex) headers.set("x-robots-tag", "noindex, follow");
  return new Response(res.body, { status: pg.status, headers });
}

/* ---------- sitemap.xml & robots.txt ---------- */
export async function sitemap(req, env) {
  await ensureSchema(env);
  const base = siteUrl(env, req);
  const [cols, prods] = await Promise.all([
    env.DB.prepare("SELECT id FROM collections ORDER BY sort").all(),
    env.DB.prepare("SELECT id, images, updated_at, title FROM products WHERE active=1 ORDER BY updated_at DESC LIMIT 45000").all(),
  ]);
  const day = (d) => (d ? String(d).slice(0, 10) : new Date().toISOString().slice(0, 10));
  const latest = day(prods.results[0]?.updated_at);
  const u = (loc, lastmod, pri, extra = "") => `<url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<priority>${pri}</priority>${extra}</url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[u(base + "/", latest, "1.0"), u(base + "/collections/all", latest, "0.9"), u(base + "/categories", latest, "0.8"), u(base + "/videos", latest, "0.6"), u(base + "/live", null, "0.5"),
  ...cols.results.map((c) => u(`${base}/collections/${c.id}`, latest, "0.8")),
  ...prods.results.map((p) => u(`${base}/products/${p.id}`, day(p.updated_at), "0.7",
    parse(p.images, []).filter((x) => /^https?:/.test(x)).slice(0, 3).map((src) => `<image:image><image:loc>${esc(src)}</image:loc></image:image>`).join(""))),
  ...Object.keys(PAGES).map((k) => u(`${base}/pages/${k}`, null, "0.3"))].join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
export function robots(req, env) {
  const base = siteUrl(env, req);
  return new Response(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /cart
Disallow: /checkout
Disallow: /thank-you
Disallow: /account

Sitemap: ${base}/sitemap.xml
`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}

/* ---------- IndexNow (Bing, Yandex, Seznam, Naver) ---------- */
export async function indexNowKey(env) {
  let k = await getSetting(env, "indexnow_key");
  if (!k) { k = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join(""); await setSetting(env, "indexnow_key", k); }
  return k;
}
export async function pingIndexNow(env, base, paths) {
  const urlList = [...new Set(paths)].map((p) => (p.startsWith("http") ? p : base + p)).slice(0, 10000);
  if (!urlList.length || !/^https:\/\//.test(base)) return { ok: false, skipped: true };
  const key = await indexNowKey(env);
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/indexnow-${key}.txt`, urlList }),
  });
  await setSetting(env, "indexnow_last", JSON.stringify({ at: new Date().toISOString(), status: r.status, count: urlList.length }));
  return { ok: r.status === 200 || r.status === 202, status: r.status, count: urlList.length };
}
export async function allSitePaths(env) {
  const [cols, prods] = await Promise.all([env.DB.prepare("SELECT id FROM collections").all(), env.DB.prepare("SELECT id FROM products WHERE active=1").all()]);
  return ["/", "/collections/all", ...cols.results.map((c) => "/collections/" + c.id), ...prods.results.map((p) => "/products/" + p.id), ...Object.keys(PAGES).map((k) => "/pages/" + k)];
}
