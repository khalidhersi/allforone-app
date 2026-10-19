// ALL FOR ONE deal alerts: list, add, remove, mark checked.
const crypto = require('crypto');
const C = require('../lib/core');

const clean = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = C.route({
  'GET ': async ({ req }) => {
    const u = await C.auth(req);
    return { alerts: await C.getAlerts(u), limit: C.limitsFor(u).alerts };
  },

  'POST add': async ({ req, body }) => {
    const u = await C.auth(req);
    const q = clean(body.q, 80);
    if (!q) throw C.fail(400, 'Say what you want, like "PS5 Slim".');
    const list = await C.getAlerts(u);
    const limit = C.limitsFor(u).alerts;
    if (list.length >= limit) {
      throw C.fail(402, C.isPro(u) ? `You can have up to ${limit} alerts.` : 'Free accounts get 1 deal alert.', { reason: 'limit', kind: 'alerts' });
    }
    const max = Math.round(Number(String(body.max || '').replace(/[^\d.]/g, '')) || 0);
    list.unshift({ id: crypto.randomBytes(6).toString('hex'), q, max: max > 0 ? String(max) : '', loc: clean(body.loc, 40), created: Date.now(), checked: 0 });
    await C.saveAlerts(u, list);
    return { alerts: list, limit };
  },

  'POST remove': async ({ req, body }) => {
    const u = await C.auth(req);
    const list = (await C.getAlerts(u)).filter(a => a.id !== body.id);
    await C.saveAlerts(u, list);
    return { alerts: list, limit: C.limitsFor(u).alerts };
  },

  'POST checked': async ({ req, body }) => {
    const u = await C.auth(req);
    const list = await C.getAlerts(u);
    const a = list.find(x => x.id === body.id);
    if (a) { a.checked = Date.now(); await C.saveAlerts(u, list); }
    return { alerts: list, limit: C.limitsFor(u).alerts };
  },
});
