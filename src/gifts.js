// Free gifts: "buy a qualifying product → get a gift product free".
// Gift lines are added on the server at $0, so they appear in the order, ship with it (CJ), and can't be faked.
import { parse } from "./db.js";

export async function activeGifts(env) {
  const rows = (await env.DB.prepare(
    `SELECT g.*, p.title AS g_title, p.images AS g_images, p.stock AS g_stock, p.cost AS g_cost, p.supplier AS g_supplier, p.variant_map AS g_vm, p.ships AS g_ships, p.price AS g_price
     FROM gifts g JOIN products p ON p.id = g.gift_id
     WHERE g.active=1 AND (g.ends_at IS NULL OR g.ends_at > datetime('now')) ORDER BY g.created_at DESC`
  ).all()).results;
  return rows.map((g) => ({ ...g, targets: g.trigger_scope === "products" ? parse(g.trigger_target, []) : null }));
}
const qualifies = (g, line) => (g.trigger_scope === "collection" ? line.collection === g.trigger_target : g.targets.includes(line.id));

// For checkout: returns $0 gift lines for the paid lines in the cart
export function giftLines(lines, gifts) {
  const out = [];
  for (const g of gifts) {
    if (g.g_stock <= 0) continue;
    const q = lines.filter((l) => !l.gift && qualifies(g, l)).reduce((s, l) => s + l.qty, 0);
    if (!q) continue;
    const qty = g.per_item ? Math.min(q, 10) : 1;
    const vm = parse(g.g_vm, {});
    const v = vm[g.gift_variant] || (Object.keys(vm).length === 1 ? Object.values(vm)[0] : null);
    out.push({ id: g.gift_id, title: g.g_title, variant: g.gift_variant || "", qty, price: 0, cost: v?.cost ?? g.g_cost, supplier: g.g_supplier,
      vid: v?.vid || null, ships: g.g_ships, gift: true, giftLabel: g.label, giftValue: g.g_price });
  }
  return out;
}
// Public, for showing "🎁 Free gift" on cards, product pages and in the cart
export const publicGifts = (gifts) => gifts.filter((g) => g.g_stock > 0).map((g) => ({
  id: g.id, label: g.label, scope: g.trigger_scope, target: g.trigger_scope === "products" ? g.targets : g.trigger_target, perItem: !!g.per_item,
  gift: { id: g.gift_id, title: g.g_title, image: parse(g.g_images, [])[0] || null, variant: g.gift_variant || "", value: g.g_price },
}));
