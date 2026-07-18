/**
 * On-the-fly image resizing for list thumbnails and banners.
 *
 * Venue photos can be raw full-res uploads (RallyHive's is a 12 MB JPG), which
 * are far too heavy to load into a card thumbnail or a full-width carousel.
 * Until the backend generates real thumbnails (a `thumbUrl` per photo), we
 * route images through the weserv.nl (Cloudflare-backed) image proxy, which
 * returns a small WebP. If the proxy is ever unavailable, the caller's
 * placeholder / background simply shows instead.
 *
 * TODO(backend): generate resized thumbnails on upload and use `thumbUrl`
 * directly, then this proxy can be dropped.
 */

/** Route a URL through the resize proxy. `w`/`h` are the target box in px. */
export const resizeUrl = (
  url: string | undefined | null,
  opts: { w?: number; h?: number; q?: number } = {},
): string | undefined => {
  if (!url) return undefined;
  // Already proxied — leave as-is.
  if (url.includes('images.weserv.nl')) return url;
  // The proxy can only fetch publicly reachable http(s) URLs. Local picker
  // results (file://, content://, ph://, data:, blob:) and anything on
  // localhost must be passed through untouched or the image breaks.
  if (!/^https?:\/\//i.test(url)) return url;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.)/i.test(url)) return url;
  const { w = 400, h, q = 80 } = opts;
  const hParam = h ? `&h=${h}` : '';
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${w}${hParam}&fit=cover&output=webp&q=${q}`;
};

/** Square thumbnail for list rows / cards. */
export const thumbUrl = (url: string | undefined | null, px = 200): string | undefined =>
  resizeUrl(url, { w: px, h: px });
