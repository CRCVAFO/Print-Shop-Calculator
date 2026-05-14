// api/ssa-products.js
// GET /api/ssa-products?styleid=16
// Returns prices, colors (with all images), inventory by warehouse, weight

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
  const IMG_BASE    = 'https://www.ssactivewear.com/';

  // All fields we need — weight + warehouseAbbr are the new additions
  const fields = [
    'sku', 'styleID', 'brandName', 'styleName',
    'colorName', 'colorCode',
    'sizeName', 'sizePriceCodeName',
    'customerPrice', 'piecePrice', 'dozenPrice', 'casePrice',
    'qty', 'warehouseAbbr',
    'weight',
    'colorFrontImage', 'colorBackImage', 'colorSwatchImage', 'colorOnModelFrontImage',
  ].join(',');

  try {
    const r = await fetch(
      `https://api.ssactivewear.com/v2/products/?styleID=${encodeURIComponent(styleid)}&fields=${fields}&mediatype=json`,
      { headers: { 'Authorization': `Basic ${credentials}`, 'Accept': 'application/json' } }
    );

    if (!r.ok) return res.status(r.status).json({ error: `SS&A error ${r.status}` });
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0)
      return res.status(404).json({ error: 'No products found for this style' });

    // ── Price tiers by sizePriceCodeName ──
    const priceMap = {};
    for (const item of data) {
      const key = item.sizePriceCodeName || item.sizeName || 'ALL';
      if (!priceMap[key]) {
        priceMap[key] = {
          sizePriceCodeName: key,
          sizeName:          item.sizeName,
          customerPrice:     item.customerPrice,
          piecePrice:        item.piecePrice,
          dozenPrice:        item.dozenPrice,
          casePrice:         item.casePrice,
          inStock:           (item.qty || 0) > 0,
        };
      }
    }
    const prices = Object.values(priceMap)
      .sort((a, b) => (a.customerPrice || 0) - (b.customerPrice || 0));

    // ── Colors with all images + inventory by warehouse ──
    // Warehouses sorted by proximity to Kenner, LA (ZIP 70065)
    const WAREHOUSE_PROXIMITY = {
      GPT: { label: 'Gulfport, MS',     days: '1 día',   priority: 1 },
      FTW: { label: 'Fort Worth, TX',   days: '1-2 días', priority: 2 },
      ATL: { label: 'Atlanta, GA',      days: '2 días',   priority: 3 },
      LAX: { label: 'Los Angeles, CA',  days: '3-4 días', priority: 4 },
      INP: { label: 'Indianapolis, IN', days: '3 días',   priority: 5 },
      SAV: { label: 'Savannah, GA',     days: '2-3 días', priority: 6 },
      HAZ: { label: 'Hazleton, PA',     days: '3-4 días', priority: 7 },
    };

    const colorMap = {};
    let totalWeight = 0;
    let weightCount = 0;

    for (const item of data) {
      const cn = item.colorName;
      if (!colorMap[cn]) {
        colorMap[cn] = {
          colorName:       cn,
          colorCode:       item.colorCode || '',
          frontImage:      item.colorFrontImage      ? IMG_BASE + item.colorFrontImage      : null,
          backImage:       item.colorBackImage       ? IMG_BASE + item.colorBackImage       : null,
          swatchImage:     item.colorSwatchImage     ? IMG_BASE + item.colorSwatchImage     : null,
          modelImage:      item.colorOnModelFrontImage ? IMG_BASE + item.colorOnModelFrontImage : null,
          inStock:         false,
          inventory:       {}, // { warehouseAbbr: { sizeName: qty } }
          totalQty:        0,
        };
      }

      const qty = item.qty || 0;
      const wh  = item.warehouseAbbr || 'UNK';
      const sz  = item.sizeName || '?';

      if (!colorMap[cn].inventory[wh]) colorMap[cn].inventory[wh] = {};
      // Accumulate qty across same wh+size (multiple SKUs can share)
      colorMap[cn].inventory[wh][sz] = (colorMap[cn].inventory[wh][sz] || 0) + qty;
      colorMap[cn].totalQty += qty;
      if (qty > 0) colorMap[cn].inStock = true;

      // Average weight
      if (item.weight > 0) { totalWeight += item.weight; weightCount++; }
    }

    // Attach proximity info and sort warehouses by proximity for each color
    const colors = Object.values(colorMap).map(c => ({
      ...c,
      warehouses: Object.entries(c.inventory)
        .map(([abbr, sizes]) => ({
          abbr,
          ...( WAREHOUSE_PROXIMITY[abbr] || { label: abbr, days: '?', priority: 99 }),
          sizes,
          totalQty: Object.values(sizes).reduce((s, q) => s + q, 0),
        }))
        .sort((a, b) => a.priority - b.priority),
    }));

    // First image for the style banner
    const firstColor = colors.find(c => c.frontImage) || colors[0];
    const frontImage = firstColor?.frontImage || null;

    // Average weight per piece in lbs
    const avgWeightLbs = weightCount > 0 ? (totalWeight / weightCount) : null;

    return res.status(200).json({
      styleID:       styleid,
      brandName:     data[0]?.brandName || '',
      styleName:     data[0]?.styleName || '',
      frontImage,
      prices,
      colors,
      totalSKUs:     data.length,
      avgWeightLbs,  // for shipping estimate
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
