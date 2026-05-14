// api/ssa-styles.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing param q' });

  const account = process.env.SSA_ACCOUNT;
  const apiKey  = process.env.SSA_API_KEY;
  if (!account || !apiKey) return res.status(500).json({ error: 'SS&A credentials not configured.' });

  const credentials = Buffer.from(`${account}:${apiKey}`).toString('base64');
  const IMG_BASE = 'https://www.ssactivewear.com/';
  const fields = 'styleID,brandName,styleName,title,baseCategory,styleImage';

  try {
    // Search by title AND styleName, merge results
    const [r1, r2] = await Promise.all([
      fetch(`https://api.ssactivewear.com/v2/styles/?title=${encodeURIComponent(q)}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }),
      fetch(`https://api.ssactivewear.com/v2/styles/?styleName=${encodeURIComponent(q)}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }),
    ]);

    const [d1, d2] = await Promise.all([r1.ok ? r1.json() : [], r2.ok ? r2.json() : []]);
    const merged = [...(Array.isArray(d1)?d1:[]), ...(Array.isArray(d2)?d2:[])];
    const seen = new Set();
    const unique = merged.filter(s => { if(seen.has(s.styleID))return false; seen.add(s.styleID); return true; });

    const results = unique.slice(0, 15).map(s => ({
      styleID: s.styleID,
      brandName: s.brandName || '',
      styleName: s.styleName || '',
      title: s.title || '',
      baseCategory: s.baseCategory || '',
      image: s.styleImage ? IMG_BASE + s.styleImage : null,
    }));

    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
