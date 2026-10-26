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
  const r = await fetch(BASE + "/authentication/getAccessToken", {
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
  const r = await fetch(BASE + path, {
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

export async function cjSearch(env, q, page = 1) {
  const d = await call(env, `/product/list?pageNum=${page}&pageSize=20&productNameEn=${encodeURIComponent(q)}`);
  return (d?.list || []).map((p) => ({ pid: p.pid, title: p.productNameEn, image: p.productImage, cost: num(p.sellPrice), category: p.categoryName }));
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
      remark: "LeeysMall " + order.id, fromCountryCode: fromCountry, logisticName, payType: 3, products,
    },
  });
  return { cjOrderId: d?.orderId || d?.orderNum || d, logisticName };
}

export async function cjOrderDetail(env, cjOrderId) {
  const d = await call(env, `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(cjOrderId)}`);
  return { status: d?.orderStatus, trackNumber: d?.trackNumber, carrier: d?.logisticName || d?.trackingProvider };
}
