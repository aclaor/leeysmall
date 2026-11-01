// Promotions: time-limited % off for everything, a category, or chosen products.
// The sale price is computed here and used everywhere (product API, checkout, PayPal, Google data),
// so what shoppers see is exactly what they pay.
export async function activePromos(env) {
  return (await env.DB.prepare(
    "SELECT * FROM promos WHERE active=1 AND starts_at <= datetime('now') AND ends_at > datetime('now') ORDER BY percent DESC"
  ).all()).results.map((p) => ({ ...p, targets: p.scope === "products" ? JSON.parse(p.target || "[]") : null }));
}
export function promoFor(product, promos) {
  let best = null;
  for (const pr of promos) {
    const hit = pr.scope === "all" || (pr.scope === "collection" && pr.target === product.collection) || (pr.scope === "products" && pr.targets.includes(product.id));
    if (hit && (!best || pr.percent > best.percent)) best = pr;
  }
  return best;
}
// Returns { price, compareAt, promo } for a DB row
export function priced(row, promos) {
  const pr = promoFor(row, promos);
  if (!pr) return { price: row.price, compareAt: row.compare_at, promo: null };
  const sale = Math.max(0.5, Math.round(row.price * (100 - pr.percent)) / 100);
  return {
    price: sale, compareAt: Math.max(row.compare_at || 0, row.price),
    promo: { id: pr.id, label: pr.label, percent: pr.percent, endsAt: pr.ends_at.replace(" ", "T") + "Z" },
  };
}
