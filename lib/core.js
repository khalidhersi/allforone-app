// ALL FOR ONE server helpers: responses, database, accounts, sessions, limits, Stripe.
const crypto = require('crypto');

/* ---------- responses ---------- */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}
function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(data));
}
function fail(status, message, extra) {
  return Object.assign(new Error(message), { status, expose: true, extra });
}
async function readBody(req) {
  try {
    const b = req.body;
    if (b !== undefined && b !== null) {
      if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8') || '{}');
      if (typeof b === 'string') return JSON.parse(b || '{}');
      if (typeof b === 'object') return b;
    }
  } catch (e) { return {}; }
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 100000) throw fail(413, 'Request too large.');
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}
/* One function per file; ?a=<action> picks the handler, keyed "METHOD action". */
function route(handlers) {
  return async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    const q = new URL(req.url, 'http://local').searchParams;
    const h = handlers[`${req.method} ${q.get('a') || ''}`];
    try {
      if (!h) throw fail(404, 'Not found.');
      const body = req.method === 'POST' ? await readBody(req) : {};
      const out = await h({ req, res, q, body });
      if (!res.writableEnded) send(res, 200, out || { ok: true });
    } catch (e) {
      if (!e.expose) console.error(e);
      send(res, e.status || 500, Object.assign({ error: e.expose ? e.message : 'Something went wrong. Try again.' }, e.extra || {}));
    }
  };
}
const ip = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';

/* ---------- database: Upstash Redis over REST, or in memory for local tests ---------- */
const DB_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const MEMORY = !!process.env.AFO_MEMORY_DB;
const dbReady = () => MEMORY || !!(DB_URL && DB_TOKEN);
const dbKind = () => (MEMORY ? 'memory' : dbReady() ? 'redis' : 'none');

const mem = new Map(), memExp = new Map();
function mget(k) {
  const e = memExp.get(k);
  if (e && e < Date.now()) { mem.delete(k); memExp.delete(k); }
  return mem.get(k);
}
function memCmd(cmd) {
  const op = String(cmd[0]).toUpperCase(), a = cmd.slice(1).map(String), k = a[0];
  const coll = (Type) => { let v = mget(k); if (!(v instanceof Type)) { v = new Type(); mem.set(k, v); } return v; };
  switch (op) {
    case 'GET': { const v = mget(k); return typeof v === 'string' ? v : null; }
    case 'MGET': return a.map(x => { const v = mget(x); return typeof v === 'string' ? v : null; });
    case 'SET': {
      const opts = a.slice(2).map(x => x.toUpperCase());
      if (opts.includes('NX') && mget(k) !== undefined) return null;
      mem.set(k, a[1]); memExp.delete(k);
      const ex = opts.indexOf('EX'); if (ex >= 0) memExp.set(k, Date.now() + Number(a[2 + ex + 1]) * 1000);
      return 'OK';
    }
    case 'DEL': { let n = 0; for (const x of a) { if (mget(x) !== undefined) n++; mem.delete(x); memExp.delete(x); } return n; }
    case 'EXPIRE': { if (mget(k) === undefined) return 0; memExp.set(k, Date.now() + Number(a[1]) * 1000); return 1; }
    case 'INCR': { const v = Number(mget(k) || 0) + 1; mem.set(k, String(v)); return v; }
    case 'HINCRBY': { const h = coll(Map); const v = Number(h.get(a[1]) || 0) + Number(a[2]); h.set(a[1], String(v)); return v; }
    case 'HGETALL': { const h = mget(k); return h instanceof Map ? [...h].flat() : []; }
    case 'SADD': { const s = coll(Set); let n = 0; for (const x of a.slice(1)) if (!s.has(x)) { s.add(x); n++; } return n; }
    case 'SREM': { const s = mget(k); let n = 0; if (s instanceof Set) for (const x of a.slice(1)) if (s.delete(x)) n++; return n; }
    case 'SMEMBERS': { const s = mget(k); return s instanceof Set ? [...s] : []; }
    case 'ZADD': { const z = coll(Map); const had = z.has(a[2]); z.set(a[2], Number(a[1])); return had ? 0 : 1; }
    case 'ZREM': { const z = mget(k); let n = 0; if (z instanceof Map) for (const x of a.slice(1)) if (z.delete(x)) n++; return n; }
    case 'ZCARD': { const z = mget(k); return z instanceof Map ? z.size : 0; }
    case 'ZREVRANGE': {
      const z = mget(k); if (!(z instanceof Map)) return [];
      const all = [...z].sort((x, y) => y[1] - x[1]).map(x => x[0]);
      const stop = Number(a[2]); return all.slice(Number(a[1]), stop < 0 ? all.length + stop + 1 : stop + 1);
    }
    default: throw new Error('Memory database does not support ' + op);
  }
}
/* db(['GET','k'], ['SET','k','v']) -> [result, result] */
async function db(...cmds) {
  if (!cmds.length) return [];
  if (MEMORY) return cmds.map(memCmd);
  if (!dbReady()) throw fail(503, 'The server isn’t finished setting up yet (no database connected).');
  let r;
  try {
    r = await fetch(DB_URL + '/pipeline', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + DB_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify(cmds.map(c => c.map(String))),
    });
  } catch (e) { throw fail(503, 'The database is not reachable right now. Try again.'); }
  if (!r.ok) throw fail(503, 'The database is not reachable right now. Try again.');
  const out = await r.json();
  return out.map(x => { if (x && x.error) throw new Error('Database error: ' + x.error); return x.result; });
}
const db1 = async (...cmd) => (await db(cmd))[0];
const pairs = arr => { const o = {}; for (let i = 0; arr && i < arr.length; i += 2) o[arr[i]] = Number(arr[i + 1]); return o; };
const today = () => new Date().toISOString().slice(0, 10);

