// api/ssa-inventory.js
// Quick inventory check for a style
// GET /api/ssa-inventory?styleid=39

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { styleid } = req.query;
  if (!styleid) return res.status(400).json({ error: 'Missing styleid' });

  const account = process.env.SSA_ACCOUNT;
  const apiKey  = process.env.SSA_API_KEY;
  const credentials = Buffer.from(`${account}:${apiKey}`).toString('base64');

  // Inventory updates every 15 min on SS&A side
  const url = `https://api.ssactivewear.com/v2/products/?styleid=${encodeURIComponent(styleid)}&fields=sku,sizeName,sizePriceCodeName,colorName,qty&mediatype=json`;

  try {
    const upstream = await fetch(url, {
      headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' }
    });
    const data = await upstream.json();

    // Group by color → sizes with qty
    const byColor = {};
    for (const item of data) {
      if (!byColor[item.colorName]) byColor[item.colorName] = {};
      byColor[item.colorName][item.sizeName] = item.qty;
    }

    return res.status(200).json({ styleID: styleid, inventory: byColor });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
