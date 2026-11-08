// node --test worker/test/   (node 22, no installs). A fake Google + fake Drive stand in for the real ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {newId, fileFor} from '../src/tools.js';
import {sha256url} from '../src/crypto.js';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const M = require('../../docs/demo/money.js');                    // the app's own maths: jobs must work in the real app

// ---------- fake Google ----------
let files, calls, google;
function reset() {
  files = {
    s1: {id: 's1', name: 'wmm-summary.json', parents: ['wmmdir'], modifiedTime: '2026-11-08T09:00:00Z',
      body: JSON.stringify({updated: '2026-11-08T09:00:00Z', spare: 120.5, spent: 300, to_come_out: 45, pots: [{name: 'Food', budget: 200, used: 80}],
        card: {used: 150, free: 350}, bills: [{name: 'Phone', amount: 20, day: 3, paid: true}, {name: 'Gym', amount: 25, day: 'varies', paid: false}],
        added: [{id: 'c-20261101-090000-aaaaaa', kind: 'spend', name: 'Costa', amount: 3.2}]})},
    d1: {id: 'd1', name: 'wmm-demo-summary.json', parents: ['demodir'], modifiedTime: '2026-11-08T09:00:00Z', body: JSON.stringify({spare: 1})},
  };
  calls = [];
  google = {refresh: 'g-refresh', email: 'darren@example.com', scope: 'openid email https://www.googleapis.com/auth/drive.file'};
}
let n = 0;
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); calls.push({url, opts});
  const ok = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'Content-Type': 'application/json'}});
  if (url === 'https://oauth2.googleapis.com/token') {
    const p = new URLSearchParams(opts.body);
    assert.equal(p.get('client_secret'), 'shh-secret');
    if (p.get('grant_type') === 'authorization_code') {
      const idt = 'x.' + Buffer.from(JSON.stringify({email: google.email})).toString('base64url') + '.y';
      return ok({access_token: 'g-at', refresh_token: google.refresh, id_token: idt, scope: google.scope, expires_in: 3600});
    }
    if (p.get('refresh_token') !== google.refresh) return ok({error: 'invalid_grant'}, 400);
    return ok({access_token: 'g-at', expires_in: 3600});
  }
  assert.equal(opts.headers.Authorization, 'Bearer g-at');
  const u = new URL(url);
  if (u.pathname === '/drive/v3/files' && (opts.method || 'GET') === 'GET') {
    const q = u.searchParams.get('q');
    assert.match(q, /trashed=false/);
    let m = q.match(/name='([^']+)'/), list;
    if (m) list = Object.values(files).filter(f => f.name === m[1]);
    else { m = q.match(/name contains '([^']+)'/); list = Object.values(files).filter(f => f.name.includes(m[1])); }
    return ok({files: list.map(({body, ...f}) => f)});
  }
  if (u.pathname === '/upload/drive/v3/files' && opts.method === 'POST') {
    const meta = JSON.parse(opts.body.split('\r\n\r\n')[1].split('\r\n')[0]);
    const content = opts.body.split('\r\n\r\n')[2].split('\r\n--')[0];
    const id = 'j' + (++n);
    files[id] = {id, name: meta.name, parents: meta.parents, modifiedTime: '2026-11-08T10:00:00Z', body: content};
    return ok({id});
  }
  const fm = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
  if (fm) {
    const f = files[decodeURIComponent(fm[1])];
    if (!f) return new Response('nope', {status: 404});
    if (opts.method === 'DELETE') { delete files[f.id]; return new Response(null, {status: 204}); }
    if (u.searchParams.get('alt') === 'media') return new Response(f.body, {status: 200});
  }
  return new Response('{}', {status: 404});
};

const env = {GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'shh-secret', TOKEN_SECRET: 'a-long-secret-for-tests-only'};
const W = 'https://wmm.test';
const call = (path, init = {}, e = env) => worker.fetch(new Request(W + path, init), e);
const jobs = () => Object.values(files).filter(f => /^wmm(-demo)?-job-/.test(f.name));

