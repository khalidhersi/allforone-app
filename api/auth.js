// ALL FOR ONE accounts: sign up, log in, who am I, log out, change password, delete account.
const crypto = require('crypto');
const C = require('../lib/core');

module.exports = C.route({
  'GET ping': async () => ({ ok: true, app: 'allforone', db: C.dbReady() }),

  'POST signup': async ({ req, body }) => {
    const email = C.normEmail(body.email), pw = String(body.password || '');
    if (!C.validEmail(email)) throw C.fail(400, 'Enter a valid email address.');
    if (pw.length < 8) throw C.fail(400, 'Use at least 8 characters for your password.');
    if (pw.length > 200) throw C.fail(400, 'That password is too long.');
    await C.limitRate('signup:' + C.ip(req), 20, 3600);
    const hash = await C.hashPw(pw);
    const id = crypto.randomUUID();
    if ((await C.db1('SET', 'email:' + email, id, 'NX')) !== 'OK') throw C.fail(409, 'That email already has an account. Log in instead.');
    // The very first account becomes the owner (admin) of this app.
    const owner = (await C.db1('SET', 'owner', id, 'NX')) === 'OK';
    const now = Date.now();
    const u = { id, email, pw: hash, role: owner ? 'owner' : 'user', createdAt: now, lastSeen: now };
    await C.saveUser(u);
    await C.db(['ZADD', 'users', now, id], ['HINCRBY', 'stats:' + C.today(), 'signups', 1], ['EXPIRE', 'stats:' + C.today(), 40 * 86400]);
    return C.session(u);
  },

  'POST login': async ({ body }) => {
    const email = C.normEmail(body.email), pw = String(body.password || '');
    if (!email || !pw) throw C.fail(400, 'Enter your email and password.');
    await C.limitRate('login:' + email, 10, 900);
    const u = await C.userByEmail(email);
    const ok = await C.checkPw(pw, u ? u.pw : C.DUMMY_HASH);
    if (!u || !ok) throw C.fail(401, 'Wrong email or password.');
    u.lastSeen = Date.now();
    await C.saveUser(u);
    return C.session(u);
  },

  'GET me': async ({ req }) => {
    const u = await C.auth(req);
    u.lastSeen = Date.now();
    await C.saveUser(u);
    await C.db1('EXPIRE', 'sess:' + u._token, C.SESSION_TTL);
    return C.state(u);
  },

  'POST logout': async ({ req }) => {
    let u = null;
    try { u = await C.auth(req); } catch (e) { return { ok: true }; }
    await C.db(['DEL', 'sess:' + u._token], ['SREM', 'sessions:' + u.id, u._token]);
    return { ok: true };
  },

  'POST password': async ({ req, body }) => {
    const u = await C.auth(req);
    const next = String(body.next || '');
    if (!(await C.checkPw(String(body.current || ''), u.pw))) throw C.fail(400, 'Your current password is wrong.');
    if (next.length < 8) throw C.fail(400, 'Use at least 8 characters for your new password.');
    if (next.length > 200) throw C.fail(400, 'That password is too long.');
    u.pw = await C.hashPw(next);
    await C.saveUser(u);
    await C.endSessions(u, u._token); // sign out other devices
    return { ok: true };
  },

  'POST delete': async ({ req, body }) => {
    const u = await C.auth(req);
    if (u.role === 'owner') throw C.fail(400, 'The owner account can’t be deleted.');
    if (!(await C.checkPw(String(body.password || ''), u.pw))) throw C.fail(400, 'That password is wrong.');
    await C.removeUser(u);
    return { ok: true };
  },
});
