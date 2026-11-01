// Video storage on Cloudflare R2 (binding: MEDIA).
// Admin uploads in chunks (multipart) so large videos work; shoppers stream with HTTP Range (seeking works).
const CT = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export const mediaReady = (env) => !!env.MEDIA;
const need = (env) => { if (!env.MEDIA) throw Object.assign(new Error("Video storage isn't connected yet (R2 bucket leeyspremium-media)."), { status: 503 }); };

export async function startUpload(env, name, type) {
  need(env);
  const ext = (String(name).split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "mp4";
  if (!CT[ext]) throw Object.assign(new Error("Please upload an MP4, MOV or WEBM video (or a JPG/PNG/WEBP image)."), { status: 400 });
  const slug = String(name).replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video";
  const key = `v/${Date.now().toString(36)}-${[...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("")}-${slug}.${ext}`;
  const up = await env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType: CT[ext] || type || "application/octet-stream", cacheControl: "public, max-age=31536000, immutable" } });
  return { key, uploadId: up.uploadId };
}
export async function uploadPart(env, key, uploadId, n, body) {
  need(env);
  const part = await env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(n, body);
  return { partNumber: part.partNumber, etag: part.etag };
}
export async function completeUpload(env, key, uploadId, parts) {
  need(env);
  const obj = await env.MEDIA.resumeMultipartUpload(key, uploadId).complete(parts.map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) })));
  return { key, size: obj.size };
}
export async function deleteObject(env, key) { if (env.MEDIA && key) await env.MEDIA.delete(key); }

// GET /media/<key> with Range support
export async function serveMedia(req, env, key) {
  if (!env.MEDIA) return new Response("Not found", { status: 404 });
  const range = req.headers.get("range");
  let opts = {};
  const m = range && range.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response("Not found", { status: 404 });
    const size = head.size, start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] === "" || m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    opts = { range: { offset: start, length: end - start + 1 } };
    const obj = await env.MEDIA.get(key, opts);
    const h = new Headers(); obj.writeHttpMetadata(h);
    h.set("content-range", `bytes ${start}-${end}/${size}`); h.set("content-length", String(end - start + 1)); h.set("accept-ranges", "bytes"); h.set("etag", obj.httpEtag);
    return new Response(req.method === "HEAD" ? null : obj.body, { status: 206, headers: h });
  }
  const obj = req.method === "HEAD" ? await env.MEDIA.head(key) : await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const h = new Headers(); obj.writeHttpMetadata(h);
  h.set("content-length", String(obj.size)); h.set("accept-ranges", "bytes"); h.set("etag", obj.httpEtag);
  return new Response(req.method === "HEAD" ? null : obj.body, { headers: h });
}

// Live stream links → embeddable player URLs (YouTube / Facebook). Returns null if not recognised.
export function embedUrl(url) {
  const u = String(url || "").trim();
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/))) return { provider: "youtube", src: `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&playsinline=1&rel=0` };
  if (/facebook\.com\/|fb\.watch\//.test(u)) return { provider: "facebook", src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&autoplay=true&mute=true&show_text=false` };
  return null;
}
