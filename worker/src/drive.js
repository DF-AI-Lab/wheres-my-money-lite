// Google Drive, as you (scope drive.file = only the files Lite, Passport and this Worker made; same Google project).
// Reads wmm-summary.json (Lite writes it on every Drive save) and drops job files next to it (Lite's inbox, v0.60).
import {GOOGLE_TOKEN} from './oauth.js';

const API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files';
const tokens = new Map();                          // refresh token -> {t, exp}, inside this Worker copy only

export async function accessToken(env, rt) {
  const hit = tokens.get(rt);
  if (hit && hit.exp > Date.now() + 60000) return hit.t;
  const r = await fetch(GOOGLE_TOKEN, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: rt, grant_type: 'refresh_token'}).toString()});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google sign-in has run out. In Claude: Settings → Connectors → Where\'s My Money → Disconnect, then Connect again.');
  tokens.set(rt, {t: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000});
  return j.access_token;
}

export function names(demo) {
  return demo ? {summary: 'wmm-demo-summary.json', job: 'wmm-demo-job-'} : {summary: 'wmm-summary.json', job: 'wmm-job-'};
}

// one person's Drive (token = a Google access token)
export function drive(token, demo) {
  const n = names(demo);
  const go = async (url, opts = {}) => {
    const r = await fetch(url, Object.assign({}, opts, {headers: Object.assign({Authorization: 'Bearer ' + token}, opts.headers || {})}));
    if (!r.ok && r.status !== 404) throw new Error('Google Drive said no (error ' + r.status + ').');
    return r;
  };
  const list = async q => {
    const r = await go(`${API}?q=${encodeURIComponent(q + ' and trashed=false')}&fields=files(id,name,parents,modifiedTime)&pageSize=200`);
    return r.ok ? ((await r.json()).files || []) : [];
  };
  return {
    names: n,
    async summaryFile() {                          // the newest summary (there should only be one)
      const f = (await list(`name='${n.summary}'`)).filter(x => x.name === n.summary);
      f.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
      return f[0] || null;
    },
    async readJson(id) {
      const r = await go(`${API}/${encodeURIComponent(id)}?alt=media`);
      if (!r.ok) return null;
      try { return JSON.parse(await r.text()); } catch (e) { return null; }
    },
    async jobFiles() { return (await list(`name contains '${n.job}'`)).filter(x => x.name.startsWith(n.job)); },
    async writeJob(name, job, folder) {
      const meta = Object.assign({name, mimeType: 'application/json'}, folder ? {parents: [folder]} : {});
      const b = 'wmm' + Date.now();
      const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
                   `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(job)}\r\n--${b}--`;
      const r = await go(`${UP}?uploadType=multipart&fields=id`, {method: 'POST', headers: {'Content-Type': 'multipart/related; boundary=' + b}, body});
      if (!r.ok) throw new Error('Google Drive would not take the change.');
      return (await r.json()).id;
    },
    async remove(id) { await go(`${API}/${encodeURIComponent(id)}`, {method: 'DELETE'}); },
  };
}
