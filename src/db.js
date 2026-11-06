// D1 schema + helpers. The schema is created automatically on first request,
// so no manual migration step is needed after deploy.
import { products as SEED, collections as SEED_COLLECTIONS } from "./data.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS collections (id TEXT PRIMARY KEY, name TEXT NOT NULL, blurb TEXT, sort INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, collection TEXT,
    price REAL NOT NULL, compare_at REAL, cost REAL DEFAULT 0, stock INTEGER DEFAULT 0,
    rating REAL DEFAULT 4.6, reviews INTEGER DEFAULT 0, badge TEXT, hue INTEGER DEFAULT 210, icon TEXT,
    ships TEXT DEFAULT 'intl', images TEXT DEFAULT '[]', variants TEXT DEFAULT '[]', variant_map TEXT DEFAULT '{}',
    supplier TEXT DEFAULT 'manual', supplier_pid TEXT, supplier_url TEXT, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT, phone TEXT, address TEXT, country TEXT,
    items TEXT NOT NULL, subtotal REAL, discount REAL DEFAULT 0, discount_code TEXT, shipping REAL, total REAL,
    cost_total REAL DEFAULT 0, currency TEXT DEFAULT 'USD', paypal_order_id TEXT, paypal_capture_id TEXT,
    status TEXT DEFAULT 'pending', supplier_order_ids TEXT DEFAULT '{}', tracking_number TEXT, tracking_carrier TEXT,
    notes TEXT, marketing INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), paid_at TEXT, shipped_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_paypal ON orders(paypal_order_id)`,
  `CREATE TABLE IF NOT EXISTS discounts (code TEXT PRIMARY KEY, percent REAL NOT NULL, active INTEGER DEFAULT 1, uses INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`,
  `CREATE TABLE IF NOT EXISTS subscribers (email TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT, email TEXT, page TEXT, status TEXT DEFAULT 'open',
    unread_admin INTEGER DEFAULT 0, unread_customer INTEGER DEFAULT 0, last_body TEXT, last_from TEXT, last_at TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_chat_msgs ON chat_messages(chat_id, id)`,
  `CREATE TABLE IF NOT EXISTS gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, trigger_scope TEXT NOT NULL, trigger_target TEXT NOT NULL, gift_id TEXT NOT NULL,
    gift_variant TEXT, per_item INTEGER DEFAULT 0, active INTEGER DEFAULT 1, ends_at TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS media (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, title TEXT, kind TEXT DEFAULT 'product', product_id TEXT, size INTEGER, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS live_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, body TEXT NOT NULL, is_host INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0, ip TEXT, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS promos (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, percent REAL NOT NULL, scope TEXT NOT NULL DEFAULT 'all', target TEXT,
    starts_at TEXT DEFAULT (datetime('now')), ends_at TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_chats_last ON chats(last_at)`,
];

let ready = null;
export function ensureSchema(env) {
  if (!ready) ready = (async () => {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    const { n } = await env.DB.prepare("SELECT COUNT(*) n FROM products").first();
    if (n === 0) await seed(env);
    await migrateToGeneralStore(env);
    for (const sql of ["ALTER TABLE collections ADD COLUMN cover TEXT", "ALTER TABLE products ADD COLUMN sold INTEGER DEFAULT 0",
      "ALTER TABLE discounts ADD COLUMN min_spend REAL DEFAULT 0", "ALTER TABLE discounts ADD COLUMN show INTEGER DEFAULT 0",
      "ALTER TABLE promos ADD COLUMN recur INTEGER DEFAULT 0", "ALTER TABLE products ADD COLUMN video TEXT", "ALTER TABLE promos ADD COLUMN days TEXT", "ALTER TABLE promos ADD COLUMN start_hour INTEGER DEFAULT 0",
      "ALTER TABLE promos ADD COLUMN end_hour INTEGER DEFAULT 24", "ALTER TABLE promos ADD COLUMN tz TEXT DEFAULT 'America/New_York'"])
      try { await env.DB.prepare(sql).run(); } catch {} // column already exists
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

async function seed(env) {
  const stmts = SEED_COLLECTIONS.map((c, i) =>
    env.DB.prepare("INSERT OR IGNORE INTO collections (id,name,blurb,sort) VALUES (?,?,?,?)").bind(c.id, c.name, c.blurb, i));
  for (const p of SEED) {
    stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO products (id,title,description,collection,price,compare_at,cost,stock,rating,reviews,badge,hue,icon,ships,variants,supplier)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id, p.title, p.description, p.collection, p.price, p.compareAt ?? null, p.cost, p.stock,
      p.rating, p.reviews, p.badge ?? null, p.hue, p.icon, p.ships, JSON.stringify(p.variants), "sample"));
  }
  stmts.push(env.DB.prepare("INSERT OR IGNORE INTO discounts (code, percent) VALUES ('WELCOME10', 10)"));
  await env.DB.batch(stmts);
}

// One-time update: gadget categories -> general store categories (gadget products move to Electronics).
const OLD_GADGET_COLLECTIONS = ["audio", "charging", "smart-home", "phone", "desk"];
async function migrateToGeneralStore(env) {
  if (await env.DB.prepare("SELECT 1 FROM settings WHERE key='migr_general_v1'").first()) return;
  const q = OLD_GADGET_COLLECTIONS.map(() => "?").join(",");
  await env.DB.batch([
    ...SEED_COLLECTIONS.map((c, i) => env.DB.prepare("INSERT INTO collections (id,name,blurb,sort) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET sort=excluded.sort").bind(c.id, c.name, c.blurb, i)),
    env.DB.prepare(`UPDATE products SET collection='electronics' WHERE collection IN (${q})`).bind(...OLD_GADGET_COLLECTIONS),
    env.DB.prepare(`DELETE FROM collections WHERE id IN (${q})`).bind(...OLD_GADGET_COLLECTIONS),
    env.DB.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('migr_general_v1', datetime('now'))"),
  ]);
}

const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// Shape sent to shoppers: never includes cost, supplier ids or vids.
export function toPublic(r) {
  return {
    id: r.id, title: r.title, description: r.description, collection: r.collection, price: r.price,
    compareAt: null, stock: r.stock, rating: r.rating, reviews: r.reviews, badge: r.badge, sold: r.sold || 0, createdAt: r.created_at, video: r.video || null,
    hue: r.hue, icon: r.icon, ships: r.ships, images: parse(r.images, []), variants: parse(r.variants, []),
    variantImages: Object.fromEntries(Object.entries(parse(r.variant_map, {}) || {}).filter(([, v]) => v && /^https?:\/\//.test(v.image || "")).map(([k, v]) => [k, v.image])),
  };
}
export function toAdmin(r) {
  return { ...toPublic(r), cost: r.cost, supplier: r.supplier, supplierPid: r.supplier_pid, supplierUrl: r.supplier_url,
    variantMap: parse(r.variant_map, {}), active: !!r.active, updatedAt: r.updated_at };
}
export function orderOut(o) {
  return { ...o, address: parse(o.address, {}), items: parse(o.items, []), supplier_order_ids: parse(o.supplier_order_ids, {}) };
}

export async function getSetting(env, key) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
  return r ? r.value : null;
}
export async function setSetting(env, key, value) {
  await env.DB.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, value).run();
}
export { parse };
