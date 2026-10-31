import { ensureSchema, toPublic, toAdmin, orderOut, parse, getSetting, setSetting } from "./db.js";
import { createPaypalOrder, capturePaypalOrder } from "./paypal.js";
import { cjSearch, cjProduct, cjToRecord, cjStock, cjCreateOrder, cjOrderDetail } from "./cj.js";

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
    lines.push({ id: p.id, title: p.title, variant, qty, price: p.price, cost: vmEntry?.cost ?? p.cost, supplier: p.supplier, vid: vmEntry?.vid || null, ships: p.ships });
  }
  const subtotal = r2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  let discount = 0, code = null;
  if (b.code) {
    const d = await env.DB.prepare("SELECT * FROM discounts WHERE code=? AND active=1").bind(str(b.code, 40).toUpperCase()).first();
    if (d) { discount = r2(subtotal * d.percent / 100); code = d.code; }
  }
  const country = str(b.country, 2).toUpperCase() || "US";
  const shipping = shippingFor(country, subtotal - discount);
  return { lines, subtotal, discount, code, shipping, country, total: r2(subtotal - discount + shipping), cost_total: r2(lines.reduce((s, l) => s + l.cost * l.qty, 0)) };
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
      const vm = parse(p.variant_map, {});
      for (const v of d.variants) if (vm[v.key]) vm[v.key].cost = v.cost;
      const cost = d.variants.length ? Math.max(...d.variants.map((v) => v.cost)) : d.cost;
      const first = d.variants[0]?.vid;
      const st = first ? await cjStock(env, first) : { total: p.stock, us: p.ships === "us" };
      await env.DB.prepare("UPDATE products SET cost=?, stock=?, ships=?, variant_map=?, updated_at=datetime('now') WHERE id=?")
        .bind(cost, Math.min(st.total, 999), st.us ? "us" : "intl", JSON.stringify(vm), p.id).run();
      ok++;
    } catch (e) {
      errors.push(p.id + ": " + e.message);
      await env.DB.prepare("UPDATE products SET updated_at=datetime('now') WHERE id=?").bind(p.id).run();
    }
  }
  await setSetting(env, "last_sync", JSON.stringify({ at: new Date().toISOString(), ok, errors: errors.slice(0, 10) }));
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
async function handle(req, env, ctx) {
  const url = new URL(req.url), path = url.pathname, m = req.method;
  let p;

  // Public config
  if (path === "/api/config") return json({ paypalClientId: env.PAYPAL_CLIENT_ID || "", paypalEnv: env.PAYPAL_ENV || "sandbox", freeShip: FREE_SHIP, countries: COUNTRY_NAMES });

  await ensureSchema(env);

  if (path === "/api/collections") return json((await env.DB.prepare("SELECT id,name,blurb,cover FROM collections ORDER BY sort").all()).results);
  if (path === "/api/products") {
    const rows = (await env.DB.prepare("SELECT * FROM products WHERE active=1 ORDER BY reviews DESC, created_at DESC").all()).results;
    return json(rows.map(toPublic));
  }
  if ((p = path.match(/^\/api\/products\/([\w-]+)$/))) {
    const r = await env.DB.prepare("SELECT * FROM products WHERE id=? AND active=1").bind(p[1]).first();
    return r ? json(toPublic(r)) : bad("Not found", 404);
  }
  if (path === "/api/subscribe" && m === "POST") {
    const e = str((await body(req)).email, 200).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return bad("Invalid email");
    await env.DB.prepare("INSERT OR IGNORE INTO subscribers (email) VALUES (?)").bind(e).run();
    return json({ ok: true });
  }
  if (path === "/api/discount" && m === "POST") {
    const d = await env.DB.prepare("SELECT code, percent FROM discounts WHERE code=? AND active=1").bind(str((await body(req)).code, 40).toUpperCase()).first();
    return d ? json(d) : bad("That code isn't valid", 404);
  }
  if (path === "/api/quote" && m === "POST") {
    try { const o = await buildOrder(env, await body(req)); return json({ subtotal: o.subtotal, discount: o.discount, code: o.code, shipping: o.shipping, total: o.total }); }
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
    const order = { id, items: o.lines, total: o.total, shipping: o.shipping, discount: o.discount };
    let paypalId;
    try { paypalId = await createPaypalOrder(env, order); } catch (e) { return bad(e.message, 502); }
    await env.DB.prepare(`INSERT INTO orders (id,email,name,phone,address,country,items,subtotal,discount,discount_code,shipping,total,cost_total,paypal_order_id,status,marketing)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)`).bind(id, email, name, str(a.phone, 30), JSON.stringify(address), o.country, JSON.stringify(o.lines),
      o.subtotal, o.discount, o.code, o.shipping, o.total, o.cost_total, paypalId, b.marketing ? 1 : 0).run();
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
    if (o.discount_code) await env.DB.prepare("UPDATE discounts SET uses=uses+1 WHERE code=?").bind(o.discount_code).run();
    const items = parse(o.items, []);
    await env.DB.batch(items.map((l) => env.DB.prepare("UPDATE products SET stock=MAX(0, stock-?), reviews=reviews WHERE id=?").bind(l.qty, l.id)));
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
    return admin(req, env, ctx, path, m, url);
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

  if (path === "/api/admin/products" && m === "GET") {
    return json((await env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all()).results.map(toAdmin));
  }
  if ((p = path.match(/^\/api\/admin\/products\/([\w-]+)$/))) {
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
      if ("images" in b) { sets.push("images=?"); vals.push(JSON.stringify((b.images || []).map((x) => str(x, 500)).filter(Boolean).slice(0, 10))); }
      if ("variants" in b) { sets.push("variants=?"); vals.push(JSON.stringify(b.variants || [])); }
      if (!sets.length) return bad("Nothing to update");
      await env.DB.prepare(`UPDATE products SET ${sets.join(",")}, updated_at=datetime('now') WHERE id=?`).bind(...vals, p[1]).run();
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
  if (path === "/api/admin/discounts" && m === "GET") return json((await env.DB.prepare("SELECT * FROM discounts ORDER BY code").all()).results);
  if (path === "/api/admin/discounts" && m === "POST") {
    const b = await body(req), code = str(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ""), pct = Number(b.percent);
    if (!code || !(pct > 0 && pct <= 90)) return bad("Code and a percent between 1 and 90 are required");
    await env.DB.prepare("INSERT INTO discounts (code,percent,active) VALUES (?,?,1) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent, active=1").bind(code, pct).run();
    return json({ ok: true });
  }
  if ((p = path.match(/^\/api\/admin\/discounts\/([\w-]+)$/)) && m === "PATCH") {
    await env.DB.prepare("UPDATE discounts SET active=? WHERE code=?").bind((await body(req)).active ? 1 : 0, p[1]).run();
    return json({ ok: true });
  }

  // CJ
  if (path === "/api/admin/cj/search") {
    try { return json(await cjSearch(env, str(url.searchParams.get("q"), 100), parseInt(url.searchParams.get("page")) || 1)); }
    catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/cj/import" && m === "POST") {
    const b = await body(req);
    try {
      const d = await cjProduct(env, str(b.pid, 80));
      let st = { total: 100, us: false };
      if (d.variants[0]) try { st = await cjStock(env, d.variants[0].vid); } catch {}
      const rec = cjToRecord(d, { markup: Number(b.markup) || 2.5, collection: str(b.collection, 40), ships: st.us ? "us" : "intl" });
      rec.stock = Math.min(st.total || 0, 999) || 100;
      await env.DB.prepare(`INSERT OR REPLACE INTO products (id,title,description,collection,price,compare_at,cost,stock,images,variants,variant_map,supplier,supplier_pid,ships,reviews,rating,active)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,5,?)`).bind(rec.id, rec.title, rec.description, rec.collection, rec.price, rec.compare_at, rec.cost, rec.stock,
        rec.images, rec.variants, rec.variant_map, "cj", rec.supplier_pid, rec.ships, b.publish ? 1 : 0).run();
      return json(toAdmin(await env.DB.prepare("SELECT * FROM products WHERE id=?").bind(rec.id).first()));
    } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/sync" && m === "POST") {
    try { const r = await syncProducts(env, 10); ctx.waitUntil(syncTracking(env)); return json(r); } catch (e) { return bad(e.message, 502); }
  }
  if (path === "/api/admin/subscribers") return json((await env.DB.prepare("SELECT * FROM subscribers ORDER BY created_at DESC").all()).results);
  return bad("Not found", 404);
}

export default {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(req);
    try { return await handle(req, env, ctx); }
    catch (e) { console.error(e); return bad(e.message?.includes("no such table") || !env.DB ? "Database not connected yet" : "Server error", 500); }
  },
  async scheduled(event, env, ctx) {
    await ensureSchema(env);
    if (!env.CJ_API_KEY) return;
    ctx.waitUntil((async () => { await syncTracking(env); await syncProducts(env, 25); })());
  },
};
