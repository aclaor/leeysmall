// Spin & Win: one paid order of at least $X (products after discounts) unlocks a spin; every spin wins one prize,
// shipped free as its own order to the same address. Several promos can run at once.
import { parse } from "./db.js";

const rand = (n, abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789") => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => abc[x % abc.length]).join("");
const nowIso = () => new Date().toISOString();
const listOf = (s) => String(s || "ALL").toUpperCase().split(/[\s,]+/).filter(Boolean);
export const spinEligible = (p, cc) => { const l = listOf(p.countries); return l.includes("ALL") || l.includes(String(cc || "").toUpperCase()); };

// Live promos with their prize products (for the storefront)
export async function liveSpinPromos(env) {
  const now = nowIso();
  const promos = (await env.DB.prepare("SELECT * FROM spin_promos WHERE status='live' AND starts_at <= ? AND ends_at > ? ORDER BY min_spend").bind(now, now).all()).results;
  const ids = [...new Set(promos.flatMap((p) => parse(p.prizes, []).map((x) => x.id)))];
  const prods = ids.length ? (await env.DB.prepare(`SELECT id,title,price,images FROM products WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all()).results : [];
  return promos.map((p) => ({ id: p.id, title: p.title, minSpend: p.min_spend, endsAt: p.ends_at, countries: p.countries,
    prizes: parse(p.prizes, []).map((x) => { const r = prods.find((y) => y.id === x.id); return r && { id: r.id, title: r.title, value: r.price, image: parse(r.images, [])[0] || null, left: x.qty > 0 ? Math.max(0, x.qty - (x.given || 0)) : null }; }).filter(Boolean) }));
}

// Called once an order is paid: grant one spin per qualifying live promo
export async function grantSpins(env, o) {
  const spend = Math.max(0, (o.subtotal || 0) - (o.discount || 0)), now = nowIso();
  const promos = (await env.DB.prepare("SELECT * FROM spin_promos WHERE status='live' AND starts_at <= ? AND ends_at > ? AND min_spend <= ?").bind(now, now, spend + 1e-9).all()).results;
  const st = [];
  for (const p of promos) {
    if (!spinEligible(p, o.country)) continue;
    st.push(env.DB.prepare("INSERT OR IGNORE INTO spins (code, promo_id, order_id, email, device) VALUES (?,?,?,?,?)").bind("SPIN-" + rand(8), p.id, o.id, o.email, o.device || null));
  }
  if (st.length) await env.DB.batch(st);
  return st.length;
}

// Weighted pick among prizes that still have stock (qty 0 = unlimited)
function pick(prizes) {
  const pool = prizes.map((x, i) => ({ ...x, i })).filter((x) => (x.weight || 0) > 0 && (!(x.qty > 0) || (x.given || 0) < x.qty));
  const total = pool.reduce((t, x) => t + x.weight, 0);
  if (!total) return null;
  let r = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * total;
  for (const x of pool) { if ((r -= x.weight) < 0) return x; }
  return pool[pool.length - 1];
}

// Use a spin: choose the prize, record it, and create a free order shipped to the original address
export async function useSpin(env, code, newOrderId) {
  const s = await env.DB.prepare("SELECT * FROM spins WHERE code=?").bind(code).first();
  if (!s) throw Object.assign(new Error("Spin not found"), { status: 404 });
  if (s.prize_id) return { already: true, prizeId: s.prize_id, giftOrder: s.gift_order_id };
  const p = await env.DB.prepare("SELECT * FROM spin_promos WHERE id=?").bind(s.promo_id).first();
  if (!p || p.status === "cancelled") throw Object.assign(new Error("This promotion has ended."), { status: 410 });
  const src = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(s.order_id).first();
  if (!src || ["pending", "cancelled", "refunded"].includes(src.status)) throw Object.assign(new Error("This order isn't eligible."), { status: 403 });
  const lock = await env.DB.prepare("UPDATE spins SET prize_id='…' WHERE code=? AND prize_id IS NULL").bind(code).run(); // stop double spins
  if (!lock.meta?.changes) return useSpin(env, code, newOrderId);
  try {
    const prizes = parse(p.prizes, []), won = pick(prizes);
    if (!won) throw Object.assign(new Error("All prizes for this promotion have been claimed. Please contact us."), { status: 410 });
    const prod = await env.DB.prepare("SELECT id,title,variants,cost FROM products WHERE id=?").bind(won.id).first();
    const variant = parse(prod?.variants, []).map((v) => v.options[0]).join(" / ");
    const gid = newOrderId();
    const items = [{ id: won.id, title: prod?.title || "Prize", variant, qty: 1, price: 0, cost: prod?.cost || 0, gift: true }];
    prizes[won.i] = { ...prizes[won.i], given: (prizes[won.i].given || 0) + 1 };
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO orders (id,email,name,phone,address,country,items,subtotal,discount,shipping,total,cost_total,status,paid_at,notes,pay_method,device)
        VALUES (?,?,?,?,?,?,?,0,0,0,0,?,'paid',datetime('now'),?,'spin',?)`).bind(gid, src.email, src.name, src.phone, src.address, src.country, JSON.stringify(items), prod?.cost || 0,
        `Spin & Win prize (${p.title}) for order ${src.id}`, src.device),
      env.DB.prepare("UPDATE spins SET prize_id=?, gift_order_id=?, used_at=datetime('now') WHERE code=?").bind(won.id, gid, code),
      env.DB.prepare("UPDATE spin_promos SET prizes=? WHERE id=?").bind(JSON.stringify(prizes), p.id),
    ]);
    return { prizeId: won.id, giftOrder: gid, title: prod?.title };
  } catch (e) {
    await env.DB.prepare("UPDATE spins SET prize_id=NULL WHERE code=? AND prize_id='…'").bind(code).run();
    throw e;
  }
}
