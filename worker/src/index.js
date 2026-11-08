// Where's My Money? Lite — the MCP server for Claude (a free Cloudflare Worker, like TaskNotes).
//   /mcp        Claude, your REAL money (wmm-summary.json + wmm-job-*.json in your Drive)
//   /demo/mcp   Claude, the DEMO money (wmm-demo-summary.json + wmm-demo-job-*.json) = safe to try
//   /authorize, /google/callback, /token, /register, /.well-known/*   connect once with your passport's Google account
// Lite itself has no server: this Worker never sees the scrambled backups, only the plain summary and the inbox.
import * as oauth from './oauth.js';
import {accessToken, drive} from './drive.js';
import {TOOLS, runTool} from './tools.js';

export const VERSION = '0.1.0';
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version', 'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate'};
const json = (o, status, extra) => new Response(JSON.stringify(o), {status: status || 200, headers: Object.assign({'Content-Type': 'application/json', 'Cache-Control': 'no-store'}, CORS, extra || {})});

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, '') || '/', origin = url.origin;
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
    try {
      if (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/openid-configuration') return json(oauth.metadata(origin));
      if (path.startsWith('/.well-known/oauth-protected-resource')) {
        const rest = path.slice('/.well-known/oauth-protected-resource'.length);
        return json(oauth.resourceMeta(origin, rest === '/demo/mcp' ? '/demo/mcp' : '/mcp'));
      }
      if (path === '/register' && req.method === 'POST') return oauth.register(req, env);
      if (path === '/authorize' && req.method === 'GET') return oauth.authorize(req, env);
      if (path === '/google/callback') return oauth.googleCallback(req, env);
      if (path === '/token' && req.method === 'POST') return oauth.tokenEndpoint(req, env);

      if (path === '/mcp' || path === '/demo/mcp') {
        const who = await oauth.whoIs(req, env);
        if (!who) return json({error: 'unauthorized'}, 401, {'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${path}"`});
        if (req.method === 'GET') return new Response('Use POST', {status: 405, headers: Object.assign({Allow: 'POST'}, CORS)});
        if (req.method === 'DELETE') return new Response(null, {status: 204, headers: CORS});
        if (req.method !== 'POST') return new Response(null, {status: 405, headers: CORS});
        const body = await req.json().catch(() => null);
        if (!body) return json({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}, 400);
        const ctx = {env, who, demo: path === '/demo/mcp'};
        const many = Array.isArray(body);
        const out = [];
        for (const m of many ? body : [body]) { const r = await handle(m, ctx); if (r) out.push(r); }
        if (!out.length) return new Response(null, {status: 202, headers: CORS});
        return json(many ? out : out[0]);
      }

      if (path === '/') return new Response(`Where's My Money? Lite Worker v${VERSION} is running.\nClaude connector address: ${origin}/mcp\nDemo money: ${origin}/demo/mcp\n`,
        {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
      return new Response('Not found', {status: 404});
    } catch (e) {
      return json({error: e.message || 'Something went wrong'}, 500);
    }
  },
};

// one JSON-RPC message from Claude
export async function handle(m, ctx) {
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return m && m.id != null ? {jsonrpc: '2.0', id: m.id, error: {code: -32600, message: 'Invalid request'}} : null;
  if (m.id == null) return null;                                     // a notification: nothing to answer
  const ok = result => ({jsonrpc: '2.0', id: m.id, result});
  switch (m.method) {
    case 'initialize': {
      const want = m.params && m.params.protocolVersion;
      return ok({protocolVersion: PROTOCOLS.includes(want) ? want : PROTOCOLS[1], capabilities: {tools: {listChanged: false}},
        serverInfo: {name: ctx.demo ? 'wmm-lite-demo' : 'wmm-lite', title: ctx.demo ? "Where's My Money? (demo)" : "Where's My Money?", version: VERSION},
        instructions: (ctx.demo ? 'DEMO money (fake), safe to try. ' : '') +
          "Darren's Where's My Money? Lite: one bank account, payday to payday. Use money_summary first for any money question. " +
          'Claude can add spends, bills and credit card lines, and remove only what Claude added (by its c-… id). ' +
          'Changes are not instant: they show in the app (and in money_summary totals) after Darren next opens the app. Amounts are pounds (£).'});
    }
    case 'ping': return ok({});
    case 'tools/list': return ok({tools: TOOLS});
    case 'tools/call': {
      const name = m.params && m.params.name, args = (m.params && m.params.arguments) || {};
      if (!TOOLS.some(t => t.name === name)) return {jsonrpc: '2.0', id: m.id, error: {code: -32602, message: 'Unknown tool: ' + name}};
      try {
        const d = drive(await accessToken(ctx.env, ctx.who.rt), ctx.demo);
        const text = await runTool(d, name, args);
        return ok({content: [{type: 'text', text}], isError: false});
      } catch (e) {
        return ok({content: [{type: 'text', text: e.message || String(e)}], isError: true});
      }
    }
    case 'resources/list': return ok({resources: []});
    case 'prompts/list': return ok({prompts: []});
    default: return {jsonrpc: '2.0', id: m.id, error: {code: -32601, message: 'Method not found: ' + m.method}};
  }
}
