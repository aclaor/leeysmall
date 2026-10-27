// LeeysMall admin dashboard
const $ = (s, el = document) => el.querySelector(s);
const root = $("#root");
const money = (n) => "$" + Number(n || 0).toFixed(2);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATUSES = ["paid", "action_needed", "processing", "shipped", "delivered", "cancelled", "refunded"];
const LABEL = { paid: "Paid", action_needed: "Action needed", processing: "Sent to supplier", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded", pending: "Unpaid" };
const SUPPLIER = { cj: "CJ Dropshipping", aliexpress: "AliExpress (manual)", manual: "Manual", sample: "Sample" };
let tab = location.hash.slice(1) || "dashboard", collections = [];

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600); }
async function api(path, method = "GET", data) {
  const r = await fetch(path, { method, headers: data ? { "content-type": "application/json" } : {}, body: data ? JSON.stringify(data) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/admin/login") { login(); throw new Error("Please sign in"); }
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
const thumb = (p) => `<div class="pthumb">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="">` : `<div style="width:100%;height:100%;background:radial-gradient(circle at 60% 30%, rgba(47,140,255,.5), #070b18 70%)"></div>`}</div>`;
const st = (s) => `<span class="st ${s}">${LABEL[s] || s}</span>`;
const date = (d) => d ? new Date(d.replace(" ", "T") + "Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function login() {
  root.innerHTML = `<div class="login"><form class="panel" id="lf" style="width:min(380px,100%)"><div class="logo" style="margin-bottom:6px">Leeys<span>Mall</span></div><p class="muted" style="margin-top:0">Admin sign in</p>
    <div class="field"><input class="inp" type="password" name="pw" placeholder="Admin password" autofocus required></div><button class="btn block">Sign in</button><p id="le" style="color:var(--bad);font-size:14px"></p></form></div>`;
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/admin/login", "POST", { password: e.target.pw.value }); shell(); } catch (er) { $("#le").textContent = er.message; }
  };
}

async function shell() {
  root.innerHTML = `<div class="adm"><nav class="side"><div class="logo">Leeys<span>Mall</span></div>
    ${[["dashboard", "Dashboard"], ["orders", "Orders"], ["products", "Products"], ["import", "Import from CJ"], ["discounts", "Discounts"], ["subscribers", "Subscribers"], ["setup", "Setup"]]
      .map(([k, t]) => `<a href="#${k}" data-tab="${k}">${t}<span id="badge-${k}"></span></a>`).join("")}
    <div class="bottom"><a href="/" target="_blank">View store ↗</a><a href="#" id="logout">Sign out</a></div></nav><main class="main" id="main"></main></div>`;
  $("#logout").onclick = async (e) => { e.preventDefault(); await fetch("/api/admin/logout"); login(); };
  try { collections = await api("/api/admin/collections"); } catch { return; }
  show(tab);
}
window.addEventListener("hashchange", () => { const t = location.hash.slice(1); if (t && $("#main")) show(t); });
function show(t) {
  tab = t;
  document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === t));
  ({ dashboard, orders, products, import: importCj, discounts, subscribers, setup }[t] || dashboard)().catch((e) => toast(e.message));
}
const main = () => $("#main");

/* ---------- Dashboard ---------- */
async function dashboard() {
  const s = await api("/api/admin/stats");
  $("#badge-orders").innerHTML = s.action ? `<span class="pill">${s.action}</span>` : "";
  const max = Math.max(1, ...s.daily.map((d) => d.rev));
  const margin = s.d30.rev ? Math.round((s.d30.profit / s.d30.rev) * 100) : 0;
  const warn = [!s.config.paypal && "PayPal isn't connected yet — checkout is closed.", !s.config.cj && "CJ API key isn't set — imports and automatic fulfilment are off."].filter(Boolean);
  main().innerHTML = `<h1>Dashboard</h1>
    ${warn.length ? `<div class="panel warn">${warn.map((w) => `<div>⚠️ ${w} <a href="#setup" style="text-decoration:underline">Fix in Setup</a></div>`).join("")}</div>` : ""}
    ${s.action ? `<div class="panel alert"><b>${s.action} order${s.action > 1 ? "s" : ""} need${s.action > 1 ? "" : "s"} your attention.</b> <a href="#orders" style="text-decoration:underline">Review orders →</a></div>` : ""}
    <div class="kpis">
      <div class="kpi"><div class="l">Sales today</div><div class="v">${money(s.today.rev)}</div><div class="s">${s.today.n} orders</div></div>
      <div class="kpi"><div class="l">Sales · 30 days</div><div class="v">${money(s.d30.rev)}</div><div class="s">${s.d30.n} orders</div></div>
      <div class="kpi"><div class="l">Profit · 30 days</div><div class="v">${money(s.d30.profit)}</div><div class="s">${margin}% margin after product cost</div></div>
      <div class="kpi"><div class="l">Products</div><div class="v">${s.products.active || 0}</div><div class="s">${s.products.soldout || 0} sold out · ${s.subscribers} subscribers</div></div></div>
    <div class="panel"><b>Sales · last 14 days</b>${s.daily.length ? `<div class="bars" style="margin-bottom:22px">${s.daily.map((d) => `<div style="height:${(d.rev / max) * 100}%" title="${d.d}: ${money(d.rev)}"><span>${d.d.slice(5)}</span></div>`).join("")}</div>` : `<p class="muted">No sales yet. Your first order will show up here.</p>`}</div>
    <div class="panel"><div class="row-between"><b>Supplier sync</b><button class="btn sm" id="syncNow">Sync now</button></div>
      <p class="muted" style="margin-bottom:0">${s.lastSync ? `Last run ${new Date(s.lastSync.at).toLocaleString()} · ${s.lastSync.ok} products updated${s.lastSync.errors.length ? ` · ${s.lastSync.errors.length} errors` : ""}` : "Runs automatically every 6 hours once the CJ key is set."}</p></div>`;
  $("#syncNow").onclick = async (e) => { e.target.disabled = true; try { const r = await api("/api/admin/sync", "POST"); toast(`Updated ${r.ok} products`); dashboard(); } catch (er) { toast(er.message); e.target.disabled = false; } };
}

/* ---------- Orders ---------- */
async function orders() {
  const f = sessionStorage.getItem("lm_of") || "";
  const list = await api("/api/admin/orders" + (f ? "?status=" + f : ""));
  main().innerHTML = `<h1>Orders</h1><div class="chips" style="margin-bottom:16px">${[["", "All"], ...STATUSES.map((s) => [s, LABEL[s]])].map(([v, t]) => `<button class="chip ${v === f ? "on" : ""}" data-f="${v}">${t}</button>`).join("")}</div>
    <div class="panel tbl-wrap" style="padding:6px 10px">${list.length ? `<table><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Profit</th><th>Status</th></tr>
      ${list.map((o) => `<tr class="click" data-o="${o.id}"><td><b>#${esc(o.id)}</b></td><td>${date(o.created_at)}</td><td>${esc(o.name)}<div class="muted" style="font-size:12px">${esc(o.country)}</div></td>
        <td>${o.items.reduce((s, l) => s + l.qty, 0)}</td><td>${money(o.total)}</td><td>${money(o.total - o.cost_total)}</td><td>${st(o.status)}</td></tr>`).join("")}</table>`
      : `<p class="muted" style="padding:12px">No orders here yet.</p>`}</div>`;
  main().querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { sessionStorage.setItem("lm_of", b.dataset.f); orders(); }));
  main().querySelectorAll("[data-o]").forEach((r) => (r.onclick = () => orderModal(list.find((o) => o.id === r.dataset.o))));
}
function modal(html) {
  const bg = document.createElement("div"); bg.className = "modal-bg"; bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.onclick = (e) => { if (e.target === bg) bg.remove(); }; document.body.appendChild(bg); return bg;
}
function orderModal(o) {
  const a = o.address || {};
  const m = modal(`<div class="row-between"><h2 style="margin:0">Order #${esc(o.id)}</h2>${st(o.status)}</div><p class="muted">${date(o.created_at)} · PayPal ${esc(o.paypal_capture_id || "")}</p>
    ${o.notes ? `<pre class="notes">${esc(o.notes)}</pre>` : ""}
    <div class="form-grid" style="margin-top:16px"><div><b>Customer</b><p style="margin:6px 0">${esc(o.name)}<br>${esc(o.email)}<br>${esc(o.phone || "")}</p></div>
      <div><b>Ship to</b><p style="margin:6px 0">${esc(a.address1)} ${esc(a.address2 || "")}<br>${esc(a.city)}, ${esc(a.province || "")} ${esc(a.zip)}<br>${esc(a.countryName || o.country)}</p></div></div>
    <table style="margin:10px 0"><tr><th>Item</th><th>Supplier</th><th>Qty</th><th>Price</th><th>Cost</th></tr>${o.items.map((l) => `<tr><td>${esc(l.title)}<div class="muted" style="font-size:12px">${esc(l.variant || "")}</div></td><td>${SUPPLIER[l.supplier] || esc(l.supplier)}</td><td>${l.qty}</td><td>${money(l.price)}</td><td>${money(l.cost)}</td></tr>`).join("")}</table>
    <div class="row-between"><span>Subtotal ${money(o.subtotal)} · Discount −${money(o.discount)} · Shipping ${money(o.shipping)}</span><b>Total ${money(o.total)}</b></div>
    <div class="row-between" style="margin-top:4px"><span class="muted">Supplier cost ${money(o.cost_total)}</span><b style="color:var(--good)">Profit ${money(o.total - o.cost_total)}</b></div>
    <div class="muted" style="font-size:13px;margin-top:6px">Supplier orders: ${Object.entries(o.supplier_order_ids || {}).map(([k, v]) => esc(k + ": " + v)).join(", ") || "none yet"}</div>
    <form id="of" class="form-grid" style="margin-top:18px">
      <label>Status<select class="inp" name="status">${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${LABEL[s]}</option>`).join("")}</select></label>
      <label>Carrier<input class="inp" name="tracking_carrier" value="${esc(o.tracking_carrier || "")}" placeholder="e.g. USPS, YunExpress"></label>
      <label class="full">Tracking number<input class="inp" name="tracking_number" value="${esc(o.tracking_number || "")}"></label>
      <label class="full">Notes<textarea class="inp" name="notes">${esc(o.notes || "")}</textarea></label>
      <div class="full flex"><button class="btn">Save</button>${["paid", "action_needed"].includes(o.status) ? `<button type="button" class="btn ghost" id="refulfil">Send to CJ again</button>` : ""}<button type="button" class="btn ghost" id="close">Close</button></div></form>`);
  $("#close", m).onclick = () => m.remove();
  $("#of", m).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    try { await api("/api/admin/orders/" + o.id, "PATCH", { status: f.status.value, tracking_carrier: f.tracking_carrier.value, tracking_number: f.tracking_number.value, notes: f.notes.value }); m.remove(); toast("Order saved"); orders(); }
    catch (er) { toast(er.message); }
  };
  const rf = $("#refulfil", m);
  if (rf) rf.onclick = async () => { rf.disabled = true; try { const r = await api(`/api/admin/orders/${o.id}/fulfil`, "POST"); m.remove(); toast("Status: " + (LABEL[r.status] || r.status)); orders(); } catch (er) { toast(er.message); rf.disabled = false; } };
}

