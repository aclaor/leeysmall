// Prize draw (sweepstakes): free one-tap entry (no purchase necessary) or an entry included with a $1 voucher purchase.
// Winners are picked on the published date with a provably fair method: the seed's SHA-256 hash is public from the start,
// the seed is revealed after the draw, and anyone can re-run the pick over the published ticket list.
import { getSetting, setSetting, parse } from "./db.js";



const now = () => new Date().toISOString();
const sqlNow = () => now().slice(0, 19).replace("T", " ");
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const rand = (n, abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") => { const b = crypto.getRandomValues(new Uint8Array(n)); return [...b].map((x) => abc[x % abc.length]).join(""); };
export const ticketCode = () => "LP-" + rand(4) + "-" + rand(4);
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export function eligibleCountry(d, cc) {
  const list = String(d.countries || "ALL").toUpperCase().split(/[\s,]+/).filter(Boolean);
  return list.includes("ALL") || list.includes(String(cc || "").toUpperCase());
}

// Public view of a draw (never the seed before the draw)
export async function publicDraw(env, d, cc) {
  const ids = parse(d.prizes, []);
  const rows = ids.length ? (await env.DB.prepare(`SELECT id,title,price,images FROM products WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results : [];
  const prizes = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean).map((r) => ({ id: r.id, title: r.title, value: r.price, image: parse(r.images, [])[0] || null }));
  const st = await env.DB.prepare("SELECT COUNT(*) n, SUM(kind='paid') paid FROM tickets WHERE draw_id=? AND status='active'").bind(d.id).first();
  const raised = (st.paid || 0) * d.entry_price;
  const out = { id: d.id, title: d.title, prizes, entryPrice: d.entry_price, voucherValue: d.voucher_value > 0 ? d.voucher_value : d.entry_price, orderEntryPer: d.order_entry_per || 0, voucherType: d.voucher_type, drawAt: d.draw_at, status: d.status, entries: st.n || 0,
    countries: d.countries, eligible: eligibleCountry(d, cc), country: cc || "", seedHash: d.seed_hash, claimDays: d.claim_days, freePerDay: d.free_per_day,
    consolation: d.auto_vouchers ? { amount: d.consolation, min: d.consolation_min, days: d.consolation_days } : null, permit: d.permit || "", notify: !!d.notify };
  if (d.show_progress && d.goal > 0) out.progress = Math.min(100, Math.round((raised / d.goal) * 100));
  if (d.status === "drawn") { out.winners = parse(d.winners, []); out.seed = d.seed; out.drawnAt = d.drawn_at; }
  return out;
}

export async function currentDraw(env) {
  return await env.DB.prepare(`SELECT * FROM draws WHERE status IN ('live','drawing') OR (status='drawn' AND drawn_at >= datetime('now','-14 days'))
    ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'drawing' THEN 1 ELSE 2 END, draw_at DESC LIMIT 1`).first();
}

// Pick winners: for prize i, index = sha256(seed:i:attempt) mod N over active tickets ordered by (created_at, code); no ticket wins twice.
export async function pickWinners(seed, codes, prizeCount) {
  const out = [];
  for (let i = 0; i < prizeCount && out.length < codes.length; i++) {
    for (let a = 0; a < 1000; a++) {
      const h = await sha256(`${seed}:${i}:${a}`);
      const idx = Number(BigInt("0x" + h) % BigInt(codes.length));
      if (!out.includes(codes[idx])) { out.push(codes[idx]); break; }
    }
  }
  return out;
}

// Run any due draw exactly once (safe to call from many requests at the same time)
export async function runDueDraws(env, ctx) {
  const due = (await env.DB.prepare("SELECT * FROM draws WHERE status='live' AND draw_at <= ?").bind(now()).all()).results;
  for (const d of due) await runDraw(env, d, ctx);
}
export async function runDraw(env, d, ctx) {
  const lock = await env.DB.prepare("UPDATE draws SET status='drawing' WHERE id=? AND status='live'").bind(d.id).run();
  if (!lock.meta?.changes) return false;
  try {
    const tickets = (await env.DB.prepare("SELECT code, device FROM tickets WHERE draw_id=? AND status='active' ORDER BY created_at, code").bind(d.id).all()).results;
    const prizeIds = parse(d.prizes, []);
    const prods = prizeIds.length ? (await env.DB.prepare(`SELECT id,title,price FROM products WHERE id IN (${prizeIds.map(() => "?").join(",")})`).bind(...prizeIds).all()).results : [];
    const codes = tickets.map((t) => t.code);
    const won = await pickWinners(d.seed, codes, prizeIds.length);
    const winners = won.map((code, i) => { const p = prods.find((x) => x.id === prizeIds[i]) || { id: prizeIds[i], title: "Prize", price: 0 }; return { code, prizeId: p.id, prize: p.title, value: p.price }; });
    const stmts = winners.map((w) => env.DB.prepare("UPDATE tickets SET result='won', prize_id=? WHERE code=?").bind(w.prizeId, w.code));
    stmts.push(env.DB.prepare("UPDATE tickets SET result='lost' WHERE draw_id=? AND status='active' AND result IS NULL").bind(d.id));
    // One consolation voucher per losing device (not per ticket), so free entries can't be farmed for vouchers
    if (d.auto_vouchers && d.consolation > 0) {
      const winDevices = new Set(tickets.filter((t) => won.includes(t.code)).map((t) => t.device));
      const seen = new Set(), ends = new Date(Date.now() + (d.consolation_days || 60) * 864e5).toISOString().slice(0, 19).replace("T", " ");
      for (const t of tickets) {
        if (won.includes(t.code) || !t.device || seen.has(t.device) || winDevices.has(t.device)) continue;
        seen.add(t.device);
        const vc = "THANKS-" + rand(6);
        stmts.push(env.DB.prepare(`INSERT INTO discounts (code, percent, type, amount, min_spend, ends_at, label, max_uses, show, active, scope) VALUES (?,0,'amount',?,?,?,?,1,0,1,'all')`)
          .bind(vc, d.consolation, d.consolation_min || 0, ends, `$${Number(d.consolation).toFixed(2)} off — thanks for joining our prize draw`));
        stmts.push(env.DB.prepare("UPDATE tickets SET consolation_code=? WHERE draw_id=? AND device=?").bind(vc, d.id, t.device));
      }
    }
    stmts.push(env.DB.prepare("UPDATE draws SET status='drawn', winners=?, drawn_at=? WHERE id=?").bind(JSON.stringify(winners), sqlNow(), d.id));
    for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));
    if (d.notify) { const job = notifyDraw(env, d.id); ctx?.waitUntil ? ctx.waitUntil(job) : await job; }
    return true;
  } catch (e) {
    await env.DB.prepare("UPDATE draws SET status='live' WHERE id=? AND status='drawing'").bind(d.id).run();
    throw e;
  }
}

/* ---------- Web Push without payload: the service worker fetches the message itself ---------- */
export async function vapidKeys(env) {
  let k = parse(await getSetting(env, "vapid_keys"), null);
  if (!k) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    k = { priv: await crypto.subtle.exportKey("jwk", pair.privateKey), pub: b64u(await crypto.subtle.exportKey("raw", pair.publicKey)) };
    await setSetting(env, "vapid_keys", JSON.stringify(k));
  }
  return k;
}
async function vapidAuth(env, endpoint) {
  const k = await vapidKeys(env);
  const key = await crypto.subtle.importKey("jwk", k.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:support@leeyspremium.com" });
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${k.pub}`;
}
export async function sendPush(env, endpoint) {
  const r = await fetch(endpoint, { method: "POST", headers: { TTL: "172800", Urgency: "high", Authorization: await vapidAuth(env, endpoint), "Content-Length": "0" } });
  if (r.status === 404 || r.status === 410) await env.DB.prepare("DELETE FROM push_subs WHERE endpoint=?").bind(endpoint).run();
  return r.status;
}
export async function notifyDraw(env, drawId) {
  const subs = (await env.DB.prepare("SELECT DISTINCT s.endpoint FROM push_subs s JOIN tickets t ON t.device=s.device WHERE t.draw_id=? AND t.status='active'").bind(drawId).all()).results;
  for (let i = 0; i < subs.length; i += 20) await Promise.allSettled(subs.slice(i, i + 20).map((s) => sendPush(env, s.endpoint)));
  return subs.length;
}
// What the service worker shows when a push arrives
export async function pushNotice(env, endpoint) {
  const s = await env.DB.prepare("SELECT device FROM push_subs WHERE endpoint=?").bind(endpoint).first();
  if (!s) return null;
  const t = await env.DB.prepare(`SELECT t.result, t.consolation_code, d.title FROM tickets t JOIN draws d ON d.id=t.draw_id WHERE t.device=? AND d.status='drawn'
    ORDER BY d.drawn_at DESC, (t.result='won') DESC LIMIT 1`).bind(s.device).first();
  if (!t) return { title: "LeeysPremium prize draw", body: "The draw has started — tap to see the results.", url: "/#draw" };
  if (t.result === "won") return { title: "🎉 You won the LeeysPremium prize draw!", body: `Your ticket won in "${t.title}". Tap to claim your prize.`, url: "/#draw" };
  return { title: "The winners have been drawn", body: t.consolation_code ? "You didn't win this time, but a thank-you voucher is waiting for you. Tap to see it." : "Tap to see the winners.", url: "/#draw" };
}

/* ---------- Bot check (Cloudflare Turnstile) — only enforced once you add the keys ---------- */
export async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET || !(await getSetting(env, "turnstile_site"))) return true;
  if (!token) return false;
  const f = new FormData(); f.append("secret", env.TURNSTILE_SECRET); f.append("response", String(token)); if (ip) f.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: f }).then((x) => x.json()).catch(() => ({}));
  return !!r.success;
}
export async function ipHash(env, ip) {
  let salt = await getSetting(env, "ip_salt");
  if (!salt) { salt = rand(24); await setSetting(env, "ip_salt", salt); }
  return (await sha256(salt + ":" + (ip || "-"))).slice(0, 24);
}
export const newSeed = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export { fromB64u };

// Entries earned with a real order: 1 per $X of product subtotal after discounts (max 20 per order), for the draw that's open now
export async function orderEntries(env, o) {
  const d = await env.DB.prepare("SELECT * FROM draws WHERE status='live' AND order_entry_per > 0 AND draw_at > ? ORDER BY id DESC LIMIT 1").bind(new Date().toISOString()).first();
  if (!d || !eligibleCountry(d, o.country)) return 0;
  const n = Math.min(20, Math.floor(Math.max(0, (o.subtotal || 0) - (o.discount || 0)) / d.order_entry_per + 1e-9));
  if (!n || (await env.DB.prepare("SELECT 1 FROM tickets WHERE order_id=? LIMIT 1").bind(o.id).first())) return 0;
  const day = new Date().toISOString().slice(0, 10);
  await env.DB.batch(Array.from({ length: n }, () => env.DB.prepare("INSERT INTO tickets (code, draw_id, kind, device, country, day, order_id) VALUES (?,?,'order',?,?,?,?)")
    .bind(ticketCode(), d.id, o.device || null, o.country || "", day, o.id)));
  return n;
}
