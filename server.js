// Aligned backend — email + 6-digit PIN auth, planner save/load/sync.
// Token-based (Authorization: Bearer <token>), no cookies — reliable inside the
// Android WebView. Data is stored per user as an opaque JSON blob.
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { db, persist } = require('./store');

const app = express();
app.set('trust proxy', 1);
app.use(cors());                       // token auth (no cookies) → any origin is safe
app.use(express.json({ limit: '6mb' }));

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const emailOk = (e) => typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && e.length <= 200;
const pinOk = (p) => typeof p === 'string' && /^\d{6}$/.test(p);

function userByToken(req) {
  const m = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const t = sha(m[1]);
  for (const k in db.users) if ((db.users[k].tokens || []).includes(t)) return db.users[k];
  return null;
}
function auth(req, res, next) {
  const u = userByToken(req);
  if (!u) return res.status(401).json({ error: 'Not signed in' });
  req.user = u;
  next();
}

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 25,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts — wait a few minutes.' },
});

// PIN endpoint doubles as sign-up (first time) and sign-in (after).
app.post('/api/planner/pin', pinLimiter, async (req, res) => {
  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  const pin = String(req.body && req.body.pin || '').trim();
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!pinOk(pin)) return res.status(400).json({ error: 'PIN must be 6 digits.' });

  let u = db.users[email];
  if (!u) {
    u = db.users[email] = { email, pinHash: bcrypt.hashSync(pin, 10), data: null, updatedAt: null, tokens: [] };
  } else if (!u.pinHash || !bcrypt.compareSync(pin, u.pinHash)) {
    return res.status(401).json({ error: 'That email + PIN didn’t match.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  u.tokens = (u.tokens || []).slice(-9);   // keep at most 10 devices signed in
  u.tokens.push(sha(token));
  await persist();
  res.json({ ok: true, token, email: u.email });
});

// Magic-link email sign-in isn't wired to an email service (and wouldn't work in
// a native app anyway) — steer people to the PIN.
app.post('/api/planner/signin', (req, res) =>
  res.status(400).json({ error: 'Sign in with a 6-digit PIN instead.' }));

app.post('/api/account/set-pin', auth, async (req, res) => {
  const pin = String(req.body && req.body.pin || '').trim();
  if (!pinOk(pin)) return res.status(400).json({ error: 'PIN must be 6 digits.' });
  req.user.pinHash = bcrypt.hashSync(pin, 10);
  await persist();
  res.json({ ok: true });
});

// Account + data deletion. Public + rate-limited: the user proves ownership with
// their email + PIN (same check as sign-in), then the whole record is erased.
// Backs the Google Play "request account deletion" URL (/delete-account page).
app.post('/api/account/delete', pinLimiter, async (req, res) => {
  const email = String(req.body && req.body.email || '').trim().toLowerCase();
  const pin = String(req.body && req.body.pin || '').trim();
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!pinOk(pin)) return res.status(400).json({ error: 'PIN must be 6 digits.' });
  const u = db.users[email];
  if (!u || !u.pinHash || !bcrypt.compareSync(pin, u.pinHash)) {
    return res.status(401).json({ error: 'That email + PIN didn’t match.' });
  }
  delete db.users[email];
  await persist();
  res.json({ ok: true });
});

app.post('/auth/signout', (req, res) => {
  const u = userByToken(req);
  const m = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (u && m) { const t = sha(m[1]); u.tokens = (u.tokens || []).filter((x) => x !== t); persist(); }
  res.json({ ok: true });
});

app.get('/api/planner', auth, (req, res) =>
  res.json({ email: req.user.email, data: req.user.data, updatedAt: req.user.updatedAt }));

app.post('/api/planner', auth, async (req, res) => {
  const data = req.body && req.body.data;
  if (typeof data === 'undefined') return res.status(400).json({ error: 'No data' });
  if (Buffer.byteLength(JSON.stringify(data)) > 5 * 1024 * 1024) return res.status(413).json({ error: 'Too large' });
  req.user.data = data;
  req.user.updatedAt = new Date().toISOString();
  await persist();
  res.json({ ok: true, updatedAt: req.user.updatedAt });
});

// Planner-sharing ("connect planners") — not built yet; return empty so the UI stays calm.
app.get('/api/planner/links', auth, (req, res) => res.json({ links: [], incoming: [], outgoing: [] }));
app.post('/api/planner/links', auth, (req, res) => res.json({ ok: true }));
app.get('/api/planner/availability', auth, (req, res) => res.json({ email: req.query.email || '', days: {} }));

// Public privacy policy (required for the Google Play store listing).
app.get(['/privacy', '/privacy-policy'], (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));

// Public account + data deletion page (required by Google Play Data Safety).
app.get(['/delete-account', '/delete', '/account/delete'], (req, res) =>
  res.sendFile(path.join(__dirname, 'delete-account.html')));

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Aligned backend listening on :' + PORT));