async function limitRate(key, max, seconds) {
  const n = await db1('INCR', 'rl:' + key);
  if (n === 1) await db1('EXPIRE', 'rl:' + key, seconds);
  if (n > max) throw fail(429, 'Too many tries. Wait a few minutes and try again.');
}

/* ---------- accounts ---------- */
const normEmail = e => String(e || '').trim().toLowerCase();
const validEmail = e => e.length <= 254 && /^[a-z0-9._%+'-]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/.test(e);
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(String(pw), salt, 64, (e, k) => (e ? no(e) : ok(k))));
async function hashPw(pw) { const salt = crypto.randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + (await scrypt(pw, salt)).toString('hex'); }
async function checkPw(pw, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const got = await scrypt(pw, Buffer.from(salt, 'hex')), want = Buffer.from(hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const DUMMY_HASH = 'scrypt$' + '0'.repeat(32) + '$' + '0'.repeat(128);
function tempPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = ''; for (let i = 0; i < 10; i++) s += abc[crypto.randomInt(abc.length)];
  return s;
}

async function getUser(id) { const s = id ? await db1('GET', 'user:' + id) : null; return s ? JSON.parse(s) : null; }
async function saveUser(u) { const { _token, ...rest } = u; await db1('SET', 'user:' + u.id, JSON.stringify(rest)); }
async function userByEmail(email) { const id = await db1('GET', 'email:' + normEmail(email)); return id ? getUser(id) : null; }

const adminEmails = () => String(process.env.ADMIN_EMAILS || '').split(',').map(normEmail).filter(Boolean);
const isAdmin = u => !!u && (u.role === 'owner' || u.role === 'admin' || adminEmails().includes(u.email));
const PRO_STATUSES = ['trialing', 'active', 'past_due'];
const isPro = u => !!u && !u.debugFree && (isAdmin(u) || !!u.compPro || PRO_STATUSES.includes(u.subStatus));
function proSource(u) {
  if (u.debugFree) return 'testing';
  if (isAdmin(u)) return 'admin';
  if (u.compPro) return 'gift';
  if (u.subStatus === 'trialing') return 'trial';
  if (PRO_STATUSES.includes(u.subStatus)) return 'subscription';
  return null;
}
function publicUser(u) {
  return {
    id: u.id, email: u.email, plan: isPro(u) ? 'pro' : 'free', proSource: proSource(u),
    isAdmin: isAdmin(u), role: u.role || 'user', trialUsed: !!u.trialUsed,
    hasBilling: !!u.stripeCustomer, debugFree: !!u.debugFree, createdAt: u.createdAt,
  };
}
function adminView(u) {
  return Object.assign(publicUser(u), { lastSeen: u.lastSeen || u.createdAt, compPro: !!u.compPro, subStatus: u.subStatus || null });
}

/* ---------- sessions ---------- */
const SESSION_TTL = 30 * 86400;
async function createSession(u) {
  const t = crypto.randomBytes(32).toString('hex');
  await db(['SET', 'sess:' + t, u.id, 'EX', SESSION_TTL], ['SADD', 'sessions:' + u.id, t], ['EXPIRE', 'sessions:' + u.id, SESSION_TTL * 2]);
  return t;
}
async function auth(req) {
  const h = String(req.headers.authorization || '');
  const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!/^[a-f0-9]{64}$/.test(t)) throw fail(401, 'Please log in again.');
  const u = await getUser(await db1('GET', 'sess:' + t));
  if (!u) throw fail(401, 'Please log in again.');
  u._token = t;
  return u;
}
async function endSessions(u, keep) {
  const ts = (await db1('SMEMBERS', 'sessions:' + u.id)) || [];
  const gone = ts.filter(t => t !== keep);
  await db(...gone.map(t => ['DEL', 'sess:' + t]), ...(gone.length ? [['SREM', 'sessions:' + u.id, ...gone]] : []));
}

