// api/ssa-styles.js — Smart search with brand+style filtering
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

  // Popular style shortcuts — direct styleID lookup bypasses bad search
  const SHORTCUTS = {
    'g500': 16, '5000': 16, 'gildan 5000': 16, 'heavy cotton': 16,
    'g64000': 32, '64000': 32, 'softstyle': 32, 'gildan 64000': 32,
    'g18500': 395, '18500': 395, 'heavy blend hoodie': 395, 'gildan hoodie': 395,
    'g18000': 372, '18000': 372, 'heavy blend crew': 372,
    '3001': null, 'bella': null, 'bella canvas': null, 'bc3001': null,
    '1717': null, 'comfort colors': null, 'cc1717': null,
    '3600': null, 'next level': null, 'nl3600': null,
    'hanes': null, '5180': null,
  };

  const qLower = q.toLowerCase().trim();
  const shortcutID = SHORTCUTS[qLower];

  try {
    let results = [];

    // If we have a direct styleID shortcut, use it
    if (shortcutID) {
      const r = await fetch(
        `https://api.ssactivewear.com/v2/styles/?styleID=${shortcutID}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }
      );
      const data = r.ok ? await r.json() : [];
      results = Array.isArray(data) ? data : [];
    }

    // Always also do a title search and filter client-side
    const [r1, r2] = await Promise.all([
      fetch(`https://api.ssactivewear.com/v2/styles/?title=${encodeURIComponent(q)}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }),
      fetch(`https://api.ssactivewear.com/v2/styles/?styleName=${encodeURIComponent(q)}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }),
    ]);

    const [d1, d2] = await Promise.all([r1.ok ? r1.json() : [], r2.ok ? r2.json() : []]);
    const allData = [...results, ...(Array.isArray(d1)?d1:[]), ...(Array.isArray(d2)?d2:[])];

    // Filter: only return items where brandName OR styleName OR title actually matches query
    const qWords = qLower.split(/\s+/).filter(w => w.length > 1);
    const filtered = allData.filter(s => {
      const brand = (s.brandName || '').toLowerCase();
      const style = (s.styleName || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      return qWords.some(w =>
        brand.includes(w) || style.includes(w) || title.includes(w)
      );
    });

    // Deduplicate
    const seen = new Set();
    const unique = filtered.filter(s => {
      if (seen.has(s.styleID)) return false;
      seen.add(s.styleID);
      return true;
    });

    const mapped = unique.slice(0, 15).map(s => ({
      styleID: s.styleID,
      brandName: s.brandName || '',
      styleName: s.styleName || '',
      title: s.title || '',
      baseCategory: s.baseCategory || '',
      image: s.styleImage ? IMG_BASE + s.styleImage : null,
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
