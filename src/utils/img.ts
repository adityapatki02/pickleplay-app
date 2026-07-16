/**
 * On-the-fly image resizing for list thumbnails.
 *
 * Venue photos can be raw full-res uploads (RallyHive's is a 12 MB JPG), which
 * are far too heavy to load into a small card thumbnail. Until the backend
 * generates real thumbnails (a `thumbUrl` per photo), we route card images
 * through the weserv.nl (Cloudflare-backed) image proxy, which returns a small
 * WebP (~4 KB). If the proxy is ever unavailable, the caller's placeholder /
 * background simply shows instead.
 *
 * TODO(backend): generate resized thumbnails on upload and use `thumbUrl`
 * directly, then this proxy can be dropped.
 */
export const thumbUrl = (url: string | undefined | null, px = 200): string | undefined => {
  if (!url) return undefined;
  // Already small/local/proxied — leave as-is.
  if (url.startsWith('data:') || url.includes('images.weserv.nl')) return url;
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${px}&h=${px}&fit=cover&output=webp&q=80`;
};
