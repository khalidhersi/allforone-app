// ALL FOR ONE admin: server status, users, and support actions. Admins only.
const C = require('../lib/core');

async function requireAdmin(req) {
  const u = await C.auth(req);
  if (!C.isAdmin(u)) throw C.fail(403, 'Admins only.');
  return u;
}
async function withUsage(users) {
  const usages = await C.db(...users.map(u => ['HGETALL', `usage:${u.id}:${C.today()}`]));
  return users.map((u, i) => Object.assign(C.adminView(u), { usage: C.pairs(usages[i]) }));
}

module.exports = C.route({
  'GET health': async ({ req }) => {
    const me = await requireAdmin(req);
    const stats = C.pairs(await C.db1('HGETALL', 'stats:' + C.today()));
    return {
      db: C.dbReady(), dbKind: C.dbKind(),
      prices: !!process.env.ANTHROPIC_API_KEY,
      payments: C.paymentsReady(),
      users: await C.db1('ZCARD', 'users'),
      today: { signups: stats.signups || 0, searches: stats.searches || 0, checks: stats.checks || 0 },
      you: { role: me.role || 'user' },
    };
  },

  'GET users': async ({ req, q }) => {
    await requireAdmin(req);
    const find = String(q.get('q') || '').trim().toLowerCase();
    const ids = (await C.db1('ZREVRANGE', 'users', 0, 499)) || [];
    const raw = ids.length ? await C.db1('MGET', ...ids.map(id => 'user:' + id)) : [];
    let users = raw.filter(Boolean).map(s => JSON.parse(s));
    const pro = users.filter(C.isPro).length;
    if (find) users = users.filter(u => u.email.includes(find));
    return { total: ids.length, pro, users: await withUsage(users.slice(0, 100)) };
  },

  'POST user': async ({ req, body }) => {
    const me = await requireAdmin(req);
    const t = await C.getUser(String(body.id || ''));
    if (!t) throw C.fail(404, 'User not found.');
    const targetOwner = t.role === 'owner', iAmOwner = me.role === 'owner', self = t.id === me.id;
    const act = String(body.action || '');
    if (targetOwner && !iAmOwner && act !== 'reset_usage') throw C.fail(403, 'Only the owner can change the owner account.');

    switch (act) {
      case 'grant_pro': t.compPro = true; break;
      case 'revoke_pro': t.compPro = false; break;
      case 'reset_usage': await C.db1('DEL', `usage:${t.id}:${C.today()}`); break;
      case 'test_free':
        if (!self) throw C.fail(400, 'You can only switch this for your own account.');
        t.debugFree = !!body.on; break;
      case 'signout':
        if (self) throw C.fail(400, 'Use Log out for your own account.');
        await C.endSessions(t); break;
      case 'reset_password': {
        if (self) throw C.fail(400, 'Use Change password for your own account.');
        const temp = C.tempPassword();
        t.pw = await C.hashPw(temp);
        await C.saveUser(t);
        await C.endSessions(t);
        return { user: (await withUsage([t]))[0], tempPassword: temp };
      }
      case 'make_admin':
      case 'remove_admin':
        if (!iAmOwner) throw C.fail(403, 'Only the owner can change admins.');
        if (targetOwner) throw C.fail(400, 'The owner is always an admin.');
        t.role = act === 'make_admin' ? 'admin' : 'user'; break;
      case 'delete':
        if (targetOwner) throw C.fail(400, 'The owner account can’t be deleted.');
        if (self) throw C.fail(400, 'You can’t delete your own account here.');
        await C.removeUser(t);
        return { deleted: true };
      default: throw C.fail(400, 'Unknown action.');
    }
    await C.saveUser(t);
    return { user: (await withUsage([t]))[0] };
  },
});
