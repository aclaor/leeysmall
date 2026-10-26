import { products, collections, publicProduct } from "./data.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/collections") return json(collections);

    if (path === "/api/products") {
      let list = products.map(publicProduct);
      const c = url.searchParams.get("collection");
      const q = (url.searchParams.get("q") || "").toLowerCase().trim();
      if (c) list = list.filter((p) => p.collection === c);
      if (q) list = list.filter((p) => (p.title + " " + p.description).toLowerCase().includes(q));
      return json(list);
    }

    const m = path.match(/^\/api\/products\/([a-z0-9-]+)$/);
    if (m) {
      const p = products.find((x) => x.id === m[1]);
      return p ? json(publicProduct(p)) : json({ error: "Not found" }, 404);
    }

    if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
