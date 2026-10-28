/* Where's My Money? Lite - the maths (a port of live v3.62: spare.pay_block, creditcard.py, typed.py,
   categories.py, left.parse_money and the routes in web.py) plus Go A: bills with due days, monthly pots, the
   saved months (history) and the backup file. Pure functions: no page, no storage, no network.
   Works in the browser (window.Money) and in node (module.exports). Fake data only.

   State v3: {v:3, pay, left, payday (ISO start of this pay month, may be missing), payDay (1-31 = paid on this day each month, or null),
              cats (the person's own extra categories), lastBackup (ISO day of the last saved backup, or missing),
              bills:[{key,name,cat,amount (number|null), due (1-31|null), paid, stopped,
                      card (a card key | '' = none | missing = linked by name), asked (pay month start the card question was answered)}],
              pots:[{key,name,cat,amount (number|null)}],
              spends:[{id,date,amount,name,cat}], history:[saved months],
              cards:[{key,name,limit,carry,next,items:[{id,date,amount,name,kind}]}]}
   A saved month: {start,end,pay,left,spare,bills:[{key,name,cat,amount,stopped}],spends:[...],pots:[{key,name,cat,amount,spent}]}
   Dates are ISO text (YYYY-MM-DD). Every mutator changes the state it is given and returns null when it worked,
   or an error code ('pay' | 'spend' | 'card' | 'newcard' | 'bill' | 'pot') exactly where live redirects to /?error=CODE. */