// the whole connect dance, like Claude does it
async function connect(e = env) {
  const reg = await (await call('/register', {method: 'POST', body: JSON.stringify({redirect_uris: ['https://claude.ai/api/mcp/auth_callback']})}, e)).json();
  const verifier = 'v'.repeat(50), challenge = await sha256url(verifier);
  const q = new URLSearchParams({response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
    code_challenge: challenge, code_challenge_method: 'S256', state: 'claude-state'});
  const page = await (await call('/authorize?' + q, {}, e)).text();
  const gUrl = new URL(page.match(/href="([^"]+accounts\.google\.com[^"]+)"/)[1].replace(/&amp;/g, '&'));
  assert.equal(gUrl.searchParams.get('access_type'), 'offline');
  assert.match(gUrl.searchParams.get('scope'), /drive\.file/);
  assert.equal(gUrl.searchParams.get('redirect_uri'), W + '/google/callback');
  const back = await call('/google/callback?' + new URLSearchParams({code: 'google-code', state: gUrl.searchParams.get('state')}), {}, e);
  if (back.status !== 302) return {fail: back};
  const to = new URL(back.headers.get('Location'));
  assert.equal(to.origin + to.pathname, 'https://claude.ai/api/mcp/auth_callback');
  assert.equal(to.searchParams.get('state'), 'claude-state');
  const tok = await (await call('/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'authorization_code', code: to.searchParams.get('code'), code_verifier: verifier,
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback'}).toString()}, e)).json();
  return tok;
}
const rpc = (tok, method, params, path = '/mcp') => call(path, {method: 'POST', headers: {Authorization: 'Bearer ' + tok.access_token, 'Content-Type': 'application/json'},
  body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})}).then(r => r.json());
const tool = async (tok, name, args, path) => (await rpc(tok, 'tools/call', {name, arguments: args}, path)).result;

// ---------- tests ----------
test('no token = 401 pointing Claude at the login', async () => {
  reset();
  const r = await call('/mcp', {method: 'POST', body: '{}'});
  assert.equal(r.status, 401);
  assert.match(r.headers.get('WWW-Authenticate'), /oauth-protected-resource\/mcp/);
  const meta = await (await call('/.well-known/oauth-protected-resource/demo/mcp')).json();
  assert.equal(meta.resource, W + '/demo/mcp');
});

test('connect with Google: the token never shows the Google refresh token', async () => {
  reset();
  const tok = await connect();
  assert.ok(tok.access_token && tok.refresh_token);
  assert.ok(!Buffer.from(tok.access_token.split('.')[0], 'base64url').toString().includes('g-refresh'));
  const init = await rpc(tok, 'initialize', {protocolVersion: '2025-06-18'});
  assert.equal(init.result.serverInfo.name, 'wmm-lite');
  const list = await rpc(tok, 'tools/list');
  assert.deepEqual(list.result.tools.map(t => t.name), ['money_summary', 'add_spend', 'add_bill', 'card_spend', 'card_paid_off', 'remove_added']);
  const again = await (await call('/token', {method: 'POST', body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: tok.refresh_token}).toString()})).json();
  assert.ok(again.access_token);
});

test('ALLOWED_EMAILS: another Google account cannot connect', async () => {
  reset(); google.email = 'stranger@example.com';
  const r = await connect(Object.assign({}, env, {ALLOWED_EMAILS: 'darren@example.com'}));
  assert.equal(r.fail.status, 403);
});

test('no Drive tick on Google = not connected', async () => {
  reset(); google.scope = 'openid email';
  const r = await connect();
  assert.equal(r.fail.status, 400);
  assert.match(await r.fail.text(), /Drive box/);
});

test('bad PKCE / bad redirect are refused', async () => {
  reset();
  const r = await call('/register', {method: 'POST', body: JSON.stringify({redirect_uris: ['https://evil.example/cb']})});
  assert.equal(r.status, 400);
  const t = await call('/token', {method: 'POST', body: 'grant_type=authorization_code&code=nonsense&code_verifier=x'});
  assert.equal((await t.json()).error, 'invalid_grant');
});

test('money_summary reads the summary, the bills and what Claude added', async () => {
  reset();
  const tok = await connect();
  const r = await tool(tok, 'money_summary', {});
  assert.equal(r.isError, false);
  const t = r.content[0].text;
  assert.match(t, /Spare cash left: £120\.50/);
  assert.match(t, /Credit card: £150\.00 used, £350\.00 free/);
  assert.match(t, /Food: £80\.00 used of £200\.00/);
  assert.match(t, /Phone: £20\.00, day 3, paid/);
  assert.match(t, /Gym: £25\.00, day varies, not paid yet/);
  assert.match(t, /\[c-20261101-090000-aaaaaa\] £3\.20 Costa/);
});

test('add_spend drops a job next to the summary that the REAL app accepts', async () => {
  reset();
  const tok = await connect();
  const r = await tool(tok, 'add_spend', {amount: 12.5, name: 'Tesco'});
  assert.equal(r.isError, false, r.content[0].text);
  assert.match(r.content[0].text, /Sent: £12\.50 Tesco\. id c-\d{8}-\d{6}-[a-z0-9]+/);
  const [f] = jobs();
  assert.deepEqual(f.parents, ['wmmdir']);
  assert.equal(M.jobOrder([f]).length, 1, 'file name matches the app\'s pattern');
  const job = JSON.parse(f.body);
  const s = M.TEMPLATE();
  const res = M.applyJob(s, job, '2026-11-08');
  assert.equal(res.done, true, JSON.stringify(res));
  assert.equal(res.note, 'Added by Claude: £12.50 Tesco');
  assert.equal(s.spends.at(-1).job, job.id);
});