/* ---------- daily limits ---------- */
const LIMITS = { free: { search: 3, check: 3, alerts: 1 }, pro: { search: 300, check: 150, alerts: 30 } };
const limitsFor = u => (isPro(u) ? LIMITS.pro : LIMITS.free);
async function getUsage(u) { const o = pairs(await db1('HGETALL', `usage:${u.id}:${today()}`)); return { search: o.search || 0, check: o.check || 0 }; }
async function spend(u, kind) {
  const key = `usage:${u.id}:${today()}`;
  const [n] = await db(['HINCRBY', key, kind, 1], ['EXPIRE', key, 2 * 86400]);
  if (n > limitsFor(u)[kind]) {
    await db1('HINCRBY', key, kind, -1);
    const what = kind === 'check' ? 'price checks' : 'searches';
    throw fail(402, isPro(u) ? `You’ve hit today’s fair-use limit for ${what}. It resets tomorrow.` : `You’ve used today’s free ${what}.`, { reason: 'limit', kind });
  }
  await db(['HINCRBY', 'stats:' + today(), kind === 'check' ? 'checks' : 'searches', 1], ['EXPIRE', 'stats:' + today(), 40 * 86400]);
}
async function refund(u, kind) { await db1('HINCRBY', `usage:${u.id}:${today()}`, kind, -1); }
async function state(u) { return { user: publicUser(u), usage: await getUsage(u), limits: limitsFor(u) }; }
async function session(u) { const token = await createSession(u); return Object.assign({ token }, await state(u)); }

/* ---------- alerts ---------- */
async function getAlerts(u) { const s = await db1('GET', 'alerts:' + u.id); return s ? JSON.parse(s) : []; }
async function saveAlerts(u, list) { await db1('SET', 'alerts:' + u.id, JSON.stringify(list)); }

/* ---------- Stripe ---------- */
const paymentsReady = () => !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_MONTH && process.env.STRIPE_PRICE_YEAR);
async function stripe(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw fail(503, 'Payments aren’t switched on yet.');
  let url = 'https://api.stripe.com/v1/' + path;
  const opts = { method, headers: { Authorization: 'Bearer ' + key } };
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (method === 'GET') url += '?' + qs;
    else { opts.headers['content-type'] = 'application/x-www-form-urlencoded'; opts.body = qs; }
  }
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw fail(502, 'Payment service error' + (j.error && j.error.message ? ': ' + j.error.message : '.'));
  return j;
}
function applySub(u, sub) {
  u.subId = sub.id;
  u.subStatus = sub.status;
  if (sub.customer) u.stripeCustomer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  if (sub.trial_start || sub.status === 'trialing') u.trialUsed = true;
}
// Where Stripe sends people back to. Uses your settings first, so a spoofed Host header can't change it.
const appBase = req => (process.env.APP_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '')
  || 'https://' + (req.headers['x-forwarded-host'] || req.headers.host)).replace(/\/$/, '');

async function removeUser(u) {
  if (u.subId && PRO_STATUSES.includes(u.subStatus) && process.env.STRIPE_SECRET_KEY) {
    try { await stripe('DELETE', 'subscriptions/' + u.subId); } catch (e) { console.error('Could not cancel subscription', e.message); }
  }
  await endSessions(u);
  await db(['DEL', 'user:' + u.id, 'email:' + u.email, 'alerts:' + u.id, 'sessions:' + u.id], ['ZREM', 'users', u.id],
    ...(u.stripeCustomer ? [['DEL', 'cust:' + u.stripeCustomer]] : []));
}

module.exports = {
  cors, send, fail, readBody, route, ip,
  db, db1, dbReady, dbKind, pairs, today, limitRate,
  normEmail, validEmail, hashPw, checkPw, DUMMY_HASH, tempPassword,
  getUser, saveUser, userByEmail, adminEmails, isAdmin, isPro, publicUser, adminView,
  SESSION_TTL, createSession, auth, endSessions,
  LIMITS, limitsFor, getUsage, spend, refund, state, session,
  getAlerts, saveAlerts,
  paymentsReady, stripe, applySub, appBase, removeUser,
};
