// Signed notes (HMAC) and a sealed box (AES-GCM), both from TOKEN_SECRET. No database needed.
// Change TOKEN_SECRET = every Claude login stops working (Claude must connect again).

const enc = new TextEncoder(), dec = new TextDecoder();
export const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

function secret(env) {
  if (!env.TOKEN_SECRET || env.TOKEN_SECRET.length < 16) throw new Error('TOKEN_SECRET must be set (at least 16 characters).');
  return env.TOKEN_SECRET;
}
async function hmac(env, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret(env)), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
export function same(a, b) {                       // compare without leaking timing
  a = String(a); b = String(b);
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export async function sign(env, obj) {
  const body = b64url(enc.encode(JSON.stringify(obj)));
  return body + '.' + await hmac(env, body);
}
export async function verify(env, tok, typ) {
  try {
    const [body, sig] = String(tok || '').split('.');
    if (!body || !sig || !same(sig, await hmac(env, body))) return null;
    const o = JSON.parse(dec.decode(unb64url(body)));
    if (o.typ !== typ || !o.exp || Date.now() > o.exp) return null;
    return o;
  } catch (e) { return null; }
}

// the Google refresh token rides inside Claude's tokens, sealed so nobody can read it
async function boxKey(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('wmm-google-box:' + secret(env)));
  return crypto.subtle.importKey('raw', raw, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
}
export async function seal(env, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await boxKey(env), enc.encode(text));
  return b64url(iv) + '.' + b64url(c);
}
export async function unseal(env, box) {
  try {
    const [iv, c] = String(box || '').split('.');
    return dec.decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64url(iv)}, await boxKey(env), unb64url(c)));
  } catch (e) { return null; }
}
export const sha256url = async t => b64url(await crypto.subtle.digest('SHA-256', enc.encode(t)));
