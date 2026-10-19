// ALL FOR ONE payments: Stripe Checkout for Pro (7-day trial, card needed) and the billing portal.
const C = require('../lib/core');

module.exports = C.route({
  'POST checkout': async ({ req, body }) => {
    const u = await C.auth(req);
    if (!C.paymentsReady()) throw C.fail(503, 'Payments aren’t switched on yet.');
    if (u.subStatus && ['trialing', 'active', 'past_due'].includes(u.subStatus)) throw C.fail(409, 'You already have Pro.');
    const price = body.plan === 'month' ? process.env.STRIPE_PRICE_MONTH : process.env.STRIPE_PRICE_YEAR;

    let customer = u.stripeCustomer;
    if (!customer) {
      const c = await C.stripe('POST', 'customers', { email: u.email, 'metadata[uid]': u.id });
      customer = c.id;
      u.stripeCustomer = customer;
      await C.saveUser(u);
      await C.db1('SET', 'cust:' + customer, u.id);
    }
    const base = C.appBase(req);
    const params = {
      mode: 'subscription',
      customer,
      client_reference_id: u.id,
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      'subscription_data[metadata][uid]': u.id,
      allow_promotion_codes: 'true',
      success_url: base + '/paid.html?done=1',
      cancel_url: base + '/paid.html?done=0',
    };
    if (!u.trialUsed) params['subscription_data[trial_period_days]'] = '7';
    const s = await C.stripe('POST', 'checkout/sessions', params);
    return { url: s.url };
  },

  'POST portal': async ({ req }) => {
    const u = await C.auth(req);
    if (!u.stripeCustomer) throw C.fail(400, 'You don’t have a subscription to manage.');
    const s = await C.stripe('POST', 'billing_portal/sessions', { customer: u.stripeCustomer, return_url: C.appBase(req) + '/paid.html?portal=1' });
    return { url: s.url };
  },
});
