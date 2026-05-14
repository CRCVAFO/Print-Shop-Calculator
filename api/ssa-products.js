// api/ssa-products.js
// GET /api/ssa-products?styleid=9182
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
  const IMG_BASE = 'https://www.ssactivewear.com/';
  const fields = 'sku,styleID,brandName,styleName,colorName,sizeName,sizePriceCodeName,customerPrice,qty,colorFrontImage,colorSwatchImage';

  try {
    const r = await fetch(
      `https://api.ssactivewear.com/v2/products/?styleID=${encodeURIComponent(styleid)}&fields=${fields}&mediatype=json`,
      { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }
    );

    if (!r.ok) return res.status(r.status).json({ error: `SS&A error ${r.status}` });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0)
      return res.status(404).json({ error: 'No products found for this style' });

    // Build price summary — one entry per sizePriceCodeName
    const priceMap = {};
    for (const item of data) {
      const key = item.sizePriceCodeName || item.sizeName || 'ALL';
      if (!priceMap[key]) {
        priceMap[key] = {
          sizePriceCodeName: key,
          sizeName: item.sizeName,
          customerPrice: item.customerPrice,
          inStock: (item.qty || 0) > 0,
        };
      }
    }
    const prices = Object.values(priceMap).sort((a, b) => (a.customerPrice||0) - (b.customerPrice||0));

    // Get first available front image and swatch
    const firstWithImg = data.find(p => p.colorFrontImage);
    const frontImage = firstWithImg ? IMG_BASE + firstWithImg.colorFrontImage : null;
    const swatchImage = firstWithImg ? (firstWithImg.colorSwatchImage ? IMG_BASE + firstWithImg.colorSwatchImage : null) : null;

    // Unique colors with images
    const colorMap = {};
    for (const item of data) {
      if (!colorMap[item.colorName]) {
        colorMap[item.colorName] = {
          colorName: item.colorName,
          frontImage: item.colorFrontImage ? IMG_BASE + item.colorFrontImage : null,
          swatchImage: item.colorSwatchImage ? IMG_BASE + item.colorSwatchImage : null,
          inStock: (item.qty || 0) > 0,
        };
      }
    }
    const colors = Object.values(colorMap).slice(0, 20);

    return res.status(200).json({
      styleID: styleid,
      brandName: data[0]?.brandName || '',
      styleName: data[0]?.styleName || '',
      frontImage,
      swatchImage,
      prices,
      colors,
      totalSKUs: data.length,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