(function (root) {
  'use strict';

  // ---------- small helpers (Python behaviour on purpose) ----------

  // Python's round(x, 2): exact halves go to the even digit (0.125 -> 0.12), everything else is the nearest.
  function r2(x) {
    const eighths = Math.abs(x) * 8;
    if (Number.isInteger(eighths) && eighths % 2 === 1) {            // .125 .375 .625 .875
      const hundredths = Math.floor(Math.abs(x) * 100);
      const even = hundredths % 2 === 0 ? hundredths : hundredths + 1;
      return Math.sign(x) * even / 100;
    }
    return Number(x.toFixed(2));
  }
  // Python's round(x) for a float: halves go to the even whole number.
  function r0(x) {
    const f = Math.floor(x), d = x - f;
    if (d === 0.5) return f % 2 === 0 ? f : f + 1;
    return Math.round(x);
  }
  const sum = list => list.reduce((a, b) => a + b, 0);

  // left.parse_money: "2450", "2,450.50", "GBP 2450", "£12". Blank, not a number, zero or negative -> null.
  function parseMoney(text) {
    let t = String(text == null ? '' : text).replace(/ /g, '').trim();
    if (t.startsWith('GBP')) t = t.slice(3);
    t = t.replace(/£/g, '').replace(/,/g, '');
    if (!t) return null;
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return null;
    const v = Number(t);
    return v <= 0 ? null : v;
  }
  // The "0 / 0.00 / £0" test that /bill and /card/balance use: nothing but zeros and dots (after a leading £).
  const isZeroText = text => String(text).replace(/^£+/, '').replace(/\./g, '').replace(/^0+|0+$/g, '') === '';

  const CATEGORIES = ['Household', 'Car', 'Fuel', 'Subscriptions', 'Food shopping', 'Takeaways', 'Going out',
                      'Shopping', 'Savings/Transfers', 'Unsorted'];
  // categories.guess_category (the name only; first keyword group that matches whole words wins)
  const KEYWORDS = [
    ['Household', ['RENT', 'WATER', 'COUNCIL', 'CITY OF', 'E.ON', 'ENERGY', 'ELECTRIC', 'GAS', 'OCTOPUS', 'SKY',
                   'TV LICENCE', 'LICENCE', 'MOBILE', 'BROADBAND', 'VIRGIN MEDIA', 'BT', 'LIFE', 'INSURANCE', 'BILLS']],
    ['Fuel', ['PETROL', 'FUEL', 'SHELL', 'ESSO', 'TEXACO', 'PUMP', 'BP']],
    ['Car', ['CAR', 'DVLA', 'PARKING']],
    ['Going out', ['PUB', 'BAR', 'CINEMA', 'ODEON', 'VUE', 'RESTAURANT', 'NANDOS', 'WETHERSPOON', 'BOWLING']],
    ['Subscriptions', ['NETFLIX', 'SPOTIFY', 'YOUTUBE', 'AUDIBLE', 'XBOX', 'PLAYSTATION', 'DISNEY', 'PRIME', 'UDEMY',
                       'GOOGLE PLAY', 'GOOGLE', 'APPLE']],
    ['Takeaways', ['JUST EAT', 'DELIVEROO', 'UBER EATS', 'DOMINOS', 'PIZZA', 'KFC', 'MCDONALDS', 'TAKEAWAY']],
    ['Food shopping', ['TESCO', 'ASDA', 'SAINSBURYS', 'ALDI', 'LIDL', 'MORRISONS', 'FARMFOODS', 'ICELAND', 'CO-OP',
                       'M&S FOOD', 'FOOD']],
    ['Shopping', ['AMAZON', 'ARGOS', 'CURRYS', 'THE RANGE', 'B&Q', 'IKEA', 'EBAY']],
    ['Savings/Transfers', ['SAVINGS', 'SAVER', 'TRANSFER', 'ISA']],
  ];
  function guessCategory(name, label) {
    const text = ((label || '') + ' ' + name).toUpperCase();
    for (const [category, words] of KEYWORDS) {
      for (const w of words) {
        const re = new RegExp('(?<![A-Z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Z0-9])');
        if (re.test(text)) return category;
      }
    }
    return 'Unsorted';
  }

  // ---------- formatting (the Jinja filters in web.py) ----------
  const commas = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function money(x) {                                    // £1,234.56 / -£12.00
    return x >= 0 ? '£' + commas(x.toFixed(2)) : '-£' + commas((-x).toFixed(2));
  }
  function diff(x) {                                     // +£12.00 / -£20.83 / £0.00 ('' for none)
    if (x === null || x === undefined) return '';
    if (Math.abs(x) < 0.005) return '£0.00';
    return x > 0 ? '+£' + commas(x.toFixed(2)) : '-£' + commas((-x).toFixed(2));
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(iso) {                                    // '5 Oct 2024'
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(iso);
  }
  function tagsplit(name) {                              // 'Rent KT (Household) (BP)' -> ['Rent KT', ['Household', 'BP']]
    const tags = [];
    name = String(name);
    while (name.endsWith(')') && name.includes(' (')) {
      const head = name.slice(0, -1), i = head.lastIndexOf(' (');
      tags.unshift(head.slice(i + 2));
      name = head.slice(0, i);
    }
    return [name, tags];
  }
  // How Python prints a float in HTML ("550.0", "157.12"): whole numbers keep one decimal.
  const pyfloat = x => Number.isInteger(x) ? x.toFixed(1) : String(x);

  // ---------- the credit card (creditcard.py) ----------
  const KEEP = 5;

  function allocate(items, carry) {
    carry = carry || 0;
    const debts = sum(items.filter(i => i.amount > 0).map(i => i.amount)) + Math.max(carry, 0);
    const credit = sum(items.filter(i => i.amount < 0).map(i => -i.amount)) + Math.max(-carry, 0);
    let pot = r2(credit - Math.max(carry, 0));
    let given = Math.max(-carry, 0);
    return items.map(i => {
      const r = Object.assign({}, i);
      if (i.amount > 0) {
        const take = Math.min(Math.max(pot, 0), i.amount);
        pot = r2(pot - take);
        r.left = r2(i.amount - take);
        r.status = r.left <= 0 ? 'paid' : (take > 0 ? 'part' : 'owed');
      } else {
        given = r2(given - i.amount);
        r.left = 0;
        r.status = 'credit';
        r.used_up = given <= debts + 0.005;
      }
      return r;
    });
  }

  function tidy(card) {                                  // fold all but the 5 newest crossed-out / used-up lines into carry
    const rows = allocate(card.items, card.carry);
    const paid = rows.filter(r => r.status === 'paid').map(r => r.id);
    const spent = rows.filter(r => r.status === 'credit' && r.used_up).map(r => r.id);
    const drop = new Set([...(paid.length > KEEP ? paid.slice(0, -KEEP) : []),
                          ...(spent.length > KEEP ? spent.slice(0, -KEEP) : [])]);
    if (drop.size) {
      card.carry = r2(card.carry + sum(card.items.filter(i => drop.has(i.id)).map(i => i.amount)));
      card.items = card.items.filter(i => !drop.has(i.id));
    }
  }

  function fixCard(c) {                                  // make sure a card has all its fields
    if (c.limit === undefined) c.limit = 500;
    if (c.carry === undefined) c.carry = 0;
    if (!Array.isArray(c.items)) c.items = [];
    c.items.forEach(i => { if (!i.kind) i.kind = i.amount > 0 ? 'spend' : 'paid'; });
    if (c.next === undefined) c.next = Math.max(0, ...c.items.map(i => i.id)) + 1;
    return c;
  }
  const templateCard = () => ({key: 'Credit card', name: 'Credit card', limit: 500, carry: 0, next: 1, items: []});
  function cardsOf(s) {                                  // the list of cards (an old single "card" becomes the Zopa card)
    if (!Array.isArray(s.cards)) {
      const old = s.card;
      s.cards = old ? [Object.assign({key: 'Zopa', name: 'Zopa'}, old)] : [templateCard()];
      delete s.card;
      s.v = 3;
    }
    s.cards.forEach(fixCard);
    return s.cards;
  }
  // the card a key names ('' or missing = the first card); null when there is none
  function cardOf(s, key) {
    const cards = cardsOf(s);
    return key === undefined || key === null || key === '' ? (cards[0] || null) : (cards.find(c => c.key === key) || null);
  }
  const cardUsed = c => r2(c.carry + sum(c.items.map(i => i.amount)));
  const cardLabel = c => (/\bcard\b/i.test(c.name) ? c.name : c.name + ' credit card');
  const escRe = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // the first card whose name is a whole word in the bill's name ('Zopa Credit Cards DD' -> Zopa), else null
  function autoCard(cards, billName) {
    for (const c of cards) {
      if (c.name && new RegExp('(?<![A-Za-z0-9])' + escRe(c.name) + '(?![A-Za-z0-9])', 'i').test(billName)) return c.key;
    }
    return null;
  }
  function billCardKey(cards, b) {                       // the card key a bill pays, or null
    if (b.card === '') return null;                      // explicitly none
    if (typeof b.card === 'string' && cards.some(c => c.key === b.card)) return b.card;
    return autoCard(cards, b.name === undefined ? b.key : b.name);
  }

  function addCard(c, iso, amount, name, kind) {
    amount = r2(Number(amount));
    c.items.push({id: c.next, date: iso, amount, name: String(name).trim().slice(0, 60),
                  kind: kind || (amount > 0 ? 'spend' : 'paid')});
    c.next += 1;
    tidy(c);
  }

  // ---------- dates ----------
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();          // m = 1..12
  function dayBefore(d) {
    const t = new Date(d + 'T00:00:00Z');
    t.setUTCDate(t.getUTCDate() - 1);
    return t.toISOString().slice(0, 10);
  }
  function ordinal(n) {                                                       // 1st 2nd 3rd 4th .. 11th 12th 13th .. 21st
    const e = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    return n + e;
  }
  // The first date on or after the pay month's start whose day is `due` (the last day of a short month).
  function dueDate(start, due) {
    let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7));
    for (let i = 0; i < 2; i++) {
      const d = iso(y, m, Math.min(due, daysIn(y, m)));
      if (d >= start) return d;
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return start;
  }

  // ---------- saved months (the history) ----------
  const clone = x => JSON.parse(JSON.stringify(x));
  const byStart = h => h.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const billAmount = b => (typeof b.amount === 'number' ? b.amount : 0);
  const monthBills = m => sum(m.bills.filter(b => !b.stopped).map(billAmount));
  const monthSpends = m => sum(m.spends.map(x => x.amount));
  const isSet = p => typeof p.amount === 'number';
  const saved = (s, key) => {                                                 // the newest saved month's entry for a bill
    for (const m of byStart(s.history || []).reverse()) {
      const b = m.bills.find(x => x.key === key);
      if (b) return b;
    }
    return null;
  };

  // ---------- compute: everything the page shows ----------
  // today (ISO) is optional: without it no bill is "past its due day" and "this year" is the newest saved year.
  function compute(s, today) {
    if (!s || s.v !== 3) s = migrate(clone(s || {}));
    const history = byStart(s.history || []);

    // bills
    const start = s.payday || (today ? today.slice(0, 8) + '01' : null);
    const cardList = cardsOf(s);
    const potOf = {};                                            // pots that have an amount, by category (v0.50: loosely)
    (s.pots || []).forEach(p => { if (isSet(p)) potOf[catKey(p.cat)] = p; });
    const bills = (s.bills || []).map(b => {
      const blank = typeof b.amount !== 'number', stopped = !!b.stopped;
      const amount = blank ? null : b.amount;
      const used = stopped ? 0 : (amount || 0);
      const past = history.map(m => m.bills.find(x => x.key === b.key))
        .filter(x => x && !x.stopped && typeof x.amount === 'number' && x.amount > 0).map(x => x.amount);
      const avg = past.length ? sum(past) / past.length : (amount || 0);
      const was = saved(s, b.key);
      const due = b.due || null, dueAt = due && start ? dueDate(start, due) : null;
      const name = b.name === undefined ? b.key : b.name;
      const inPot = !stopped && potOf[catKey(b.cat)] ? potOf[catKey(b.cat)].name : null;   // a bill in a pot's category is paid from that pot
      return {key: b.key, id: 'bill:' + b.key, name, orig: name, cat: b.cat, amount, avg, pot: inPot, last: amount || 0, used, blank, stopped,
              saved: was && typeof was.amount === 'number' ? was.amount : null,
              changed: !!was && !stopped && !blank && was.amount !== amount, new: false, estimated: blank,
              due, dueAt, dueText: due ? ordinal(due) : '', duePassed: !!(dueAt && today && today >= dueAt), paid: !!b.paid,
              card: billCardKey(cardList, b), asked: b.asked === start,
              diff: (blank || stopped) ? null : used - avg};
    });
    bills.forEach((b, i) => { b.i = i; });
    bills.sort((a, b) => (a.stopped - b.stopped) || (b.avg - a.avg) || (a.i - b.i));
    const live = bills.filter(b => !b.stopped);
    const billsAll = sum(live.map(b => b.used));                 // every live bill, pot bills too
    const own = live.filter(b => !b.pot);                        // pot bills are not counted twice
    const billsTotal = sum(own.map(b => b.used));
    const billsAvg = sum(own.map(b => b.avg));

    // spends and pots: a spend is "in a pot" when its category is a pot that has an amount
    const pay = s.pay || 0, left = s.left || 0;
    const spends = (s.spends || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    const pots = (s.pots || []).map(p => {
      const spent = sum(spends.filter(x => catKey(x.cat) === catKey(p.cat)).map(x => x.amount))
        + (isSet(p) ? sum(live.filter(b => b.pot === p.name).map(b => b.used)) : 0), blank = !isSet(p);
      const amount = blank ? null : p.amount;
      return {key: p.key, name: p.name, cat: p.cat, amount, spent, blank,
              left: blank ? 0 : Math.max(amount - spent, 0), over: blank ? 0 : Math.max(spent - amount, 0),
              pct: blank || amount <= 0 ? 0 : Math.min(r0(100 * spent / amount), 100)};
    });
    const potsSet = sum(pots.map(p => p.amount || 0)), potsOver = sum(pots.map(p => p.over));
    const potsTotal = potsSet + potsOver;
    const potsSpent = sum(pots.filter(p => !p.blank).map(p => p.spent)), potsLeft = sum(pots.map(p => p.left));
    const potBills = billsAll - billsTotal;
    const shown = spends.map(x => Object.assign({}, x, {pot: potOf[catKey(x.cat)] ? potOf[catKey(x.cat)].name : null,
      upcoming: !!x.upcoming && !!today && today < x.date, autoPaid: !!x.upcoming && !!today && today >= x.date}));
    const spendsTotal = sum(shown.filter(x => !x.pot).map(x => x.amount));
    const moneyForSpending = pay + left - billsTotal - potsSet;
    const startSpare = moneyForSpending;
    const spendsAll = sum(shown.map(x => x.amount));             // every spend, pot spends too
    // Actual spare = the real money left in the bank (21 Oct evening): pot spends and pot bills come off it
    const leftNow = startSpare + potsLeft - potsOver - spendsTotal;

    const total = pay + left;                                    // the ring: pay + left split four ways
    const f = x => total > 0 ? Math.max(x, 0) / total : 0;
    const spareRing = Math.max(leftNow, 0);
    const pct = {bills: r0(100 * f(billsTotal)), pots: r0(100 * f(potsSpent)), spends: r0(100 * f(spendsTotal)),
                 spare: r0(100 * f(spareRing))};

    const cards = cardList.map(c => {
      const rows = allocate(c.items, c.carry).map(r => Object.assign(r, {removable: r.status !== 'paid'}));
      const used = cardUsed(c), pc = c.limit ? 100 * used / c.limit : 0;
      // the question: a bill that pays this card, due day gone (or no due day), not answered this pay month
      const asks = bills.filter(b => b.card === c.key && !b.stopped && b.amount > 0 && (!b.due || b.duePassed) && !b.asked)
        .map(b => ({key: b.key, name: b.name, amount: b.amount, dueText: b.dueText}));
      return {key: c.key, name: c.name, label: cardLabel(c), limit: c.limit, carry: c.carry, used, free: r2(c.limit - used),
              pc, pctUsed: r0(pc), rows, asks};
    });

    // history cards (all from the months saved at payday)
    const cycles = Math.max(1, history.length);
    const group = (list, keyOf) => {                             // [{key, total}] biggest first
      const t = new Map();
      list.forEach(x => t.set(keyOf(x), (t.get(keyOf(x)) || 0) + x.amount));
      return [...t].map(([key, total]) => ({key, total})).sort((a, b) => b.total - a.total);
    };
    let lastMonth = null;
    if (history.length) {
      const m = history[history.length - 1], b = monthBills(m);
      const catAvg = cat => sum(history.map(h => sum(h.spends.filter(x => (x.cat || 'Unsorted') === cat).map(x => x.amount)))) / cycles;
      const cats = group(m.spends, x => x.cat || 'Unsorted').map(g => ({cat: g.key, total: g.total,
        avg: catAvg(g.key), diff: g.total - catAvg(g.key),
        items: group(m.spends.filter(x => (x.cat || 'Unsorted') === g.key), x => x.name).map(i => ({name: i.key, total: i.total}))}));
      const billsAvg = sum(history.map(monthBills)) / cycles;
      lastMonth = {start: m.start, end: m.end, bills: b, billsAvg, billsDiff: b - billsAvg, cats, total: b + monthSpends(m)};
    }
    const nowBy = new Map(), pastBy = new Map();
    spends.forEach(x => nowBy.set(x.cat || 'Unsorted', (nowBy.get(x.cat || 'Unsorted') || 0) + x.amount));
    history.forEach(m => m.spends.forEach(x => pastBy.set(x.cat || 'Unsorted', (pastBy.get(x.cat || 'Unsorted') || 0) + x.amount)));
    const cats = [...new Set([...nowBy.keys(), ...pastBy.keys()])].map(cat => {
      const now = nowBy.get(cat) || 0, avg = (pastBy.get(cat) || 0) / cycles;
      return {cat, now, avg, diff: now - avg};
    }).sort((a, b) => Math.max(b.now, b.avg) - Math.max(a.now, a.avg) || (a.cat < b.cat ? -1 : 1));
    const year = today ? today.slice(0, 4) : (history.length ? history[history.length - 1].start.slice(0, 4) : '');
    const sums = list => {
      const wage = sum(list.map(m => m.pay)), b = sum(list.map(monthBills)), sp = sum(list.map(monthSpends));
      return {months: list.length, wage, bills: b, spending: sp, left: wage - b - sp};
    };
    const periods = {six: sums(history.slice(-6)), twelve: sums(history.slice(-12)),
                     ytd: sums(history.filter(m => m.start.slice(0, 4) === year)), year};

    return {pay, left, startSpare: moneyForSpending, bills, billsTotal, billsAll, billsAvg, billsDiff: billsTotal - billsAvg, spends: shown, spendsTotal,
            pots, potsSet, potsOver, potsTotal, potsSpent, potsLeft, potBills, spendsAll, moneyForSpending, leftNow, spare: leftNow, pct, cards, card: cards[0] || null,
            spendCats: catTotals(shown),
            billCats: catTotals(own.map(b => ({name: b.name, cat: b.cat, amount: b.used, dueText: b.dueText}))
              .concat(pots.filter(p => !p.blank).map(p => ({name: p.name, cat: 'Pots', amount: p.amount})))),
            anyEstimated: bills.some(b => b.estimated), cycles, lastMonth, cats, periods, hasHistory: history.length > 0};
  }

  // The money really left at the end of the month (unspent pot money goes back into spare).
  function monthEndSpare(s) {
    const r = compute(s);
    return r.pay + r.left - r.billsAll - sum((s.spends || []).map(x => x.amount));
  }

  // ---------- state shape ----------
  const TEMPLATE_BILLS = ['Rent / Mortgage', 'Council tax', 'Gas & electric', 'Water', 'Phone', 'Broadband', 'TV licence', 'Car insurance'];
  const TEMPLATE_POTS = ['Shopping', 'Fuel', 'Going out'];
  const newBill = (name, amount) => ({key: name, name, cat: guessCategory(name), amount, due: null, paid: false, stopped: false});
  const newPot = (name, amount) => ({key: name, name, cat: name, amount});

  function TEMPLATE() {                                          // a new person: the usual bills, amounts blank, no fake numbers
    return {v: 3, pay: 0, left: 0, bills: TEMPLATE_BILLS.map(n => newBill(n, null)), pots: TEMPLATE_POTS.map(n => newPot(n, null)),
            spends: [], history: [], cards: [templateCard()], ideas: [], payDay: null, cats: []};
  }

  // v1 / v2 -> v3 (v2: one "card", now cards:[...]; the old card is the Zopa card). A v3 state comes back untouched.
  function migrate(old) {                                        // upgrade, and every state has an ideas list
    const s = upgrade(old);
    if (!Array.isArray(s.ideas)) s.ideas = [];
    return s;
  }
  function upgrade(old) {
    if (old && old.v === 3) return old;
    old = old || {};
    if (old.v === 2) { cardsOf(old); return old; }
    const s = {v: 2, pay: old.pay || 0, left: old.left || 0,
      bills: (old.bills || []).map(b => ({key: b.key, name: b.name === undefined ? b.key : b.name, cat: b.cat || 'Unsorted',
        amount: b.change !== undefined && b.change !== null ? b.change : (b.last > 0 ? b.last : (typeof b.avg === 'number' ? b.avg : null)),
        due: null, paid: false, stopped: !!b.stopped})),
      pots: TEMPLATE_POTS.map(n => newPot(n, null)), spends: old.spends || [], history: [], card: old.card};
    if (old.payday) s.payday = old.payday;
    cardsOf(s);
    return s;
  }

  // ---------- the backup file ----------
  const APP = 'wheres-my-money-lite', VERSION = '0.58';
  const exportBackup = (s, day) => ({app: APP, version: VERSION, saved: day, state: clone(s)});
  function importBackup(file) {                                  // the state (a copy, migrated) or null for anything wrong
    if (!file || typeof file !== 'object' || file.app !== APP) return null;
    const st = file.state;
    if (!st || typeof st !== 'object' || !Array.isArray(st.bills)) return null;
    return migrate(clone(st));
  }
  const backupName = day => `wheres-my-money-backup-${day}.json`;

  // ---------- the routes (web.py), as functions on the state ----------
  // a real calendar date 'YYYY-MM-DD' (not 2024-13-40)
  const isDate = t => { const d = new Date(t + 'T00:00:00Z'); return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(d) && d.toISOString().slice(0, 10) === t; };
  // POST /add. expectText = Upcoming (v0.36, mock H2): the date it should go out; from that day it counts as paid by itself
  function addSpend(s, iso, amountText, nameText, expectText) {
    const amount = parseMoney(amountText), name = String(nameText == null ? '' : nameText).trim();
    const expect = String(expectText == null ? '' : expectText).trim();
    if (amount === null || !name || (expect && !isDate(expect))) return 'spend';
    s.spends = s.spends || [];
    const x = {id: Math.max(0, ...s.spends.map(x => x.id)) + 1, date: expect || iso, amount, name, cat: guessCategory(name)};
    if (expect) x.upcoming = true;
    s.spends.push(x);
    return null;
  }
  const findSpend = (s, idText) => (s.spends || []).find(x => String(x.id) === String(idText).trim());
  function paySpend(s, idText, iso) {                            // POST /spend/paid: an upcoming spend went out today
    const x = findSpend(s, idText);
    if (!x) return null;
    x.date = iso; delete x.upcoming;
    return null;
  }
  function setSpendDate(s, idText, text) {                       // POST /spend/date (⋯ → Change date)
    const x = findSpend(s, idText), d = String(text == null ? '' : text).trim();
    if (!x) return null;
    if (!isDate(d)) return 'spend';
    x.date = d; x.dated = true;
    return null;
  }
  // v0.49: ⋯ → ✏️ Change amount / ✏️ Change name on a spend
  function setSpendAmount(s, idText, text) {                     // POST /spend/amount
    const x = findSpend(s, idText), amount = parseMoney(text);
    if (!x) return null;
    if (amount === null) return 'spend';
    x.amount = amount;
    return null;
  }
  function renameSpend(s, idText, text) {                        // POST /spend/name
    const x = findSpend(s, idText), name = String(text == null ? '' : text).trim();
    if (!x) return null;
    if (!name) return 'spend';
    x.name = name;
    return null;
  }
  function removeSpend(s, idText) {                              // POST /remove (a bad id is ignored)
    const id = Number(idText);
    if (!/^\s*-?\d+\s*$/.test(String(idText))) return null;
    s.spends = (s.spends || []).filter(x => x.id !== id);
    return null;
  }
  function setPay(s, text, clear) {                              // POST /pay
    const pay = parseMoney(text);
    if (pay === null) return 'pay';
    s.pay = pay;
    if (clear) s.spends = [];
    return null;
  }
  function setLeft(s, text) {                                    // POST /left (empty = remove)
    text = String(text == null ? '' : text).trim();
    if (text === '') { s.left = 0; return null; }
    const v = parseMoney(text);
    if (v === null) return 'pay';
    s.left = v;
    return null;
  }
  // POST /bill: sets this bill's amount (it carries over to next month). '' puts back the last saved month's amount.
  // Returns null | 'pay' (bad amount) | 'unknown' (no such bill: nothing happens)
  function setBill(s, key, text) {
    const b = (s.bills || []).find(x => x.key === key);
    if (!b) return 'unknown';
    text = String(text == null ? '' : text).trim();
    if (text === '') {
      const was = saved(s, key);
      if (was) b.amount = typeof was.amount === 'number' ? was.amount : null;
      return null;
    }
    let v = parseMoney(text);
    if (v === null && isZeroText(text)) v = 0;                   // 0 = not paying it this month
    if (v === null) return 'pay';
    b.amount = v;
    return null;
  }
  function setStopped(s, key, on) {                              // POST /stopped (a simple switch)
    const b = (s.bills || []).find(x => x.key === key);
    if (!b) return 'unknown';
    b.stopped = !!on;
    return null;
  }
  const findBill = (s, key) => (s.bills || []).find(x => x.key === key);
  const uniqueKey = (list, name) => {                            // "Netflix", "Netflix 2", "Netflix 3"
    let key = name, n = 1;
    while (list.some(x => x.key === key)) { n += 1; key = name + ' ' + n; }
    return key;
  };
  function addBill(s, amountText, nameText) {                    // POST /bill/add (a blank amount is fine)
    const name = String(nameText == null ? '' : nameText).trim().slice(0, 60);
    const text = String(amountText == null ? '' : amountText).trim();
    const amount = text === '' ? null : parseMoney(text);
    if (!name || (text !== '' && amount === null)) return 'bill';
    s.bills = s.bills || [];
    s.bills.push({key: uniqueKey(s.bills, name), name, cat: guessCategory(name), amount, due: null, paid: false, stopped: false});
    return null;
  }
  function renameBill(s, key, nameText) {                        // POST /bill/name
    const b = findBill(s, key), name = String(nameText == null ? '' : nameText).trim().slice(0, 60);
    if (!b) return 'unknown';
    if (!name) return 'bill';
    b.name = name;
    return null;
  }
  function setDue(s, key, text) {                                // POST /bill/due ('' = none, else a whole day 1-31)
    const b = findBill(s, key);
    if (!b) return 'unknown';
    text = String(text == null ? '' : text).trim();
    if (text === '') { b.due = null; return null; }
    if (!/^\d{1,2}$/.test(text) || Number(text) < 1 || Number(text) > 31) return 'bill';
    b.due = Number(text);
    return null;
  }
  function setPaid(s, key, on) {                                 // POST /bill/paid (only ever ticked by the person)
    const b = findBill(s, key);
    if (!b) return 'unknown';
    b.paid = !!on;
    return null;
  }
  // the fixed list, then the person's own new ones
  const categories = s => CATEGORIES.concat(Array.isArray(s.cats) ? s.cats : []);
  function setBillCat(s, key, text) {                            // POST /bill/cat (a known name keeps its spelling, a new one joins the list)
    const b = findBill(s, key), cat = String(text == null ? '' : text).trim().slice(0, 30);
    if (!b) return 'unknown';
    if (!cat) return 'bill';
    const known = categories(s).find(c => c.toLowerCase() === cat.toLowerCase());
    if (!known) { s.cats = Array.isArray(s.cats) ? s.cats : []; s.cats.push(cat); }
    b.cat = known || cat;
    return null;
  }
  // v0.37: ⋯ → 🏷 Category on a spend (and '+ category' on an Unsorted one), the same list as bills
  function setSpendCat(s, idText, text) {                        // POST /spend/cat
    const x = findSpend(s, idText), cat = String(text == null ? '' : text).trim().slice(0, 30);
    if (!x) return null;
    if (!cat) return 'spend';
    const known = categories(s).find(c => c.toLowerCase() === cat.toLowerCase());
    if (!known) { s.cats = Array.isArray(s.cats) ? s.cats : []; s.cats.push(cat); }
    x.cat = known || cat;
    return null;
  }
  function setBillsPaid(s, keys) {                               // POST /bills/paid: the bell's ✓ on a whole day
    (Array.isArray(keys) ? keys : []).forEach(k => { const b = findBill(s, k); if (b) b.paid = true; });
    return null;
  }
  function deleteBill(s, key) {                                  // POST /bill/delete
    if (!findBill(s, key)) return 'unknown';
    s.bills = s.bills.filter(x => x.key !== key);
    return null;
  }

  // ---------- pots: a category + a monthly amount ----------
  // v0.50: a pot and a spend/bill match loosely: 'takeaway' = 'Takeaways' (case, spaces, a trailing s)
  const catKey = c => String(c == null ? '' : c).trim().toLowerCase().replace(/\s+/g, ' ').replace(/s$/, '');
  // v0.51: All | Categories in Add a spend and Bills: [{name, total, items}] biggest first, loose like the pots
  function catTotals(list) {
    const groups = [], by = {};
    (list || []).forEach(x => {
      const name = String(x.cat || '').trim() || 'Unsorted', k = catKey(name);
      if (!by[k]) { by[k] = {name, total: 0, items: []}; groups.push(by[k]); }
      by[k].total += x.amount || 0;
      by[k].items.push(x);
    });
    return groups.sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name));
  }
  function potCat(s, name) {                                     // an existing category, else the name becomes one
    const known = categories(s).find(c => catKey(c) === catKey(name));
    if (known) return known;
    s.cats = Array.isArray(s.cats) ? s.cats : []; s.cats.push(name);
    return name;
  }
  const findPot = (s, key) => (s.pots || []).find(x => x.key === key);
  const sameName = (s, name, except) => (s.pots || []).some(p => p !== except && p.name.toLowerCase() === name.toLowerCase());
  function addPot(s, amountText, nameText) {                     // POST /pot/add
    const name = String(nameText == null ? '' : nameText).trim().slice(0, 40);
    const text = String(amountText == null ? '' : amountText).trim();
    const amount = text === '' ? null : parseMoney(text);
    if (!name || sameName(s, name) || (text !== '' && amount === null)) return 'pot';
    s.pots = s.pots || [];
    s.pots.push({key: uniqueKey(s.pots, name), name, cat: potCat(s, name), amount});
    return null;
  }
  function setPotAmount(s, key, text) {                          // POST /pot/amount ('' = no amount: not a pot for now)
    const p = findPot(s, key);
    if (!p) return 'unknown';
    text = String(text == null ? '' : text).trim();
    if (text === '') { p.amount = null; return null; }
    const v = parseMoney(text);
    if (v === null) return 'pot';
    p.amount = v;
    return null;
  }
  function setPotCat(s, key, text) {                             // POST /pot/cat (⋯ → 🏷 Category, v0.50)
    const p = findPot(s, key), cat = String(text == null ? '' : text).trim().slice(0, 30);
    if (!p) return 'unknown';
    if (!cat) return 'pot';
    p.cat = potCat(s, cat);
    return null;
  }
  function renamePot(s, key, nameText) {                         // POST /pot/name (the category it collects stays)
    const p = findPot(s, key), name = String(nameText == null ? '' : nameText).trim().slice(0, 40);
    if (!p) return 'unknown';
    if (!name || sameName(s, name, p)) return 'pot';
    p.name = name;
    return null;
  }
  function deletePot(s, key) {                                   // POST /pot/delete
    if (!findPot(s, key)) return 'unknown';
    s.pots = s.pots.filter(x => x.key !== key);
    return null;
  }

  // ---------- payday: save this month, start the next ----------
  // POST /payday. Bad pay or bad left = 'pay' and nothing changes. A blank left = 0.
  function newPayday(s, day, payText, leftText) {
    const pay = parseMoney(payText);
    leftText = String(leftText == null ? '' : leftText).trim();
    const left = leftText === '' || isZeroText(leftText) ? 0 : parseMoney(leftText);
    if (pay === null || left === null) return 'pay';
    const all = s.spends || [], pots = s.pots || [];
    const next = x => x.upcoming && x.date >= day;               // an upcoming spend dated from the new payday on = next month's
    const spends = all.filter(x => !next(x));
    const first = spends.length ? spends.map(x => x.date).sort()[0] : day;
    s.history = s.history || [];
    s.history.push({
      start: s.payday || first, end: dayBefore(day), pay: s.pay || 0, left: s.left || 0, spare: monthEndSpare(Object.assign({}, s, {spends})),
      bills: (s.bills || []).map(b => ({key: b.key, name: b.name, cat: b.cat, amount: typeof b.amount === 'number' ? b.amount : null, stopped: !!b.stopped})),
      spends: clone(spends),
      pots: pots.map(p => ({key: p.key, name: p.name, cat: p.cat, amount: isSet(p) ? p.amount : null,
                            spent: (compute(Object.assign({}, s, {spends})).pots.find(q => q.key === p.key) || {spent: 0}).spent})),
    });
    s.payday = day; s.pay = pay; s.left = left; s.spends = all.filter(next);
    (s.bills || []).forEach(b => { b.paid = false; delete b.asked; });
    return null;
  }
  // ---------- payday date: the same day each month, a weekend moves it to the Friday before ----------
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  function payDate(y, m, day) {                                   // the payday of month m (1..12): short month = last day, Sat/Sun = Friday before
    const d = iso(y, m, Math.min(day, daysIn(y, m)));
    const wd = new Date(d + 'T00:00:00Z').getUTCDay();
    return wd === 6 ? dayBefore(d) : (wd === 0 ? dayBefore(dayBefore(d)) : d);
  }
  const monthStep = (y, m, n) => { const k = y * 12 + (m - 1) + n; return [Math.floor(k / 12), k % 12 + 1]; };
  function nextPayday(day, todayIso) {                            // the first payday on or after today (null when no day is set)
    if (!day) return null;
    const y = Number(todayIso.slice(0, 4)), m = Number(todayIso.slice(5, 7)), here = payDate(y, m, day);
    if (here >= todayIso) return here;
    const [ny, nm] = monthStep(y, m, 1);
    return payDate(ny, nm, day);
  }
  function paydayText(isoDay, todayIso) {                         // '25 Nov · in 17 days'
    const n = daysBetween(todayIso, isoDay), when = n <= 0 ? 'today' : (n === 1 ? 'tomorrow' : `in ${n} days`);
    return `${Number(isoDay.slice(8, 10))} ${MONTHS[Number(isoDay.slice(5, 7)) - 1]} · ${when}`;
  }
  function setPayDay(s, text) {                                   // POST /payday/day ('' = none; "25", "25th" are fine)
    text = String(text == null ? '' : text).trim();
    if (text === '') { s.payDay = null; return null; }
    const m = /^(\d{1,2})(?:st|nd|rd|th)?$/i.exec(text);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 31) return 'pay';
    s.payDay = Number(m[1]);
    return null;
  }
  // payday has come (the newest one on or before today) and no new pay was typed within a week of it
  function paydayDue(s, todayIso) {
    if (!s.payDay) return false;
    const y = Number(todayIso.slice(0, 4)), m = Number(todayIso.slice(5, 7));
    let last = payDate(y, m, s.payDay);
    if (last > todayIso) { const [py, pm] = monthStep(y, m, -1); last = payDate(py, pm, s.payDay); }
    return !s.payday || daysBetween(s.payday, last) > 7;
  }

  // ---------- the last backup ----------
  function setBackupDay(s, day) { s.lastBackup = day; return null; }       // POST /backup/saved
  function backupText(day, todayIso) {
    if (!day) return 'Not saved yet';
    const n = daysBetween(day, todayIso);
    return `Last saved ${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]} · ${n <= 0 ? 'today' : (n === 1 ? 'yesterday' : n + ' days ago')}`;
  }

  // ---------- reminders (the 🔔 bell): [{kind, key?, text, go}] ----------
  function reminders(s, todayIso) {
    const r = compute(s, todayIso), list = [];
    r.bills.filter(b => !b.stopped && !b.paid && b.duePassed).forEach(b => list.push({kind: 'bill', key: b.key,
      text: `${b.name} was due on the ${b.dueText}. Check your bank app.`, go: `tr.bill[data-key="${b.key}"]`}));
    if (s.snooze === todayIso) return list;
    if (paydayDue(s, todayIso)) list.push({kind: 'payday', text: 'Payday is here. Put in your new pay.', go: '#quicktab'});
    r.cards.forEach(c => c.asks.forEach(a => list.push({kind: 'card', key: a.key,
      text: `${a.name} ${money(a.amount)}: take it off the ${c.name} card?`, go: `.cardask[data-bill="${a.key}"]`})));
    const days = s.lastBackup ? daysBetween(s.lastBackup, todayIso) : null;
    if (s.lastBackup ? days >= 30 : (r.pay > 0 || r.hasHistory)) list.push({kind: 'backup',
      text: s.lastBackup ? `No backup for ${days} days.` : 'No backup saved yet.', go: '#qsave'});
    return list;
  }

  // v0.37 (Darren, 24 Oct, mock B): the bell shows bills due the same day as ONE line ('1st · 2 bills · £711.00');
  // a lone bill keeps its own line. Bill lines in date order, then payday, card, backup.
  function remindLines(s, todayIso) {
    const r = compute(s, todayIso), all = reminders(s, todayIso), bills = all.filter(x => x.kind === 'bill');
    const days = new Map();
    bills.forEach(x => {
      const b = r.bills.find(y => y.key === x.key), at = b.dueAt || '';
      if (!days.has(at)) days.set(at, []);
      days.get(at).push({key: b.key, name: b.name, amount: b.used, dueText: b.dueText, go: x.go});
    });
    const lines = [...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([at, items]) => {
      const total = items.reduce((a, i) => a + i.amount, 0);
      if (items.length === 1) {
        const i = items[0];
        return {kind: 'bill', key: i.key, dueAt: at, items, total, text: `${i.name} · ${i.dueText}`, sub: `${money(i.amount)} · check your bank app`, go: i.go};
      }
      return {kind: 'bills', keys: items.map(i => i.key), dueAt: at, items, total,
              text: `${items[0].dueText} · ${items.length} bills · ${money(total)}`, sub: 'check your bank app'};
    });
    return lines.concat(all.filter(x => x.kind !== 'bill'));
  }

  // ---------- v0.37: Google Drive keeps one file per pay month, the last 3 ----------
  function driveName(s, todayIso, demo) {
    const d = (s && s.payday) || todayIso, m = MONTHS[Number(d.slice(5, 7)) - 1];
    return `wheres-my-money-${demo ? 'demo-' : ''}backup ${m} ${d.slice(0, 4)}.json`;
  }
  function drivePrune(files, keep) {                            // the ids to delete: a 2nd copy of a month, then all but the newest `keep`
    const seen = new Set(), kept = [], drop = [];
    files.slice().sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : a.modifiedTime > b.modifiedTime ? -1 : 0))
      .forEach(f => { if (seen.has(f.name)) drop.push(f.id); else { seen.add(f.name); kept.push(f); } });
    return drop.concat(kept.slice(keep).map(f => f.id));
  }

  // POST /reminders/clear: bills ticked as checked; payday, card and backup quiet for today only
  function clearReminders(s, todayIso) {
    reminders(s, todayIso).filter(x => x.kind === 'bill').forEach(x => setPaid(s, x.key, true));
    s.snooze = todayIso;
    return null;
  }

  function cardAdd(s, iso, amountText, nameText, paid, cardKey) {   // POST /card/add
    const c = cardOf(s, cardKey);
    if (!c) return 'unknown';
    const amount = parseMoney(amountText);
    const name = String(nameText == null ? '' : nameText).trim() || (paid ? 'Paid off' : '');
    if (amount === null || !name) return 'card';
    addCard(c, iso, paid ? -amount : amount, name);
    return null;
  }
  function cardRemove(s, idText, cardKey) {                      // POST /card/remove
    const c = cardOf(s, cardKey);
    if (!c) return 'unknown';
    if (!/^\s*-?\d+\s*$/.test(String(idText))) return null;
    const id = Number(idText), keep = c.items.filter(i => i.id !== id);
    if (keep.length !== c.items.length) { c.items = keep; tidy(c); }
    return null;
  }
  function cardLimit(s, text, cardKey) {                         // POST /card/limit
    const c = cardOf(s, cardKey);
    if (!c) return 'unknown';
    const v = parseMoney(text);
    if (v === null) return 'pay';
    c.limit = v;
    tidy(c);
    return null;
  }
  function setUsed(s, iso, amount, cardKey) {                    // creditcard.set_used: a Correction line makes the total match
    const c = cardOf(s, cardKey);
    if (!c) return 'unknown';
    const d = r2(Number(amount) - cardUsed(c));
    if (d !== 0) addCard(c, iso, d, 'Correction', 'correction');
    return null;
  }
  function cardBalance(s, iso, text, cardKey) {                  // POST /card/balance (the Used box)
    if (!cardOf(s, cardKey)) return 'unknown';
    text = String(text == null ? '' : text).trim();
    const amount = isZeroText(text) ? 0 : parseMoney(text);
    if (amount === null) return 'pay';
    return setUsed(s, iso, amount, cardKey);
  }

  // ---------- several credit cards ----------
  function addCreditCard(s, nameText, limitText) {               // POST /card/new
    const name = String(nameText == null ? '' : nameText).trim().slice(0, 40), limit = parseMoney(limitText);
    if (!name || limit === null) return 'newcard';
    const cards = cardsOf(s);
    cards.push({key: uniqueKey(cards, name), name, limit, carry: 0, next: 1, items: []});
    return null;
  }
  function renameCreditCard(s, key, nameText) {                  // POST /card/name
    const c = cardsOf(s).find(x => x.key === key), name = String(nameText == null ? '' : nameText).trim().slice(0, 40);
    if (!c) return 'unknown';
    if (!name) return 'newcard';
    c.name = name;
    return null;
  }
  function deleteCreditCard(s, key) {                            // POST /card/delete (the last one can go too)
    if (!cardsOf(s).some(x => x.key === key)) return 'unknown';
    s.cards = s.cards.filter(x => x.key !== key);
    return null;
  }
  function setBillCard(s, key, text) {                           // POST /bill/card ('' = this bill pays no card)
    const b = findBill(s, key);
    if (!b) return 'unknown';
    text = String(text == null ? '' : text).trim();
    if (text === '') { b.card = ''; return null; }
    const lower = text.toLowerCase(), cards = cardsOf(s);
    const c = cards.find(x => x.key.toLowerCase() === lower) || cards.find(x => x.name.toLowerCase() === lower);
    if (!c) return 'bill';
    b.card = c.key;
    return null;
  }
  // POST /card/ask: did the bill that pays a card come out? yes = take its amount off, other = a typed amount, no = nothing
  function cardAsk(s, today, billKey, answer, amountText) {
    const b = findBill(s, billKey), cards = cardsOf(s);
    const c = b ? cards.find(x => x.key === billCardKey(cards, b)) : null;
    if (!b || !c) return 'unknown';
    if (answer === 'yes') addCard(c, today, -(typeof b.amount === 'number' ? b.amount : 0), 'Paid off', 'paid');
    else if (answer === 'other') {
      const v = parseMoney(amountText);
      if (v === null) return 'card';
      addCard(c, today, -v, 'Paid off', 'paid');
    }
    b.asked = s.payday || today.slice(0, 8) + '01';
    return null;
  }

  // ---------- the fake starting data (the ?demo=1 page; "today" there is about 8 Nov 2024) ----------
  function FAKE() {
    const b = (key, cat, amount, due) => ({key, name: key, cat, amount, due, paid: false, stopped: false});
    const bills = () => [
      b('Rent', 'Household', 550, 1),
      b('Council Tax', 'Household', 161, 1),
      b('Energy Co', 'Household', 157.12, 5),
      b('Bills', 'Household', 150, 3),
      b('Gym Club', 'Subscriptions', 50, 10),
      b('Sky Digital', 'Household', 46.5, 15),
      b('Phone Co', 'Household', 40.11, 18),
      b('Water Board', 'Household', 15.75, 20),
      b('Tv Licence', 'Household', 13.25, 28),
    ];
    const pots = () => [{key: 'Shopping', name: 'Shopping', cat: 'Shopping', amount: 400},
                        {key: 'Fuel', name: 'Fuel', cat: 'Fuel', amount: 150},
                        {key: 'Going out', name: 'Going out', cat: 'Going out', amount: null}];
    // a month that was saved at an earlier payday: [amount, name, category] spends
    const month = (start, end, energy, list) => {
      const bl = bills().map(x => ({key: x.key, name: x.name, cat: x.cat, amount: x.key === 'Energy Co' ? energy : x.amount, stopped: false}));
      const sp = list.map(([amount, name, cat], i) => ({id: i + 1, date: start, amount, name, cat}));
      const pl = pots().map(p => ({key: p.key, name: p.name, cat: p.cat, amount: p.amount,
                                   spent: sum(sp.filter(x => x.cat === p.cat).map(x => x.amount))}));
      return {start, end, pay: 2500, left: 0, spare: 2500 - sum(bl.map(x => x.amount)) - sum(sp.map(x => x.amount)),
              bills: bl, spends: sp, pots: pl};
    };
    return {
      v: 3, pay: 2500, left: 0, payday: '2024-10-25', payDay: 25, lastBackup: '2024-11-03', cats: [],
      bills: bills(), pots: pots(),
      spends: [
        {id: 1, date: '2024-10-25', amount: 12.5, name: 'Costa', cat: 'Unsorted'},
        {id: 2, date: '2024-10-25', amount: 34.2, name: 'Tesco', cat: 'Food shopping'},
        {id: 3, date: '2024-10-30', amount: 60, name: 'Shell', cat: 'Fuel'},
      ],
      history: [
        month('2024-07-25', '2024-08-24', 148.4, [[210, 'Tesco', 'Food shopping'], [70, 'Shell', 'Fuel'], [85, 'Amazon', 'Shopping'], [32, 'Odeon', 'Going out']]),
        month('2024-08-25', '2024-09-24', 152.9, [[225, 'Tesco', 'Food shopping'], [64, 'Shell', 'Fuel'], [120, 'Amazon', 'Shopping'], [45, 'The Red Lion pub', 'Going out'], [9.5, 'Costa', 'Unsorted']]),
        month('2024-09-25', '2024-10-24', 157.12, [[216, 'Tesco', 'Food shopping'], [22, 'Aldi', 'Food shopping'], [81, 'Shell', 'Fuel'], [60, 'Amazon', 'Shopping'], [28, 'Nandos', 'Going out'], [12.5, 'Costa', 'Unsorted'], [14, 'Costa', 'Unsorted']]),
      ],
      cards: [{key: 'Zopa', name: 'Zopa', limit: 500, carry: 0, next: 2,
               items: [{id: 1, date: '2024-10-25', amount: 45, name: 'Amazon', kind: 'spend'}]}],
      ideas: [],
    };
  }

  // ---------- Move & rename (fintrack/layout.py): the saved order of the boxes ----------
  const SORTS = ['cards', 'bills', 'lastmonth', 'cats'];
  function setLayout(s, sort, ids) {                             // POST /layout (junk is ignored)
    if (SORTS.indexOf(sort) < 0 || !Array.isArray(ids)) return null;
    s.layout = s.layout || {};
    s.layout[sort] = ids.filter(x => typeof x === 'string').slice(0, 200);
    return null;
  }
  function resetLayout(s) { delete s.layout; return null; }      // POST /layout/reset
  function order(items, ids, idOf) {                             // saved ones first, in the saved order; the rest keep theirs
    if (!Array.isArray(ids)) return items.slice();
    const at = x => { const i = ids.indexOf(idOf(x)); return i < 0 ? Infinity : i; };
    return items.map((x, i) => [x, i]).sort((a, b) => (at(a[0]) - at(b[0])) || (a[1] - b[1]) || 0).map(p => p[0]);
  }
  function renameRow(s, id, nameText) {                          // POST /name (only a bill row can be renamed)
    const m = /^bill:(.*)$/s.exec(String(id == null ? '' : id));
    if (m) renameBill(s, m[1], nameText);                        // empty or unknown: nothing happens
    return null;
  }

  // ---------- Ideas & feedback (fintrack/v3/ideas.py) ----------
  const IDEA_TAGS = {idea: '\u{1F4A1} Idea', odd: '\u{1F41E} Something odd', love: '\u2764\uFE0F Love this'};
  const IDEA_BUTTONS = {idea: '\u{1F4A1} Idea', odd: '\u{1F41E} Odd', love: '\u2764\uFE0F Love it'};
  function addIdea(s, text, tag, atIso) {                        // POST /ideas/add
    const t = String(text == null ? '' : text).split(/\s+/).filter(Boolean).join(' ').slice(0, 1000);
    if (!t) return 'idea';
    s.ideas = s.ideas || [];
    s.ideas.push({id: Math.max(0, ...s.ideas.map(n => n.id)) + 1, text: t, tag: IDEA_TAGS[tag] ? tag : 'idea', at: atIso, done: false});
    return null;
  }
  const findIdea = (s, idText) => (s.ideas || []).find(n => String(n.id) === String(idText).trim());
  function toggleIdea(s, idText) {                               // POST /ideas/done (done <-> not done)
    const n = findIdea(s, idText);
    if (n) n.done = !n.done;
    return null;
  }
  function removeIdea(s, idText) {                               // POST /ideas/remove
    const n = findIdea(s, idText);
    if (n) s.ideas = s.ideas.filter(x => x !== n);
    return null;
  }
  function ideasCopy(s, version, todayIso) {                     // the open notes as text for a chat with Claude, oldest first
    const lines = ["Where's My Money? Lite ideas & feedback (v" + version + ', copied ' + day(todayIso) + ')', ''];
    (s.ideas || []).forEach(n => { if (!n.done) lines.push('- ' + IDEA_TAGS[n.tag] + ' (' + day(n.at) + '): ' + n.text); });
    return lines.join('\n').replace(/\n+$/, '');
  }

  const Money = {FAKE, TEMPLATE, CATEGORIES, categories, compute, setUsed, parseMoney, guessCategory, allocate, r2, ordinal, migrate, monthEndSpare,
    exportBackup, importBackup, backupName,
    addSpend, removeSpend, paySpend, setSpendDate, setPay, setLeft, setBill, setStopped, addBill, renameBill, setDue, setPaid, setBillCat, deleteBill,
    catTotals, setSpendCat, setPotCat, setSpendAmount, renameSpend, setBillsPaid, remindLines, driveName, drivePrune,
    nextPayday, paydayText, setPayDay, paydayDue, setBackupDay, backupText, reminders, clearReminders,
    addPot, setPotAmount, renamePot, deletePot, newPayday, cardAdd, cardRemove, cardLimit, cardBalance,
    addCreditCard, renameCreditCard, deleteCreditCard, setBillCard, cardAsk,
    setLayout, resetLayout, order, renameRow, IDEA_TAGS, IDEA_BUTTONS, addIdea, toggleIdea, removeIdea, ideasCopy, VERSION,
    fmt: {money, diff, day, tagsplit, pyfloat, r0}};
  if (typeof module !== 'undefined' && module.exports) module.exports = Money;
  else root.Money = Money;
})(typeof window !== 'undefined' ? window : globalThis);
