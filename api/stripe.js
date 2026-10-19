// ALL FOR ONE Stripe webhook. Each event is fetched back from Stripe by its id,
// so only real events from your Stripe account can change anyone's plan.
const C = require('../lib/core');

module.exports = C.route({
  'POST ': async ({ body }) => {
    const id = String((body && body.id) || '');
    if (!/^evt_[A-Za-z0-9]+$/.test(id)) throw C.fail(400, 'Not a Stripe event.');
    const ev = await C.stripe('GET', 'events/' + id);
    const o = (ev.data && ev.data.object) || {};

    if (ev.type === 'checkout.session.completed') {
      const u = await C.getUser(o.client_reference_id);
      if (u) {
        if (o.customer) { u.stripeCustomer = o.customer; await C.db1('SET', 'cust:' + o.customer, u.id); }
        if (o.subscription) C.applySub(u, await C.stripe('GET', 'subscriptions/' + o.subscription));
        await C.saveUser(u);
      }
    } else if (/^customer\.subscription\./.test(ev.type)) {
      const uid = (o.metadata && o.metadata.uid) || (await C.db1('GET', 'cust:' + o.customer));
      const u = await C.getUser(uid);
      if (u) {
        // Always read the latest state, in case events arrive out of order.
        C.applySub(u, await C.stripe('GET', 'subscriptions/' + o.id));
        await C.saveUser(u);
      }
    }
    return { received: true };
  },
});
