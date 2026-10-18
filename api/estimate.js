// ALL FOR ONE price service: estimates typical used prices for an item on each site.
// Needs the ANTHROPIC_API_KEY environment variable set in the Vercel project.
const SITE_NAMES = {
  ebay: 'eBay', fb: 'Facebook Marketplace', gumtree: 'Gumtree', vinted: 'Vinted', depop: 'Depop',
  preloved: 'Preloved', cex: 'CeX', backmarket: 'Back Market', autotrader: 'AutoTrader',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'Price service is not set up yet' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String(body.q || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const sites = (Array.isArray(body.sites) ? body.sites : []).filter(s => SITE_NAMES[s]).slice(0, 8);
  if (!q || !sites.length) return res.status(400).json({ error: 'Send an item and at least one site' });

  const prompt = 'You estimate typical asking prices on UK second-hand marketplaces, from general knowledge.\n'
    + 'Item: "' + q + '"\n'
    + 'Marketplaces (id = name): ' + sites.map(id => id + ' = ' + SITE_NAMES[id]).join('; ') + '\n'
    + 'Assume used condition, except cex and backmarket, which sell refurbished stock.\n'
    + 'Reply with only one JSON object and no other text:\n'
    + '{"typical":[low,high],"sites":{"<id>":[low,high]},"checks":["up to 2 checks before paying for this exact item, each under 10 words"]}\n'
    + 'Prices are whole GBP numbers. Use null for a marketplace where this item rarely sells. If the item is too vague to price, set "typical" to null.';

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.PRICE_MODEL || 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return res.status(502).json({ error: 'Price service is busy, try again' });
    const data = await r.json();
    const text = (data.content || []).map(c => c.text || '').join('');
    const match = text.match(/\{[\s\S]*\}/);
    return res.status(200).json(match ? JSON.parse(match[0]) : {});
  } catch (e) {
    return res.status(500).json({ error: 'Could not estimate a price' });
  }
};
