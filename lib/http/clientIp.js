// The caller's IP address, for the per-IP rate limits only (never stored raw; rateLimit.js hashes it).
// On Vercel the platform sets these headers itself. Elsewhere they can be forged, which is why the
// per-user limit is the main one and the per-IP limit only a backstop.

export function clientIp(req) {
  const h = req?.headers;
  if (!h) return null;
  const first = (v) => (v ? v.split(',')[0].trim() : '');
  const ip = first(h.get('x-vercel-forwarded-for')) || first(h.get('x-forwarded-for')) || (h.get('x-real-ip') || '').trim();
  return ip ? ip.slice(0, 64) : null;
}
