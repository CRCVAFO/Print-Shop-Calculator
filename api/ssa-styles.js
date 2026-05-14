// api/ssa-styles.js — Smart search with verified styleID shortcuts
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

  // Verified styleIDs from SS&A account 1001550
  const SHORTCUTS = {
    // Gildan
    'g500':16, '5000':16, 'gildan 5000':16, 'heavy cotton':16,
    'g64000':32, '64000':32, 'softstyle':32, 'gildan 64000':32, 'gildan softstyle':32,
    'g18500':395, '18500':395, 'gildan hoodie':395, 'heavy blend hoodie':395,
    'g18000':372, '18000':372, 'gildan crewneck':372, 'heavy blend crew':372,
    // Bella+Canvas
    '3001':29, 'bella':29, 'bella canvas':29, 'bella+canvas':29, 'bc3001':29, 'bella 3001':29,
    // Comfort Colors
    '1717':1822, 'comfort colors':1822, 'cc1717':1822, 'comfort colors 1717':1822,
    // Next Level
    '3600':3214, 'next level':3214, 'next level 3600':3214, 'nl3600':3214,
    // Hanes
    '5180':55, 'hanes':55, 'beefy':55, 'hanes 5180':55,
  };

  const qLower = q.toLowerCase().trim();

  try {
    let priorityResults = [];

    // Check for shortcut match
    const shortcutID = SHORTCUTS[qLower];
    if (shortcutID) {
      const r = await fetch(
        `https://api.ssactivewear.com/v2/styles/?styleID=${shortcutID}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }
      );
      if (r.ok) {
        const data = await r.json();
        priorityResults = Array.isArray(data) ? data : [];
      }
    }

    // Also search by styleName (exact number like "3001", "5000")
    const [r1, r2] = await Promise.all([
      fetch(`https://api.ssactivewear.com/v2/styles/?styleName=${encodeURIComponent(q)}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }),
      fetch(`https://api.ssactivewear.com/v2/styles/?title=${encodeURIComponent(q)}&fields=${fields}&mediatype=json`,
        { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }),
    ]);

    const [d1, d2] = await Promise.all([r1.ok ? r1.json() : [], r2.ok ? r2.json() : []]);
    const allRaw = [...priorityResults, ...(Array.isArray(d1)?d1:[]), ...(Array.isArray(d2)?d2:[])];

    // Filter: results must actually match query words
    const qWords = qLower.split(/\s+/).filter(w => w.length >= 2);
    const filtered = allRaw.filter(s => {
      const brand = (s.brandName || '').toLowerCase();
      const style = (s.styleName || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      return qWords.some(w => brand.includes(w) || style.includes(w) || title.includes(w));
    });

    // Deduplicate, priorityResults first
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
