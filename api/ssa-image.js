// api/ssa-image.js
// GET /api/ssa-image?url=https://www.ssactivewear.com/images/...
// Proxies SSA images for CORS-free download from the calculator
// The URL must start with ssactivewear.com to prevent open redirect abuse

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, filename } = req.query;

  // Security: only allow ssactivewear.com domains
  if (!url || !/^https?:\/\/(www\.)?ssactivewear\.com\//i.test(url)) {
    return res.status(400).json({ error: 'Invalid or disallowed image URL' });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrintShopCalculator/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Image fetch failed: ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await upstream.arrayBuffer());

    // Suggest a filename for download
    const dlName = filename || url.split('/').pop() || 'garment-image.jpg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${dlName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 1 day
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
