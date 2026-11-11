// What Claude can do (agreed with Darren, 8 Nov 2026):
//   ✅ read: spare cash, pots, card used/free, bills (name, amount, day, paid)
//   ✅ add a spend (paid or upcoming), add a bill, add a card spend or a card payment, add money in (v0.70)
//   ✅ remove something Claude added (nothing else)
//   ❌ single spends / past months (scrambled), pay, Left, passcode, deleting your own entries
// Changes are job files in Drive (Lite's inbox). Lite applies them the next time it opens on your Main device.

const money = n => (n == null || isNaN(n) ? '—' : (n < 0 ? '−£' : '£') + Math.abs(Number(n)).toFixed(2));

export const TOOLS = [
  {name: 'money_summary', title: 'Money summary',
    description: "Darren's money this month: spare cash left, spent so far, still to come out, pots, credit card used/free, every bill (amount, due day, paid or not), " +
      'what Claude added, and changes still waiting for the app to open. Use this first for any money question.',
    inputSchema: {type: 'object', properties: {}, additionalProperties: false}, annotations: {readOnlyHint: true}},
  {name: 'add_spend', title: 'Add a spend',
    description: 'Add a spend from the bank account (not the credit card). Paid = already gone out (date = when, default today). ' +
      'upcoming = true for money still to come out (date = when it will go; no date = "no date yet").',
    inputSchema: {type: 'object', properties: {
      amount: {type: 'number', description: 'Pounds, e.g. 12.5'}, name: {type: 'string', description: 'Shop or what it was, e.g. Tesco'},
      date: {type: 'string', description: 'YYYY-MM-DD (optional)'}, upcoming: {type: 'boolean', description: 'true = not paid yet'}},
      required: ['amount', 'name'], additionalProperties: false}},
  {name: 'add_bill', title: 'Add a monthly bill',
    description: 'Add a new monthly bill (direct debit / standing order). day = the day of the month it goes out (1-31) or "varies".',
    inputSchema: {type: 'object', properties: {
      amount: {type: 'number'}, name: {type: 'string'}, day: {type: ['integer', 'string'], description: '1-31 or "varies" (optional)'}},
      required: ['amount', 'name'], additionalProperties: false}},
  {name: 'card_spend', title: 'Add a credit card spend',
    description: 'Something bought on the credit card (it goes on the first card in the app).',
    inputSchema: {type: 'object', properties: {amount: {type: 'number'}, name: {type: 'string'}, date: {type: 'string', description: 'YYYY-MM-DD (optional, default today)'}},
      required: ['amount', 'name'], additionalProperties: false}},
  {name: 'card_paid_off', title: 'Pay off the credit card',
    description: 'Money paid off the credit card (lowers what is used).',
    inputSchema: {type: 'object', properties: {amount: {type: 'number'}, date: {type: 'string', description: 'YYYY-MM-DD (optional, default today)'}},
      required: ['amount'], additionalProperties: false}},
  {name: 'add_money_in', title: 'Add money in',
    description: 'Money coming in that is NOT pay: a gift, a refund, someone paying Darren back. It adds to spare cash this month.',
    inputSchema: {type: 'object', properties: {amount: {type: 'number'}, name: {type: 'string', description: 'Where it came from, e.g. Mum or Amazon refund'},
      date: {type: 'string', description: 'YYYY-MM-DD (optional, default today)'}}, required: ['amount', 'name'], additionalProperties: false}},
  {name: 'remove_added', title: 'Remove something Claude added',
    description: 'Remove a spend, bill, card line or money in that CLAUDE added, by its id (from the add result or money_summary). Cannot remove anything Darren added.',
    inputSchema: {type: 'object', properties: {id: {type: 'string', description: 'e.g. c-20261108-101500-ab12'}}, required: ['id'], additionalProperties: false},
    annotations: {destructiveHint: true}},
];

// ---------- checks ----------
function amountOf(a) {
  const v = typeof a === 'string' ? Number(a.replace(/[£,\s]/g, '')) : Number(a);
  if (!isFinite(v) || v <= 0 || v > 1000000) throw new Error('amount must be more than £0 (pounds, e.g. 12.50).');
  return Math.round(v * 100) / 100;
}
function nameOf(n) {
  const t = String(n == null ? '' : n).replace(/\s+/g, ' ').trim();
  if (!t) throw new Error('name is needed.');
  return t.slice(0, 60);
}
function dateOf(d) {
  if (d == null || d === '') return '';
  const t = String(d).trim();
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(Date.parse(t + 'T00:00:00Z')) && new Date(t + 'T00:00:00Z').toISOString().slice(0, 10) === t;
  if (!ok) throw new Error('date must be YYYY-MM-DD, e.g. 2026-11-08.');
  return t;
}
function dayOf(d) {
  if (d == null || d === '') return '';
  const t = String(d).trim().toLowerCase();
  if (t === 'varies') return 'varies';
  if (!/^\d{1,2}$/.test(t) || Number(t) < 1 || Number(t) > 31) throw new Error('day must be 1-31 or "varies".');
  return String(Number(t));
}

// c-YYYYMMDD-HHMMSS-xxxx  <->  wmm-job-YYYYMMDD-HHMMSS-xxxx.json
export function newId(now = new Date(), rand = Math.random) {
  const p = n => String(n).padStart(2, '0');
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += abc[Math.floor(rand() * abc.length)];
  return `c-${stamp}-${r}`;
}
const ID = /^c-\d{8}-\d{6}-[a-z0-9]+$/;
export const fileFor = (prefix, id) => prefix + id.slice(2) + '.json';

