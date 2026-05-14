// api/ssa-products.js
// Proxy para SS&A API — GET /api/ssa-products?styleid=39
// Returns all SKUs for a style with customer pricing

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { styleid } = req.query;

  if (!styleid) {
    return res.status(400).json({ error: 'Missing query param: styleid' });
  }

  const account = process.env.SSA_ACCOUNT;
  const apiKey  = process.env.SSA_API_KEY;

  if (!account || !apiKey) {
    return res.status(500).json({ error: 'SS&A credentials not configured.' });
  }

  const credentials = Buffer.from(`${account}:${apiKey}`).toString('base64');

  // We only need the price fields — keep response small
  const fields = 'sku,styleID,brandName,styleName,colorName,sizeName,sizePriceCodeName,customerPrice,qty';
  const url = `https://api.ssactivewear.com/v2/products/?styleid=${encodeURIComponent(styleid)}&fields=${fields}&mediatype=json`;

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

    // Summarize: one price per sizePriceCodeName (S-XL, 2XL, 3XL, etc.)
    // to keep the payload small
    const priceMap = {};
    for (const item of data) {
      const key = item.sizePriceCodeName || item.sizeName;
      if (!priceMap[key]) {
        priceMap[key] = {
          sizePriceCodeName: key,
          sizeName: item.sizeName,
          customerPrice: item.customerPrice,
          inStock: item.qty > 0,
        };
      }
    }

    const summary = Object.values(priceMap).sort((a, b) =>
      (a.customerPrice || 0) - (b.customerPrice || 0)
    );

    return res.status(200).json({
      styleID: styleid,
      brandName: data[0]?.brandName || '',
      styleName: data[0]?.styleName || '',
      prices: summary,
      rawCount: data.length,
    });

  } catch (err) {
    return res.status(500).json({ error: 'Proxy fetch failed', detail: err.message });
  }
}
