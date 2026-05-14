// api/ssa-inventory.js
// GET /api/ssa-inventory?styleid=16
// Returns inventory grouped by color → warehouse → size
// SS&A updates inventory every ~15 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { styleid } = req.query;
  if (!styleid) return res.status(400).json({ error: 'Missing styleid' });

  const account = process.env.SSA_ACCOUNT;
  const apiKey  = process.env.SSA_API_KEY;
  if (!account || !apiKey) return res.status(500).json({ error: 'SS&A credentials not configured.' });

  const credentials = Buffer.from(`${account}:${apiKey}`).toString('base64');

  // Warehouses sorted by proximity to Kenner, LA (ZIP 70065)
  const WAREHOUSE_PROXIMITY = {
    GPT: { label: 'Gulfport, MS',     days: '1 día',    priority: 1 },
    FTW: { label: 'Fort Worth, TX',   days: '1–2 días', priority: 2 },
    ATL: { label: 'Atlanta, GA',      days: '2 días',   priority: 3 },
    LAX: { label: 'Los Angeles, CA',  days: '3–4 días', priority: 4 },
    INP: { label: 'Indianapolis, IN', days: '3 días',   priority: 5 },
    SAV: { label: 'Savannah, GA',     days: '2–3 días', priority: 6 },
    HAZ: { label: 'Hazleton, PA',     days: '3–4 días', priority: 7 },
  };

  try {
    const r = await fetch(
      `https://api.ssactivewear.com/v2/products/?styleid=${encodeURIComponent(styleid)}&fields=colorName,sizeName,qty,warehouseAbbr&mediatype=json`,
      { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }
    );
    if (!r.ok) return res.status(r.status).json({ error: `SS&A error ${r.status}` });
    const data = await r.json();

    // Group: color → warehouse → size → qty
    const byColor = {};
    for (const item of data) {
      const cn = item.colorName;
      const wh = item.warehouseAbbr || 'UNK';
      const sz = item.sizeName || '?';
      const qty = item.qty || 0;

      if (!byColor[cn]) byColor[cn] = {};
      if (!byColor[cn][wh]) byColor[cn][wh] = {};
      byColor[cn][wh][sz] = (byColor[cn][wh][sz] || 0) + qty;
    }

    // Add proximity metadata to each warehouse
    const result = {};
    for (const [color, warehouses] of Object.entries(byColor)) {
      result[color] = Object.entries(warehouses)
        .map(([abbr, sizes]) => ({
          abbr,
          ...(WAREHOUSE_PROXIMITY[abbr] || { label: abbr, days: '?', priority: 99 }),
          sizes,
          totalQty: Object.values(sizes).reduce((s, q) => s + q, 0),
        }))
        .sort((a, b) => a.priority - b.priority);
    }

    return res.status(200).json({
      styleID:   styleid,
      inventory: result,
      updatedAt: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
