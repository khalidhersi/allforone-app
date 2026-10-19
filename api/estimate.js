// ALL FOR ONE price service: counts the search or price check against the daily limit,
// then estimates typical used prices. Needs ANTHROPIC_API_KEY for the estimates.
const crypto = require('crypto');
const C = require('../lib/core');

const SITE_NAMES = {
  ebay: 'eBay', fb: 'Facebook Marketplace', gumtree: 'Gumtree', vinted: 'Vinted', depop: 'Depop',
  preloved: 'Preloved', cex: 'CeX', backmarket: 'Back Market', autotrader: 'AutoTrader',
};

function promptFor(q, sites) {
  return 'You estimate typical asking prices on UK second-hand marketplaces, from general knowledge.\n'
    + 'Item: "' + q + '"\n'
    + 'Marketplaces (id = name): ' + sites.map(id => id + ' = ' + SITE_NAMES[id]).join('; ') + '\n'
    + 'Assume used condition, except cex and backmarket, which sell refurbished stock.\n'
    + 'Reply with only one JSON object and no other text:\n'
    + '{"typical":[low,high],"sites":{"<id>":[low,high]},"checks":["up to 2 checks before paying for this exact item, each under 10 words"]}\n'
    + 'Prices are whole GBP numbers. Use null for a marketplace where this item rarely sells. If the item is too vague to price, set "typical" to null.';
}

module.exports = C.route({
  'POST ': async ({ req, body }) => {
    const u = await C.auth(req);
    const q = String(body.q || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const sites = (Array.isArray(body.sites) ? body.sites : []).filter(s => SITE_NAMES[s]).slice(0, 8);
    if (!q || !sites.length) throw C.fail(400, 'Send an item and at least one site.');

    // Checking a saved deal alert is free; everything else counts toward today's limit.
    let kind = body.kind === 'check' ? 'check' : 'search';
    let free = false;
    if (body.kind === 'alert') {
      const alerts = await C.getAlerts(u);
      free = alerts.some(a => a.q.toLowerCase() === q.toLowerCase());
    }
    if (!free) await C.spend(u, kind);
    const usage = await C.getUsage(u);

    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { none: true, usage };

    const cacheKey = 'est:' + crypto.createHash('sha1').update(q.toLowerCase() + '|' + sites.join(',')).digest('hex');
    const cached = await C.db1('GET', cacheKey);
    if (cached) return Object.assign(JSON.parse(cached), { usage });

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.PRICE_MODEL || 'claude-haiku-5-5', max_tokens: 400, messages: [{ role: 'user', content: promptFor(q, sites) }] }),
      });
      if (!r.ok) throw new Error('model ' + r.status);
      const data = await r.json();
      const text = (data.content || []).map(c => c.text || '').join('');
      const m = text.match(/\{[\s\S]*\}/);
      const est = m ? JSON.parse(m[0]) : {};
      await C.db1('SET', cacheKey, JSON.stringify(est), 'EX', 86400);
      return Object.assign(est, { usage });
    } catch (e) {
      console.error('estimate failed', e.message);
      if (!free) await C.refund(u, kind);
      return { none: true, busy: true, usage: await C.getUsage(u) };
    }
  },
});
