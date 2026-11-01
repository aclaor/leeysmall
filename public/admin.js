// LeeysPremium admin dashboard
import { classify } from "/classify.js";
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
  root.innerHTML = `<div class="login"><form class="panel" id="lf" style="width:min(380px,100%)"><div class="logo" style="margin-bottom:6px">Leeys<span>Premium</span></div><p class="muted" style="margin-top:0">Admin sign in</p>
    <div class="field"><input class="inp" type="password" name="pw" placeholder="Admin password" autofocus required></div><button class="btn block">Sign in</button><p id="le" style="color:var(--bad);font-size:14px"></p></form></div>`;
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    try { await api("/api/admin/login", "POST", { password: e.target.pw.value }); shell(); } catch (er) { $("#le").textContent = er.message; }
  };
}

async function shell() {
  root.innerHTML = `<div class="adm"><nav class="side"><div class="logo">Leeys<span>Premium</span></div>
    ${[["dashboard", "Dashboard"], ["orders", "Orders"], ["messages", "Messages"], ["products", "Products"], ["import", "Import from CJ"], ["live", "Live & Video"], ["promos", "Promotions"], ["discounts", "Vouchers"], ["subscribers", "Subscribers"], ["setup", "Setup"]]
      .map(([k, t]) => `<a href="#${k}" data-tab="${k}">${t}<span id="badge-${k}"></span></a>`).join("")}
    <div class="bottom"><a href="/" target="_blank">View store ↗</a><a href="#" id="logout">Sign out</a></div></nav><main class="main" id="main"></main></div>`;
  $("#logout").onclick = async (e) => { e.preventDefault(); await fetch("/api/admin/logout"); login(); };
  try { collections = await api("/api/admin/collections"); } catch { return; }
  refreshChatBadge();
  show(tab);
}
window.addEventListener("hashchange", () => { const t = location.hash.slice(1); if (t && $("#main")) show(t); });
function show(t) {
  tab = t;
  document.querySelectorAll("[data-tab]").forEach((a) => a.classList.toggle("on", a.dataset.tab === t));
  ({ dashboard, orders, messages, products, import: importCj, live: liveAdmin, promos, discounts, subscribers, setup }[t] || dashboard)().catch((e) => toast(e.message));
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

/* ---------- Messages (live chat) ---------- */
let chatState = { status: "open", openId: null, timer: null, lastCount: -1 };
async function refreshChatBadge() {
  try {
    const r = await api("/api/admin/chats/unread");
    const b = $("#badge-messages"); if (b) b.innerHTML = r.n ? `<span class="pill">${r.n}</span>` : "";
    document.title = (r.n ? `(${r.n}) ` : "") + "LeeysPremium Admin";
    if (chatState.lastCount >= 0 && r.n > chatState.lastCount) { toast("💬 New chat message"); if (tab === "messages") messages(true); }
    chatState.lastCount = r.n;
  } catch {}
}
setInterval(() => { if ($("#main")) refreshChatBadge(); }, 15000);

async function messages(keepOpen) {
  const cs = chatState;
  const list = await api("/api/admin/chats?status=" + cs.status);
  main().innerHTML = `<h1>Messages</h1><div class="chips" style="margin-bottom:14px">${[["open", "Open"], ["closed", "Closed"]].map(([v, t]) => `<button class="chip ${cs.status === v ? "on" : ""}" data-cst="${v}">${t}</button>`).join("")}</div>
    <div class="chat-admin"><div class="panel chat-list" style="padding:6px">${list.length ? list.map((c) => `<button class="chat-row ${c.id === cs.openId ? "on" : ""}" data-chat="${c.id}">
        <div class="row-between"><b>${esc(c.name || c.email || "Visitor " + c.id.slice(-4))}</b><span class="muted" style="font-size:12px">${date(c.last_at)}</span></div>
        <div class="row-between" style="gap:8px"><span class="muted" style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.last_from === "admin" ? "You: " : ""}${esc(c.last_body || "")}</span>${c.unread_admin ? `<span class="pill">${c.unread_admin}</span>` : ""}</div></button>`).join("")
      : `<p class="muted" style="padding:14px">${cs.status === "open" ? "No open chats. When a customer messages you from the store, it shows up here." : "No closed chats."}</p>`}</div>
      <div class="panel chat-view" id="chatView"><p class="muted">Select a conversation.</p></div></div>`;
  main().querySelectorAll("[data-cst]").forEach((b) => (b.onclick = () => { cs.status = b.dataset.cst; cs.openId = null; messages(); }));
  main().querySelectorAll("[data-chat]").forEach((b) => (b.onclick = () => { cs.openId = b.dataset.chat; main().querySelectorAll("[data-chat]").forEach((x) => x.classList.toggle("on", x === b)); openChat(cs.openId); }));
  if (cs.openId && list.some((c) => c.id === cs.openId)) openChat(cs.openId, keepOpen);
  refreshChatBadge();
}
async function openChat(id, keepDraft) {
  const view = $("#chatView"); if (!view) return;
  const draft = keepDraft ? ($("#replyBox")?.value || "") : "";
  const d = await api("/api/admin/chats/" + id), c = d.chat;
  view.innerHTML = `<div class="row-between" style="gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px">
      <div><b style="font-size:16px">${esc(c.name || "Visitor")}</b><div class="muted" style="font-size:13px">${c.email ? `<a href="mailto:${esc(c.email)}" style="color:var(--blue-2)">${esc(c.email)}</a>` : "No email given"} · started ${date(c.created_at)}${c.page ? ` · on <a href="${esc(c.page)}" target="_blank" style="color:var(--blue-2)">${esc(c.page)}</a>` : ""}</div></div>
      <div class="flex" style="gap:6px"><button class="btn sm ghost" id="chatToggle">${c.status === "open" ? "Mark resolved" : "Reopen"}</button><button class="btn sm ghost" id="chatDel">Delete</button></div></div>
    ${d.orders.length ? `<div class="muted" style="font-size:13px;padding:10px 0;border-bottom:1px solid var(--line)">Orders from this email: ${d.orders.map((o) => `<a href="#orders" style="color:var(--blue-2)">#${esc(o.id)}</a> ${money(o.total)} (${LABEL[o.status] || o.status})`).join(" · ")}</div>` : ""}
    <div class="chat-thread" id="thread">${d.messages.map((m) => `<div class="msg ${m.sender === "admin" ? "me" : "them"}"><p>${esc(m.body).replace(/\n/g, "<br>")}</p><time>${date(m.created_at)}</time></div>`).join("")}</div>
    <form id="replyForm" class="chat-reply"><textarea class="inp" id="replyBox" rows="2" placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)">${esc(draft)}</textarea><button class="btn accent">Send</button></form>
    ${c.email ? "" : `<p class="muted" style="font-size:12px;margin:6px 0 0">They see your reply while the store is open in their browser. They didn't leave an email, so ask for one if you need to follow up later.</p>`}`;
  const th = $("#thread"); th.scrollTop = th.scrollHeight;
  const box = $("#replyBox");
  box.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#replyForm").requestSubmit(); } };
  $("#replyForm").onsubmit = async (e) => {
    e.preventDefault(); const text = box.value.trim(); if (!text) return;
    try { await api("/api/admin/chats/" + id, "POST", { body: text }); box.value = ""; openChat(id); messagesListOnly(); } catch (er) { toast(er.message); }
  };
  $("#chatToggle").onclick = async () => { await api("/api/admin/chats/" + id, "PATCH", { status: c.status === "open" ? "closed" : "open" }); chatState.openId = null; messages(); };
  $("#chatDel").onclick = async () => { if (!confirm("Delete this conversation permanently?")) return; await api("/api/admin/chats/" + id, "DELETE"); chatState.openId = null; messages(); };
  if (!keepDraft) box.focus();
  refreshChatBadge();
}
async function messagesListOnly() { if (tab === "messages") { const keep = $("#replyBox")?.value; await messages(true); if (keep && $("#replyBox")) $("#replyBox").value = keep; } }
// Refresh the open conversation while the Messages tab is visible
setInterval(() => { if (tab === "messages" && chatState.openId && document.visibilityState === "visible" && $("#chatView")) messagesListOnly(); }, 6000);