test('every add kind works in the real app, and remove takes it back', async () => {
  reset();
  const tok = await connect();
  await tool(tok, 'add_spend', {amount: 40, name: 'MOT', upcoming: true, date: '2026-11-20'});
  await tool(tok, 'add_bill', {amount: '9.99', name: 'Netflix', day: 15});
  await tool(tok, 'card_spend', {amount: 30, name: 'Amazon'});
  await tool(tok, 'card_paid_off', {amount: 50});
  const s = M.FAKE ? M.FAKE() : M.TEMPLATE();
  const js = jobs().map(f => JSON.parse(f.body)).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(js.length, 4);
  for (const j of js) {
    const r = M.applyJob(s, j, '2026-11-08');
    assert.equal(r.done, true, j.kind + ': ' + JSON.stringify(r));
  }
  jobs().forEach(f => delete files[f.id]);                         // the app deletes each file it used
  const bill = s.bills.find(b => b.name === 'Netflix');
  assert.equal(bill.due, 15);
  // remove the (already applied) bill: the Worker sends a remove job
  const r = await tool(tok, 'remove_added', {id: bill.job});
  assert.match(r.content[0].text, /Sent: remove/);
  const rm = jobs().map(f => JSON.parse(f.body)).find(j => j.kind === 'remove_spend');
  assert.equal(M.applyJob(s, rm, '2026-11-08').done, true);
  assert.equal(s.bills.some(b => b.name === 'Netflix'), false);
});

test('remove_added of a change still waiting just deletes the file', async () => {
  reset();
  const tok = await connect();
  const r = await tool(tok, 'add_spend', {amount: 5, name: 'Greggs'});
  const id = r.content[0].text.match(/id (c-[\w-]+)/)[1];
  const sum = (await tool(tok, 'money_summary', {})).content[0].text;
  assert.match(sum, /Waiting for the app to open[\s\S]*Greggs/);
  const back = await tool(tok, 'remove_added', {id});
  assert.match(back.content[0].text, /Taken back/);
  assert.equal(jobs().length, 0);
});

test('Claude cannot remove things Darren added', async () => {
  reset();
  const tok = await connect();
  const r = await tool(tok, 'remove_added', {id: '3'});
  assert.equal(r.isError, true);
  assert.equal(jobs().length, 0);
});

test('bad input is refused with a clear message, nothing written', async () => {
  reset();
  const tok = await connect();
  for (const [name, args, re] of [['add_spend', {amount: -3, name: 'x'}, /amount/], ['add_spend', {amount: 3, name: '  '}, /name/],
    ['add_spend', {amount: 3, name: 'x', date: '2026-02-30'}, /date/], ['add_bill', {amount: 3, name: 'x', day: 32}, /day/]]) {
    const r = await tool(tok, name, args);
    assert.equal(r.isError, true, name);
    assert.match(r.content[0].text, re);
  }
  assert.equal(jobs().length, 0);
});

test('demo address uses the demo files only', async () => {
  reset();
  const tok = await connect();
  const init = await rpc(tok, 'initialize', {}, '/demo/mcp');
  assert.match(init.result.instructions, /DEMO/);
  await tool(tok, 'add_spend', {amount: 1, name: 'Test'}, '/demo/mcp');
  const [f] = jobs();
  assert.match(f.name, /^wmm-demo-job-/);
  assert.deepEqual(f.parents, ['demodir']);
  assert.equal(M.jobOrder([f], true).length, 1);
});

test('no summary yet = a plain message, nothing written', async () => {
  reset(); delete files.s1;
  const tok = await connect();
  assert.match((await tool(tok, 'money_summary', {})).content[0].text, /open Where's My Money\? Lite once/);
  const r = await tool(tok, 'add_spend', {amount: 1, name: 'x'});
  assert.equal(r.isError, true);
  assert.equal(jobs().length, 0);
});

test('ids and file names match the app', () => {
  const id = newId(new Date('2026-11-08T10:15:00Z'), () => 0);
  assert.equal(id, 'c-20261108-101500-aaaaaa');
  assert.equal(fileFor('wmm-job-', id), 'wmm-job-20261108-101500-aaaaaa.json');
});

test('DF apps on GitHub Pages may connect (Luna Offline); other sites may not', async () => {
  const {redirectOk} = await import('../src/oauth.js');
  assert.equal(redirectOk('https://df-ai-lab.github.io/Luna_offline/'), true);
  assert.equal(redirectOk('http://df-ai-lab.github.io/Luna_offline/'), false);
  assert.equal(redirectOk('https://df-ai-lab.github.io.evil.example/'), false);
  assert.equal(redirectOk('https://evil.github.io/'), false);
});
