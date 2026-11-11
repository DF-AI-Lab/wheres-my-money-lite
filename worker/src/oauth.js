// Connect Claude ONCE with the Google account your 🛂 passport uses (OAuth 2.1 + PKCE, what Claude's connectors speak).
//   Claude -> /authorize (our small page) -> Google sign-in (same Google project as Lite + Passport, scope drive.file)
//   -> /google/callback -> back to Claude with a code -> /token gives Claude its tokens.
// Claude's tokens carry the Google refresh token, sealed (crypto.js). No database.
import {sign, verify, seal, unseal, sha256url} from './crypto.js';

export const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'openid email https://www.googleapis.com/auth/drive.file';

const json = (o, status = 200) => new Response(JSON.stringify(o), {status, headers: {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store'}});
const oops = (error, desc, status = 400) => json({error, error_description: desc}, status);
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// where Claude may send the code back to
export function redirectOk(uri) {
  try {
    const u = new URL(uri);
    if (u.protocol === 'https:' && /(^|\.)claude\.(ai|com)$/.test(u.hostname)) return true;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true;   // MCP Inspector / Claude Code
    return false;
  } catch (e) { return false; }
}

export function metadata(origin) {
  return {
    issuer: origin, authorization_endpoint: origin + '/authorize', token_endpoint: origin + '/token', registration_endpoint: origin + '/register',
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['wmm'],
  };
}
export const resourceMeta = (origin, resource) => ({resource: origin + resource, authorization_servers: [origin], scopes_supported: ['wmm'], bearer_methods_supported: ['header']});

// dynamic client registration: the client id is a signed list of its redirect addresses
export async function register(req, env) {
  let b = {};
  try { b = await req.json(); } catch (e) { /* empty */ }
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
  if (!uris.length || !uris.every(redirectOk)) return oops('invalid_redirect_uri', 'Only Claude (claude.ai / claude.com) or localhost can connect.');
  const client_id = await sign(env, {typ: 'client', ru: uris, exp: Date.now() + 10 * 365 * 86400000});
  return json({client_id, client_name: b.client_name || 'Claude', redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'], token_endpoint_auth_method: 'none', client_id_issued_at: Math.floor(Date.now() / 1000)}, 201);
}

async function checkAuthParams(env, p) {
  if (p.get('response_type') !== 'code') return 'response_type must be code';
  const ru = p.get('redirect_uri') || '';
  if (!redirectOk(ru)) return 'That redirect address is not allowed.';
  const c = await verify(env, p.get('client_id') || '', 'client');
  if (c && !c.ru.includes(ru)) return 'redirect_uri does not match this client.';
  if (!p.get('code_challenge') || (p.get('code_challenge_method') || 'S256') !== 'S256') return 'PKCE (S256) is required.';
  return '';
}

// ---------- the page (WMM dark mint, like the app) ----------
export const page = (inner, status = 200) => new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Claude · Where's My Money?</title><style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1714;color:#e9f3ef;font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;box-sizing:border-box}
.c{width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px;text-align:center;align-items:center}
.logo{width:68px;height:68px;border-radius:20px;background:#1fa88a;color:#fff;display:grid;place-items:center;font-weight:800;font-size:30px}
h1{margin:0;font-size:22px}p{margin:0;color:#9fb3ab}.err{color:#ff7a7a}ul{margin:0;padding-left:20px;text-align:left;color:#c9d8d2}
a.b{display:block;width:100%;box-sizing:border-box;border-radius:14px;padding:14px;background:#5ee0b8;color:#0e1714;font-weight:800;text-decoration:none}
</style></head><body><div class="c"><div class="logo">£</div>${inner}</div></body></html>`,
{status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY'}});

const callbackUrl = origin => origin + '/google/callback';

export async function authorize(req, env) {
  const url = new URL(req.url), p = url.searchParams;
  const bad = await checkAuthParams(env, p);
  if (bad) return page(`<h1>Can't connect</h1><p class="err">${esc(bad)}</p>`, 400);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return page(`<h1>Not set up yet</h1><p class="err">GOOGLE_CLIENT_SECRET is missing on the Worker (see worker/SETUP.md).</p>`, 500);
  const keep = {};
  for (const k of ['redirect_uri', 'client_id', 'code_challenge', 'state']) keep[k] = p.get(k) || '';
  const state = await sign(env, {typ: 'st', p: keep, exp: Date.now() + 15 * 60000});
  const g = new URL(GOOGLE_AUTH);
  g.search = new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(url.origin), response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state}).toString();
  return page(`<h1>Connect Claude to Where's My Money?</h1>
    <p>Sign in with the <b>same Google account your 🛂 passport uses</b>.</p>
    <ul><li>Claude can read your totals and bills</li><li>Claude can add spends, bills, card lines and money in</li><li>Claude can only remove what Claude added</li></ul>
    <p>Changes show up the next time you open the app.</p>
    <a class="b" href="${esc(g.toString())}">Sign in with Google</a>`);
}

function emailFrom(idToken) {                       // straight from Google over HTTPS, so reading it is enough
  try { return String(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))).email || '').toLowerCase(); }
  catch (e) { return ''; }
}
export function emailAllowed(env, email) {
  const list = String(env.ALLOWED_EMAILS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  return !list.length || list.includes(String(email).toLowerCase());
}

export async function googleCallback(req, env) {
  const url = new URL(req.url), q = url.searchParams;
  const st = await verify(env, q.get('state'), 'st');
  if (!st) return page(`<h1>Can't connect</h1><p class="err">That took too long. Start again from Claude.</p>`, 400);
  if (q.get('error') || !q.get('code')) return page(`<h1>Not connected</h1><p>Google sign-in was cancelled. Start again from Claude.</p>`, 400);
  const r = await fetch(GOOGLE_TOKEN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({code: q.get('code'), client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(url.origin), grant_type: 'authorization_code'}).toString()});
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.refresh_token) return page(`<h1>Not connected</h1><p class="err">Google said no (${esc(t.error || r.status)}). Start again from Claude.</p>`, 400);
  if (!String(t.scope || SCOPE).includes('drive.file')) return page(`<h1>Not connected</h1><p class="err">Please tick the Google Drive box on Google's screen. Start again from Claude.</p>`, 400);
  const em = emailFrom(t.id_token || '');
  if (!emailAllowed(env, em)) return page(`<h1>Not this account</h1><p class="err">${esc(em || 'That Google account')} can't connect here. Use your passport's Google account.</p>`, 403);
  const p = st.p;
  const code = await sign(env, {typ: 'code', ru: p.redirect_uri, cid: p.client_id, cc: p.code_challenge, g: await seal(env, t.refresh_token), em, exp: Date.now() + 5 * 60000});
  const back = new URL(p.redirect_uri);
  back.searchParams.set('code', code);
  if (p.state) back.searchParams.set('state', p.state);
  return Response.redirect(back.toString(), 302);
}

async function pair(env, g, em) {
  return {access_token: await sign(env, {typ: 'at', g, em, exp: Date.now() + 3600 * 1000}), token_type: 'Bearer', expires_in: 3600,
    refresh_token: await sign(env, {typ: 'rt', g, em, exp: Date.now() + 180 * 86400000}), scope: 'wmm'};
}
export async function tokenEndpoint(req, env) {
  const ct = req.headers.get('Content-Type') || '';
  const p = ct.includes('json') ? new URLSearchParams(await req.json().catch(() => ({}))) : new URLSearchParams(await req.text());
  const gt = p.get('grant_type');
  if (gt === 'authorization_code') {
    const c = await verify(env, p.get('code'), 'code');
    if (!c) return oops('invalid_grant', 'The code is wrong or too old.');
    if (p.get('redirect_uri') && p.get('redirect_uri') !== c.ru) return oops('invalid_grant', 'redirect_uri does not match.');
    if (!p.get('code_verifier') || await sha256url(p.get('code_verifier')) !== c.cc) return oops('invalid_grant', 'PKCE check failed.');
    return json(await pair(env, c.g, c.em));
  }
  if (gt === 'refresh_token') {
    const r = await verify(env, p.get('refresh_token'), 'rt');
    if (!r || !emailAllowed(env, r.em)) return oops('invalid_grant', 'Please connect again.');
    return json(await pair(env, r.g, r.em));
  }
  return oops('unsupported_grant_type', 'Use authorization_code or refresh_token.');
}

// the Google refresh token for this request, or null = not signed in
export async function whoIs(req, env) {
  const at = await verify(env, (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), 'at');
  if (!at || !emailAllowed(env, at.em)) return null;
  const rt = await unseal(env, at.g);
  return rt ? {rt, email: at.em} : null;
}