/* ---------- Products ---------- */
const pState = { q: "", status: "", cat: "", supplier: "", selected: new Set() };
async function products() {
  const list = await api("/api/admin/products"), ps = pState;
  const ids = new Set(list.map((p) => p.id));
  for (const id of [...ps.selected]) if (!ids.has(id)) ps.selected.delete(id);
  const counts = { all: list.length, draft: list.filter((p) => !p.active).length, live: list.filter((p) => p.active).length };
  main().innerHTML = `<div class="row-between"><h1>Products</h1><div class="flex"><button class="btn sm accent" id="autoSort">✨ Auto-sort categories</button><a class="btn sm ghost" href="#import">Import from CJ</a><button class="btn sm" id="addP">Add product</button></div></div>
    <div class="chips" style="margin-bottom:12px">${[["", `All (${counts.all})`], ["draft", `Drafts (${counts.draft})`], ["live", `Live (${counts.live})`]].map(([v, t]) => `<button class="chip ${ps.status === v ? "on" : ""}" data-status="${v}">${t}</button>`).join("")}</div>
    <div class="panel flex" style="flex-wrap:wrap;gap:10px;padding:14px">
      <input class="inp" id="pq" placeholder="Search products…" value="${esc(ps.q)}" style="flex:2;min-width:200px">
      <select class="inp" id="pcat" style="flex:1;min-width:160px"><option value="">All categories</option><option value="__none" ${ps.cat === "__none" ? "selected" : ""}>No category</option>${collections.map((c) => `<option value="${c.id}" ${ps.cat === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      <select class="inp" id="psup" style="flex:1;min-width:160px"><option value="">All suppliers</option>${Object.entries(SUPPLIER).map(([k, v]) => `<option value="${k}" ${ps.supplier === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div id="pbar"></div><div class="panel tbl-wrap" style="padding:6px 10px" id="ptable"></div>`;
  const filtered = () => {
    const q = ps.q.toLowerCase();
    return list.filter((p) => (!ps.status || (ps.status === "live" ? p.active : !p.active)) && (!ps.supplier || p.supplier === ps.supplier)
      && (!ps.cat || (ps.cat === "__none" ? !collections.some((c) => c.id === p.collection) : p.collection === ps.cat)) && (!q || p.title.toLowerCase().includes(q)));
  };
  const renderTable = () => {
    const rows = filtered(), allOn = rows.length && rows.every((p) => ps.selected.has(p.id));
    $("#ptable").innerHTML = rows.length ? `<table><tr><th style="width:34px"><input type="checkbox" id="pall" ${allOn ? "checked" : ""} title="Select all shown"></th><th>Product</th><th>Supplier</th><th>Price</th><th>Cost</th><th>Margin</th><th>Stock</th><th>Status</th></tr>
      ${rows.map((p) => { const mg = p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;
        return `<tr class="click" data-p="${p.id}"><td data-nopen><input type="checkbox" data-sel="${p.id}" ${ps.selected.has(p.id) ? "checked" : ""}></td>
        <td><div class="flex">${thumb(p)}<div><b>${esc(p.title)}</b><div class="muted" style="font-size:12px">${esc(collections.find((c) => c.id === p.collection)?.name || "No category")}${p.ships === "us" ? " · US warehouse" : ""}</div></div></div></td>
        <td>${SUPPLIER[p.supplier] || esc(p.supplier)}</td><td>${money(p.price)}</td><td>${money(p.cost)}</td><td style="color:${mg < 30 ? "var(--bad)" : "var(--good)"};font-weight:600">${mg}%</td><td>${p.stock}</td>
        <td data-nopen><button class="st ${p.active ? "delivered" : ""}" data-toggle="${p.id}" title="Click to ${p.active ? "hide" : "publish"}" style="cursor:pointer">${p.active ? "Live" : "Draft"}</button></td></tr>`; }).join("")}</table>`
      : `<p class="muted" style="padding:12px">No products match.</p>`;
    renderBar();
    $("#ptable").querySelectorAll("[data-p]").forEach((r) => (r.onclick = (e) => { if (!e.target.closest("[data-nopen]")) productModal(list.find((p) => p.id === r.dataset.p)); }));
    $("#ptable").querySelectorAll("[data-sel]").forEach((c) => (c.onchange = () => { c.checked ? ps.selected.add(c.dataset.sel) : ps.selected.delete(c.dataset.sel); renderTable(); }));
    const pall = $("#pall");
    if (pall) pall.onchange = () => { for (const p of rows) pall.checked ? ps.selected.add(p.id) : ps.selected.delete(p.id); renderTable(); };
    $("#ptable").querySelectorAll("[data-toggle]").forEach((b) => (b.onclick = async () => {
      const p = list.find((x) => x.id === b.dataset.toggle);
      try { await api("/api/admin/products/bulk", "POST", { ids: [p.id], action: p.active ? "hide" : "publish" }); p.active = !p.active; toast(p.active ? "Published" : "Hidden"); products(); }
      catch (er) { toast(er.message); }
    }));
  };
  const renderBar = () => {
    const n = ps.selected.size, bar = $("#pbar");
    bar.innerHTML = n ? `<div class="panel row-between" style="position:sticky;top:10px;z-index:6;flex-wrap:wrap;gap:10px;padding:12px 16px;box-shadow:var(--glow)">
      <b>${n} selected</b><div class="flex" style="flex-wrap:wrap;gap:8px">
        <button class="btn sm accent" data-bulk="publish">Publish</button><button class="btn sm ghost" data-bulk="hide">Hide</button>
        <select class="inp" id="bcat" style="width:auto;padding:7px 10px"><option value="">Move to category…</option>${collections.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        <button class="btn sm ghost" id="bflash">⚡ Sale…</button>
        <select class="inp" id="bmk" style="width:auto;padding:7px 10px"><option value="">Set price markup…</option>${[2, 2.5, 3, 3.5, 4].map((x) => `<option value="${x}">${x}× cost</option>`).join("")}</select>
        <button class="btn sm danger" data-bulk="delete">Delete</button><button class="btn sm ghost" id="bclear">Clear</button></div></div>` : "";
    if (!n) return;
    const run = async (action, extra = {}) => {
      try { const r = await api("/api/admin/products/bulk", "POST", { ids: [...ps.selected], action, ...extra }); toast(`${r.count} product${r.count === 1 ? "" : "s"} updated`); if (action === "delete") ps.selected.clear(); products(); }
      catch (er) { toast(er.message); }
    };
    bar.querySelectorAll("[data-bulk]").forEach((b) => (b.onclick = () => {
      if (b.dataset.bulk === "delete" && !confirm(`Delete ${n} product${n === 1 ? "" : "s"} permanently?`)) return;
      run(b.dataset.bulk);
    }));
    $("#bcat").onchange = (e) => e.target.value && run("category", { collection: e.target.value });
    $("#bflash").onclick = () => {
      const m = modal(`<h2>⚡ Sale for ${n} product${n === 1 ? "" : "s"}</h2><form id="fsf" class="form-grid">
        <label>Name shown to shoppers<input class="inp" name="label" value="Flash Sale" maxlength="60" required></label>
        <label>Discount (%)<input class="inp" name="percent" type="number" min="1" max="90" value="10" required></label>
        ${whenFields()}
        <div class="full flex"><button class="btn accent">Save sale</button><button type="button" class="btn ghost" id="fsc">Cancel</button></div></form>`);
      $("#fsc", m).onclick = () => m.remove();
      bindWhen($("#fsf", m));
      $("#fsf", m).onsubmit = async (e) => { e.preventDefault(); const f = e.target;
        try { await api("/api/admin/promos", "POST", { label: f.label.value, percent: f.percent.value, scope: "products", target: [...ps.selected], ...readWhen(f) });
          m.remove(); toast("Sale saved"); } catch (er) { toast(er.message); } };
    };
    $("#bmk").onchange = (e) => e.target.value && confirm(`Reprice ${n} product${n === 1 ? "" : "s"} to ${e.target.value}× their cost?`) ? run("markup", { markup: Number(e.target.value) }) : (e.target.value = "");
    $("#bclear").onclick = () => { ps.selected.clear(); renderTable(); };
  };
  main().querySelectorAll("[data-status]").forEach((b) => (b.onclick = () => { ps.status = b.dataset.status; products(); }));
  $("#pq").oninput = (e) => { ps.q = e.target.value; renderTable(); };
  $("#pcat").onchange = (e) => { ps.cat = e.target.value; renderTable(); };
  $("#psup").onchange = (e) => { ps.supplier = e.target.value; renderTable(); };
  $("#addP").onclick = () => productModal(null);
  $("#autoSort").onclick = () => autoSortModal(list);
  renderTable();
}
function autoSortModal(list) {
  const ids = collections.map((c) => c.id), cname = (id) => collections.find((c) => c.id === id)?.name || "No category";
  const rows = [];
  let unsure = 0;
  for (const p of list) {
    const r = classify({ title: p.title, description: p.description }, ids);
    if (!r) { if (!ids.includes(p.collection)) unsure++; continue; }
    if (r.id !== p.collection) rows.push({ p, to: r.id, sure: r.sure, on: r.sure });
  }
  rows.sort((a, b) => (b.sure - a.sure) || a.to.localeCompare(b.to));
  const sel = (r, i) => `<select class="inp" data-to="${i}" style="padding:6px 8px;width:auto;max-width:180px">${collections.map((c) => `<option value="${c.id}" ${c.id === r.to ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`;
  const summary = () => { const by = {}; rows.filter((r) => r.on).forEach((r) => (by[r.to] = (by[r.to] || 0) + 1)); return Object.entries(by).map(([k, n]) => `${esc(cname(k))} ${n}`).join(" · ") || "nothing selected"; };
  const m = modal(`<div class="row-between" style="gap:10px;flex-wrap:wrap"><h2 style="margin:0">✨ Auto-sort categories</h2><button class="btn sm ghost" id="asClose">Close</button></div>
    <p class="muted" style="margin:8px 0 14px">Each product's name and description was checked to suggest its best category. <b style="color:#fff">${rows.filter((r) => r.sure).length}</b> confident suggestions are ticked; <b style="color:var(--warn)">${rows.filter((r) => !r.sure).length}</b> less certain ones are unticked — tick the ones that look right, or change the category in the dropdown.${unsure ? ` ${unsure} uncategorised product${unsure === 1 ? "" : "s"} couldn't be matched and stay as they are.` : ""}</p>
    ${rows.length ? `<div class="flex" style="gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="btn sm ghost" id="asAll">Tick all</button><button class="btn sm ghost" id="asSure">Only confident</button><button class="btn sm ghost" id="asNone">Untick all</button></div>
    <div class="tbl-wrap" style="max-height:55vh;overflow:auto;border:1px solid var(--line);border-radius:14px"><table><tr><th style="width:30px"></th><th>Product</th><th>Now</th><th>Move to</th></tr>
      ${rows.map((r, i) => `<tr><td><input type="checkbox" data-as="${i}" ${r.on ? "checked" : ""}></td><td><div class="flex">${thumb(r.p)}<span style="color:#fff">${esc(r.p.title.slice(0, 80))}</span></div></td>
        <td class="muted">${esc(cname(r.p.collection))}</td><td>${sel(r, i)} ${r.sure ? "" : `<span class="st paid" title="Less certain — please check">check</span>`}</td></tr>`).join("")}</table></div>
    <div class="row-between" style="margin-top:14px;gap:10px;flex-wrap:wrap"><span class="muted" id="asSum" style="font-size:13px"></span><button class="btn accent" id="asApply">Apply</button></div>`
    : `<p style="color:var(--good)">Everything already looks correctly sorted. 🎉</p>`}`);
  const upd = () => { const n = rows.filter((r) => r.on).length; const b = $("#asApply", m); if (b) { b.textContent = `Move ${n} product${n === 1 ? "" : "s"}`; b.disabled = !n; $("#asSum", m).innerHTML = summary(); } };
  $("#asClose", m).onclick = () => m.remove();
  m.querySelectorAll("[data-as]").forEach((c) => (c.onchange = () => { rows[c.dataset.as].on = c.checked; upd(); }));
  m.querySelectorAll("[data-to]").forEach((s2) => (s2.onchange = () => { const r = rows[s2.dataset.to]; r.to = s2.value; r.on = true; m.querySelector(`[data-as="${s2.dataset.to}"]`).checked = true; upd(); }));
  const setAll = (fn) => { rows.forEach((r, i) => { r.on = fn(r); m.querySelector(`[data-as="${i}"]`).checked = r.on; }); upd(); };
  if (rows.length) {
    $("#asAll", m).onclick = () => setAll(() => true);
    $("#asSure", m).onclick = () => setAll((r) => r.sure);
    $("#asNone", m).onclick = () => setAll(() => false);
    $("#asApply", m).onclick = async (e) => {
      const groups = {};
      rows.filter((r) => r.on).forEach((r) => (groups[r.to] ||= []).push(r.p.id));
      e.target.disabled = true; e.target.textContent = "Moving…";
      try {
        let n = 0;
        for (const [to, ids2] of Object.entries(groups)) { await api("/api/admin/products/bulk", "POST", { ids: ids2, action: "category", collection: to }); n += ids2.length; }
        m.remove(); toast(`Moved ${n} products into the right categories`); products();
      } catch (er) { toast(er.message); upd(); }
    };
    upd();
  }
}
function productModal(p) {
  const isNew = !p; p = p || { title: "", description: "", price: "", compareAt: "", cost: "", stock: 100, images: [], variants: [], supplier: "aliexpress", active: true, ships: "intl" };
  const vtxt = (p.variants || []).map((v) => v.name + ": " + v.options.join(", ")).join("\n");
  const m = modal(`<h2>${isNew ? "Add product" : "Edit product"}</h2>${isNew ? `<p class="muted">Use this for AliExpress items you order by hand. CJ products are added from “Import from CJ”.</p>` : ""}
    <form id="pf" class="form-grid">
      <label class="full">Title<input class="inp" name="title" required value="${esc(p.title)}"></label>
      <label class="full">Description<textarea class="inp" name="description">${esc(p.description)}</textarea></label>
      <label>Price (USD)<input class="inp" name="price" type="number" step="0.01" required value="${p.price ?? ""}"></label>
      <label>Discounts<span class="muted" style="font-weight:400;font-size:12.5px;padding-top:10px">Crossed-out prices only appear during a real promotion. Set sales in <a href="#promos" style="color:var(--blue-2)">Promotions</a>.</span></label>
      <label>Your cost (supplier price)<input class="inp" name="cost" type="number" step="0.01" value="${p.cost ?? ""}"></label>
      <label>Stock<input class="inp" name="stock" type="number" value="${p.stock}"></label>
      <label>Collection<select class="inp" name="collection"><option value="">None</option>${collections.map((c) => `<option value="${c.id}" ${c.id === p.collection ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label>Badge<input class="inp" name="badge" value="${esc(p.badge || "")}" placeholder="e.g. New, Best seller"></label>
      <label>Ships from<select class="inp" name="ships"><option value="intl">China / overseas</option><option value="us" ${p.ships === "us" ? "selected" : ""}>US warehouse</option></select></label>
      ${isNew ? `<label>Supplier<select class="inp" name="supplier"><option value="aliexpress">AliExpress (manual)</option><option value="manual">Other (manual)</option></select></label>` : `<label>Supplier<input class="inp" disabled value="${esc(SUPPLIER[p.supplier] || p.supplier)}"></label>`}
      <label class="full">Supplier link (where you order it)<input class="inp" name="supplierUrl" value="${esc(p.supplierUrl || "")}" placeholder="https://www.aliexpress.com/item/..."></label>
      ${isNew ? "" : `<div class="full"><b style="font-size:13px;color:var(--ink-2)">Product video</b><div class="flex" style="gap:10px;flex-wrap:wrap;margin-top:6px">
        ${p.video ? `<video src="${esc(p.video)}" muted controls style="width:160px;border-radius:10px;background:#000"></video><button type="button" class="btn sm ghost" id="pvRemove">Remove video</button>` : `<span class="muted" style="font-size:13px">No video yet</span>`}
        <input type="file" id="pvFile" accept="video/mp4,video/quicktime,video/webm" class="inp" style="max-width:280px"><button type="button" class="btn sm accent" id="pvUp">Upload video</button><span id="pvProg" class="muted" style="font-size:13px"></span></div></div>`}
      <label class="full">Image URLs (one per line)<textarea class="inp" name="images">${esc((p.images || []).join("\n"))}</textarea></label>
      <label class="full">Options (one per line, e.g. “Color: Black, White”)<textarea class="inp" name="variants" ${p.supplier === "cj" ? "disabled" : ""}>${esc(vtxt)}</textarea></label>
      <label class="full" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="active" ${p.active ? "checked" : ""}> Visible in store</label>
      <div class="full flex"><button class="btn">${isNew ? "Create" : "Save"}</button><button type="button" class="btn ghost" id="pc">Cancel</button>${isNew ? "" : `<button type="button" class="btn ghost" id="psale">⚡ Put on sale</button>`}${isNew ? "" : `<button type="button" class="btn danger" id="pd" style="margin-left:auto">Delete</button>`}</div></form>`);
  $("#pc", m).onclick = () => m.remove();
  const psale = $("#psale", m);
  if (psale) psale.onclick = () => {
    const sm = modal(`<h2>⚡ Sale: ${esc(p.title.slice(0, 60))}</h2><p class="muted" style="margin-top:-6px">Now ${money(p.price)} — preview updates as you type.</p><form id="ssf" class="form-grid">
      <label>Name shown to shoppers<input class="inp" name="label" value="Flash Sale" maxlength="60" required></label>
      <label>Discount (%)<input class="inp" name="percent" type="number" min="1" max="90" value="10" required></label>
      <div class="full" id="sprev" style="font-size:15px"></div>
      ${whenFields()}
      <div class="full flex"><button class="btn accent">Save sale</button><button type="button" class="btn ghost" id="ssc">Cancel</button></div></form>`);
    const sf = $("#ssf", sm);
    const prev = () => { const pct = Number(sf.percent.value) || 0; $("#sprev", sm).innerHTML = pct ? `Shoppers will see <b style="color:var(--blue-2)">${money(Math.round(p.price * (100 - pct)) / 100)}</b> <s class="muted">${money(p.price)}</s> while the sale runs.` : ""; };
    sf.percent.oninput = prev; prev(); bindWhen(sf);
    $("#ssc", sm).onclick = () => sm.remove();
    sf.onsubmit = async (e) => { e.preventDefault();
      try { await api("/api/admin/promos", "POST", { label: sf.label.value, percent: sf.percent.value, scope: "products", target: [p.id], ...readWhen(sf) }); sm.remove(); toast("Sale saved for this product"); }
      catch (er) { toast(er.message); } };
  };
  const pvUp = $("#pvUp", m);
  if (pvUp) pvUp.onclick = async () => {
    const file = $("#pvFile", m).files[0]; if (!file) return toast("Choose a video file first");
    pvUp.disabled = true;
    try { await uploadVideo(file, { productId: p.id, kind: "product", title: p.title }, (x) => ($("#pvProg", m).textContent = `Uploading… ${Math.round(x * 100)}%`)); m.remove(); toast("Video added to product"); products(); }
    catch (er) { toast(er.message); pvUp.disabled = false; $("#pvProg", m).textContent = ""; }
  };
  const pvRm = $("#pvRemove", m);
  if (pvRm) pvRm.onclick = async () => { await api("/api/admin/products/" + p.id, "PATCH", { video: "" }); m.remove(); toast("Video removed from product"); products(); };
  const del = $("#pd", m);
  if (del) del.onclick = async () => { if (!confirm("Delete this product permanently?")) return; await api("/api/admin/products/" + p.id, "DELETE"); m.remove(); toast("Deleted"); products(); };
  $("#pf", m).onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const data = { title: f.title.value, description: f.description.value, price: f.price.value, cost: f.cost.value, stock: f.stock.value,
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
// Matches a CJ category path to one of the store's categories.
const AUTO_RULES = [
  ["pets", /\bpet/i], ["toys-kids", /toy|kid|baby|babies|mother|maternity|child/i], ["automotive", /auto|motor|car\b|vehicle/i],
  ["beauty-health", /beauty|health|hair|makeup|cosmetic|wig|nail|skin|personal care/i],
  ["sports-outdoors", /sport|outdoor|fitness|camping|cycling|fishing/i],
  ["electronics", /electronic|phone|computer|office|gadget|camera|audio|smart|game|gaming/i],
  ["fashion", /cloth|apparel|fashion|bag|shoe|jewel|watch|dress|wear|luggage/i],
  ["home-kitchen", /home|garden|furniture|kitchen|household|appliance|improvement|tool|light|decor|bed/i],
];
// Best store category for a CJ item: product name first, CJ category second. "" = not sure (left uncategorised).
const autoCategory = (path, title = "") => {
  const r = classify({ title, category: path }, collections.map((c) => c.id));
  if (r) return r.id;
  for (const [id, re] of AUTO_RULES) if (re.test(path || "") && collections.some((c) => c.id === id)) return id;
  return "";
};
let cjTree = null;
const cjState = { lv1: "", lv2: "", lv3: "", preset: "", q: "", us: false, sort: "popular", page: 1, target: "auto", markup: 2.5, publish: false, selected: new Map(), results: null };

function cjCatIds() {
  const st = cjState, l3 = (n) => (n?.children || []).map((c) => c.id);
  if (st.lv3) return [st.lv3];
  if (st.preset) return cjTree.filter((a) => autoCategory(a.name) === st.preset).flatMap((a) => a.children.flatMap(l3)).slice(0, 60);
  const a = cjTree.find((x) => String(x.id) === st.lv1);
  if (!a) return [];
  const b = a.children.find((x) => String(x.id) === st.lv2);
  return (b ? l3(b) : a.children.flatMap(l3)).slice(0, 60);
}

async function importCj() {
  main().innerHTML = `<h1>Import from CJ Dropshipping</h1><div class="panel"><p class="muted" style="margin:0">Loading CJ categories…</p></div>`;
  try { cjTree ||= await api("/api/admin/cj/categories"); }
  catch (e) { main().innerHTML = `<h1>Import from CJ Dropshipping</h1><div class="panel alert">${esc(e.message)}</div>`; return; }
  const st = cjState, opts = (list, sel, all) => `<option value="">${all}</option>` + list.map((x) => `<option value="${esc(x.id)}" ${String(x.id) === sel ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  const a = cjTree.find((x) => String(x.id) === st.lv1), b = a?.children.find((x) => String(x.id) === st.lv2);
  main().innerHTML = `<h1>Import from CJ Dropshipping</h1>
    <div class="panel"><b>Quick browse</b><span class="muted" style="font-size:13px"> — best-selling CJ products for each of your categories, no typing needed</span>
      <div class="chips" style="margin-top:12px">${collections.map((c) => `<button class="chip ${st.preset === c.id ? "on" : ""}" data-preset="${c.id}">${esc(c.name)}</button>`).join("")}</div></div>
    <form class="panel" id="cjf"><div class="flex" style="flex-wrap:wrap;gap:10px">
        <select class="inp" name="lv1" style="flex:1;min-width:180px">${opts(cjTree, st.lv1, "All CJ categories")}</select>
        <select class="inp" name="lv2" style="flex:1;min-width:180px" ${a ? "" : "disabled"}>${opts(a?.children || [], st.lv2, "All subcategories")}</select>
        <select class="inp" name="lv3" style="flex:1;min-width:180px" ${b ? "" : "disabled"}>${opts(b?.children || [], st.lv3, "All types")}</select></div>
      <div class="flex" style="flex-wrap:wrap;gap:10px;margin-top:10px">
        <input class="inp" name="q" value="${esc(st.q)}" placeholder="Keyword (optional), e.g. bedsheet" style="flex:2;min-width:200px">
        <select class="inp" name="sort" style="width:auto">${[["popular", "Most popular"], ["new", "Newest"], ["price-asc", "Price: low → high"], ["price-desc", "Price: high → low"], ["match", "Best match"]].map(([v, t]) => `<option value="${v}" ${st.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select>
        <label class="flex" style="font-size:14px;gap:6px;color:var(--ink-2)"><input type="checkbox" name="us" ${st.us ? "checked" : ""}> US warehouse only</label>
        <button class="btn">Search</button></div></form>
    <div class="panel flex" style="flex-wrap:wrap;gap:12px">
      <label class="flex" style="font-size:14px;gap:8px">Import into
        <select class="inp" id="cjTarget" style="width:auto"><option value="auto">Auto-match category</option>${collections.map((c) => `<option value="${c.id}" ${st.target === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
      <label class="flex" style="font-size:14px;gap:8px">Markup
        <select class="inp" id="cjMarkup" style="width:auto">${[2, 2.5, 3, 3.5].map((x) => `<option value="${x}" ${st.markup === x ? "selected" : ""}>${x}× cost</option>`).join("")}</select></label>
      <label class="flex" style="font-size:14px;gap:6px;color:var(--ink-2)"><input type="checkbox" id="cjPublish" ${st.publish ? "checked" : ""}> Publish straight to the store (otherwise saved as drafts)</label></div>
    <div id="res"></div>
    <div id="bulkbar" class="panel" style="position:sticky;bottom:12px;z-index:5;display:none;margin-top:16px;box-shadow:var(--glow)"></div>`;

  const f = $("#cjf");
  main().querySelectorAll("[data-preset]").forEach((btn) => (btn.onclick = () => {
    Object.assign(st, { preset: st.preset === btn.dataset.preset ? "" : btn.dataset.preset, lv1: "", lv2: "", lv3: "", q: "", page: 1 });
    st.target = st.preset || "auto";
    importCj().then(() => st.preset && cjRun());
  }));
  f.lv1.onchange = () => { Object.assign(st, { lv1: f.lv1.value, lv2: "", lv3: "", preset: "", target: "auto" }); importCj(); };
  f.lv2.onchange = () => { Object.assign(st, { lv2: f.lv2.value, lv3: "" }); importCj(); };
  f.lv3.onchange = () => { st.lv3 = f.lv3.value; };
  f.onsubmit = (e) => { e.preventDefault(); Object.assign(st, { q: f.q.value.trim(), sort: f.sort.value, us: f.us.checked, lv3: f.lv3.value, page: 1 }); if (st.lv1 || st.q) st.preset = st.lv1 ? "" : st.preset; cjRun(); };
  $("#cjTarget").onchange = (e) => { st.target = e.target.value; renderResults(); };
  $("#cjMarkup").onchange = (e) => { st.markup = Number(e.target.value); renderResults(); };
  $("#cjPublish").onchange = (e) => { st.publish = e.target.checked; };
  if (st.results) renderResults();
  renderBulk();
}

async function cjRun() {
  const st = cjState, res = $("#res");
  const cats = cjCatIds();
  if (!st.q && !cats.length) { res.innerHTML = `<p class="muted">Pick a category or type a keyword.</p>`; return; }
  res.innerHTML = `<p class="muted">Loading CJ products…</p>`;
  try {
    const qs = new URLSearchParams({ q: st.q, page: st.page, sort: st.sort, us: st.us ? "1" : "", cats: cats.join(",") });
    st.results = await api("/api/admin/cj/search?" + qs);
    renderResults();
  } catch (e) { res.innerHTML = `<p style="color:var(--bad)">${esc(e.message)}</p>`; }
}

function renderResults() {
  const st = cjState, r = st.results, res = $("#res");
  if (!r || !res) return;
  if (!r.items.length) { res.innerHTML = `<p class="muted">No products found. Try another category or turn off “US warehouse only”.</p>`; return; }
  const target = (i) => (st.target === "auto" ? autoCategory(i.category, i.title) : st.target);
  const cname = (id) => collections.find((c) => c.id === id)?.name || "No category (sort later)";
  const fresh = r.items.filter((i) => !i.imported);
  res.innerHTML = `<div class="row-between" style="margin:6px 0 12px;flex-wrap:wrap;gap:10px">
      <span class="muted">${r.total.toLocaleString()} products · page ${r.page} of ${r.totalPages}</span>
      <div class="flex"><button class="btn sm ghost" id="selAll">${fresh.length && fresh.every((i) => st.selected.has(i.pid)) ? "Unselect page" : "Select all on page"}</button>
        <button class="btn sm ghost" id="prev" ${r.page <= 1 ? "disabled" : ""}>← Prev</button><button class="btn sm ghost" id="next" ${r.page >= r.totalPages ? "disabled" : ""}>Next →</button></div></div>
    <div class="cj-grid">${r.items.map((i) => {
      const on = st.selected.has(i.pid);
      return `<div class="cj-card ${on ? "sel" : ""}" ${i.imported ? "" : `data-pick="${esc(i.pid)}"`} style="position:relative;cursor:${i.imported ? "default" : "pointer"};${on ? "border-color:var(--blue);box-shadow:var(--glow)" : ""}">
        <span style="position:absolute;top:10px;left:10px;z-index:2;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-weight:700;font-size:14px;
          ${i.imported ? "background:rgba(61,220,151,.9);color:#04140c" : on ? "background:var(--blue);color:#fff" : "background:rgba(10,16,34,.75);border:1px solid var(--line-2)"}">${i.imported || on ? "✓" : ""}</span>
        ${i.usStock ? `<span class="st processing" style="position:absolute;top:10px;right:10px;z-index:2">US stock</span>` : ""}
        <img src="${esc(i.image)}" alt="" loading="lazy"><div class="b"><b>${esc(i.title)}</b>
        <span class="muted" style="font-size:12px">${esc(i.category)}</span>
        <span>Cost ${money(i.cost)} → sell ≈ <b>${money(Math.max(0.99, Math.ceil(i.cost * st.markup) - 0.01))}</b></span>
        <span class="muted" style="font-size:12px">${i.listed ? i.listed.toLocaleString() + " stores selling · " : ""}${i.imported ? "Already in your store" : "→ " + esc(cname(target(i)))}</span></div></div>`;
    }).join("")}</div>`;
  res.querySelectorAll("[data-pick]").forEach((el) => (el.onclick = () => {
    const i = r.items.find((x) => x.pid === el.dataset.pick);
    st.selected.has(i.pid) ? st.selected.delete(i.pid) : st.selected.set(i.pid, i);
    renderResults(); renderBulk();
  }));
  $("#selAll").onclick = () => {
    const all = fresh.every((i) => st.selected.has(i.pid));
    for (const i of fresh) all ? st.selected.delete(i.pid) : st.selected.set(i.pid, i);
    renderResults(); renderBulk();
  };
  $("#prev").onclick = () => { st.page--; cjRun(); window.scrollTo(0, 0); };
  $("#next").onclick = () => { st.page++; cjRun(); window.scrollTo(0, 0); };
}

function renderBulk(progress) {
  const st = cjState, bar = $("#bulkbar");
  if (!bar) return;
  const n = st.selected.size;
  bar.style.display = n || progress ? "flex" : "none";
  bar.className = "panel row-between";
  if (progress) { bar.innerHTML = `<div style="flex:1"><b>${progress.text}</b><div class="bar" style="margin-top:8px"><i style="width:${progress.pct}%"></i></div></div>`; return; }
  bar.innerHTML = `<span><b>${n} selected</b> <span class="muted">· ${st.publish ? "will go live right away" : "saved as drafts"}</span></span>
    <div class="flex"><button class="btn sm ghost" id="clearSel">Clear</button><button class="btn sm accent" id="doImport">Import ${n} product${n === 1 ? "" : "s"}</button></div>`;
  $("#clearSel").onclick = () => { st.selected.clear(); renderResults(); renderBulk(); };
  $("#doImport").onclick = bulkImport;
}

async function bulkImport() {
  const st = cjState, items = [...st.selected.values()];
  let ok = 0, skip = 0, fail = [];
  for (const [k, i] of items.entries()) {
    renderBulk({ text: `Importing ${k + 1} of ${items.length}: ${i.title.slice(0, 60)}…`, pct: (k / items.length) * 100 });
    try {
      const r = await api("/api/admin/cj/import", "POST", { pid: i.pid, markup: st.markup, publish: st.publish, collection: st.target === "auto" ? autoCategory(i.category, i.title) || "auto" : st.target, cjCategory: i.category });
      r.alreadyImported ? skip++ : ok++;
      i.imported = r.id; st.selected.delete(i.pid);
    } catch (e) { fail.push(i.title.slice(0, 40) + ": " + e.message); }
  }
  renderBulk(); renderResults();
  toast(`Imported ${ok}${skip ? `, ${skip} already in store` : ""}${fail.length ? `, ${fail.length} failed` : ""}`);
  if (fail.length) $("#res").insertAdjacentHTML("afterbegin", `<div class="panel alert" style="font-size:13px">${fail.map(esc).join("<br>")}</div>`);
}

/* ---------- Discounts ---------- */
async function discounts() {
  const list = await api("/api/admin/discounts");
  main().innerHTML = `<h1>Vouchers</h1><p class="muted" style="margin-top:-8px">Codes customers enter at checkout. Tick <b>Show on store</b> to display a voucher as a “Claim” coupon on the homepage, category pages and product pages — claimed vouchers apply automatically at checkout.</p>
    <form class="panel flex" id="df" style="flex-wrap:wrap;gap:10px"><input class="inp" name="code" placeholder="CODE e.g. SAVE10" style="max-width:180px;text-transform:uppercase" required>
    <input class="inp" name="percent" type="number" min="1" max="90" placeholder="% off" style="max-width:100px" required>
    <input class="inp" name="minSpend" type="number" min="0" step="0.01" placeholder="Min. spend $ (optional)" style="max-width:190px">
    <label class="flex" style="gap:6px;font-size:14px;color:var(--ink-2)"><input type="checkbox" name="show" checked> Show on store</label><button class="btn accent">Save voucher</button></form>
    <div class="panel tbl-wrap" style="padding:6px 10px"><table><tr><th>Code</th><th>Discount</th><th>Min. spend</th><th>Used</th><th>On store</th><th>Status</th><th></th></tr>
    ${list.map((d) => `<tr><td><b>${esc(d.code)}</b></td><td>${d.percent}% off</td><td>${d.min_spend ? money(d.min_spend) : "—"}</td><td>${d.uses}</td>
      <td><button class="st ${d.show ? "delivered" : ""}" data-show="${esc(d.code)}" data-v="${d.show ? 0 : 1}" style="cursor:pointer">${d.show ? "Shown" : "Hidden"}</button></td>
      <td>${d.active ? "Active" : "Disabled"}</td><td><button class="btn sm ghost" data-d="${esc(d.code)}" data-a="${d.active ? 0 : 1}">${d.active ? "Disable" : "Enable"}</button></td></tr>`).join("")}</table></div>`;
  $("#df").onsubmit = async (e) => { e.preventDefault(); const f = e.target;
    try { await api("/api/admin/discounts", "POST", { code: f.code.value, percent: f.percent.value, minSpend: f.minSpend.value, show: f.show.checked }); toast("Voucher saved"); discounts(); } catch (er) { toast(er.message); } };
  main().querySelectorAll("[data-d]").forEach((b) => (b.onclick = async () => { await api("/api/admin/discounts/" + b.dataset.d, "PATCH", { active: b.dataset.a === "1" }); discounts(); }));
  main().querySelectorAll("[data-show]").forEach((b) => (b.onclick = async () => { await api("/api/admin/discounts/" + b.dataset.show, "PATCH", { show: b.dataset.v === "1" }); discounts(); }));
}

/* ---------- Promotions (flash sales) ---------- */
const localInput = (d) => { const x = new Date(d - new Date().getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); };
// Shared "when does it run" fields: one-time (start/end) or weekly (days + hours + time zone)
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TZS = [["America/New_York", "US Eastern (ET)"], ["America/Chicago", "US Central (CT)"], ["America/Denver", "US Mountain (MT)"], ["America/Los_Angeles", "US Pacific (PT)"], ["Asia/Manila", "Philippines"], ["UTC", "UTC"]];
const hourOpts = (sel, isEnd) => [...Array(24).keys()].map((h) => h + (isEnd ? 1 : 0)).map((h) => `<option value="${h}" ${h === sel ? "selected" : ""}>${h === 0 || h === 24 ? "12 am" + (h === 24 ? " (midnight)" : "") : h === 12 ? "12 pm" : h < 12 ? h + " am" : h - 12 + " pm"}</option>`).join("");
function whenFields(defaults = {}) {
  return `<label class="full">When<div class="chips" style="margin-top:2px"><label class="chip on" data-mode="once"><input type="radio" name="mode" value="once" checked hidden> One-time sale</label>
      <label class="chip" data-mode="weekly"><input type="radio" name="mode" value="weekly" hidden> Repeat weekly</label></div></label>
    <div class="full form-grid" data-when="once">
      <label>Quick length<select class="inp" name="plen"><option value="">Custom</option><option value="3">3 hours</option><option value="24" selected>24 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label><span></span>
      <label>Starts<input class="inp" type="datetime-local" name="startsAt" value="${localInput(Date.now())}"></label>
      <label>Ends<input class="inp" type="datetime-local" name="endsAt" value="${localInput(Date.now() + 864e5)}"></label></div>
    <div class="full form-grid" data-when="weekly" hidden>
      <label class="full">Days<div class="chips" style="margin-top:2px">${DAYS.map((d, i) => `<label class="chip ${i === (defaults.day ?? 5) ? "on" : ""}"><input type="checkbox" name="days" value="${i}" ${i === (defaults.day ?? 5) ? "checked" : ""} hidden>${d}</label>`).join("")}</div></label>
      <label>From<select class="inp" name="startHour">${hourOpts(0)}</select></label>
      <label>Until<select class="inp" name="endHour">${hourOpts(24, true)}</select></label>
      <label>Time zone<select class="inp" name="tz">${TZS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
      <label>Stop repeating on (optional)<input class="inp" type="date" name="until"></label></div>`;
}
function bindWhen(form) {
  const setMode = (mode) => {
    form.querySelectorAll("[data-mode]").forEach((c) => c.classList.toggle("on", c.dataset.mode === mode));
    form.querySelectorAll("[data-when]").forEach((b) => (b.hidden = b.dataset.when !== mode));
  };
  form.querySelectorAll("[data-mode]").forEach((c) => (c.onclick = () => { c.querySelector("input").checked = true; setMode(c.dataset.mode); }));
  form.querySelectorAll('input[name="days"]').forEach((cb) => cb.parentElement.addEventListener("click", (e) => { e.preventDefault(); cb.checked = !cb.checked; cb.parentElement.classList.toggle("on", cb.checked); }));
  form.plen.onchange = (e) => { if (!e.target.value) return; const s0 = new Date(form.startsAt.value || Date.now()); form.endsAt.value = localInput(s0.getTime() + Number(e.target.value) * 36e5); };
}
function readWhen(form) {
  if (form.mode.value === "weekly") {
    return { recur: true, days: [...form.querySelectorAll('input[name="days"]:checked')].map((x) => Number(x.value)), startHour: Number(form.startHour.value), endHour: Number(form.endHour.value),
      tz: form.tz.value, endsAt: form.until.value ? new Date(form.until.value + "T23:59:59").toISOString() : null };
  }
  return { startsAt: new Date(form.startsAt.value).toISOString(), endsAt: new Date(form.endsAt.value).toISOString() };
}

async function promos() {
  const [list, prods] = await Promise.all([api("/api/admin/promos"), api("/api/admin/products")]);
  const picked = new Set();
  const scopeText = (p) => p.scope === "all" ? "Whole store" : p.scope === "collection" ? (collections.find((c) => c.id === p.target)?.name || p.target) : (() => { const ids = JSON.parse(p.target || "[]"); const names = ids.map((id) => prods.find((x) => x.id === id)?.title).filter(Boolean);
      return ids.length <= 2 && names.length ? names.map((n) => n.slice(0, 40)).join(", ") : `${ids.length} selected products`; })();
  const when = (t) => new Date(t.replace(" ", "T") + "Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const runs = (p) => p.recur ? `<b style="color:#fff">${esc(p.schedule)}</b>${p.ends_at.startsWith("2099") ? "" : `<br><span class="muted">until ${when(p.ends_at)}</span>`}` : `${when(p.starts_at)} → ${when(p.ends_at)}`;
  const stateTag = { live: '<span class="st delivered">Live now</span>', waiting: '<span class="st processing">Repeats weekly</span>', scheduled: '<span class="st processing">Scheduled</span>', ended: '<span class="st">Ended</span>' };
  main().innerHTML = `<h1>Promotions</h1><p class="muted" style="margin-top:-8px">Real sales with real end times. Prices drop automatically while a promotion runs — on product cards, product pages, checkout, PayPal and Google — and go back afterwards. Only products in a running promotion show a crossed-out price.</p>
    <form class="panel" id="pf"><div class="form-grid">
      <label>Name shown to shoppers<input class="inp" name="label" placeholder="e.g. Flash Sale, Friday Tech Deal, Weekend Sale" maxlength="60" required></label>
      <label>Discount (%)<input class="inp" name="percent" type="number" min="1" max="90" value="10" required></label>
      <label class="full">Applies to<select class="inp" name="scope"><option value="all">Whole store</option><option value="products">Specific products…</option>${collections.map((c) => `<option value="c:${c.id}">Category: ${esc(c.name)}</option>`).join("")}</select></label>
      <div class="full" id="ppick" hidden><div class="row-between"><b style="font-size:13px;color:var(--ink-2)">Choose products <span id="pcount" style="color:var(--blue-2)">(0 selected)</span></b><button type="button" class="btn sm ghost" id="pclear">Clear</button></div>
        <input class="inp" id="pq" placeholder="Search by product name…" style="margin:6px 0">
        <div id="plist" style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px"></div></div>
      ${whenFields()}
      <div class="full flex"><button class="btn accent">Save promotion</button><span class="muted" style="font-size:13px">You can also tick products in Products → “⚡ Sale…”, or use “⚡ Put on sale” when editing a product.</span></div></div></form>
    <div class="panel tbl-wrap" style="padding:6px 10px">${list.length ? `<table><tr><th>Promotion</th><th>Discount</th><th>Applies to</th><th>Runs</th><th>Status</th><th></th></tr>
      ${list.map((p) => `<tr><td><b>${esc(p.label)}</b></td><td>${p.percent}% off</td><td>${esc(scopeText(p))}</td><td style="font-size:13px">${runs(p)}</td>
        <td>${stateTag[p.state] || ""}</td>
        <td class="flex" style="gap:6px">${p.state !== "ended" ? `<button class="btn sm ghost" data-pend="${p.id}">End</button>` : ""}<button class="btn sm ghost" data-pdel="${p.id}">Delete</button></td></tr>`).join("")}</table>`
      : `<p class="muted" style="padding:12px">No promotions yet. Example: name “Tech Friday”, 10%, Category: Electronics, Repeat weekly → Fri.</p>`}</div>`;
  const f = $("#pf");
  bindWhen(f);
  const renderPick = () => {
    const q = $("#pq").value.toLowerCase();
    const rows = prods.filter((x) => x.active && (!q || x.title.toLowerCase().includes(q))).sort((a, b) => picked.has(b.id) - picked.has(a.id)).slice(0, 80);
    $("#plist").innerHTML = rows.map((x) => `<label class="flex" style="padding:6px;gap:10px;cursor:pointer"><input type="checkbox" data-pp="${x.id}" ${picked.has(x.id) ? "checked" : ""}>${thumb(x)}<span>${esc(x.title.slice(0, 80))}</span><span class="muted" style="margin-left:auto;white-space:nowrap">${money(x.price)}</span></label>`).join("") || `<p class="muted" style="padding:8px">No matching products</p>`;
    $("#plist").querySelectorAll("[data-pp]").forEach((c) => (c.onchange = () => { c.checked ? picked.add(c.dataset.pp) : picked.delete(c.dataset.pp); $("#pcount").textContent = `(${picked.size} selected)`; }));
    $("#pcount").textContent = `(${picked.size} selected)`;
  };
  f.scope.onchange = () => { $("#ppick").hidden = f.scope.value !== "products"; if (!$("#ppick").hidden) { renderPick(); $("#pq").focus(); } };
  $("#pq").oninput = renderPick;
  $("#pclear").onclick = () => { picked.clear(); renderPick(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const sc = f.scope.value;
    if (sc === "products" && !picked.size) return toast("Choose at least one product");
    try {
      await api("/api/admin/promos", "POST", { label: f.label.value, percent: f.percent.value, scope: sc === "all" ? "all" : sc === "products" ? "products" : "collection",
        target: sc === "products" ? [...picked] : sc.startsWith("c:") ? sc.slice(2) : null, ...readWhen(f) });
      toast("Promotion saved"); promos();
    } catch (er) { toast(er.message); }
  };
  main().querySelectorAll("[data-pend]").forEach((b) => (b.onclick = async () => { if (!confirm("End this promotion now? Weekly promotions stop repeating.")) return; await api("/api/admin/promos/" + b.dataset.pend, "PATCH"); toast("Promotion ended"); promos(); }));
  main().querySelectorAll("[data-pdel]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this promotion?")) return; await api("/api/admin/promos/" + b.dataset.pdel, "DELETE"); promos(); }));
}

/* ---------- Video upload helper (chunked → R2) ---------- */
async function uploadVideo(file, meta, onProgress) {
  if (file.size > 1024 * 1024 * 1024) throw new Error("Please keep videos under 1 GB");
  const CH = 25 * 1024 * 1024;
  const st = await api("/api/admin/media/start", "POST", { name: file.name, type: file.type });
  const n = Math.max(1, Math.ceil(file.size / CH)), parts = [];
  for (let i = 0; i < n; i++) {
    const r = await fetch(`/api/admin/media/part?key=${encodeURIComponent(st.key)}&uploadId=${encodeURIComponent(st.uploadId)}&n=${i + 1}`, { method: "PUT", body: file.slice(i * CH, (i + 1) * CH) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Upload failed");
    parts.push(j); onProgress?.((i + 1) / n);
  }
  return api("/api/admin/media/complete", "POST", { key: st.key, uploadId: st.uploadId, parts, ...meta });
}
const fmtSize = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : (b / 1e6).toFixed(1) + " MB");

/* ---------- Live & Video ---------- */
let liveTimer = null;
async function liveAdmin() {
  clearInterval(liveTimer);
  const [lv, media, prods] = await Promise.all([api("/api/admin/live"), api("/api/admin/media"), api("/api/admin/products")]);
  const live = { status: "off", pinned: [], ...lv };
  const pinned = new Set(live.pinned || []);
  const liveVids = media.items;
  const setupMsg = media.ready ? "" : `<div class="panel warn">Video uploads need Cloudflare R2. Create the bucket <b>leeyspremium-media</b> (Storage & Databases → R2 → Create bucket) and let Claude know to connect it. Live streaming via YouTube/Facebook links works already.</div>`;
  main().innerHTML = `<h1>Live & Video</h1>${setupMsg}
    <form class="panel" id="lf"><div class="row-between"><b style="font-size:16px">🔴 Premium Live</b><a class="btn sm ghost" href="/live" target="_blank">Open live page ↗</a></div>
      <p class="muted" style="font-size:13px;margin:6px 0 14px">How to go live: start a live on <b>YouTube</b> or <b>Facebook</b> from your phone (or OBS), paste its link here and choose <b>Live now</b>. Shoppers watch on your site, see the products you pin, and chat with you. Uploaded videos can be shown as a <b>Replay</b> — they're labelled Replay, never LIVE, so shoppers aren't misled.</p>
      <div class="form-grid">
        <label class="full">Status<div class="chips">${[["off", "Off"], ["scheduled", "📅 Scheduled"], ["live", "🔴 Live now"], ["replay", "▶ Replay"]].map(([v, t]) => `<label class="chip ${live.status === v ? "on" : ""}" data-ls="${v}"><input type="radio" name="status" value="${v}" ${live.status === v ? "checked" : ""} hidden>${t}</label>`).join("")}</div></label>
        <label class="full">Title<input class="inp" name="title" value="${esc(live.title || "")}" placeholder="e.g. Friday Tech Deals — live demos & Q&A" maxlength="120"></label>
        <label class="full">YouTube Live / Facebook Live link<input class="inp" name="url" value="${esc(live.url || "")}" placeholder="https://www.youtube.com/live/… or https://www.facebook.com/…/videos/…"></label>
        <label>Starts at (for Scheduled)<input class="inp" type="datetime-local" name="startsAt" value="${live.startsAt ? localInput(new Date(live.startsAt).getTime()) : ""}"></label>
        <label>Replay video (uploaded)<select class="inp" name="mediaId"><option value="">— none —</option>${liveVids.map((v) => `<option value="${v.id}" ${Number(live.mediaId) === v.id ? "selected" : ""}>${esc(v.title || v.key.split("/").pop())}</option>`).join("")}</select></label>
        <label class="full">Note under the video (optional)<input class="inp" name="note" value="${esc(live.note || "")}" placeholder="e.g. Live-only: 15% off everything shown — ends when the live ends" maxlength="200"></label>
        <div class="full"><b style="font-size:13px;color:var(--ink-2)">Featured products (${pinned.size})</b><input class="inp" id="pinq" placeholder="Search products to feature…" style="margin:6px 0">
          <div id="pinlist" style="max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:6px"></div></div>
        <div class="full flex" style="flex-wrap:wrap;gap:10px"><button class="btn accent">Save live settings</button>
          <button type="button" class="btn ghost" id="liveDeal">⚡ Live deal on featured products…</button></div></div></form>
    <div class="panel"><div class="row-between"><b style="font-size:16px">💬 Live chat</b><button class="btn sm ghost" id="lcClear">Clear chat</button></div>
      <form id="hostf" class="flex" style="margin:12px 0;gap:8px"><input class="inp" name="body" placeholder="Reply as LeeysPremium (shown with a ✓)…" maxlength="300"><button class="btn sm accent">Send</button></form>
      <div id="lcAdmin" style="max-height:320px;overflow:auto"></div></div>
    <div class="panel"><b style="font-size:16px">▶ Videos</b><p class="muted" style="font-size:13px;margin:6px 0 12px">Upload a product video (shows on the product page, on product cards as “▶ Video”, and in the Premium Video feed) or a live replay. MP4 works best; up to 1 GB.</p>
      <form id="vf" class="form-grid"><label>Video file<input class="inp" type="file" name="file" accept="video/mp4,video/quicktime,video/webm" required ${media.ready ? "" : "disabled"}></label>
        <label>Use as<select class="inp" name="target"><option value="">Live replay</option>${prods.filter((x) => x.active).map((x) => `<option value="${x.id}">Product: ${esc(x.title.slice(0, 60))}</option>`).join("")}</select></label>
        <label class="full">Title (optional)<input class="inp" name="title" maxlength="120"></label>
        <div class="full flex"><button class="btn accent" ${media.ready ? "" : "disabled"}>Upload</button><span id="vprog" class="muted"></span></div></form>
      <div class="tbl-wrap" style="margin-top:12px">${media.items.length ? `<table><tr><th>Video</th><th>Used for</th><th>Size</th><th>Added</th><th></th></tr>${media.items.map((v) => `<tr><td><a href="${esc(v.url)}" target="_blank" style="color:var(--blue-2)">${esc(v.title || v.key.split("/").pop())}</a></td>
        <td>${v.product_id ? esc(v.product_title || v.product_id) : "Live replay"}</td><td>${fmtSize(v.size || 0)}</td><td>${date(v.created_at)}</td><td><button class="btn sm ghost" data-vdel="${v.id}">Delete</button></td></tr>`).join("")}</table>` : `<p class="muted">No videos yet.</p>`}</div></div>`;

  const f = $("#lf");
  f.querySelectorAll("[data-ls]").forEach((c) => (c.onclick = () => { c.querySelector("input").checked = true; f.querySelectorAll("[data-ls]").forEach((x) => x.classList.toggle("on", x === c)); }));
  const renderPins = () => {
    const q = $("#pinq").value.toLowerCase();
    const rows = prods.filter((x) => x.active && (!q || x.title.toLowerCase().includes(q))).sort((a, b) => pinned.has(b.id) - pinned.has(a.id)).slice(0, 60);
    $("#pinlist").innerHTML = rows.map((x) => `<label class="flex" style="padding:6px;gap:10px;cursor:pointer"><input type="checkbox" data-pin="${x.id}" ${pinned.has(x.id) ? "checked" : ""}>${thumb(x)}<span>${esc(x.title.slice(0, 70))}</span><span class="muted" style="margin-left:auto">${money(x.price)}</span></label>`).join("") || `<p class="muted">No matches</p>`;
    $("#pinlist").querySelectorAll("[data-pin]").forEach((c) => (c.onchange = () => { c.checked ? pinned.add(c.dataset.pin) : pinned.delete(c.dataset.pin); }));
  };
  $("#pinq").oninput = renderPins; renderPins();
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/live", "PUT", { status: f.status.value, title: f.title.value, url: f.url.value, mediaId: f.mediaId.value || null, note: f.note.value,
        startsAt: f.startsAt.value ? new Date(f.startsAt.value).toISOString() : null, pinned: [...pinned] });
      toast(f.status.value === "live" ? "🔴 You're live on the store" : "Live settings saved"); liveAdmin();
    } catch (er) { toast(er.message); }
  };
  $("#liveDeal").onclick = async () => {
    if (!pinned.size) return toast("Feature some products first");
    const pct = prompt("Live-only discount on the featured products (%)", "15"); if (!pct) return;
    const hrs = prompt("How many hours should the deal last?", "2"); if (!hrs) return;
    try { await api("/api/admin/promos", "POST", { label: "Live deal", percent: pct, scope: "products", target: [...pinned], endsAt: new Date(Date.now() + Number(hrs) * 36e5).toISOString() }); toast("Live deal is on — prices updated with a countdown"); }
    catch (er) { toast(er.message); }
  };
  const loadChat = async () => {
    if (tab !== "live" || !$("#lcAdmin")) return clearInterval(liveTimer);
    const cs = await api("/api/admin/live/comments").catch(() => []);
    $("#lcAdmin").innerHTML = cs.length ? cs.map((c) => `<div class="row-between" style="padding:6px 0;border-bottom:1px solid var(--line);gap:10px;${c.hidden ? "opacity:.4" : ""}"><span><b style="color:${c.is_host ? "#fff" : "#8fc8ff"}">${esc(c.name)}${c.is_host ? " ✓" : ""}</b> ${esc(c.body)}</span>
      <span class="flex" style="gap:6px;flex:none"><span class="muted" style="font-size:12px">${date(c.created_at)}</span>${c.hidden ? "<span class='muted' style='font-size:12px'>hidden</span>" : `<button class="btn sm ghost" data-hide="${c.id}">Hide</button>`}</span></div>`).join("") : `<p class="muted">No comments yet.</p>`;
    $("#lcAdmin").querySelectorAll("[data-hide]").forEach((b) => (b.onclick = async () => { await api("/api/admin/live/comments/" + b.dataset.hide, "DELETE"); loadChat(); }));
  };
  loadChat(); liveTimer = setInterval(loadChat, 5000);
  $("#hostf").onsubmit = async (e) => { e.preventDefault(); const t = e.target.body.value.trim(); if (!t) return; try { await api("/api/admin/live/comment", "POST", { body: t }); e.target.body.value = ""; loadChat(); } catch (er) { toast(er.message); } };
  $("#lcClear").onclick = async () => { if (!confirm("Delete all live chat messages?")) return; await api("/api/admin/live/clear", "POST"); loadChat(); };
  $("#vf").onsubmit = async (e) => {
    e.preventDefault(); const fm = e.target, file = fm.file.files[0]; if (!file) return;
    const btn = fm.querySelector("button"); btn.disabled = true;
    try {
      await uploadVideo(file, { productId: fm.target.value || null, kind: fm.target.value ? "product" : "live", title: fm.title.value || file.name.replace(/\.[^.]+$/, "") }, (x) => ($("#vprog").textContent = `Uploading… ${Math.round(x * 100)}%`));
      toast("Video uploaded"); liveAdmin();
    } catch (er) { toast(er.message); btn.disabled = false; $("#vprog").textContent = ""; }
  };
  main().querySelectorAll("[data-vdel]").forEach((b) => (b.onclick = async () => { if (!confirm("Delete this video permanently?")) return; await api("/api/admin/media/" + b.dataset.vdel, "DELETE"); toast("Video deleted"); liveAdmin(); }));
}

/* ---------- Subscribers ---------- */
async function subscribers() {
  const list = await api("/api/admin/subscribers");
  main().innerHTML = `<div class="row-between"><h1>Subscribers (${list.length})</h1>${list.length ? `<button class="btn sm" id="csv">Download CSV</button>` : ""}</div>
    <div class="panel">${list.length ? list.map((s) => `<div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(s.email)}</span><span class="muted">${date(s.created_at)}</span></div>`).join("") : `<p class="muted">No subscribers yet.</p>`}</div>`;
  const c = $("#csv");
  if (c) c.onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["email,date\n" + list.map((s) => `${s.email},${s.created_at}`).join("\n")], { type: "text/csv" })); a.download = "leeyspremium-subscribers.csv"; a.click(); };
}

