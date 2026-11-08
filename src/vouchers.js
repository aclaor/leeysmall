// Voucher types (like Shopee):
//   percent  — X% off the items, optionally capped ("10% off, max $15")
//   amount   — $X off the items
//   shipping — free shipping, optionally capped ("Free shipping up to $5")
// A customer can use one shipping voucher + one discount voucher per order.
const r2 = (n) => Math.round(n * 100) / 100;
export const PUBLIC_FIELDS = "code, type, percent, amount, max_off, min_spend, ends_at, label, first_order, scope, target";
// Which cart lines a voucher covers: everything, one category, or chosen products
export function eligibleSubtotal(v, lines) {
  const ids = v.scope === "products" ? (() => { try { return JSON.parse(v.target || "[]"); } catch { return []; } })() : null;
  return Math.round(lines.filter((l) => !l.gift && (v.scope === "collection" ? l.collection === v.target : v.scope === "products" ? ids.includes(l.id) : true))
    .reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
}

export function voucherTitle(v) {
  if (v.type === "shipping") return v.amount ? `Free shipping up to $${Number(v.amount).toFixed(2)}` : "Free shipping";
  if (v.type === "amount") return `$${Number(v.amount).toFixed(2)} off`;
  return `${v.percent}% off${v.max_off ? `, max $${Number(v.max_off).toFixed(2)}` : ""}`;
}
// ctx: { subtotal, shipping, hasOrdered (true/false/null if unknown) }
export function evaluate(v, ctx) {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (!v || !v.active) return { ok: false, reason: "This voucher isn't available" };
  if (v.ends_at && v.ends_at <= now) return { ok: false, reason: "This voucher has expired" };
  if (v.max_uses && v.uses >= v.max_uses) return { ok: false, reason: "This voucher has been fully used" };
  if (v.first_order && ctx.hasOrdered === true) return { ok: false, reason: "For first orders only" };
  const scoped = v.scope === "collection" || v.scope === "products";
  const base = ctx.eligible ?? ctx.subtotal;
  if (scoped && ctx.eligible === 0) return { ok: false, reason: v.scope === "collection" ? "Only for items in a specific category" : "Only for selected items" };
  if (base < (v.min_spend || 0)) return { ok: false, reason: `Add $${(v.min_spend - base).toFixed(2)} more${scoped ? " of eligible items" : ""} to use this voucher`, short: v.min_spend - base };
  if (v.type === "shipping") {
    if (!(ctx.shipping > 0)) return { ok: false, reason: "Your shipping is already free" };
    return { ok: true, amount: r2(Math.min(ctx.shipping, v.amount > 0 ? v.amount : ctx.shipping)) };
  }
  if (v.type === "amount") return { ok: true, amount: r2(Math.min(v.amount || 0, base)) };
  let a = base * (v.percent || 0) / 100;
  if (v.max_off > 0) a = Math.min(a, v.max_off);
  return { ok: true, amount: r2(a) };
}
