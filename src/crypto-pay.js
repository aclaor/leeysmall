// Crypto payments through NOWPayments (hosted invoice page: BTC, ETH, USDT and 300+ coins).
// Secrets (Cloudflare → Worker → Settings → Variables and Secrets): NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET.
const API = "https://api.nowpayments.io/v1";
export const cryptoReady = (env) => !!(env.NOWPAYMENTS_API_KEY && env.NOWPAYMENTS_IPN_SECRET);

export async function createCryptoInvoice(env, { orderId, amount, description, base }) {
  const r = await fetch(API + "/invoice", {
    method: "POST", headers: { "x-api-key": env.NOWPAYMENTS_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ price_amount: Math.round(amount * 100) / 100, price_currency: "usd", order_id: orderId, order_description: description.slice(0, 200),
      ipn_callback_url: base + "/api/crypto/ipn", success_url: `${base}/thank-you?order=${encodeURIComponent(orderId)}&crypto=1`, cancel_url: base + "/checkout" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.invoice_url) throw new Error("Crypto payment couldn't start: " + (j.message || r.status));
  return { id: String(j.id), url: j.invoice_url };
}

// NOWPayments signs the JSON body with its keys sorted (recursively), using HMAC-SHA512 and your IPN secret
const sortDeep = (v) => Array.isArray(v) ? v.map(sortDeep) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => ((o[k] = sortDeep(v[k])), o), {}) : v;
export async function verifyIpn(env, raw, sig) {
  if (!sig || !env.NOWPAYMENTS_IPN_SECRET) return null;
  let data; try { data = JSON.parse(raw); } catch { return null; }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.NOWPAYMENTS_IPN_SECRET.trim()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(sortDeep(data)))));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return null;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.toLowerCase().charCodeAt(i);
  return diff === 0 ? data : null;
}
