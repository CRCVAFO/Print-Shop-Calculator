// api/ssa-styles.js
// Proxy para SS&A API — GET /api/ssa-styles?q=Gildan+5000
// Vercel Serverless Function

export default async function handler(req, res) {
  // Allow requests from anywhere (your calculator)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query param: q' });
  }

  // Credentials come from Vercel environment variables (never exposed to browser)
  const account = process.env.SSA_ACCOUNT;
  const apiKey  = process.env.SSA_API_KEY;

  if (!account || !apiKey) {
    return res.status(500).json({ error: 'SS&A credentials not configured in Vercel env vars.' });
  }

  const credentials = Buffer.from(`${account}:${apiKey}`).toString('base64');
  const url = `https://api.ssactivewear.com/v2/styles/?style=${encodeURIComponent(q)}&fields=styleID,brandName,styleName,baseCategory&mediatype=json`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json',
      }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `SS&A error ${upstream.status}`, detail: text });
    }

    const data = await upstream.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Proxy fetch failed', detail: err.message });
  }
}
