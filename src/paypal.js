// PayPal Orders v2. PAYPAL_ENV = "sandbox" (testing) or "live".
// PAYPAL_CLIENT_ID is a public var; PAYPAL_SECRET is a Worker secret.
const base = (env) => (env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

async function token(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) throw new Error("PayPal is not configured yet");
  const r = await fetch(base(env) + "/v1/oauth2/token", {
    method: "POST",
    headers: { authorization: "Basic " + btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_SECRET), "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal auth failed (" + r.status + ")");
  return (await r.json()).access_token;
}

export async function createPaypalOrder(env, order) {
  const t = await token(env);
  const amt = (n) => n.toFixed(2);
  const itemTotal = order.items.reduce((s, i) => s + Math.round(i.price * 100) * i.qty, 0) / 100;
  const r = await fetch(base(env) + "/v2/checkout/orders", {
    method: "POST",
    headers: { authorization: "Bearer " + t, "content-type": "application/json", "PayPal-Request-Id": order.id },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: order.id, invoice_id: order.id, description: "LeeysMall order " + order.id,
        amount: {
          currency_code: "USD", value: amt(order.total),
          breakdown: { item_total: { currency_code: "USD", value: amt(itemTotal) }, shipping: { currency_code: "USD", value: amt(order.shipping) },
            discount: { currency_code: "USD", value: amt(order.discount) } },
        },
        items: order.items.map((i) => ({ name: (i.title + (i.variant ? " - " + i.variant : "")).slice(0, 127), quantity: String(i.qty),
          unit_amount: { currency_code: "USD", value: amt(i.price) }, category: "PHYSICAL_GOODS" })),
      }],
      payment_source: { paypal: { experience_context: { brand_name: "LeeysMall", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } } },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("PayPal order failed: " + (j.message || r.status));
  return j.id;
}

export async function capturePaypalOrder(env, paypalOrderId) {
  const t = await token(env);
  const r = await fetch(base(env) + `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST", headers: { authorization: "Bearer " + t, "content-type": "application/json" },
  });
  let j = await r.json();
  if (!r.ok) {
    if (j?.details?.[0]?.issue !== "ORDER_ALREADY_CAPTURED") throw new Error("PayPal capture failed: " + (j.details?.[0]?.issue || j.message || r.status));
    j = await (await fetch(base(env) + `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { headers: { authorization: "Bearer " + t } })).json();
  }
  const cap = j.purchase_units?.[0]?.payments?.captures?.[0];
  return { status: j.status, captureId: cap?.id, amount: Number(cap?.amount?.value || 0), currency: cap?.amount?.currency_code };
}