/* ---------- Products ---------- */
async function products() {
  const list = await api("/api/admin/products");
  main().innerHTML = `<div class="row-between"><h1>Products</h1><div class="flex"><a class="btn sm ghost" href="#import">Import from CJ</a><button class="btn sm" id="addP">Add product</button></div></div>
    <div class="panel tbl-wrap" style="padding:6px 10px"><table><tr><th>Product</th><th>Supplier</th><th>Price</th><th>Cost</th><th>Margin</th><th>Stock</th><th>Status</th></tr>
    ${list.map((p) => { const mg = p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
      return `<tr class="click" data-p="${p.id}"><td><div class="flex">${thumb(p)}<div><b>${esc(p.title)}</b><div class="muted" style="font-size:12px">${esc(collections.find((c) => c.id === p.collection)?.name || "No collection")}${p.ships === "us" ? " · US warehouse" : ""}</div></div></div></td>
      <td>${SUPPLIER[p.supplier] || esc(p.supplier)}</td><td>${money(p.price)}</td><td>${money(p.cost)}</td><td style="color:${mg < 30 ? "var(--bad)" : "var(--good)"};font-weight:600">${mg}%</td><td>${p.stock}</td><td>${p.active ? st("delivered").replace("Delivered", "Active") : '<span class="st">Draft</span>'}</td></tr>`; }).join("")}</table></div>`;
  main().querySelectorAll("[data-p]").forEach((r) => (r.onclick = () => productModal(list.find((p) => p.id === r.dataset.p))));
  $("#addP").onclick = () => productModal(null);
}
function productModal(p) {
  const isNew = !p; p = p || { title: "", description: "", price: "", compareAt: "", cost: "", stock: 100, images: [], variants: [], supplier: "aliexpress", active: true, ships: "intl" };
  const vtxt = (p.variants || []).map((v) => v.name + ": " + v.options.join(", ")).join("\n");
  const m = modal(`<h2>${isNew ? "Add product" : "Edit product"}</h2>${isNew ? `<p class="muted">Use this for AliExpress items you order by hand. CJ products are added from “Import from CJ”.</p>` : ""}
    <form id="pf" class="form-grid">
      <label class="full">Title<input class="inp" name="title" required value="${esc(p.title)}"></label>
      <label class="full">Description<textarea class="inp" name="description">${esc(p.description)}</textarea></label>
      <label>Price (USD)<input class="inp" name="price" type="number" step="0.01" required value="${p.price ?? ""}"></label>
      <label>Compare-at price<input class="inp" name="compareAt" type="number" step="0.01" value="${p.compareAt ?? ""}"></label>
      <label>Your cost (supplier price)<input class="inp" name="cost" type="number" step="0.01" value="${p.cost ?? ""}"></label>
      <label>Stock<input class="inp" name="stock" type="number" value="${p.stock}"></label>
      <label>Collection<select class="inp" name="collection"><option value="">None</option>${collections.map((c) => `<option value="${c.id}" ${c.id === p.collection ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label>Badge<input class="inp" name="badge" value="${esc(p.badge || "")}" placeholder="e.g. New, Best seller"></label>
      <label>Ships from<select class="inp" name="ships"><option value="intl">China / overseas</option><option value="us" ${p.ships === "us" ? "selected" : ""}>US warehouse</option></select></label>
      ${isNew ? `<label>Supplier<select class="inp" name="supplier"><option value="aliexpress">AliExpress (manual)</option><option value="manual">Other (manual)</option></select></label>` : `<label>Supplier<input class="inp" disabled value="${esc(SUPPLIER[p.supplier] || p.supplier)}"></label>`}
      <label class="full">Supplier link (where you order it)<input class="inp" name="supplierUrl" value="${esc(p.supplierUrl || "")}" placeholder="https://www.aliexpress.com/item/..."></label>
      <label class="full">Image URLs (one per line)<textarea class="inp" name="images">${esc((p.images || []).join("\n"))}</textarea></label>
      <label class="full">Options (one per line, e.g. “Color: Black, White”)<textarea class="inp" name="variants" ${p.supplier === "cj" ? "disabled" : ""}>${esc(vtxt)}</textarea></label>
      <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${p.active ? "checked" : ""}> Visible in store</label>
      <div class="full flex"><button class="btn">${isNew ? "Create" : "Save"}</button><button type="button" class="btn ghost" id="pc">Cancel</button>${isNew ? "" : `<button type="button" class="btn danger" id="pd" style="margin-left:auto">Delete</button>`}</div></form>`);
  $("#pc", m).onclick = () => m.remove();
  const del = $("#pd", m);
  if (del) del.onclick = async () => { if (!confirm("Delete this product permanently?")) return; await api("/api/admin/products/" + p.id, "DELETE"); m.remove(); toast("Deleted"); products(); };
  $("#pf", m).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const data = { title: f.title.value, description: f.description.value, price: f.price.value, compareAt: f.compareAt.value, cost: f.cost.value, stock: f.stock.value,
      collection: f.collection.value, badge: f.badge.value, ships: f.ships.value, supplierUrl: f.supplierUrl.value, active: f.active.checked,
      images: f.images.value.split("\n").map((x) => x.trim()).filter(Boolean) };
    if (!f.variants.disabled) data.variants = f.variants.value.split("\n").map((l) => l.split(":")).filter((x) => x.length === 2 && x[1].trim())
      .map(([n, o]) => ({ name: n.trim(), options: o.split(",").map((x) => x.trim()).filter(Boolean) }));
    if (isNew) data.supplier = f.supplier.value;
    try { await api(isNew ? "/api/admin/products" : "/api/admin/products/" + p.id, isNew ? "POST" : "PATCH", data); m.remove(); toast("Saved"); products(); }
    catch (er) { toast(er.message); }
  };
}

/* ---------- Import from CJ ---------- */
async function importCj() {
  main().innerHTML = `<h1>Import from CJ Dropshipping</h1>
    <form class="panel flex" id="sf" style="flex-wrap:wrap"><input class="inp" name="q" placeholder="Search CJ products, e.g. wireless earbuds" style="flex:1;min-width:220px" required>
      <label class="flex" style="font-size:14px">Markup<select class="inp" name="markup" style="width:auto">${[2, 2.5, 3, 3.5].map((x) => `<option ${x === 2.5 ? "selected" : ""} value="${x}">${x}× cost</option>`).join("")}</select></label>
      <select class="inp" name="collection" style="width:auto">${collections.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
      <button class="btn">Search</button></form>
    <p class="muted">Imported products start as <b>drafts</b> so you can check the title, photos and price before they go live in Products.</p><div id="res"></div>`;
  $("#sf").onsubmit = async (e) => {
    e.preventDefault(); const f = e.target, res = $("#res");
    res.innerHTML = `<p class="muted">Searching CJ…</p>`;
    try {
      const list = await api("/api/admin/cj/search?q=" + encodeURIComponent(f.q.value));
      if (!list.length) { res.innerHTML = `<p class="muted">No results. Try different words.</p>`; return; }
      const mk = Number(f.markup.value);
      res.innerHTML = `<div class="cj-grid">${list.map((p) => `<div class="cj-card"><img src="${esc(p.image)}" alt="" loading="lazy"><div class="b"><b>${esc(p.title)}</b>
        <span class="muted">Cost ${money(p.cost)} → sell ≈ ${money(Math.ceil(p.cost * mk) - 0.01)}</span><button class="btn sm" data-pid="${esc(p.pid)}" style="margin-top:auto">Import</button></div></div>`).join("")}</div>`;
      res.querySelectorAll("[data-pid]").forEach((b) => (b.onclick = async () => {
        b.disabled = true; b.textContent = "Importing…";
        try { const p = await api("/api/admin/cj/import", "POST", { pid: b.dataset.pid, markup: mk, collection: f.collection.value }); b.textContent = "Imported ✓"; toast("Added as draft: " + p.title); }
        catch (er) { b.disabled = false; b.textContent = "Import"; toast(er.message); }
      }));
    } catch (er) { res.innerHTML = `<p style="color:var(--bad)">${esc(er.message)}</p>`; }
  };
}

/* ---------- Discounts ---------- */
async function discounts() {
  const list = await api("/api/admin/discounts");
  main().innerHTML = `<h1>Discount codes</h1><form class="panel flex" id="df" style="flex-wrap:wrap"><input class="inp" name="code" placeholder="CODE" style="max-width:200px;text-transform:uppercase" required>
    <input class="inp" name="percent" type="number" min="1" max="90" placeholder="% off" style="max-width:120px" required><button class="btn">Create code</button></form>
    <div class="panel tbl-wrap" style="padding:6px 10px"><table><tr><th>Code</th><th>Discount</th><th>Times used</th><th>Status</th><th></th></tr>
    ${list.map((d) => `<tr><td><b>${esc(d.code)}</b></td><td>${d.percent}% off</td><td>${d.uses}</td><td>${d.active ? "Active" : "Disabled"}</td><td><button class="btn sm ghost" data-d="${esc(d.code)}" data-a="${d.active ? 0 : 1}">${d.active ? "Disable" : "Enable"}</button></td></tr>`).join("")}</table></div>`;
  $("#df").onsubmit = async (e) => { e.preventDefault(); try { await api("/api/admin/discounts", "POST", { code: e.target.code.value, percent: e.target.percent.value }); toast("Code saved"); discounts(); } catch (er) { toast(er.message); } };
  main().querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => { await api("/api/admin/discounts/" + b.dataset.d, "PATCH", { active: b.dataset.a === "1" }); discounts(); }));
}

/* ---------- Subscribers ---------- */
async function subscribers() {
  const list = await api("/api/admin/subscribers");
  main().innerHTML = `<div class="row-between"><h1>Subscribers (${list.length})</h1>${list.length ? `<button class="btn sm" id="csv">Download CSV</button>` : ""}</div>
    <div class="panel">${list.length ? list.map((s) => `<div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(s.email)}</span><span class="muted">${date(s.created_at)}</span></div>`).join("") : `<p class="muted">No subscribers yet.</p>`}</div>`;
  const c = $("#csv");
  if (c) c.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["email,date\n" + list.map((s) => `${s.email},${s.created_at}`).join("\n")], { type: "text/csv" })); a.download = "leeysmall-subscribers.csv"; a.click(); };
}

/* ---------- Setup ---------- */
async function setup() {
  const s = await api("/api/admin/stats");
  const row = (ok, t, d) => `<div><span class="dot ${ok ? "ok" : ""}"></span><div><b>${t}</b><div class="muted" style="font-size:13px">${d}</div></div></div>`;
  main().innerHTML = `<h1>Setup</h1><div class="panel check">
    ${row(true, "Database", "Connected and ready.")}
    ${row(s.config.paypal, "PayPal payments", s.config.paypal ? `Connected (${s.config.paypalEnv === "live" ? "LIVE — real payments" : "sandbox — test payments only"}).` : "Add PAYPAL_CLIENT_ID (in wrangler.jsonc) and the PAYPAL_SECRET secret in Cloudflare → Worker → Settings → Variables and Secrets.")}
    ${row(s.config.cj, "CJ Dropshipping", s.config.cj ? "API key set. Orders are sent to CJ automatically (unpaid — pay them in your CJ dashboard)." : "Add the CJ_API_KEY secret in Cloudflare → Worker → Settings → Variables and Secrets.")}
    </div><div class="panel"><b>Categories</b><form id="cf" class="flex" style="margin-top:10px;flex-wrap:wrap"><input class="inp" name="name" placeholder="Name, e.g. Gaming" style="max-width:240px" required><input class="inp" name="blurb" placeholder="Short description" style="max-width:320px"><button class="btn sm">Add</button></form>
    <div class="chips" style="margin-top:14px">${collections.map((c) => `<span class="chip">${esc(c.name)} <button data-rmc="${c.id}" title="Remove" style="border:0;background:none;color:var(--bad);font-weight:700;padding:0 0 0 4px">×</button></span>`).join("")}</div>
    <p class="muted" style="margin-bottom:0;font-size:13px">The first 5 categories show in the top menu; all of them show on the homepage, mobile menu and footer. Removing a category keeps its products (they just become uncategorised).</p></div>`;
  main().querySelectorAll("[data-rmc]").forEach((b) => (b.onclick = async () => { if (!confirm("Remove this category?")) return; await api("/api/admin/collections/" + b.dataset.rmc, "DELETE"); collections = await api("/api/admin/collections"); setup(); }));
  $("#cf").onsubmit = async (e) => { e.preventDefault(); try { await api("/api/admin/collections", "POST", { name: e.target.name.value, blurb: e.target.blurb.value }); collections = await api("/api/admin/collections"); toast("Collection added"); setup(); } catch (er) { toast(er.message); } };
}

api("/api/admin/stats").then(() => shell()).catch(() => login());
