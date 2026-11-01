// Promotions: % off for everything, a category, or chosen products.
//  • One-time: runs between starts_at and ends_at.
//  • Weekly schedule: runs on chosen weekdays between start_hour and end_hour in a chosen time zone
//    (e.g. 10% off Electronics every Friday), optionally only within starts_at..ends_at.
// The sale price is computed here and used everywhere (product API, checkout, PayPal, Google data),
// so what shoppers see is exactly what they pay.
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localNow(tz, now = new Date()) {
  let parts;
  try { parts = new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(now); }
  catch { parts = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" }).formatToParts(now); }
  const g = (t) => parts.find((p) => p.type === t)?.value;
  return { day: DAY.indexOf(g("weekday")), secs: Number(g("hour")) % 24 * 3600 + Number(g("minute")) * 60 + Number(g("second")) };
}
// If a weekly promo is running right now, returns the ISO time its current window ends; otherwise null.
export function windowEnd(pr, now = new Date()) {
  const days = String(pr.days || "").split(",").filter((x) => x !== "").map(Number);
  const sh = Number(pr.start_hour ?? 0), eh = Number(pr.end_hour ?? 24);
  const { day, secs } = localNow(pr.tz, now);
  if (!days.includes(day) || secs < sh * 3600 || secs >= eh * 3600) return null;
  return new Date(now.getTime() + (eh * 3600 - secs) * 1000).toISOString().replace(/\.\d+Z$/, "Z");
}
const fmtHour = (h) => (h === 0 || h === 24 ? "12am" : h === 12 ? "12pm" : h < 12 ? h + "am" : h - 12 + "pm");
export function scheduleText(pr) {
  const days = String(pr.days || "").split(",").filter((x) => x !== "").map(Number).sort();
  const d = days.length === 7 ? "Every day" : days.join() === "1,2,3,4,5" ? "Weekdays" : days.join() === "0,6" ? "Weekends" : "Every " + days.map((x) => DAY[x]).join(", ");
  const h = Number(pr.start_hour) === 0 && Number(pr.end_hour) === 24 ? "all day" : `${fmtHour(Number(pr.start_hour))}–${fmtHour(Number(pr.end_hour))}`;
  const tz = { "America/New_York": "ET", "America/Chicago": "CT", "America/Denver": "MT", "America/Los_Angeles": "PT", "Asia/Manila": "PH time", UTC: "UTC" }[pr.tz] || pr.tz;
  return `${d}, ${h} ${tz}`;
}

async function allValid(env) {
  return (await env.DB.prepare(
    "SELECT * FROM promos WHERE active=1 AND starts_at <= datetime('now') AND ends_at > datetime('now') ORDER BY percent DESC"
  ).all()).results.map((p) => ({ ...p, targets: p.scope === "products" ? JSON.parse(p.target || "[]") : null }));
}
// Promotions running at this moment (weekly ones only inside their window). endsAt = when the current run ends.
export async function activePromos(env) {
  const out = [];
  for (const p of await allValid(env)) {
    const overallEnd = p.ends_at.replace(" ", "T") + "Z";
    if (!p.recur) { out.push({ ...p, endsAt: overallEnd }); continue; }
    const w = windowEnd(p);
    if (w) out.push({ ...p, endsAt: w < overallEnd ? w : overallEnd });
  }
  return out;
}
// Weekly promotions that exist (running or not) — shown to shoppers as "Every Friday: 10% off Electronics".
export async function schedules(env) {
  return (await allValid(env)).filter((p) => p.recur).map((p) => ({ id: p.id, label: p.label, percent: p.percent, scope: p.scope,
    target: p.scope === "products" ? p.targets : p.target, text: scheduleText(p) }));
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
  if (!pr) return { price: row.price, compareAt: null, promo: null }; // no invented "was" prices
  const sale = Math.max(0.5, Math.round(row.price * (100 - pr.percent)) / 100);
  return {
    price: sale, compareAt: row.price, // the real everyday price
    promo: { id: pr.id, label: pr.label, percent: pr.percent, endsAt: pr.endsAt, recurring: !!pr.recur },
  };
}
