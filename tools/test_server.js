// Server tests with an in-memory database and fake Stripe / AI responses.
// Usage: node tools/test_server.js
process.env.AFO_MEMORY_DB = '1';
const assert = require('assert');
const { createServer } = require('./dev_server');

const realFetch = global.fetch;
const stripeCalls = [];
let subStatus = 'trialing';
global.fetch = async (url, opts = {}) => {
  url = String(url);
  if (url.startsWith('https://api.anthropic.com/')) {
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"typical":[180,240],"sites":{"ebay":[190,250]},"checks":["Check battery health."]}' }] }), { status: 200 });
  }
  if (url.startsWith('https://api.stripe.com/')) {
    const path = url.replace('https://api.stripe.com/v1/', '').split('?')[0];
    const body = new URLSearchParams(opts.body || '');
    stripeCalls.push({ method: opts.method, path, body: Object.fromEntries(body) });
    const j = (o) => new Response(JSON.stringify(o), { status: 200 });
    if (path === 'customers') return j({ id: 'cus_test1' });
    if (path === 'checkout/sessions') return j({ id: 'cs_test1', url: 'https://checkout.stripe.com/c/pay/cs_test1' });
    if (path === 'billing_portal/sessions') return j({ url: 'https://billing.stripe.com/p/session/test' });
    if (path.startsWith('events/evt_done')) return j({ id: 'evt_done', type: 'checkout.session.completed', data: { object: { client_reference_id: global.__uid, customer: 'cus_test1', subscription: 'sub_test1' } } });
    if (path.startsWith('events/evt_cancel')) return j({ id: 'evt_cancel', type: 'customer.subscription.deleted', data: { object: { id: 'sub_test1', customer: 'cus_test1', metadata: {} } } });
    if (path.startsWith('subscriptions/')) return j({ id: 'sub_test1', status: subStatus, customer: 'cus_test1', trial_start: 1 });
    return new Response(JSON.stringify({ error: { message: 'unknown ' + path } }), { status: 400 });
  }
  return realFetch(url, opts);
};