/* ---------- Setup ---------- */
async function setup() {
  const [s, prods] = await Promise.all([api("/api/admin/stats"), api("/api/admin/products")]);
  const row = (ok, t, d) => `<div><span class="dot ${ok ? "ok" : ""}"></span><div><b>${t}</b><div class="muted" style="font-size:13px">${d}</div></div></div>`;
  main().innerHTML = `<h1>Setup</h1><div class="panel check">
    ${row(true, "Database", "Connected and ready.")}
    ${row(s.config.paypal, "PayPal payments", s.config.paypal ? `Connected (${s.config.paypalEnv === "live" ? "LIVE — real payments" : "sandbox — test payments only"}).` : "Add PAYPAL_CLIENT_ID (in wrangler.jsonc) and the PAYPAL_SECRET secret in Cloudflare → Worker → Settings → Variables and Secrets.")}
    ${row(s.config.cj, "CJ Dropshipping", s.config.cj ? "API key set. Orders are sent to CJ automatically (unpaid — pay them in your CJ dashboard)." : "Add the CJ_API_KEY secret in Cloudflare → Worker → Settings → Variables and Secrets.")}
    </div><div class="panel"><b>Categories</b><form id="cf" class="flex" style="margin-top:10px;flex-wrap:wrap"><input class="inp" name="name" placeholder="Name, e.g. Gaming" style="max-width:240px" required><input class="inp" name="blurb" placeholder="Short description" style="max-width:320px"><button class="btn sm">Add</button></form>
    <div class="chips" style="margin-top:14px">${collections.map((c) => `<span class="chip">${esc(c.name)} <button data-rmc="${c.id}" title="Remove" style="border:0;background:none;color:var(--bad);font-weight:700;padding:0 0 0 4px">×</button></span>`).join("")}</div>
    <p class="muted" style="margin-bottom:0;font-size:13px">The first 5 categories show in the top menu; all of them show on the homepage, mobile menu and footer. Removing a category keeps its products (they just become uncategorised).</p></div>`;
  // Search engines
  let seo = null; try { seo = await api("/api/admin/seo"); } catch {}
  if (seo) {
    const last = seo.last ? `Last sent ${new Date(seo.last.at).toLocaleString()} — ${seo.last.count} pages, ${[200, 202].includes(seo.last.status) ? "accepted ✓" : "response " + seo.last.status}` : "Not sent yet";
    main().insertAdjacentHTML("beforeend", `<div class="panel"><b>Search engines (Google & Bing)</b>
      <p class="muted" style="margin:6px 0 14px;font-size:13px">Every product, category and policy page now has its own title, description, Google product details (price, stock, returns) and is listed in your sitemap. New or changed products are sent to Bing instantly.</p>
      <div class="check">
        <div><span class="dot ok"></span><div><b>Sitemap</b><div class="muted" style="font-size:13px"><a href="${esc(seo.sitemap)}" target="_blank" style="color:var(--blue-2)">${esc(seo.sitemap)}</a> · ${seo.liveProducts} live products</div></div></div>
        <div><span class="dot ok"></span><div><b>Bing instant indexing (IndexNow)</b><div class="muted" style="font-size:13px">${esc(last)}</div></div></div>
        <div><span class="dot ${seo.google ? "ok" : ""}"></span><div><b>Google Search Console</b><div class="muted" style="font-size:13px">${seo.google ? "Verification tag installed." : "Verify ownership with the Domain/DNS option (recommended) or add a GOOGLE_SITE_VERIFICATION secret, then submit the sitemap."}</div></div></div>
        <div><span class="dot ${seo.bing ? "ok" : ""}"></span><div><b>Bing Webmaster Tools</b><div class="muted" style="font-size:13px">${seo.bing ? "Verification tag installed." : "Easiest: “Import from Google Search Console” once Google is verified, or add a BING_SITE_VERIFICATION secret."}</div></div></div>
      </div>
      <div class="flex" style="margin-top:14px;flex-wrap:wrap;gap:10px"><button class="btn sm accent" id="seoSubmit">Send all pages to Bing now</button>
        <a class="btn sm ghost" href="https://search.google.com/search-console" target="_blank" rel="noopener">Open Google Search Console ↗</a>
        <a class="btn sm ghost" href="https://www.bing.com/webmasters" target="_blank" rel="noopener">Open Bing Webmaster Tools ↗</a></div></div>`);
    $("#seoSubmit").onclick = async (e) => { e.target.disabled = true; try { const r = await api("/api/admin/seo/submit", "POST"); toast(r.ok ? `Sent ${r.count} pages to Bing` : r.skipped ? "Only works on your live https domain" : "Bing replied " + r.status); setup(); } catch (er) { toast(er.message); e.target.disabled = false; } };
  }

  // Homepage showcase slides
  let cfg = {}; try { cfg = await (await fetch("/api/config")).json(); } catch {}
  const slides = (cfg.heroSlides || []).filter((id) => prods.some((p) => p.id === id));
  main().insertAdjacentHTML("beforeend", `<div class="panel" id="heroPanel"><b>Homepage showcase</b>
    <p class="muted" style="margin:6px 0 14px;font-size:13px">The rotating cards at the top of the homepage — the front card grows big. ${slides.length ? "Showing your picks in this order:" : "Currently <b>automatic</b>: it rotates your category images. Add products below to choose the slides yourself."}</p>
    ${slides.map((id, i) => { const p = prods.find((x) => x.id === id); return `<div class="row-between" style="padding:8px 0;border-bottom:1px solid var(--line);gap:10px">
      <div class="flex">${thumb(p)}<div><b>${i + 1}. ${esc(p.title.slice(0, 70))}</b><div class="muted" style="font-size:12px">${money(p.price)}${p.active ? "" : " · <span style='color:var(--warn)'>Draft — hidden until published</span>"}</div></div></div>
      <div class="flex" style="gap:6px"><button class="btn sm ghost" data-hmove="${i}" data-d="-1" ${i ? "" : "disabled"}>↑</button><button class="btn sm ghost" data-hmove="${i}" data-d="1" ${i < slides.length - 1 ? "" : "disabled"}>↓</button><button class="btn sm ghost" data-hrm="${i}">Remove</button></div></div>`; }).join("")}
    <div class="flex" style="margin-top:14px;flex-wrap:wrap;gap:10px">
      <select class="inp" id="heroAdd" style="max-width:460px"><option value="">+ Add a product to the showcase…</option>${[...prods].filter((p) => p.active && !slides.includes(p.id)).sort((a, b) => (b.images?.length ? 1 : 0) - (a.images?.length ? 1 : 0))
        .map((p) => `<option value="${p.id}">${esc(p.title.slice(0, 70))}${p.images?.length ? "" : " (no photo)"}</option>`).join("")}</select>
      ${slides.length ? `<button class="btn sm ghost" id="heroAuto">Back to automatic</button>` : ""}</div></div>`);
  const saveHero = async (ids, msg) => { try { await api("/api/admin/hero", "PUT", { ids }); toast(msg); setup(); } catch (er) { toast(er.message); } };
  $("#heroAdd").onchange = (e) => e.target.value && (slides.length >= 12 ? toast("Up to 12 slides") : saveHero([...slides, e.target.value], "Added to showcase"));
  main().querySelectorAll("[data-hrm]").forEach((b) => (b.onclick = () => saveHero(slides.filter((_, i) => i !== Number(b.dataset.hrm)), "Removed")));
  main().querySelectorAll("[data-hmove]").forEach((b) => (b.onclick = () => { const i = Number(b.dataset.hmove), j = i + Number(b.dataset.d), a = [...slides]; [a[i], a[j]] = [a[j], a[i]]; saveHero(a, "Order updated"); }));
  const ha = $("#heroAuto"); if (ha) ha.onclick = () => saveHero([], "Showcase is automatic again");
  main().insertAdjacentHTML("beforeend", `<div class="panel"><b>Category images</b><p class="muted" style="margin:6px 0 14px;font-size:13px">Pick which product's photo shows on each category tile on the homepage. “Automatic” uses the first product in that category that has a photo.</p>
    <div class="tbl-wrap"><table><tr><th>Category</th><th>Image</th><th>Product shown</th></tr>${collections.map((c) => {
      const inCat = prods.filter((p) => p.collection === c.id && p.active);
      const auto = inCat.find((p) => p.images?.length) || inCat[0];
      const cur = prods.find((p) => p.id === c.cover) || auto;
      return `<tr><td><b>${esc(c.name)}</b><div class="muted" style="font-size:12px">${inCat.length} products</div></td><td>${cur ? thumb(cur) : '<div class="pthumb"></div>'}</td>
        <td><select class="inp" data-cover="${c.id}" style="max-width:420px"><option value="">Automatic${auto ? " (" + esc(auto.title.slice(0, 50)) + ")" : " (no products yet)"}</option>
        ${(() => { const opt = (p) => `<option value="${p.id}" ${p.id === c.cover ? "selected" : ""}>${esc(p.title.slice(0, 70))}${p.images?.length ? "" : " (no photo)"}</option>`;
          const others = prods.filter((p) => p.collection !== c.id && p.active);
          return (inCat.length ? `<optgroup label="In ${esc(c.name)}">${inCat.map(opt).join("")}</optgroup>` : "") + (others.length ? `<optgroup label="Other products">${others.map(opt).join("")}</optgroup>` : ""); })()}</select></td></tr>`;
    }).join("")}</table></div></div>`);
  main().querySelectorAll("[data-cover]").forEach((sel) => (sel.onchange = async () => {
    try { await api("/api/admin/collections/" + sel.dataset.cover, "PATCH", { cover: sel.value }); collections = await api("/api/admin/collections"); toast("Category image updated"); setup(); }
    catch (er) { toast(er.message); }
  }));
  main().querySelectorAll("[data-rmc]").forEach((b) => (b.onclick = async () => { if (!confirm("Remove this category?")) return; await api("/api/admin/collections/" + b.dataset.rmc, "DELETE"); collections = await api("/api/admin/collections"); setup(); }));
  $("#cf").onsubmit = async (e) => { e.preventDefault(); try { await api("/api/admin/collections", "POST", { name: e.target.name.value, blurb: e.target.blurb.value }); collections = await api("/api/admin/collections"); toast("Collection added"); setup(); } catch (er) { toast(er.message); } };
}

api("/api/admin/stats").then(() => shell()).catch(() => login());