function describe(job) {
  if (!job) return 'something';
  if (job.kind === 'add_spend') return `${money(Number(job.amount))} ${job.name}${job.upcoming ? (job.date ? ' (to come out ' + job.date + ')' : ' (to come out, no date yet)') : ''}`;
  if (job.kind === 'add_bill') return `${money(Number(job.amount))} ${job.name} (monthly bill${job.day ? ', day ' + job.day : ''})`;
  if (job.kind === 'card_spend') return `${money(Number(job.amount))} ${job.name} on the credit card`;
  if (job.kind === 'card_paid_off') return `${money(Number(job.amount))} paid off the credit card`;
  if (job.kind === 'add_money_in') return `+${money(Number(job.amount))} ${job.name} (money in)`;
  if (job.kind === 'remove_spend') return `remove ${job.target}`;
  return job.kind;
}

// ---------- run one tool ----------
// d = drive(...) from drive.js; returns the text Claude reads
export async function runTool(d, name, args = {}, now = new Date()) {
  if (name === 'money_summary') return summaryText(d);
  if (name === 'remove_added') return removeAdded(d, args, now);
  const job = {v: 1, from: 'Claude', kind: name === 'card_spend' ? 'card_spend' : name};
  if (name === 'add_spend') {
    Object.assign(job, {amount: amountOf(args.amount).toFixed(2), name: nameOf(args.name), date: dateOf(args.date)});
    if (args.upcoming) job.upcoming = true;
  } else if (name === 'add_bill') {
    Object.assign(job, {amount: amountOf(args.amount).toFixed(2), name: nameOf(args.name), day: dayOf(args.day)});
  } else if (name === 'card_spend') {
    Object.assign(job, {amount: amountOf(args.amount).toFixed(2), name: nameOf(args.name), date: dateOf(args.date)});
  } else if (name === 'add_money_in') {
    Object.assign(job, {amount: amountOf(args.amount).toFixed(2), name: nameOf(args.name), date: dateOf(args.date)});
  } else if (name === 'card_paid_off') {
    Object.assign(job, {amount: amountOf(args.amount).toFixed(2), name: '', date: dateOf(args.date)});
  } else throw new Error('Unknown tool: ' + name);
  await send(d, job, now);
  return `Sent: ${describe(job)}. id ${job.id}. ${SHOWS}`;
}

async function send(d, job, now) {
  const s = await d.summaryFile();
  if (!s) throw new Error("Can't find the app's file in Google Drive. Open Where's My Money? Lite once with Google Drive switched on, then try again.");
  job.id = newId(now);
  await d.writeJob(fileFor(d.names.job, job.id), job, (s.parents || [])[0]);
  return job;
}
const SHOWS = 'It shows in the app the next time Darren opens it.';

async function waiting(d) {
  const out = [];
  for (const f of (await d.jobFiles()).sort((a, b) => a.name.localeCompare(b.name))) {
    const job = await d.readJson(f.id);
    if (job && job.id) out.push({file: f, job});
  }
  return out;
}

async function summaryText(d) {
  const f = await d.summaryFile();
  if (!f) return "No summary yet. Darren needs to open Where's My Money? Lite once with Google Drive switched on.";
  const s = (await d.readJson(f.id)) || {};
  const L = [];
  L.push(`Where's My Money? (app last saved ${s.updated || f.modifiedTime || 'unknown'}). This is a guide; the bank app is the real number.`);
  L.push(`Spare cash left: ${money(s.spare)} · Spent so far: ${money(s.spent)} · Still to come out: ${money(s.to_come_out)}`);
  if (s.money_in) L.push(`Money in this month (not pay): ${money(s.money_in)}`);
  if (s.card) L.push(`Credit card: ${money(s.card.used)} used, ${money(s.card.free)} free`);
  const pots = Array.isArray(s.pots) ? s.pots : [];
  if (pots.length) {
    L.push('', 'Pots:');
    pots.forEach(p => L.push(`- ${p.name}: ${money(p.used)} used of ${p.budget == null ? 'no budget' : money(p.budget)}`));
  }
  const bills = Array.isArray(s.bills) ? s.bills : [];
  if (bills.length) {
    L.push('', 'Bills:');
    bills.forEach(b => L.push(`- ${b.name}: ${money(b.amount)}, day ${b.day == null ? 'not set' : b.day}, ${b.skipped ? 'skipped this month (counts £0)' : b.on_card ? 'paid on the credit card' : b.paid ? 'paid' : 'not paid yet'}`));
  }
  const added = Array.isArray(s.added) ? s.added.filter(a => ID.test(String(a.id))) : [];
  if (added.length) {
    L.push('', 'Added by Claude (can be removed with remove_added):');
    added.forEach(a => L.push(`- [${a.id}] ${money(a.amount)} ${a.name} (${a.kind})`));
  }
  const w = (await waiting(d)).filter(x => ID.test(String(x.job.id)));
  if (w.length) {
    L.push('', 'Waiting for the app to open (not in the numbers above yet):');
    w.forEach(x => L.push(`- [${x.job.id}] ${describe(x.job)}`));
  }
  return L.join('\n');
}

async function removeAdded(d, args, now) {
  const id = String(args.id == null ? '' : args.id).trim();
  if (!ID.test(id)) throw new Error('Claude can only remove what Claude added (ids look like c-20261108-101500-ab12).');
  for (const x of await waiting(d)) {                 // not picked up yet: just take it back
    if (x.job.id === id) { await d.remove(x.file.id); return `Taken back before the app saw it: ${describe(x.job)}.`; }
  }
  const job = await send(d, {v: 1, from: 'Claude', kind: 'remove_spend', target: id}, now);
  return `Sent: remove ${id} (id ${job.id}). ${SHOWS}`;
}