(async () => {
  const server = createServer().listen(0);
  const base = 'http://localhost:' + server.address().port;
  const call = async (path, body, token, method) => {
    const r = await realFetch(base + '/api/' + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  };
  let passed = 0;
  const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };

  // Sign up: first account is the owner
  let r = await call('auth?a=signup', { email: 'Owner@Test.com', password: 'password123' });
  ok(r.status === 200 && r.data.token && r.data.user.role === 'owner' && r.data.user.isAdmin && r.data.user.plan === 'pro', 'owner signup');
  const owner = r.data.token;
  r = await call('auth?a=signup', { email: 'owner@test.com', password: 'password123' });
  ok(r.status === 409, 'duplicate email blocked');
  r = await call('auth?a=signup', { email: 'bad', password: 'password123' });
  ok(r.status === 400, 'bad email blocked');
  r = await call('auth?a=signup', { email: 'a@b.co', password: 'short' });
  ok(r.status === 400, 'short password blocked');

  // Second account is a normal free user
  r = await call('auth?a=signup', { email: 'user@test.com', password: 'password123' });
  ok(r.status === 200 && r.data.user.role === 'user' && !r.data.user.isAdmin && r.data.user.plan === 'free', 'user signup is free');
  let user = r.data.token;
  global.__uid = r.data.user.id;
  const uid = r.data.user.id;

  r = await call('auth?a=login', { email: 'user@test.com', password: 'nope-nope' });
  ok(r.status === 401, 'wrong password rejected');
  r = await call('auth?a=login', { email: 'USER@test.com', password: 'password123' });
  ok(r.status === 200 && r.data.token, 'login works, email not case sensitive');
  r = await call('auth?a=me', null, 'f'.repeat(64));
  ok(r.status === 401, 'fake token rejected');
  r = await call('auth?a=me', null, user);
  ok(r.status === 200 && r.data.usage.search === 0 && r.data.limits.search === 3, 'me shows free limits');

  // Free limits: 3 searches, then 402. No AI key yet, so estimates come back empty.
  const est = (q, kind, t) => call('estimate', { q, kind, sites: ['ebay', 'vinted'] }, t);
  for (let i = 1; i <= 3; i++) { r = await est('PS5', 'search', user); ok(r.status === 200 && r.data.none && r.data.usage.search === i, 'search ' + i + ' counted'); }
  r = await est('PS5', 'search', user);
  ok(r.status === 402 && r.data.reason === 'limit' && r.data.kind === 'search', '4th search hits paywall');
  r = await call('auth?a=me', null, user);
  ok(r.data.usage.search === 3, 'blocked search not counted');
  for (let i = 1; i <= 3; i++) await est('iPhone 13', 'check', user);
  r = await est('iPhone 13', 'check', user);
  ok(r.status === 402 && r.data.kind === 'check', '4th price check hits paywall');

  // Alerts: free gets 1, checking a saved alert is free
  r = await call('alerts?a=add', { q: 'Nike Dunk', max: '£60' }, user);
  ok(r.status === 200 && r.data.alerts.length === 1 && r.data.alerts[0].max === '60', 'alert added');
  r = await call('alerts?a=add', { q: 'PS5' }, user);
  ok(r.status === 402 && r.data.kind === 'alerts', '2nd alert hits paywall');
  r = await est('nike dunk', 'alert', user);
  ok(r.status === 200, 'checking a saved alert is free even at the limit');
  r = await est('something else', 'alert', user);
  ok(r.status === 402, 'unsaved alert name still counts');

  // Admin powers
  r = await call('admin?a=health', null, user);
  ok(r.status === 403, 'normal user cannot see admin');
  r = await call('admin?a=health', null, owner);
  ok(r.status === 200 && r.data.db && r.data.users === 2 && r.data.today.signups === 2 && !r.data.payments, 'admin health');
  r = await call('admin?a=users&q=user@', null, owner);
  ok(r.status === 200 && r.data.users.length === 1 && r.data.users[0].usage.search === 3 && !r.data.users[0].pw, 'admin user list, no password hashes');
  r = await call('admin?a=user', { id: uid, action: 'grant_pro' }, owner);
  ok(r.status === 200 && r.data.user.plan === 'pro' && r.data.user.proSource === 'gift', 'admin gives Pro');
  r = await est('PS5', 'search', user);
  ok(r.status === 200, 'Pro user can search again');
  r = await call('admin?a=user', { id: uid, action: 'revoke_pro' }, owner);
  ok(r.data.user.plan === 'free', 'admin removes Pro');
  r = await call('admin?a=user', { id: uid, action: 'reset_usage' }, owner);
  ok(r.data.user.usage.search === undefined, 'admin resets usage');

  // Owner testing as a free user
  const ownerId = (await call('auth?a=me', null, owner)).data.user.id;
  r = await call('admin?a=user', { id: ownerId, action: 'test_free', on: true }, owner);
  ok(r.data.user.plan === 'free' && r.data.user.isAdmin, 'owner can test as free and stays admin');
  r = await call('admin?a=user', { id: uid, action: 'test_free', on: true }, owner);
  ok(r.status === 400, 'test-as-free only for yourself');
  await call('admin?a=user', { id: ownerId, action: 'test_free', on: false }, owner);

  // Reset password: old one stops working, temp one works, old sessions end
  r = await call('admin?a=user', { id: uid, action: 'reset_password' }, owner);
  ok(r.status === 200 && /^[a-z0-9]{10}$/.test(r.data.tempPassword), 'temp password made');
  const temp = r.data.tempPassword;
  r = await call('auth?a=me', null, user);
  ok(r.status === 401, 'reset ends old sessions');
  r = await call('auth?a=login', { email: 'user@test.com', password: 'password123' });
  ok(r.status === 401, 'old password stops working');
  r = await call('auth?a=login', { email: 'user@test.com', password: temp });
  ok(r.status === 200, 'temp password works');
  user = r.data.token;
  r = await call('auth?a=password', { current: temp, next: 'newpassword1' }, user);
  ok(r.status === 200, 'user changes password');
  r = await call('auth?a=login', { email: 'user@test.com', password: 'newpassword1' });
  ok(r.status === 200, 'new password works');

  // Payments: off until Stripe keys are set
  r = await call('billing?a=checkout', { plan: 'year' }, user);
  ok(r.status === 503, 'checkout says payments are off');
  process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.STRIPE_PRICE_MONTH = 'price_m'; process.env.STRIPE_PRICE_YEAR = 'price_y';
  r = await call('billing?a=checkout', { plan: 'year' }, user);
  ok(r.status === 200 && r.data.url.startsWith('https://checkout.stripe.com/'), 'checkout link made');
  const cs = stripeCalls.find(c => c.path === 'checkout/sessions');
  ok(cs.body['line_items[0][price]'] === 'price_y' && cs.body['subscription_data[trial_period_days]'] === '7' && cs.body.client_reference_id === uid, 'checkout asks for card with 7-day trial');
  r = await call('auth?a=me', null, user);
  ok(r.data.user.plan === 'free', 'opening checkout does not give Pro');

  // Webhook from Stripe turns Pro on, cancel turns it off
  r = await call('stripe', { id: 'evt_done' });
  ok(r.status === 200, 'webhook accepted');
  r = await call('auth?a=me', null, user);
  ok(r.data.user.plan === 'pro' && r.data.user.proSource === 'trial' && r.data.user.trialUsed && r.data.user.hasBilling, 'paid trial gives Pro');
  r = await call('billing?a=checkout', { plan: 'month' }, user);
  ok(r.status === 409, 'cannot buy twice');
  r = await call('billing?a=portal', {}, user);
  ok(r.status === 200 && r.data.url.includes('billing.stripe.com'), 'manage subscription link');
  subStatus = 'canceled';
  r = await call('stripe', { id: 'evt_cancel' });
  r = await call('auth?a=me', null, user);
  ok(r.data.user.plan === 'free', 'cancelled subscription ends Pro');
  stripeCalls.length = 0;
  await call('billing?a=checkout', { plan: 'month' }, user);
  const cs2 = stripeCalls.find(c => c.path === 'checkout/sessions');
  ok(cs2.body['line_items[0][price]'] === 'price_m' && !cs2.body['subscription_data[trial_period_days]'], 'no second free trial');
  r = await call('stripe', { id: 'not-an-event' });
  ok(r.status === 400, 'junk webhook rejected');

  // AI price estimates, with caching
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  await call('admin?a=user', { id: uid, action: 'reset_usage' }, owner);
  r = await est('iPhone 13', 'check', user);
  ok(r.status === 200 && r.data.typical[0] === 180 && r.data.usage.check === 1, 'AI estimate returned and counted');
  r = await est('iPhone 13', 'check', user);
  ok(r.status === 200 && r.data.typical[0] === 180 && r.data.usage.check === 2, 'cached estimate still counts');

  // Logout and delete
  r = await call('auth?a=logout', {}, user);
  r = await call('auth?a=me', null, user);
  ok(r.status === 401, 'logout ends session');
  r = await call('auth?a=login', { email: 'user@test.com', password: 'newpassword1' });
  user = r.data.token;
  r = await call('auth?a=delete', { password: 'wrong-one' }, user);
  ok(r.status === 400, 'delete needs the right password');
  r = await call('auth?a=delete', { password: 'newpassword1' }, user);
  ok(r.status === 200, 'account deleted');
  ok(stripeCalls.some(c => c.method === 'DELETE' && c.path === 'subscriptions/sub_test1') === false, 'no cancel call for a cancelled plan');
  r = await call('auth?a=login', { email: 'user@test.com', password: 'newpassword1' });
  ok(r.status === 401, 'deleted account cannot log in');
  r = await call('auth?a=delete', { password: 'password123' }, owner);
  ok(r.status === 400, 'owner cannot delete themselves');

  // Login rate limit
  for (let i = 0; i < 10; i++) await call('auth?a=login', { email: 'brute@test.com', password: 'xxxxxxxx' });
  r = await call('auth?a=login', { email: 'brute@test.com', password: 'xxxxxxxx' });
  ok(r.status === 429, 'too many login tries blocked');

  r = await call('auth?a=ping');
  ok(r.status === 200 && r.data.ok, 'ping');
  r = await realFetch(base + '/api/auth?a=me', { method: 'OPTIONS' });
  ok(r.status === 204 && r.headers.get('access-control-allow-origin') === '*', 'CORS preflight for the Android app');

  console.log(`All ${passed} server checks passed`);
  server.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
