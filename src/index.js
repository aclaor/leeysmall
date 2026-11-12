import { classify } from "../public/classify.js";
import { evaluate, voucherTitle, eligibleSubtotal, PUBLIC_FIELDS } from "./vouchers.js";
import { activeGifts, giftLines, publicGifts } from "./gifts.js";
import { activePromos, priced, schedules, windowEnd, scheduleText } from "./promos.js";
import { mediaReady, startUpload, uploadPart, completeUpload, deleteObject, serveMedia, embedUrl } from "./media.js";
import { renderPage, sitemap, robots, indexNowKey, pingIndexNow, allSitePaths, siteUrl } from "./seo.js";
import { ensureSchema, toPublic, toAdmin, orderOut, parse, getSetting, setSetting } from "./db.js";
import { createPaypalOrder, capturePaypalOrder } from "./paypal.js";
import { cjSearch, cjCategories, cjProduct, cjPageVideo, cjToRecord, cjStock, cjCreateOrder, cjOrderDetail } from "./cj.js";

/* ---------------- helpers ---------------- */
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const bad = (msg, status = 400) => json({ error: msg }, status);
const body = async (req) => { try { return await req.json(); } catch { return {}; } };
const r2 = (n) => Math.round(n * 100) / 100;
const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

const FREE_SHIP = 49;
function shippingFor(country, subtotal) {
  if (country === "US") return subtotal >= FREE_SHIP ? 0 : 4.99;
  if (["CA", "GB", "AU"].includes(country)) return 9.99;
  return 12.99;
}
const COUNTRY_NAMES = { US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia", PH: "Philippines", DE: "Germany", FR: "France", JP: "Japan", SG: "Singapore", NZ: "New Zealand", IE: "Ireland", NL: "Netherlands" };

function newOrderId() {
  const a = crypto.getRandomValues(new Uint8Array(5));
  return "LP" + [...a].map((b) => (b % 36).toString(36)).join("").toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();
}

/* ---------------- admin auth (signed cookie) ---------------- */
async function hmac(env, msg) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("lm:" + env.ADMIN_PASSWORD), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function isAdmin(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const c = (req.headers.get("cookie") || "").match(/(?:^|;\s*)lm_admin=([^;]+)/);
  if (!c) return false;
  const [exp, sig] = c[1].split(".");
  return Number(exp) > Date.now() && sig === (await hmac(env, exp));
}

/* ---------------- checkout ---------------- */
async function buildOrder(env, b) {
  const items = Array.isArray(b.items) ? b.items.slice(0, 50) : [];
  if (!items.length) throw new Error("Your cart is empty");
  const ids = [...new Set(items.map((i) => str(i.id, 100)))];
  const rows = (await env.DB.prepare(`SELECT * FROM products WHERE active=1 AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results;
  const promos = await activePromos(env);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const lines = [];
  for (const i of items) {
    const p = byId[i.id];
    if (!p) throw new Error("A product in your cart is no longer available");
    const qty = Math.min(20, Math.max(1, parseInt(i.qty) || 1));
    if (p.stock <= 0) throw new Error(p.title + " is sold out");
    const variants = parse(p.variants, []);
    const variant = str(i.variant, 150);
    if (variants.length) {
      const parts = variant.split(" / ");
      if (parts.length !== variants.length || parts.some((v, k) => !variants[k].options.includes(v))) throw new Error("Please choose options for " + p.title);
    }
    const vm = parse(p.variant_map, {});
    const vmEntry = vm[variant] || (Object.keys(vm).length === 1 ? Object.values(vm)[0] : null);
    lines.push({ id: p.id, collection: p.collection, title: p.title, variant, qty, price: priced(p, promos).price, cost: vmEntry?.cost ?? p.cost, supplier: p.supplier, vid: vmEntry?.vid || null, ships: p.ships });
  }
  const subtotal = r2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  lines.push(...giftLines(lines, await activeGifts(env)));
  // Vouchers: one discount voucher (percent / amount) + one shipping voucher
  const wanted = [...new Set([b.code, b.shipCode, ...(Array.isArray(b.codes) ? b.codes : [])].map((c) => str(c, 40).toUpperCase()).filter(Boolean))].slice(0, 4);
  const vs = wanted.length ? (await env.DB.prepare(`SELECT * FROM discounts WHERE code IN (${wanted.map(() => "?").join(",")})`).bind(...wanted).all()).results : [];
  const email = str(b.email, 200).toLowerCase();
  const hasOrdered = email ? !!(await env.DB.prepare("SELECT 1 FROM orders WHERE email=? AND status NOT IN ('pending','cancelled') LIMIT 1").bind(email).first()) : null;
  const notes = [];
  for (const c of wanted) if (!vs.some((v) => v.code === c)) notes.push(`${c}: this code isn't valid`);
  let discount = 0, code = null, shipDiscount = 0, shipCode = null;
  const dv = vs.find((v) => v.type !== "shipping");
  if (dv) { const r = evaluate(dv, { subtotal, eligible: eligibleSubtotal(dv, lines), shipping: 0, hasOrdered }); if (r.ok) { discount = r.amount; code = dv.code; } else notes.push(`${dv.code}: ${r.reason}`); }
  const country = str(b.country, 2).toUpperCase() || "US";
  const shipping = shippingFor(country, subtotal - discount);
  const sv = vs.find((v) => v.type === "shipping");
  if (sv) { const r = evaluate(sv, { subtotal, eligible: eligibleSubtotal(sv, lines), shipping, hasOrdered }); if (r.ok) { shipDiscount = r.amount; shipCode = sv.code; } else notes.push(`${sv.code}: ${r.reason}`); }
  return { lines, subtotal, discount, code, shipDiscount, shipCode, codeNote: notes.join(" · ") || null, shipping, country,
    total: r2(subtotal - discount + shipping - shipDiscount), cost_total: r2(lines.reduce((s, l) => s + l.cost * l.qty, 0)) };
}

async function fulfil(env, orderId) {
  const o = orderOut(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first());
  if (!o || !["paid", "action_needed"].includes(o.status)) return;
  const done = o.supplier_order_ids || {};
  const notes = [];
  const groups = {};
  for (const l of o.items) {
    if (l.supplier === "cj" && l.vid) { const from = l.ships === "us" ? "US" : "CN"; (groups[from] ||= []).push(l); }
    else notes.push(`Order manually: ${l.qty} × ${l.title}${l.variant ? " (" + l.variant + ")" : ""} [${l.supplier}]`);
  }
  for (const [from, lines] of Object.entries(groups)) {
    const key = "cj_" + from;
    if (done[key]) continue;
    try { const r = await cjCreateOrder(env, o, lines, from); done[key] = r.cjOrderId; notes.push(`CJ order ${r.cjOrderId} created (${r.logisticName}) — pay it in CJ`); }
    catch (e) { notes.push(`CJ order from ${from} failed: ${e.message}`); }
  }
  const allCj = Object.keys(groups).every((f) => done["cj_" + f]) && o.items.every((l) => l.supplier === "cj" && l.vid);
  await env.DB.prepare("UPDATE orders SET status=?, supplier_order_ids=?, notes=? WHERE id=?")
    .bind(allCj ? "processing" : "action_needed", JSON.stringify(done), notes.join("\n"), orderId).run();
}

/* ---------------- scheduled sync ---------------- */
async function syncProducts(env, limit = 20) {
  const rows = (await env.DB.prepare("SELECT * FROM products WHERE supplier='cj' AND supplier_pid IS NOT NULL ORDER BY updated_at ASC LIMIT ?").bind(limit).all()).results;
  let ok = 0, errors = [];
  for (const p of rows) {
    try {
      const d = await cjProduct(env, p.supplier_pid);
      if (!p.video && !d.video && d.rawVideo?.length) d.video = (await cjPageVideo(p.supplier_pid, d.title)).video;
      const vm = parse(p.variant_map, {});
      for (const v of d.variants) if (vm[v.key]) vm[v.key].cost = v.cost;
      const cost = d.variants.length ? Math.max(...d.variants.map((v) => v.cost)) : d.cost;
      const first = d.variants[0]?.vid;
      const st = first ? await cjStock(env, first) : { total: p.stock, us: p.ships === "us" };
      await env.DB.prepare("UPDATE products SET cost=?, stock=?, ships=?, variant_map=?, video=COALESCE(video, ?), updated_at=datetime('now') WHERE id=?")
        .bind(cost, Math.min(st.total, 999), st.us ? "us" : "intl", JSON.stringify(vm), d.video, p.id).run();
      ok++;
    } catch (e) {
      errors.push(p.id + ": " + e.message);
      await env.DB.prepare("UPDATE products SET updated_at=datetime('now') WHERE id=?").bind(p.id).run();
    }
  }
  await setSetting(env, "last_sync", JSON.stringify({ at: new Date().toISOString(), ok, errors: errors.slice(0, 10) }));
  await bustCache(env);
  return { ok, errors };
}
async function syncTracking(env) {
  const rows = (await env.DB.prepare("SELECT * FROM orders WHERE status='processing' AND tracking_number IS NULL LIMIT 15").all()).results;
  for (const r of rows) {
    const ids = Object.values(parse(r.supplier_order_ids, {}));
    for (const id of ids) {
      try {
        const d = await cjOrderDetail(env, id);
        if (d.trackNumber) {
          await env.DB.prepare("UPDATE orders SET status='shipped', tracking_number=?, tracking_carrier=?, shipped_at=datetime('now') WHERE id=?").bind(d.trackNumber, d.carrier || null, r.id).run();
          break;
        }
      } catch {}
    }
  }
}

/* ---------------- router ---------------- */
// Busy public lists are cached at Cloudflare's edge for 60s, so a page view doesn't re-read ~2,000 products
// from D1 each time. Any admin change bumps a version number, so edits still show up right away.
const CACHED = new Set(["/api/products", "/api/collections", "/api/promos"]);
async function handle(req, env, ctx) {
  const url = new URL(req.url);
  if (req.method !== "GET" || !CACHED.has(url.pathname) || typeof caches === "undefined") return handleRoutes(req, env, ctx);
  let v = "0";
  try { v = (await env.DB.prepare("SELECT value FROM settings WHERE key='cache_v'").first())?.value || "0"; } catch {}
  const key = new Request(`${url.origin}${url.pathname}?cv=${v}&${url.searchParams}`);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  const res = await handleRoutes(req, env, ctx);
  if (res.status !== 200) return res;
  const out = new Response(res.body, res);
  out.headers.set("cache-control", "public, max-age=60");
  ctx.waitUntil(caches.default.put(key, out.clone()));
  return out;
}
const bustCache = (env) => setSetting(env, "cache_v", String(Date.now())).catch(() => {});
async function handleRoutes(req, env, ctx) {
  const url = new URL(req.url), path = url.pathname, m = req.method;
  let p;

  // Public config
  await ensureSchema(env);

  if (path === "/api/config") return json({ paypalClientId: env.PAYPAL_CLIENT_ID || "", paypalEnv: env.PAYPAL_ENV || "sandbox", freeShip: FREE_SHIP, countries: COUNTRY_NAMES, country: req.cf?.country || "US",
    heroSlides: parse(await getSetting(env, "hero_slides"), []), live: (({ status, title }) => ({ status: status || "off", title: title || "" }))(parse(await getSetting(env, "live"), {}) || {}) });

  if (path === "/api/collections") return json((await env.DB.prepare("SELECT id,name,blurb,cover FROM collections ORDER BY sort").all()).results);
  if (path === "/api/products") {
    const [rows, promos] = await Promise.all([env.DB.prepare("SELECT * FROM products WHERE active=1 ORDER BY sold DESC, reviews DESC, created_at DESC").all().then((r) => r.results), activePromos(env)]);
    return json(rows.map((r) => ({ ...toPublic(r), ...priced(r, promos) })));
  }
  if ((p = path.match(/^\/api\/products\/([\w-]+)$/))) {
    const r = await env.DB.prepare("SELECT * FROM products WHERE id=? AND active=1").bind(p[1]).first();
    return r ? json({ ...toPublic(r), ...priced(r, await activePromos(env)) }) : bad("Not found", 404);
  }
  if (path === "/api/promos") {
    const [promos, sched, vouchers, gifts] = await Promise.all([activePromos(env), schedules(env),
      env.DB.prepare(`SELECT ${PUBLIC_FIELDS} FROM discounts WHERE active=1 AND show=1 AND (ends_at IS NULL OR ends_at > datetime('now')) AND (max_uses=0 OR max_uses IS NULL OR uses < max_uses) ORDER BY type='shipping' DESC, percent DESC, amount DESC`).all()
        .then((r) => r.results.map((v) => ({ ...v, scope: v.scope || "all", target: v.scope === "products" ? parse(v.target, []) : v.target, title: voucherTitle(v) }))), activeGifts(env)]);
    return json({ promos: promos.map((x) => ({ id: x.id, label: x.label, percent: x.percent, scope: x.scope, target: x.scope === "products" ? x.targets : x.target, endsAt: x.endsAt, recurring: !!x.recur })),
      schedules: sched, vouchers, gifts: publicGifts(gifts) });
  }
  /* ---------- live chat (customer side) ---------- */
  if (path === "/api/chat/send" && m === "POST") {
    const b = await body(req);
    const text = str(b.body, 2000);
    if (!text) return bad("Type a message first");
    let c = b.id ? await env.DB.prepare("SELECT * FROM chats WHERE id=? AND token=?").bind(str(b.id, 40), str(b.token, 80)).first() : null;
    const email = str(b.email, 200).toLowerCase(), name = str(b.name, 80);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Please check your email address");
    if (!c) {
      const id = "c" + Date.now().toString(36) + [...crypto.getRandomValues(new Uint8Array(3))].map((x) => x.toString(16).padStart(2, "0")).join("");
      const token = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, "0")).join("");
      await env.DB.prepare("INSERT INTO chats (id, token, name, email, page) VALUES (?,?,?,?,?)").bind(id, token, name || null, email || null, str(b.page, 300)).run();
      c = { id, token };
    } else {
      const recent = await env.DB.prepare("SELECT COUNT(*) n FROM chat_messages WHERE chat_id=? AND sender='customer' AND created_at > datetime('now','-1 minute')").bind(c.id).first();
      if (recent.n >= 8) return bad("You're sending messages very quickly — please wait a moment", 429);
      if (email || name) await env.DB.prepare("UPDATE chats SET email=COALESCE(?, email), name=COALESCE(?, name) WHERE id=?").bind(email || null, name || null, c.id).run();
    }
    await env.DB.batch([
      env.DB.prepare("INSERT INTO chat_messages (chat_id, sender, body) VALUES (?, 'customer', ?)").bind(c.id, text),
      env.DB.prepare("UPDATE chats SET status='open', unread_admin=unread_admin+1, last_body=?, last_from='customer', last_at=datetime('now'), page=COALESCE(?, page) WHERE id=?").bind(text.slice(0, 200), str(b.page, 300) || null, c.id),
    ]);
    const msgs = (await env.DB.prepare("SELECT id, sender, body, created_at FROM chat_messages WHERE chat_id=? ORDER BY id").bind(c.id).all()).results;
    return json({ id: c.id, token: c.token, messages: msgs });
  }
  if (path === "/api/chat/poll") {
    const c = await env.DB.prepare("SELECT id, unread_customer FROM chats WHERE id=? AND token=?").bind(str(url.searchParams.get("id"), 40), str(url.searchParams.get("token"), 80)).first();
    if (!c) return bad("Chat not found", 404);
    const after = parseInt(url.searchParams.get("after")) || 0;
    const msgs = (await env.DB.prepare("SELECT id, sender, body, created_at FROM chat_messages WHERE chat_id=? AND id>? ORDER BY id LIMIT 200").bind(c.id, after).all()).results;
    if (url.searchParams.get("seen") === "1" && c.unread_customer) await env.DB.prepare("UPDATE chats SET unread_customer=0 WHERE id=?").bind(c.id).run();
    return json({ messages: msgs, unread: c.unread_customer });
  }
  /* ---------- Premium Live (public) ---------- */
  if (path === "/api/live") {
    const live = parse(await getSetting(env, "live"), {}) || {};
    const comments = (await env.DB.prepare("SELECT id, name, body, is_host, created_at FROM live_comments WHERE hidden=0 ORDER BY id DESC LIMIT 60").all()).results.reverse();
    let video = null;
    if (live.mediaId) { const md = await env.DB.prepare("SELECT key FROM media WHERE id=?").bind(live.mediaId).first(); if (md) video = "/media/" + md.key; }
    return json({ status: live.status || "off", title: live.title || "", startsAt: live.startsAt || null, embed: embedUrl(live.url), video, pinned: live.pinned || [], note: live.note || "", comments });
  }
  if (path === "/api/live/comments") {
    const after = parseInt(url.searchParams.get("after")) || 0;
    const rows = (await env.DB.prepare("SELECT id, name, body, is_host, created_at FROM live_comments WHERE hidden=0 AND id>? ORDER BY id LIMIT 100").bind(after).all()).results;
    const hiddenIds = (await env.DB.prepare("SELECT id FROM live_comments WHERE hidden=1 AND id > ? - 200").bind(after).all()).results.map((r) => r.id);
    const live = parse(await getSetting(env, "live"), {}) || {};
    return json({ comments: rows, hidden: hiddenIds, status: live.status || "off", pinned: live.pinned || [] });
  }
  if (path === "/api/live/comment" && m === "POST") {
    const b = await body(req), name = str(b.name, 40), text = str(b.body, 300);
    if (!name || !text) return bad("Add your name and a comment");
    const ip = req.headers.get("cf-connecting-ip") || "local";
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM live_comments WHERE ip=? AND created_at > datetime('now','-1 minute')").bind(ip).first();
    if (n.n >= 6) return bad("Slow down a little — you can comment again in a minute", 429);
    await env.DB.prepare("INSERT INTO live_comments (name, body, ip) VALUES (?,?,?)").bind(name, text, ip).run();
    return json({ ok: true });
  }
  if (path === "/api/subscribe" && m === "POST") {
    const e = str((await body(req)).email, 200).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return bad("Invalid email");
    await env.DB.prepare("INSERT OR IGNORE INTO subscribers (email) VALUES (?)").bind(e).run();
    return json({ ok: true });
  }
  if (path === "/api/discount" && m === "POST") {
    const d = await env.DB.prepare(`SELECT ${PUBLIC_FIELDS}, active, uses, max_uses FROM discounts WHERE code=?`).bind(str((await body(req)).code, 40).toUpperCase()).first();
    if (!d || !d.active) return bad("That code isn't valid", 404);
    const r = evaluate(d, { subtotal: 1e9, shipping: 1, hasOrdered: null });
    if (!r.ok && !r.short) return bad(r.reason, 400);
    const { active, uses, max_uses, ...pub } = d;
    return json({ ...pub, scope: d.scope || "all", target: d.scope === "products" ? parse(d.target, []) : d.target, title: voucherTitle(d) });
  }
  if (path === "/api/quote" && m === "POST") {
    try { const o = await buildOrder(env, await body(req)); return json({ subtotal: o.subtotal, discount: o.discount, code: o.code, shipDiscount: o.shipDiscount, shipCode: o.shipCode, codeNote: o.codeNote, shipping: o.shipping, total: o.total,
      gifts: o.lines.filter((l) => l.gift).map((l) => ({ id: l.id, title: l.title, variant: l.variant, qty: l.qty, value: l.giftValue, label: l.giftLabel })) }); }
    catch (e) { return bad(e.message); }
  }

  // Step 1: create local order + PayPal order
  if (path === "/api/checkout" && m === "POST") {
    const b = await body(req);
    const email = str(b.email, 200).toLowerCase();
    const a = b.address || {};
    const address = { address1: str(a.address1), address2: str(a.address2), city: str(a.city, 80), province: str(a.province, 80), zip: str(a.zip, 20) };
    const name = (str(a.firstName, 60) + " " + str(a.lastName, 60)).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("Please enter a valid email");
    if (!name || !address.address1 || !address.city || !address.zip) return bad("Please complete your shipping address");
    let o;
    try { o = await buildOrder(env, b); } catch (e) { return bad(e.message); }
    address.countryName = COUNTRY_NAMES[o.country] || o.country;
    const id = newOrderId();
    const order = { id, items: o.lines, total: o.total, shipping: o.shipping, discount: o.discount, shipDiscount: o.shipDiscount };
    let paypalId;
    try { paypalId = await createPaypalOrder(env, order); } catch (e) { return bad(e.message, 502); }
    await env.DB.prepare(`INSERT INTO orders (id,email,name,phone,address,country,items,subtotal,discount,discount_code,shipping,total,cost_total,paypal_order_id,status,marketing,ship_code,ship_discount)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?)`).bind(id, email, name, str(a.phone, 30), JSON.stringify(address), o.country, JSON.stringify(o.lines),
      o.subtotal, o.discount, o.code, o.shipping, o.total, o.cost_total, paypalId, b.marketing ? 1 : 0, o.shipCode, o.shipDiscount || 0).run();
    return json({ orderId: id, paypalOrderId: paypalId });
  }

  // Step 2: capture after buyer approves in PayPal
  if (path === "/api/checkout/capture" && m === "POST") {
    const b = await body(req);
    const o = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(str(b.orderId, 30)).first();
    if (!o) return bad("Order not found", 404);
    if (o.status !== "pending") return json({ ok: true, orderId: o.id, status: o.status });
    let cap;
    try { cap = await capturePaypalOrder(env, o.paypal_order_id); } catch (e) { return bad(e.message, 402); }
    if (cap.status !== "COMPLETED" || Math.abs(cap.amount - o.total) > 0.01 || cap.currency !== "USD") return bad("Payment was not completed", 402);
    await env.DB.prepare("UPDATE orders SET status='paid', paypal_capture_id=?, paid_at=datetime('now') WHERE id=? AND status='pending'").bind(cap.captureId, o.id).run();
    for (const c of [o.discount_code, o.ship_code].filter(Boolean)) await env.DB.prepare("UPDATE discounts SET uses=uses+1 WHERE code=?").bind(c).run();
    const items = parse(o.items, []);
    await env.DB.batch(items.map((l) => env.DB.prepare("UPDATE products SET stock=MAX(0, stock-?), sold=COALESCE(sold,0)+? WHERE id=?").bind(l.qty, l.gift ? 0 : l.qty, l.id)));
    ctx.waitUntil(fulfil(env, o.id).catch(() => {}));
    return json({ ok: true, orderId: o.id, status: "paid" });
  }

  if (path === "/api/orders/lookup") {
    const o = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND email=? AND status!='pending'")
      .bind(str(url.searchParams.get("id"), 30).toUpperCase().replace(/^#/, ""), str(url.searchParams.get("email"), 200).toLowerCase()).first();
    if (!o) return bad("We couldn't find that order. Check the number and email.", 404);
    const x = orderOut(o);
    return json({ id: x.id, status: x.status, created_at: x.created_at, shipped_at: x.shipped_at, total: x.total, country: x.country,
      items: x.items.map((l) => ({ title: l.title, variant: l.variant, qty: l.qty, price: l.price })), tracking_number: x.tracking_number, tracking_carrier: x.tracking_carrier });
  }

  /* ---------- admin ---------- */
  if (path === "/api/admin/login" && m === "POST") {
    if (!env.ADMIN_PASSWORD) return bad("Set the ADMIN_PASSWORD secret in Cloudflare first", 503);
    const pw = str((await body(req)).password, 200);
    const [a1, a2] = await Promise.all([hmac(env, "pw:" + pw), hmac(env, "pw:" + env.ADMIN_PASSWORD)]);
    if (a1 !== a2) { await new Promise((r) => setTimeout(r, 800)); return bad("Wrong password", 401); }
    const exp = String(Date.now() + 7 * 86400000);
    return json({ ok: true }, 200, { "set-cookie": `lm_admin=${exp}.${await hmac(env, exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800` });
  }
  if (path === "/api/admin/logout") return json({ ok: true }, 200, { "set-cookie": "lm_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict" });
  if (path.startsWith("/api/admin/")) {
    if (!(await isAdmin(req, env))) return bad("Not signed in", 401);
    const res = await admin(req, env, ctx, path, m, url);
    if (m !== "GET" && res.status < 400) ctx.waitUntil(bustCache(env));
    return res;
  }
  return bad("Not found", 404);
}

async function admin(req, env, ctx, path, m, url) {
  let p;
  if (path === "/api/admin/stats") {
    const q = (s) => env.DB.prepare(s).first();
    const [all, d30, today, action, products, subs, sync] = await Promise.all([
      q("SELECT COUNT(*) n, COALESCE(SUM(total),0) rev, COALESCE(SUM(total-cost_total-shipping*0),0) gross FROM orders WHERE status NOT IN ('pending','cancelled','refunded')"),
      q("SELECT COUNT(*) n, COALESCE(SUM(total),0) rev, COALESCE(SUM(total-cost_total),0) profit FROM orders WHERE status NOT IN ('pending','cancelled','refunded') AND created_at >= datetime('now','-30 days')"),
      q("SELECT COUNT(*) n, COALESCE(SUM(total),0) rev FROM orders WHERE status NOT IN ('pending','cancelled','refunded') AND date(created_at)=date('now')"),
      q("SELECT COUNT(*) n FROM orders WHERE status IN ('paid','action_needed')"),
      q("SELECT COUNT(*) n, SUM(active) active, SUM(CASE WHEN stock=0 THEN 1 ELSE 0 END) soldout FROM products"),
      q("SELECT COUNT(*) n FROM subscribers"), getSetting(env, "last_sync"),
    ]);
    const daily = (await env.DB.prepare("SELECT date(created_at) d, COUNT(*) n, SUM(total) rev FROM orders WHERE status NOT IN ('pending','cancelled','refunded') AND created_at >= datetime('now','-14 days') GROUP BY d ORDER BY d").all()).results;
    return json({ all, d30, today, action: action.n, products, subscribers: subs.n, lastSync: parse(sync, null), daily,
      config: { paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET), paypalEnv: env.PAYPAL_ENV || "sandbox", cj: !!env.CJ_API_KEY } });
  }
  if (path === "/api/admin/orders" && m === "GET") {
    const st = url.searchParams.get("status");
    const rows = st
      ? (await env.DB.prepare("SELECT * FROM orders WHERE status=? ORDER BY created_at DESC LIMIT 200").bind(st).all()).results
      : (await env.DB.prepare("SELECT * FROM orders WHERE status!='pending' ORDER BY created_at DESC LIMIT 200").all()).results;
    return json(rows.map(orderOut));
  }
  if ((p = path.match(/^\/api\/admin\/orders\/([\w-]+)$/)) && m === "PATCH") {
    const b = await body(req), sets = [], vals = [];
    for (const k of ["status", "tracking_number", "tracking_carrier", "notes"]) if (k in b) { sets.push(k + "=?"); vals.push(b[k] === "" ? null : str(b[k], 2000)); }
    if ("supplier_order_ids" in b) { sets.push("supplier_order_ids=?"); vals.push(JSON.stringify(b.supplier_order_ids || {})); }
    if (b.status === "shipped") sets.push("shipped_at=COALESCE(shipped_at, datetime('now'))");
    if (!sets.length) return bad("Nothing to update");
    await env.DB.prepare(`UPDATE orders SET ${sets.join(",")} WHERE id=?`).bind(...vals, p[1]).run();
    return json(orderOut(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(p[1]).first()));
  }
  if ((p = path.match(/^\/api\/admin\/orders\/([\w-]+)\/fulfil$/)) && m === "POST") {
    await fulfil(env, p[1]);
    return json(orderOut(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(p[1]).first()));
  }

  if (path === "/api/admin/seo" && m === "GET") {
    const base = siteUrl(env, req), key = await indexNowKey(env);
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM products WHERE active=1").first();
    return json({ site: base, sitemap: base + "/sitemap.xml", keyFile: `${base}/indexnow-${key}.txt`, liveProducts: n.n, last: parse(await getSetting(env, "indexnow_last"), null),
      google: !!env.GOOGLE_SITE_VERIFICATION, bing: !!env.BING_SITE_VERIFICATION });
  }
  if (path === "/api/admin/seo/submit" && m === "POST") {
    try { return json(await pingIndexNow(env, siteUrl(env, req), await allSitePaths(env))); } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/gifts" && m === "GET") {
    return json((await env.DB.prepare("SELECT g.*, p.title AS gift_title, p.stock AS gift_stock FROM gifts g LEFT JOIN products p ON p.id=g.gift_id ORDER BY g.created_at DESC").all()).results);
  }
  if (path === "/api/admin/gifts" && m === "POST") {
    const b = await body(req);
    const scope = b.scope === "collection" ? "collection" : "products";
    const target = scope === "collection" ? str(b.target, 40) : JSON.stringify((b.target || []).map((x) => str(x, 100)).slice(0, 2000));
    if (!target || target === "[]") return bad("Choose which products earn the gift");
    const g = await env.DB.prepare("SELECT id, title, variants FROM products WHERE id=?").bind(str(b.giftId, 100)).first();
    if (!g) return bad("Choose the gift product");
    const variants = parse(g.variants, []), variant = str(b.giftVariant, 150);
    if (variants.length && variant.split(" / ").length !== variants.length) return bad("Choose the gift's option (e.g. color)");
    const ends = b.endsAt ? new Date(b.endsAt).toISOString().slice(0, 19).replace("T", " ") : null;
    const label = str(b.label, 80) || "Free " + g.title.slice(0, 60);
    await env.DB.prepare("INSERT INTO gifts (label, trigger_scope, trigger_target, gift_id, gift_variant, per_item, ends_at) VALUES (?,?,?,?,?,?,?)")
      .bind(label, scope, target, g.id, variant || null, b.perItem ? 1 : 0, ends).run();
    return json({ ok: true });
  }
  if ((p = path.match(/^\/api\/admin\/gifts\/(\d+)$/)) && (m === "DELETE" || m === "PATCH")) {
    if (m === "DELETE") await env.DB.prepare("DELETE FROM gifts WHERE id=?").bind(Number(p[1])).run();
    else await env.DB.prepare("UPDATE gifts SET active=? WHERE id=?").bind((await body(req)).active ? 1 : 0, Number(p[1])).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/cat-rules" && m === "GET") return json(parse(await getSetting(env, "cat_rules"), []));
  if (path === "/api/admin/cat-rules" && m === "PUT") {
    const rules = ((await body(req)).rules || []).map((r) => ({ kw: str(r.kw, 60).toLowerCase(), cat: str(r.cat, 40) })).filter((r) => r.kw && r.cat).slice(0, 200);
    await setSetting(env, "cat_rules", JSON.stringify(rules));
    return json(rules);
  }
  if (path === "/api/admin/hero" && m === "PUT") {
    const ids = ((await body(req)).ids || []).map((x) => str(x, 100)).filter(Boolean).slice(0, 12);
    await setSetting(env, "hero_slides", JSON.stringify([...new Set(ids)]));
    return json({ ok: true, ids });
  }
  if (path === "/api/admin/products/bulk" && m === "POST") {
    const b = await body(req);
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => str(x, 100)).filter(Boolean).slice(0, 2000);
    if (!ids.length) return bad("No products selected");
    let sql, extra = [];
    if (b.action === "publish") sql = "UPDATE products SET active=1, updated_at=datetime('now') WHERE id=?";
    else if (b.action === "hide") sql = "UPDATE products SET active=0, updated_at=datetime('now') WHERE id=?";
    else if (b.action === "delete") sql = "DELETE FROM products WHERE id=?";
    else if (b.action === "category") { sql = "UPDATE products SET collection=?, updated_at=datetime('now') WHERE id=?"; extra = [str(b.collection, 40) || null]; }
    else if (b.action === "markup") {
      const mk = Number(b.markup);
      if (!(mk >= 1.1 && mk <= 10)) return bad("Markup must be between 1.1 and 10");
      // price = cost × markup, rounded to .99; compare-at 60% higher. Skips products with no cost.
      sql = "UPDATE products SET price=MAX(0.99, CAST(cost*?+0.999 AS INTEGER)-0.01), compare_at=NULL, updated_at=datetime('now') WHERE id=? AND cost>0";
      extra = [mk];
    } else return bad("Unknown action");
    for (let i = 0; i < ids.length; i += 90)
      await env.DB.batch(ids.slice(i, i + 90).map((id) => env.DB.prepare(sql).bind(...extra, id)));
    if (["publish", "category", "markup", "hide", "delete"].includes(b.action)) ctx.waitUntil(pingIndexNow(env, siteUrl(env, req), ids.map((id) => "/products/" + id)).catch(() => {}));
    return json({ ok: true, count: ids.length });
  }
  if (path === "/api/admin/products" && m === "GET") {
    // Lean list (thousands of products): short description, no variant map. The editor loads the full record.
    const rows = (await env.DB.prepare(`SELECT id,title,substr(description,1,300) description,collection,price,compare_at,cost,stock,rating,reviews,badge,sold,created_at,video,
      hue,icon,ships,images,variants,supplier,supplier_pid,supplier_url,active,updated_at FROM products ORDER BY created_at DESC`).all()).results;
    return json(rows.map((r) => ({ ...toAdmin(r), lite: true })));
  }
  if ((p = path.match(/^\/api\/admin\/products\/([\w-]+)$/))) {
    if (m === "GET") { const r = await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(p[1]).first(); return r ? json(toAdmin(r)) : bad("Not found", 404); }
    if (m === "DELETE") { await env.DB.prepare("DELETE FROM products WHERE id=?").bind(p[1]).run(); return json({ ok: true }); }
    if (m === "PATCH") {
      const b = await body(req), map = { title: "title", description: "description", collection: "collection", price: "price", compareAt: "compare_at",
        stock: "stock", badge: "badge", active: "active", ships: "ships", supplierUrl: "supplier_url", cost: "cost" };
      const sets = [], vals = [];
      for (const [k, col] of Object.entries(map)) if (k in b) {
        let v = b[k];
        if (["price", "compareAt", "cost"].includes(k)) v = v === "" || v == null ? null : r2(Number(v));
        else if (k === "stock") v = Math.max(0, parseInt(v) || 0);
        else if (k === "active") v = v ? 1 : 0;
        else v = v === "" ? null : str(v, 3000);
        sets.push(col + "=?"); vals.push(v);
      }
      if ("video" in b) { const v = str(b.video, 500); if (v && !/^(https:\/\/|\/media\/)/.test(v)) return bad("Video must be an uploaded video or an https:// link to an MP4"); sets.push("video=?"); vals.push(v || null); }
      if ("images" in b) { sets.push("images=?"); vals.push(JSON.stringify((b.images || []).map((x) => str(x, 500)).filter(Boolean).slice(0, 10))); }
      if ("variants" in b) { sets.push("variants=?"); vals.push(JSON.stringify(b.variants || [])); }
      if (!sets.length) return bad("Nothing to update");
      await env.DB.prepare(`UPDATE products SET ${sets.join(",")}, updated_at=datetime('now') WHERE id=?`).bind(...vals, p[1]).run();
      ctx.waitUntil(pingIndexNow(env, siteUrl(env, req), ["/products/" + p[1]]).catch(() => {}));
      return json(toAdmin(await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(p[1]).first()));
    }
  }
  if (path === "/api/admin/products" && m === "POST") {
    // Manual product (e.g. AliExpress item fulfilled by hand)
    const b = await body(req);
    const title = str(b.title, 120);
    if (!title || !(Number(b.price) > 0)) return bad("Title and price are required");
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + Date.now().toString(36).slice(-4);
    await env.DB.prepare(`INSERT INTO products (id,title,description,collection,price,compare_at,cost,stock,images,variants,supplier,supplier_url,ships,reviews,rating)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,5)`).bind(id, title, str(b.description, 3000), str(b.collection, 40), r2(Number(b.price)), b.compareAt ? r2(Number(b.compareAt)) : null,
      r2(Number(b.cost) || 0), Math.max(0, parseInt(b.stock) || 0), JSON.stringify((b.images || []).filter(Boolean).slice(0, 10)), JSON.stringify(b.variants || []),
      ["aliexpress", "manual"].includes(b.supplier) ? b.supplier : "manual", str(b.supplierUrl, 500), b.ships === "us" ? "us" : "intl").run();
    return json(toAdmin(await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(id).first()));
  }
  if (path === "/api/admin/collections" && m === "GET") return json((await env.DB.prepare("SELECT * FROM collections ORDER BY sort").all()).results);
  if (path === "/api/admin/collections" && m === "POST") {
    const b = await body(req), name = str(b.name, 60);
    if (!name) return bad("Name required");
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await env.DB.prepare("INSERT OR REPLACE INTO collections (id,name,blurb,sort) VALUES (?,?,?,COALESCE((SELECT MAX(sort)+1 FROM collections),0))").bind(id, name, str(b.blurb, 200)).run();
    return json({ ok: true, id });
  }

  if ((p = path.match(/^\/api\/admin\/collections\/([\w-]+)$/)) && m === "PATCH") {
    const cover = str((await body(req)).cover, 100) || null;
    await env.DB.prepare("UPDATE collections SET cover=? WHERE id=?").bind(cover, p[1]).run();
    return json({ ok: true });
  }
  if ((p = path.match(/^\/api\/admin\/collections\/([\w-]+)$/)) && m === "DELETE") {
    await env.DB.batch([env.DB.prepare("UPDATE products SET collection=NULL WHERE collection=?").bind(p[1]), env.DB.prepare("DELETE FROM collections WHERE id=?").bind(p[1])]);
    return json({ ok: true });
  }
  /* ---------- Videos (R2) ---------- */
  if (path === "/api/admin/media" && m === "GET") {
    const rows = (await env.DB.prepare("SELECT m.*, p.title AS product_title FROM media m LEFT JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC LIMIT 300").all()).results;
    return json({ ready: mediaReady(env), items: rows.map((r) => ({ ...r, url: "/media/" + r.key })) });
  }
  try {
    if (path === "/api/admin/media/start" && m === "POST") { const b = await body(req); return json(await startUpload(env, str(b.name, 200), str(b.type, 100))); }
    if (path === "/api/admin/media/part" && m === "PUT") {
      return json(await uploadPart(env, str(url.searchParams.get("key"), 300), str(url.searchParams.get("uploadId"), 500), parseInt(url.searchParams.get("n")), req.body));
    }
    if (path === "/api/admin/media/complete" && m === "POST") {
      const b = await body(req), key = str(b.key, 300);
      const r = await completeUpload(env, key, str(b.uploadId, 500), b.parts || []);
      const productId = str(b.productId, 100) || null;
      const ins = await env.DB.prepare("INSERT INTO media (key, title, kind, product_id, size) VALUES (?,?,?,?,?)").bind(key, str(b.title, 120) || null, b.kind === "live" ? "live" : "product", productId, r.size).run();
      if (productId) {
        await env.DB.prepare("UPDATE products SET video=?, updated_at=datetime('now') WHERE id=?").bind("/media/" + key, productId).run();
        ctx.waitUntil(pingIndexNow(env, siteUrl(env, req), ["/products/" + productId]).catch(() => {}));
      }
      return json({ id: ins.meta?.last_row_id, key, url: "/media/" + key, size: r.size });
    }
  } catch (e) { return bad(e.message, e.status || 500); }
  if ((p = path.match(/^\/api\/admin\/media\/(\d+)$/)) && m === "DELETE") {
    const md = await env.DB.prepare("SELECT * FROM media WHERE id=?").bind(Number(p[1])).first();
    if (!md) return bad("Not found", 404);
    await deleteObject(env, md.key);
    await env.DB.batch([env.DB.prepare("UPDATE products SET video=NULL WHERE video=?").bind("/media/" + md.key), env.DB.prepare("DELETE FROM media WHERE id=?").bind(md.id)]);
    return json({ ok: true });
  }
  /* ---------- Premium Live (admin) ---------- */
  if (path === "/api/admin/live" && m === "GET") return json({ ...(parse(await getSetting(env, "live"), {}) || {}), mediaReady: mediaReady(env) });
  if (path === "/api/admin/live" && m === "PUT") {
    const b = await body(req);
    const status = ["off", "scheduled", "live", "replay"].includes(b.status) ? b.status : "off";
    const live = { status, title: str(b.title, 120), url: str(b.url, 500), mediaId: b.mediaId ? Number(b.mediaId) : null, startsAt: b.startsAt || null,
      note: str(b.note, 200), pinned: (b.pinned || []).map((x) => str(x, 100)).slice(0, 30) };
    if (status === "live" && !embedUrl(live.url)) return bad("To go live, paste your YouTube Live or Facebook Live link");
    if (status === "replay" && !live.mediaId && !embedUrl(live.url)) return bad("Choose an uploaded video (or a YouTube/Facebook link) for the replay");
    if (status === "scheduled" && !live.startsAt) return bad("Choose when the live starts");
    await setSetting(env, "live", JSON.stringify(live));
    return json({ ok: true });
  }
  if (path === "/api/admin/live/comment" && m === "POST") {
    const text = str((await body(req)).body, 300);
    if (!text) return bad("Type a message");
    await env.DB.prepare("INSERT INTO live_comments (name, body, is_host) VALUES ('LeeysPremium', ?, 1)").bind(text).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/live/comments") return json((await env.DB.prepare("SELECT id, name, body, is_host, hidden, created_at FROM live_comments ORDER BY id DESC LIMIT 200").all()).results);
  if ((p = path.match(/^\/api\/admin\/live\/comments\/(\d+)$/)) && m === "DELETE") {
    await env.DB.prepare("UPDATE live_comments SET hidden=1 WHERE id=?").bind(Number(p[1])).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/live/clear" && m === "POST") { await env.DB.prepare("DELETE FROM live_comments").run(); return json({ ok: true }); }
  if (path === "/api/admin/promos" && m === "GET") {
    const rows = (await env.DB.prepare("SELECT *, CASE WHEN active=1 AND starts_at<=datetime('now') AND ends_at>datetime('now') THEN 'live' WHEN active=1 AND starts_at>datetime('now') THEN 'scheduled' ELSE 'ended' END state FROM promos ORDER BY created_at DESC LIMIT 100").all()).results;
    return json(rows.map((r) => r.recur ? { ...r, schedule: scheduleText(r), state: r.state === "live" ? (windowEnd(r) ? "live" : "waiting") : r.state } : r));
  }
  if (path === "/api/admin/promos" && m === "POST") {
    const b = await body(req), pct = Number(b.percent), label = str(b.label, 60) || `${pct}% off`;
    if (!(pct >= 1 && pct <= 90)) return bad("Discount must be between 1% and 90%");
    const scope = ["all", "collection", "products"].includes(b.scope) ? b.scope : "all";
    const target = scope === "collection" ? str(b.target, 40) : scope === "products" ? JSON.stringify((b.target || []).map((x) => str(x, 100)).slice(0, 2000)) : null;
    if (scope !== "all" && (!target || target === "[]")) return bad("Choose what the promotion applies to");
    const iso = (v) => { const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 19).replace("T", " "); };
    const recur = !!b.recur;
    const starts = b.startsAt ? iso(b.startsAt) : iso(Date.now()), ends = b.endsAt ? iso(b.endsAt) : recur ? "2099-12-31 00:00:00" : null;
    if (!ends || ends <= starts) return bad("Choose an end time after the start time");
    let days = null, sh = 0, eh = 24, tz = "America/New_York";
    if (recur) {
      days = [...new Set((b.days || []).map(Number).filter((d) => d >= 0 && d <= 6))].sort().join(",");
      sh = Math.max(0, Math.min(23, parseInt(b.startHour) || 0)); eh = Math.max(1, Math.min(24, parseInt(b.endHour) || 24));
      tz = str(b.tz, 60) || tz;
      try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { return bad("Unknown time zone"); }
      if (!days) return bad("Pick at least one day of the week");
      if (eh <= sh) return bad("The end hour must be after the start hour");
    }
    const r = await env.DB.prepare("INSERT INTO promos (label, percent, scope, target, starts_at, ends_at, recur, days, start_hour, end_hour, tz) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(label, pct, scope, target, starts, ends, recur ? 1 : 0, days, sh, eh, tz).run();
    const ids = scope === "products" ? JSON.parse(target) : (await env.DB.prepare(scope === "all" ? "SELECT id FROM products WHERE active=1" : "SELECT id FROM products WHERE active=1 AND collection=?").bind(...(scope === "all" ? [] : [target])).all()).results.map((x) => x.id);
    ctx.waitUntil(pingIndexNow(env, siteUrl(env, req), ids.map((id) => "/products/" + id)).catch(() => {}));
    return json({ ok: true, id: r.meta?.last_row_id });
  }
  if ((p = path.match(/^\/api\/admin\/promos\/(\d+)$/)) && (m === "DELETE" || m === "PATCH")) {
    await env.DB.prepare(m === "DELETE" ? "DELETE FROM promos WHERE id=?" : "UPDATE promos SET active=0, ends_at=MIN(ends_at, datetime('now')) WHERE id=?").bind(Number(p[1])).run();
    return json({ ok: true });
  }
  if (path === "/api/admin/discounts" && m === "GET") return json((await env.DB.prepare("SELECT * FROM discounts ORDER BY code").all()).results);
  if (path === "/api/admin/discounts" && m === "POST") {
    const b = await body(req), code = str(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const type = ["percent", "amount", "shipping"].includes(b.type) ? b.type : "percent";
    const pct = Number(b.percent) || 0, amount = Math.max(0, Number(b.amount) || 0), maxOff = Math.max(0, Number(b.maxOff) || 0);
    if (!code) return bad("Enter a voucher code");
    if (type === "percent" && !(pct > 0 && pct <= 90)) return bad("Percent must be between 1 and 90");
    if (type === "amount" && !(amount > 0)) return bad("Enter how many dollars off");
    const ends = b.endsAt ? new Date(b.endsAt).toISOString().slice(0, 19).replace("T", " ") : null;
    const scope = ["collection", "products"].includes(b.scope) ? b.scope : "all";
    const target = scope === "collection" ? str(b.target, 40) : scope === "products" ? JSON.stringify((b.target || []).map((x) => str(x, 100)).slice(0, 2000)) : null;
    if (scope !== "all" && (!target || target === "[]")) return bad("Choose the products or category this voucher applies to");
    await env.DB.prepare(`INSERT INTO discounts (code, type, percent, amount, max_off, min_spend, show, ends_at, label, first_order, max_uses, scope, target, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(code) DO UPDATE SET type=excluded.type, percent=excluded.percent, amount=excluded.amount, max_off=excluded.max_off, min_spend=excluded.min_spend, show=excluded.show,
      ends_at=excluded.ends_at, label=excluded.label, first_order=excluded.first_order, max_uses=excluded.max_uses, scope=excluded.scope, target=excluded.target, active=1`)
      .bind(code, type, type === "percent" ? pct : 0, type === "percent" ? 0 : amount, type === "percent" ? maxOff : 0, Math.max(0, Number(b.minSpend) || 0), b.show ? 1 : 0, ends,
        str(b.label, 60) || null, b.firstOrder ? 1 : 0, Math.max(0, parseInt(b.maxUses) || 0), scope, target).run();
    return json({ ok: true });
  }
  if ((p = path.match(/^\/api\/admin\/discounts\/([\w-]+)$/)) && m === "PATCH") {
    const b = await body(req);
    if ("active" in b) await env.DB.prepare("UPDATE discounts SET active=? WHERE code=?").bind(b.active ? 1 : 0, p[1]).run();
    if ("show" in b) await env.DB.prepare("UPDATE discounts SET show=? WHERE code=?").bind(b.show ? 1 : 0, p[1]).run();
    return json({ ok: true });
  }

  // CJ
  if (path === "/api/admin/cj/categories") {
    try { return json(await cjCategories(env)); } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/cj/search") {
    try {
      const r = await cjSearch(env, {
        q: str(url.searchParams.get("q"), 100), page: parseInt(url.searchParams.get("page")) || 1, us: url.searchParams.get("us") === "1",
        sort: str(url.searchParams.get("sort"), 20), categoryIds: str(url.searchParams.get("cats"), 4000).split(",").filter(Boolean),
      });
      const pids = r.items.map((i) => i.pid).filter(Boolean);
      if (pids.length) {
        const have = (await env.DB.prepare(`SELECT supplier_pid, id FROM products WHERE supplier='cj' AND supplier_pid IN (${pids.map(() => "?").join(",")})`).bind(...pids).all()).results;
        const map = Object.fromEntries(have.map((h) => [h.supplier_pid, h.id]));
        for (const i of r.items) i.imported = map[i.pid] || null;
      }
      return json(r);
    } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/cj/import" && m === "POST") {
    const b = await body(req);
    const existing = await env.DB.prepare("SELECT * FROM products WHERE supplier='cj' AND supplier_pid=?").bind(str(b.pid, 80)).first();
    if (existing) return json({ ...toAdmin(existing), alreadyImported: true });
    try {
      const d = await cjProduct(env, str(b.pid, 80));
      if (!d.video && d.rawVideo?.length) d.video = (await cjPageVideo(d.pid || str(b.pid, 80), d.title)).video;
      let st = { total: 100, us: false };
      if (d.variants[0]) try { st = await cjStock(env, d.variants[0].vid); } catch {}
      let collection = str(b.collection, 40);
      if (!collection || collection === "auto") {
        const allowed = (await env.DB.prepare("SELECT id FROM collections").all()).results.map((c) => c.id);
        collection = classify({ title: d.title, category: str(b.cjCategory, 300), description: d.description }, allowed, parse(await getSetting(env, "cat_rules"), []))?.id || null;
      }
      const rec = cjToRecord(d, { markup: Number(b.markup) || 2.5, collection, ships: st.us ? "us" : "intl" });
      rec.stock = Math.min(st.total || 0, 999) || 100;
      await env.DB.prepare(`INSERT OR REPLACE INTO products (id,title,description,collection,price,compare_at,cost,stock,images,variants,variant_map,supplier,supplier_pid,ships,reviews,rating,active,video)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,5,?,?)`).bind(rec.id, rec.title, rec.description, rec.collection, rec.price, rec.compare_at, rec.cost, rec.stock,
        rec.images, rec.variants, rec.variant_map, "cj", rec.supplier_pid, rec.ships, b.publish ? 1 : 0, rec.video).run();
      if (b.publish) ctx.waitUntil(pingIndexNow(env, siteUrl(env, req), ["/products/" + rec.id]).catch(() => {}));
      return json(toAdmin(await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(rec.id).first()));
    } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/cj/video" && m === "GET") { // diagnostic: what CJ returns for a product's video
    try {
      const pid = str(url.searchParams.get("pid"), 80), d = await cjProduct(env, pid);
      if (d.video || !d.rawVideo || !d.rawVideo.length) return json({ video: d.video, raw: d.rawVideo });
      const pg = await cjPageVideo(pid, d.title); return json({ video: pg.video, raw: d.rawVideo, page: pg.why || "ok" });
    } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/sync" && m === "POST") {
    try { const r = await syncProducts(env, 10); ctx.waitUntil(syncTracking(env)); return json(r); } catch (e) { return bad(e.message, 502); }
  }
  /* ---------- live chat (admin side) ---------- */
  if (path === "/api/admin/chats/unread") {
    const r = await env.DB.prepare("SELECT COALESCE(SUM(unread_admin),0) n, COUNT(CASE WHEN unread_admin>0 THEN 1 END) chats FROM chats").first();
    return json(r);
  }
  if (path === "/api/admin/chats" && m === "GET") {
    const st = url.searchParams.get("status") || "open";
    return json((await env.DB.prepare("SELECT id, name, email, page, status, unread_admin, last_body, last_from, last_at, created_at FROM chats WHERE status=? ORDER BY last_at DESC LIMIT 200").bind(st).all()).results);
  }
  if ((p = path.match(/^\/api\/admin\/chats\/([\w-]+)$/))) {
    const c = await env.DB.prepare("SELECT id, name, email, page, status, created_at FROM chats WHERE id=?").bind(p[1]).first();
    if (!c) return bad("Chat not found", 404);
    if (m === "GET") {
      await env.DB.prepare("UPDATE chats SET unread_admin=0 WHERE id=?").bind(c.id).run();
      const msgs = (await env.DB.prepare("SELECT id, sender, body, created_at FROM chat_messages WHERE chat_id=? ORDER BY id").bind(c.id).all()).results;
      const orders = c.email ? (await env.DB.prepare("SELECT id, status, total, created_at FROM orders WHERE email=? AND status!='pending' ORDER BY created_at DESC LIMIT 10").bind(c.email).all()).results : [];
      return json({ chat: c, messages: msgs, orders });
    }
    if (m === "POST") {
      const text = str((await body(req)).body, 4000);
      if (!text) return bad("Type a reply first");
      await env.DB.batch([
        env.DB.prepare("INSERT INTO chat_messages (chat_id, sender, body) VALUES (?, 'admin', ?)").bind(c.id, text),
        env.DB.prepare("UPDATE chats SET unread_customer=unread_customer+1, unread_admin=0, last_body=?, last_from='admin', last_at=datetime('now'), status='open' WHERE id=?").bind(text.slice(0, 200), c.id),
      ]);
      return json({ ok: true });
    }
    if (m === "PATCH") {
      const s2 = (await body(req)).status === "closed" ? "closed" : "open";
      await env.DB.prepare("UPDATE chats SET status=?, unread_admin=0 WHERE id=?").bind(s2, c.id).run();
      return json({ ok: true });
    }
    if (m === "DELETE") {
      await env.DB.batch([env.DB.prepare("DELETE FROM chat_messages WHERE chat_id=?").bind(c.id), env.DB.prepare("DELETE FROM chats WHERE id=?").bind(c.id)]);
      return json({ ok: true });
    }
  }
  if (path === "/api/admin/subscribers") return json((await env.DB.prepare("SELECT * FROM subscribers ORDER BY created_at DESC").all()).results);
  return bad("Not found", 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), path = url.pathname;
    if (!path.startsWith("/api/")) {
      try {
        // Send every visitor and crawler to the main domain (e.g. workers.dev or www → leeyspremium.com)
        if (env.SITE_URL && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname) && (req.method === "GET" || req.method === "HEAD")) {
          const site = new URL(env.SITE_URL);
          if (url.hostname !== site.hostname && !path.startsWith("/admin")) return Response.redirect(site.origin + path + url.search, 301);
        }
        if (path.startsWith("/media/")) return await serveMedia(req, env, decodeURIComponent(path.slice(7)));
        if (path === "/sitemap.xml") return await sitemap(req, env);
        if (path === "/robots.txt") return robots(req, env);
        const k = path.match(/^\/indexnow-([a-f0-9]{32})\.txt$/);
        if (k) { await ensureSchema(env); return k[1] === (await indexNowKey(env)) ? new Response(k[1], { headers: { "content-type": "text/plain" } }) : new Response("Not found", { status: 404 }); }
        const accept = req.headers.get("accept") || "";
        if ((req.method === "GET" || req.method === "HEAD") && !/\.[a-z0-9]+$/i.test(path) && !path.startsWith("/admin") && (accept.includes("text/html") || accept === "*/*" || !accept))
          return await renderPage(req, env);
      } catch (e) { console.error("seo", e); }
      return env.ASSETS.fetch(req);
    }
    try { return await handle(req, env, ctx); }
    catch (e) { console.error(e); return bad(e.message?.includes("no such table") || !env.DB ? "Database not connected yet" : "Server error", 500); }
  },
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    if (!env.CJ_API_KEY) return;
    ctx.waitUntil((async () => { await syncTracking(env); await syncProducts(env, 25); })());
  },
};
