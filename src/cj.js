// CJ Dropshipping API 2.0 client. CJ_API_KEY is a Worker secret.
// CJ allows ~1 request/second, so calls are spaced out automatically.
import { getSetting, setSetting } from "./db.js";

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
let last = 0;
const pace = async () => { const wait = last + 1100 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now(); };

async function accessToken(env) {
  if (!env.CJ_API_KEY) throw new Error("CJ API key is not set yet (add the CJ_API_KEY secret in Cloudflare)");
  const cached = await getSetting(env, "cj_token");
  if (cached) { const { token, exp } = JSON.parse(cached); if (Date.now() < exp - 86400000) return token; }
  await pace();
  const r = await fetch((env.CJ_BASE || BASE) + "/authentication/getAccessToken", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiKey: env.CJ_API_KEY }),
  });
  const j = await r.json();
  if (!j.result || !j.data?.accessToken) throw new Error("CJ login failed: " + (j.message || r.status));
  const exp = Date.parse(j.data.accessTokenExpiryDate) || Date.now() + 15 * 86400000;
  await setSetting(env, "cj_token", JSON.stringify({ token: j.data.accessToken, exp }));
  return j.data.accessToken;
}

async function call(env, path, { method = "GET", body } = {}) {
  const t = await accessToken(env);
  await pace();
  const r = await fetch((env.CJ_BASE || BASE) + path, {
    method, headers: { "CJ-Access-Token": t, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!j.result) throw new Error("CJ " + path.split("?")[0] + ": " + (j.message || "HTTP " + r.status));
  return j.data;
}

const imgs = (d) => {
  let list = d.productImageSet || d.productImage || [];
  if (typeof list === "string") { try { list = JSON.parse(list); } catch { list = [list]; } }
  return [...new Set(list.filter(Boolean))].slice(0, 8);
};
const num = (v) => { const n = parseFloat(String(v ?? "").split("--").pop()); return isNaN(n) ? 0 : n; };

// CJ category tree (3 levels), cached for a day.
export async function cjCategories(env) {
  const cached = await getSetting(env, "cj_categories");
  if (cached) { const c = JSON.parse(cached); if (Date.now() - c.at < 86400000) return c.tree; }
  const d = await call(env, "/product/getCategory");
  const tree = (Array.isArray(d) ? d : []).map((a) => ({
    name: a.categoryFirstName, id: a.categoryFirstId || a.categoryFirstName,
    children: (a.categoryFirstList || []).map((b) => ({
      name: b.categorySecondName, id: b.categorySecondId || b.categorySecondName,
      children: (b.categorySecondList || []).map((c) => ({ name: c.categoryName, id: c.categoryId })),
    })),
  }));
  await setSetting(env, "cj_categories", JSON.stringify({ at: Date.now(), tree }));
  return tree;
}

const firstImage = (v) => { if (!v) return ""; if (Array.isArray(v)) return v[0] || ""; if (typeof v === "string" && v.startsWith("[")) { try { return JSON.parse(v)[0] || ""; } catch {} } return String(v).includes(",http") ? String(v).split(",")[0] : String(v); };

// Browse/search CJ. opts: { q, categoryIds: [3rd-level ids], page, us, sort: "popular"|"new"|"price-asc"|"price-desc" }
export async function cjSearch(env, opts = {}) {
  const page = Math.max(1, Math.min(1000, opts.page || 1)), size = 40;
  const order = { popular: [1, "desc"], new: [3, "desc"], "price-asc": [2, "asc"], "price-desc": [2, "desc"] }[opts.sort] || [0, "desc"];
  const qs = new URLSearchParams({ page, size, orderBy: order[0], sort: order[1] });
  if (opts.q) qs.set("keyWord", opts.q);
  const ids = (opts.categoryIds || []).filter(Boolean);
  if (ids.length === 1) qs.set("categoryId", ids[0]);
  else if (ids.length > 1) for (const id of ids.slice(0, 60)) qs.append("lv3categoryList", id);
  if (opts.us) qs.set("countryCode", "US");
  try {
    const d = await call(env, "/product/listV2?" + qs);
    const list = (d?.content || []).flatMap((c) => c.productList || []);
    return {
      page, totalPages: Math.min(d?.totalPages || 1, 1000), total: d?.totalRecords || list.length,
      items: list.map((p) => ({ pid: p.id, title: p.nameEn, image: firstImage(p.bigImage), cost: num(p.nowPrice || p.discountPrice || p.sellPrice),
        listed: p.listedNum || 0, category: [p.oneCategoryName, p.twoCategoryName, p.threeCategoryName].filter(Boolean).join(" › "),
        usStock: !!opts.us, inventory: p.warehouseInventoryNum ?? null })),
    };
  } catch (e) {
    // Fallback to the older list endpoint (one category at a time)
    const q2 = new URLSearchParams({ pageNum: page, pageSize: size, orderBy: opts.sort === "popular" ? "listedNum" : "createAt", sort: "desc" });
    if (opts.q) q2.set("productNameEn", opts.q);
    if (ids[0]) q2.set("categoryId", ids[0]);
    if (opts.us) q2.set("countryCode", "US");
    const d = await call(env, "/product/list?" + q2);
    return {
      page, totalPages: Math.max(1, Math.ceil((d?.total || 0) / size)), total: d?.total || 0,
      items: (d?.list || []).map((p) => ({ pid: p.pid, title: p.productNameEn, image: firstImage(p.productImage), cost: num(p.sellPrice),
        listed: p.listedNum || 0, category: p.categoryName || "", usStock: !!opts.us, inventory: null })),
    };
  }
}

export async function cjProduct(env, pid) {
  const d = await call(env, `/product/query?pid=${encodeURIComponent(pid)}`);
  const variants = (d.variants || []).map((v) => ({ vid: v.vid, key: v.variantKey || v.variantNameEn || v.vid, cost: num(v.variantSellPrice), image: v.variantImage }));
  return {
    pid: d.pid, title: d.productNameEn, description: (d.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1500),
    images: imgs(d), cost: num(d.sellPrice), variants,
  };
}

// Builds a store product record from a CJ product. markup = price multiplier on cost.
export function cjToRecord(p, { markup = 2.5, collection = "", ships = "intl" } = {}) {
  const round = (n) => Math.max(0.99, Math.ceil(n) - 0.01);
  const costs = p.variants.length ? p.variants.map((v) => v.cost) : [p.cost];
  const cost = Math.max(...costs);
  const price = round(cost * markup);
  const variantMap = {};
  for (const v of p.variants) variantMap[v.key] = { vid: v.vid, cost: v.cost, image: v.image };
  const slug = (p.title || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + String(p.pid).slice(-5).toLowerCase();
  return {
    id: slug, title: (p.title || "").slice(0, 120), description: p.description, collection, price, compare_at: round(price * 1.6), cost,
    stock: 100, images: JSON.stringify(p.images), ships, supplier: "cj", supplier_pid: p.pid,
    variants: JSON.stringify(p.variants.length > 1 ? [{ name: "Option", options: p.variants.map((v) => v.key) }] : []),
    variant_map: JSON.stringify(variantMap),
  };
}

export async function cjStock(env, vid) {
  const d = await call(env, `/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`);
  const list = Array.isArray(d) ? d : [];
  return { total: list.reduce((s, w) => s + (w.storageNum ?? w.totalInventoryNum ?? 0), 0), us: list.some((w) => w.countryCode === "US" && (w.storageNum ?? w.totalInventoryNum) > 0) };
}

async function pickLogistic(env, from, to, products) {
  try {
    const d = await call(env, "/logistic/freightCalculate", { method: "POST", body: { startCountryCode: from, endCountryCode: to, products } });
    const opts = (Array.isArray(d) ? d : []).filter((o) => o.logisticName);
    opts.sort((a, b) => num(a.logisticPrice) - num(b.logisticPrice));
    const tracked = opts.find((o) => /packet|usps|ups|fedex|dhl|express/i.test(o.logisticName));
    return (tracked || opts[0])?.logisticName || "CJPacket Ordinary";
  } catch { return "CJPacket Ordinary"; }
}

// Creates the CJ order WITHOUT paying it (payType 3). The owner reviews and pays it in the CJ dashboard.
export async function cjCreateOrder(env, order, lines, fromCountry) {
  const a = order.address;
  const products = lines.map((l) => ({ vid: l.vid, quantity: l.qty }));
  const logisticName = await pickLogistic(env, fromCountry, order.country, products);
  const d = await call(env, "/shopping/order/createOrderV2", {
    method: "POST",
    body: {
      orderNumber: order.id + (fromCountry === "US" ? "" : "-" + fromCountry), shippingCountryCode: order.country, shippingCountry: a.countryName || order.country,
      shippingProvince: a.province || a.city, shippingCity: a.city, shippingZip: a.zip, shippingAddress: a.address1,
      shippingAddress2: a.address2 || "", shippingCustomerName: order.name, shippingPhone: order.phone || "", email: order.email,
      remark: "LeeysPremium " + order.id, fromCountryCode: fromCountry, logisticName, payType: 3, products,
    },
  });
  return { cjOrderId: d?.orderId || d?.orderNum || d, logisticName };
}

export async function cjOrderDetail(env, cjOrderId) {
  const d = await call(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(cjOrderId)}`);
  return { status: d?.orderStatus, trackNumber: d?.trackNumber, carrier: d?.logisticName || d?.trackingProvider };
}
