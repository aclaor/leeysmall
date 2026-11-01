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
    ${[["dashboard", "Dashboard"], ["orders", "Orders"], ["messages", "Messages"], ["products", "Products"], ["import", "Import from CJ"], ["discounts", "Discounts"], ["subscribers", "Subscribers"], ["setup", "Setup"]]
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
  ({ dashboard, orders, messages, products, import: importCj, discounts, subscribers, setup }[t] || dashboard)().catch((e) => toast(e.message));
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
