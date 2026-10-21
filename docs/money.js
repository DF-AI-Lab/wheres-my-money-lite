/* Where's My Money? Lite - step 2: the maths (a port of live v3.62: spare.pay_block, creditcard.py, typed.py,
   categories.py, left.parse_money and the routes in web.py). Pure functions: no page, no storage, no network.
   Works in the browser (window.Money) and in node (module.exports). Fake data only.

   State: {pay, left, cycles, bills:[{key,name,cat,type,avg,last,new,stopped,change}],
           spends:[{id,date,amount,name,cat}],
           card:{limit,carry,next,items:[{id,date,amount,name,kind}]}}
   Dates are ISO text (YYYY-MM-DD). Every mutator changes the state it is given and returns null when it worked,
   or an error code ('pay' | 'spend' | 'card') exactly where live redirects to /?error=CODE. */
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

  // categories.guess_category (the name only; first keyword group that matches whole words wins)
  const KEYWORDS = [
    ['Household', ['RENT', 'WATER', 'COUNCIL', 'CITY OF', 'E.ON', 'ENERGY', 'ELECTRIC', 'GAS', 'OCTOPUS', 'SKY',
                   'TV LICENCE', 'LICENCE', 'MOBILE', 'BROADBAND', 'VIRGIN MEDIA', 'BT', 'LIFE', 'INSURANCE', 'BILLS']],
    ['Car', ['CAR', 'PETROL', 'FUEL', 'PUMP', 'DVLA', 'SHELL', 'ESSO', 'TEXACO', 'PARKING']],
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

  function cardOf(s) {                                   // make sure the card has all its fields
    const c = s.card || (s.card = {});
    if (c.limit === undefined) c.limit = 500;
    if (c.carry === undefined) c.carry = 0;
    if (!Array.isArray(c.items)) c.items = [];
    c.items.forEach(i => { if (!i.kind) i.kind = i.amount > 0 ? 'spend' : 'paid'; });
    if (c.next === undefined) c.next = Math.max(0, ...c.items.map(i => i.id)) + 1;
    return c;
  }
  const cardUsed = c => r2(c.carry + sum(c.items.map(i => i.amount)));

  function addCard(s, iso, amount, name, kind) {
    const c = cardOf(s);
    amount = r2(Number(amount));
    c.items.push({id: c.next, date: iso, amount, name: String(name).trim().slice(0, 60),
                  kind: kind || (amount > 0 ? 'spend' : 'paid')});
    c.next += 1;
    tidy(c);
  }

  // ---------- compute: everything the page shows ----------
  function compute(s) {
    const bills = (s.bills || []).map(b => {
      const changed = b.change !== undefined && b.change !== null;
      const stopped = !!b.stopped && !changed;
      const last = b.last || 0;
      const estimated = !changed && !stopped && last <= 0;
      const used = changed ? b.change : (stopped ? 0 : (estimated ? b.avg : last));
      return {key: b.key, id: 'bill:' + b.key, name: b.name === undefined ? b.key : b.name, orig: b.name === undefined ? b.key : b.name,
              cat: b.cat, type: b.type, avg: b.avg, last, used, changed, estimated, stopped, new: !!b.new,
              diff: (estimated || stopped) ? null : used - b.avg};
    });
    bills.sort((a, b) => (a.stopped - b.stopped) || (b.avg - a.avg) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const live = bills.filter(b => !b.stopped);
    const billsTotal = sum(live.map(b => b.used));
    const billsAvg = sum(live.map(b => b.avg));

    const pay = s.pay || 0, left = s.left || 0;
    const spends = (s.spends || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    const moneyForSpending = pay + left - billsTotal;            // spare cash with bills taken off
    const leftNow = moneyForSpending - sum(spends.map(x => x.amount));
    const spendsTotal = moneyForSpending - leftNow;              // live: typed_total = money - left_now

    const total = pay + left;                                    // the ring: pay + left split three ways
    const f = x => total > 0 ? Math.max(x, 0) / total : 0;
    const spareRing = Math.max(total - billsTotal - spendsTotal, 0);
    const pct = {bills: Math.round(100 * f(billsTotal)), spends: Math.round(100 * f(spendsTotal)),
                 spare: Math.round(100 * f(spareRing))};

    const c = cardOf(s);
    const rows = allocate(c.items, c.carry).map(r => Object.assign(r, {removable: r.status !== 'paid'}));
    const used = cardUsed(c);
    const pc = c.limit ? 100 * used / c.limit : 0;
    const card = {limit: c.limit, carry: c.carry, used, free: r2(c.limit - used), pc, pctUsed: r0(pc), rows};

    return {pay, left, bills, billsTotal, billsAvg, billsDiff: billsTotal - billsAvg, spends, spendsTotal,
            moneyForSpending, leftNow, spare: leftNow, pct, card,
            anyEstimated: bills.some(b => b.estimated), cycles: s.cycles || 2};
  }

  // ---------- the routes (web.py), as functions on the state ----------
  function addSpend(s, iso, amountText, nameText) {              // POST /add
    const amount = parseMoney(amountText), name = String(nameText == null ? '' : nameText).trim();
    if (amount === null || !name) return 'spend';
    s.spends = s.spends || [];
    s.spends.push({id: Math.max(0, ...s.spends.map(x => x.id)) + 1, date: iso, amount, name, cat: guessCategory(name)});
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
  // POST /bill: returns null | 'pay' (bad amount) | 'unknown' (no such bill: nothing happens)
  function setBill(s, key, text) {
    const b = (s.bills || []).find(x => x.key === key);
    if (!b) return 'unknown';
    text = String(text == null ? '' : text).trim();
    if (text === '') { delete b.change; return null; }
    let v = parseMoney(text);
    if (v === null && isZeroText(text)) v = 0;                   // 0 = not paying it this month
    if (v === null) return 'pay';
    b.change = v;
    return null;
  }
  function setStopped(s, key, on) {                              // POST /stopped (Lite: a simple switch; Stop rules = issue #2)
    const b = (s.bills || []).find(x => x.key === key);
    if (!b) return 'unknown';
    b.stopped = !!on;
    return null;
  }
  function cardAdd(s, iso, amountText, nameText, paid) {         // POST /card/add
    const amount = parseMoney(amountText);
    const name = String(nameText == null ? '' : nameText).trim() || (paid ? 'Paid off' : '');
    if (amount === null || !name) return 'card';
    addCard(s, iso, paid ? -amount : amount, name);
    return null;
  }
  function cardRemove(s, idText) {                               // POST /card/remove
    if (!/^\s*-?\d+\s*$/.test(String(idText))) return null;
    const c = cardOf(s), id = Number(idText), keep = c.items.filter(i => i.id !== id);
    if (keep.length !== c.items.length) { c.items = keep; tidy(c); }
    return null;
  }
  function cardLimit(s, text) {                                  // POST /card/limit
    const v = parseMoney(text);
    if (v === null) return 'pay';
    const c = cardOf(s);
    c.limit = v;
    tidy(c);
    return null;
  }
  function setUsed(s, iso, amount) {                             // creditcard.set_used: a Correction line makes the total match
    const c = cardOf(s), d = r2(Number(amount) - cardUsed(c));
    if (d !== 0) addCard(s, iso, d, 'Correction', 'correction');
  }
  function cardBalance(s, iso, text) {                           // POST /card/balance (the Used box)
    text = String(text == null ? '' : text).trim();
    const amount = isZeroText(text) ? 0 : parseMoney(text);
    if (amount === null) return 'pay';
    setUsed(s, iso, amount);
    return null;
  }

  // ---------- the fake starting data (what the live page shows on the fake statements) ----------
  function FAKE() {
    const b = (key, type, cat, avg, isNew) => ({key, name: key, cat, type, avg, last: avg, new: !!isNew, stopped: false});
    return {
      pay: 2500, left: 0, cycles: 2,
      bills: [
        b('Rent', 'SO', 'Household', 550),
        b('Council Tax', 'DD', 'Household', 161, true),
        b('Energy Co', 'DD', 'Household', 157.12, true),
        b('Bills', 'SO', 'Household', 150, true),
        b('Gym Club', 'DD', 'Unsorted', 50),
        b('Sky Digital', 'DD', 'Household', 46.5),
        b('Phone Co', 'DD', 'Unsorted', 40.11),
        b('Water Board', 'DD', 'Household', 15.75),
        b('Tv Licence', 'DD', 'Household', 13.25),
      ],
      spends: [
        {id: 1, date: '2024-10-25', amount: 12.5, name: 'Costa', cat: 'Unsorted'},
        {id: 2, date: '2024-10-25', amount: 34.2, name: 'Tesco', cat: 'Food shopping'},
      ],
      card: {limit: 500, carry: 0, next: 2,
             items: [{id: 1, date: '2024-10-25', amount: 45, name: 'Amazon', kind: 'spend'}]},
    };
  }

  const Money = {FAKE, compute, setUsed, parseMoney, guessCategory, allocate, r2,
    addSpend, removeSpend, setPay, setLeft, setBill, setStopped, cardAdd, cardRemove, cardLimit, cardBalance,
    fmt: {money, diff, day, tagsplit, pyfloat, r0}};
  if (typeof module !== 'undefined' && module.exports) module.exports = Money;
  else root.Money = Money;
})(typeof window !== 'undefined' ? window : globalThis);
