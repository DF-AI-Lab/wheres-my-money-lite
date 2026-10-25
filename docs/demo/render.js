/* Where's My Money? Lite - draws the parts of the page that depend on the numbers.
   A port of live's Jinja templates (demo_top.html, demo_bills.html and the spend / credit card cards of home.html):
   the markup it writes is the same markup live sends. Go A adds the pots card, the due day / Paid ticks on bills and
   the history cards (last month, categories, 6 / 12 months), all from the months saved at payday.
   Lite.render(state) runs once, before the page's own script, so that script binds to what is drawn here. */
(function (root) {
  'use strict';
  const M = root.Money, F = M.fmt, money = F.money;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const f2 = x => x.toFixed(2);

  const ERRORS = {
    pay: 'Sorry, I could not read that as money.',
    spend: 'Sorry, type an amount and a name, e.g. 12.50 and Coffee.',
    card: 'Sorry, type an amount and a name for the credit card, e.g. 40 and Shell.',
    bill: 'Sorry, type a name for the bill (and an amount, e.g. 12.99).',
    pot: 'Sorry, type a name and a monthly amount for the pot, e.g. 400 and Shopping.',
    newcard: 'Sorry, type a name and a limit for the card, e.g. Zopa and 500.',
  };
  const INLINE = ['spend', 'card', 'newcard', 'bill', 'pot'];                 // errors shown inside their own card
  const errorBox = (err, code) => err === code ? `<div class="error fade">${ERRORS[code]}</div>` : '';

  // ---------- the pieces ----------
  function statementRows(r) {
    const left = r.left ? money(r.left) : 'Add';
    return `
      <div class="r"><span>Pay</span><button type="button" class="link tap" data-edit="qpay" title="Change this month's pay">${money(r.pay)}</button></div>
      <div class="r"><span>+ Left from last month</span><button type="button" class="link tap" data-edit="qleft" title="Change what was left from last month">${left}</button></div>
      <div class="r"><span><i class="dot bill"></i>− Bills</span><span class="k-bill" id="st-bills">${money(r.billsTotal)}</span></div>
      <div class="r spends"><span><i class="dot spend"></i>− Spends ${infoBtn('Spends that are not in a pot. Pot spends come out of the pot, so they show in Pots left.')}</span><span class="k-spend" id="st-spends">${money(r.spendsTotal)}</span></div>
      ${potsLine(r)}
      <div class="r start"><span>Starting spare</span><span id="st-start">${money(r.startSpare)}</span></div>
      <div class="r tot"><span>Actual spare</span><span id="st-spare">${money(r.leftNow)}</span></div>
    `;
  }

  // one pot line (Darren, 22 Oct): what is left in the pots, less any pot that went over
  function potsLine(r) {
    const net = r.potsLeft - r.potsOver;
    const over = r.potsOver > 0.004 ? ` <span class="labels">(${money(r.potsOver)} over)</span>` : '';
    return `<div class="r pots"><span><i class="dot pot"></i>${net < -0.004 ? 'Pots over' : 'Pots left'}${over} ${infoBtn('Pot money still left to spend this month (less any pot that went over).')}</span><span class="k-pot" id="st-potleft">${money(Math.abs(net))}</span></div>`;
  }

  // one tile per card; only the first keeps the ids the page script and tests look for
  function zopaTile(c, first) {
    const pc = c.pc, pcr = Math.min(Math.max(pc, 0), 100), n = F.r0(pc);
    const id = (name) => first ? ` id="${name}"` : '';
    return `

    <div class="tile wide zcard"><div class="zl">
        <div class="label">${esc(c.label)}</div>
        <div class="zrow"><i class="dot zused"></i><span>Used</span><b${id('ccused')}>${money(c.used)}</b></div>
        <div class="zrow"><i class="dot zfree"></i><span>Free</span><b class="${c.free < 0 ? 'bad' : 'zfreeval'}"${id('ccfree')}>${money(c.free)}</b></div>
        <div class="zlimit">Limit ${money(c.limit)}</div></div>
      <svg${id('zring')} class="zring" viewBox="0 0 100 100" role="img" aria-label="${n}% of the limit used">
        <circle cx="50" cy="50" r="40" class="z-free"/>
        <circle cx="50" cy="50" r="40" class="z-used" transform="rotate(-90 50 50)"
          stroke-dasharray="${Math.max(pcr * 2.5133 - 1.5, 0).toFixed(1)} 251.3"/>
        <text x="50" y="52" text-anchor="middle" class="z-pc">${n}%</text>
        <text x="50" y="67" text-anchor="middle" class="z-sub">used</text>
      </svg>
    </div>
  `;
  }

  // v0.36 (mock H2): Upcoming spends (an expected date) sit under "Coming up" until that date, then count as paid by
  // themselves (green ✓). Every row: date · category ⓘ, and ⋯ = Change date / ✅ Paid (upcoming only) / Remove.
  const SPEND_TIP = {
    upcoming: 'Expected date. When this date comes it moves to Paid by itself. Tap ⋯ to change the date, or to mark it paid early.',
    gone: 'The expected date has gone, so it should be paid. Please check your bank app it came out.',
    added: 'This is the date you added it. If it went out on another day, tap ⋯ to change the date.',
    dated: 'You changed this date. Tap ⋯ to change it again.',
  };
  const shortDay = iso => F.day(iso).replace(/ \d{4}$/, '');           // '20 Nov'
  function spendRow(s) {
    const unsorted = !s.cat || s.cat === 'Unsorted';                  // v0.37: like bills, '+ category' until one is set
    const where = s.pot ? `<i class="dot pot"></i>${esc(s.pot)}` : (unsorted ? addLink('cat', '+ category') : esc(s.cat));
    const when = s.upcoming ? `expected ${shortDay(s.date)}` : F.day(s.date);
    const tip = s.upcoming ? SPEND_TIP.upcoming : (s.autoPaid ? SPEND_TIP.gone : (s.dated ? SPEND_TIP.dated : SPEND_TIP.added));
    const cls = s.upcoming ? ' upcoming' : (s.autoPaid ? ' paid' : '');
    return `

          <tr class="drow${cls}" data-id="${s.id}" data-name="${esc(s.name)}" data-date="${esc(s.date)}" data-cat="${esc(s.cat || 'Unsorted')}" data-amount="${s.amount.toFixed(2)}" data-up="${s.upcoming ? 1 : 0}"><td><b>${esc(s.name)}</b><span class="labels">${when} · ${where} ${infoBtn(tip)}</span></td><td class="n">${money(s.amount)}</td>
              <td class="n smore"><button type="button" class="more" aria-haspopup="true" aria-label="Change or remove ${esc(s.name)}">⋯</button><form method="post" action="/remove" hidden><input type="hidden" name="id" value="${s.id}"></form></td></tr>

        `;
  }
  function spendCard(r, err) {
    const up = r.spends.filter(s => s.upcoming), done = r.spends.filter(s => !s.upcoming);
    const head = (text, list) => `<tr class="sgrp"><td colspan="3">${text} · ${money(list.reduce((a, s) => a + s.amount, 0))}</td></tr>`;
    const rows = up.length ? head('Coming up', up) + up.map(spendRow).join('') + head('Paid', done) + done.map(spendRow).join('')
                           : done.map(spendRow).join('');
    return `<div class="card" data-id="spend" data-card="spend">
    <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot spend"></i> Add a spend<button type="button" class="fold" title="Fold">▾</button></h2>
    ${errorBox(err, 'spend')}

    <div class="spendseg" role="group" aria-label="Paid or upcoming"><button type="button" data-up="0" aria-pressed="true">Paid</button><button type="button" data-up="1" aria-pressed="false">Upcoming</button></div>
    <form class="inline" method="post" action="/add">
      <input class="amount" type="text" name="amount" inputmode="decimal" placeholder="12.50" aria-label="Amount">
      <input class="name" type="text" name="name" placeholder="Coffee" aria-label="What">
      <button type="submit">Add</button>
      <input type="hidden" name="upcoming" value="0">
      <label class="spenddate" hidden>📅 Expected on <input type="date" name="date" aria-label="Expected date"></label>
    </form>
    ${r.spends.length ? `
      <table style="margin-top:12px">
        ${rows}
      </table>
    ` : ''}

    <div class="sum" style="margin-top:12px">
      <span>Money for spending</span><span class="n" id="mfs">${money(r.pay + r.left - r.billsAll)}</span>
      <span>Typed so far</span><span class="n" id="typed">${money(r.spendsAll)}</span>
      <span class="eq">Left now</span><span class="n eq" id="leftnow">${money(r.leftNow)}</span>
    </div>
  </div>`;
  }

  // the question under a card's heading: did the bill that pays it come out?
  function cardAsk(a) {
    const hid = (n, v) => `<input type="hidden" name="${n}" value="${esc(v)}">`;
    const when = a.dueText ? `was due on the ${a.dueText}.` : 'is due this month.';
    return `<div class="ask cardask" data-bill="${esc(a.key)}"><b>${esc(a.name)} ${money(a.amount)}</b> ${when} Take ${money(a.amount)} off the card?
      <div class="askbtns"><form method="post" action="/card/ask">${hid('bill', a.key)}${hid('answer', 'yes')}<button type="submit">Yes, ${money(a.amount)}</button></form>
        <button type="button" class="small askother">Other amount</button>
        <form method="post" action="/card/ask">${hid('bill', a.key)}${hid('answer', 'no')}<button type="submit" class="small">No</button></form></div></div>`;
  }

  function cardCard(c, first, err, title) {
    const key = `<input type="hidden" name="card" value="${esc(c.key)}">`;
    const rows = c.rows.map(x => `

          <tr class="drow ${x.status === 'paid' ? 'crossed' : ''}"><td><b>${esc(x.name)}</b><span class="labels">${F.day(x.date)}${x.status === 'part' ? ' · ' + money(x.left) + ' left' : ''}</span></td>
              <td class="n ${x.amount < 0 ? 'good' : ''}">${money(x.amount)}</td>
              <td class="n">${x.removable ? `<form method="post" action="/card/remove">${key}<input type="hidden" name="id" value="${x.id}"><button class="small xbtn" type="submit" title="Remove" aria-label="Remove ${esc(x.name)}">×</button></form>` : ''}</td></tr>

        `).join('');
    return `<div class="card" data-id="card:${esc(c.key)}" data-card="card" data-key="${esc(c.key)}" data-name="${esc(c.name)}">
    <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot zused"></i> ${esc(title)}<button type="button" class="fold" title="Fold">▾</button></h2>
    ${first ? errorBox(err, 'card') + errorBox(err, 'newcard') : ''}
    ${c.asks.map(cardAsk).join('')}
    <form class="inline" method="post" action="/card/add">${key}
      <input class="amount" type="text" name="amount" inputmode="decimal" placeholder="40" aria-label="Amount">
      <input class="name" type="text" name="name" placeholder="Shell" aria-label="What">
      <button type="submit">Add</button>
      <button type="submit" class="small" name="paid" value="1" title="Money you paid off the card (name can be empty)">Paid off</button>
    </form>
    ${c.rows.length ? `
      <table style="margin-top:12px">
        ${rows}
      </table>
    ` : ''}

    <div class="sum cardsum" style="margin-top:12px">
      <span>Limit</span><span class="n"><form class="inline" method="post" action="/card/limit">${key}<input class="amount" type="text" name="amount" inputmode="decimal" value="${f2(c.limit)}" aria-label="Limit"><button class="small" type="submit">Change</button></form></span>
      <span>Used <span class="labels">type the ${esc(c.name)} app's amount to make it exact</span></span><span class="n"><form class="inline" method="post" action="/card/balance"${first ? ' id="ccbalform"' : ''}>${key}<input class="amount" type="text" name="amount"${first ? ' id="ccused2"' : ''} inputmode="decimal" value="${f2(c.used)}" aria-label="What the ${esc(c.name)} card owes now"><button class="small" type="submit">Change</button></form></span>
      <span class="eq">Free</span><span class="n eq ccfree2"${first ? ' id="ccfree2"' : ''}>${money(c.free)}</span>
    </div>
    <div class="cardfoot"><span class="potmore cardmore"><button type="button" class="more" aria-haspopup="true" aria-label="Change or remove ${esc(c.name)}">⋯</button></span></div>
  </div>`;
  }

  // no cards at all: one box to add the first
  function noCardBox(err) {
    return `<div class="card" data-id="card" data-card="card">
    <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot zused"></i> Credit card<button type="button" class="fold" title="Fold">▾</button></h2>
    ${errorBox(err, 'card')}${errorBox(err, 'newcard')}
    <div class="labels">No credit cards yet.</div>
    <form class="inline" method="post" action="/card/new" style="margin-top:12px">
      <input class="name" type="text" name="name" placeholder="Zopa" aria-label="Card name">
      <input class="amount" type="text" name="limit" inputmode="decimal" placeholder="500" aria-label="Limit">
      <button type="submit">Add</button>
    </form>
  </div>`;
  }

  // one card = live's heading 'Credit card'; several = each card's own name
  const cardCards = (r, err) => r.cards.length
    ? r.cards.map((c, i) => cardCard(c, i === 0, err, r.cards.length === 1 ? 'Credit card' : c.label)).join('') : noCardBox(err);

  const INFO = {
    due: 'The due day has gone, so it should be paid. Check your bank app that it came out.',
    stopped: 'Not counted until you choose Count it again in ⋯.',
    marked: 'You marked this as paid (⋯ → Not paid yet to undo).',
    left: 'Check your bank app for what is really left. Please check this each month.',
  };
  const infoBtn = tip => `<button type="button" class="info" aria-label="What is this?" data-tip="${esc(tip)}">ⓘ</button>`;

  // grey line under a bill: category, avg (the due day sits on the name line, Darren 22 Oct)
  // v0.36 (mock A3): a missing date or category is a green '+ date' / '+ category' link; once set it is plain text
  const addLink = (what, text) => `<button type="button" class="addlink" data-add="${what}">${text}</button>`;
  function billSub(b) {
    const nm = F.tagsplit(b.name), unsorted = !b.cat || b.cat === 'Unsorted';
    const tags = [unsorted ? addLink('cat', '+ category') : esc(b.cat), ...nm[1].map(esc)].map(t => `${t} · `).join('');
    let line = b.blank ? `${tags}no amount yet` : `${tags}avg ${money(b.avg)}`;
    if (b.cardName) line += ` · pays ${esc(b.cardName)}`;
    if (b.pot) line += ` · from the ${esc(b.pot)} pot`;
    if (b.stopped) line += ` · <span class="bstop">Stopped ${infoBtn(INFO.stopped)}</span>`;
    return line;
  }

  // the name line: name · due day; once the due day has gone both go green with ✓ (CSS), then ⓘ (mock B, 22 Oct)
  const paidNow = b => !b.stopped && (b.paid || b.duePassed);   // marked paid by hand (⋯), or the due day has gone
  function billLine(b, nm) {
    const date = b.dueText ? `<span class="bdate">· ${b.dueText}</span>` : (b.stopped ? '' : `<span class="bdate">· ${addLink('due', '+ date')}</span>`);
    return `<span class="bline${paidNow(b) ? ' paid' : ''}"><b class="bbase">${esc(nm[0])}</b>${date}${paidNow(b) ? ` ${infoBtn(b.paid ? INFO.marked : INFO.due)}` : ''}</span>`;
  }

  function billRow(b) {
    const nm = F.tagsplit(b.name), dflt = b.saved !== null ? b.saved : b.used;
    return `


      <tr class="bill${b.stopped ? ' stopped' : ''}" data-id="${esc(b.id)}" data-key="${esc(b.key)}" data-name="${esc(b.name)}" data-cat="${esc(b.cat || 'Unsorted')}" data-due="${b.due || ''}" data-card="${esc(b.cardName || '')}" data-avg="${b.stopped ? 0 : F.pyfloat(b.avg)}" data-avg0="${F.pyfloat(b.avg)}" data-default="${b.stopped ? 0 : F.pyfloat(dflt)}" data-default0="${F.pyfloat(dflt)}" data-estimated="${b.blank ? 1 : 0}" data-blank="${b.blank ? 1 : 0}" data-saved="${b.saved !== null ? F.pyfloat(b.saved) : ''}" data-changed="${b.changed ? 1 : 0}" data-used="${F.pyfloat(b.used)}" data-inpot="${b.pot ? 1 : 0}" data-new="0" data-stopped="${b.stopped ? 1 : 0}" data-paid="${b.paid ? 1 : 0}">
        <td><span class="handle" title="Drag to move">⠿</span><span class="rname" data-id="${esc(b.id)}" data-orig="${esc(b.orig)}">${esc(b.name)}</span>${billLine(b, nm)}
          <span class="bsub">${billSub(b)}</span>
          <form method="post" action="/stopped" class="stopform" hidden><input type="hidden" name="key" value="${esc(b.key)}"><input type="hidden" name="stopped" value="${b.stopped ? '0' : '1'}"><button class="small stopbtn" type="submit">${b.stopped ? 'Undo' : 'Stop'}</button></form></td>
        <td class="n bavg">${money(b.avg)}</td>
        <td class="n bamt">
          <button type="button" class="link ${b.blank ? 'muted' : ''}" title="Change the amount">${b.blank ? 'Add' : money(b.used)}</button>
          <input class="amount billbox" type="text" inputmode="decimal" value="${b.blank ? '' : f2(b.used)}" aria-label="New amount for ${esc(b.name)}" hidden>
          <button type="button" class="small x" title="Put it back" ${b.changed ? '' : 'hidden'}>✖</button>
        </td>
        <td class="n diff ${b.diff !== null && b.diff < -0.005 ? 'good' : (b.diff !== null && b.diff > 0.005 ? 'bad' : 'muted')}">${F.diff(b.diff)}</td>
        <td class="bmore"><button type="button" class="more" aria-haspopup="true" aria-label="Change or stop ${esc(nm[0])}">⋯</button></td></tr>
    `;
  }

  // a pot is also a row in Bills (not tr.bill: the page's bill maths ignores it); tap the amount to change the pot
  function potBill(p) {
    return `
      <tr class="potbill" data-pot="${esc(p.key)}" data-name="${esc(p.name)}" data-amount="${p.blank ? '' : f2(p.amount)}">
        <td><b class="bbase">${esc(p.name)}</b><span class="bsub">Pots · monthly amount</span></td>
        <td class="n bavg">${p.blank ? '' : money(p.amount)}</td>
        <td class="n bamt"><button type="button" class="link ${p.blank ? 'muted' : ''}" title="Change the pot amount">${p.blank ? 'Add' : money(p.amount)}</button></td>
        <td colspan="2"></td></tr>
    `;
  }

  // v0.37 (Darren, 24 Oct): ⏸ Pause takes a bill out of the list into ONE folded line at the bottom (Bills stays clean);
  // open it for each paused bill and ▶ Resume (the same /stopped switch as before)
  function pausedRows(list) {
    if (!list.length) return '';
    const sum = list.reduce((a, b) => a + (b.amount || 0), 0);
    return `<tbody class="paused">
      <tr class="pausedrow"><td colspan="5"><button type="button" class="pausedfold" aria-expanded="false"><span><svg class="pch" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1.5 2 6 6.5 10.5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> ⏸ ${list.length} paused</span><span>${money(sum)} not counted</span></button></td></tr>
      ${list.map(b => `<tr class="pbill" data-key="${esc(b.key)}" hidden><td colspan="5"><div class="pline"><span class="pname">${esc(b.name)}</span><span class="n">${b.amount ? money(b.amount) : ''}</span>
        <form method="post" action="/stopped"><input type="hidden" name="key" value="${esc(b.key)}"><input type="hidden" name="stopped" value="0"><button class="small resume" type="submit">▶ Resume</button></form></div></td></tr>`).join('')}
    </tbody>`;
  }

  function billsCard(r, err) {
    const bd = r.billsDiff, tone = bd < -0.005 ? 'good' : (bd > 0.005 ? 'bad' : '');
    return `<div class="card" data-id="bills" data-card="bills">
  <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot bill"></i> Bills (every month)<button type="button" class="fold" title="Fold">▾</button></h2>
  ${errorBox(err, 'bill')}
  <table id="bills" class="dbills">
    <thead><tr><th>Bill</th><th class="n">${r.cycles}-mth avg</th><th class="n">Last month</th><th class="n">Diff</th><th></th></tr></thead>
    <tbody data-sort="bills">
    ${r.bills.filter(b => !b.stopped).map(billRow).join('')}
    </tbody>

    <tbody>${r.pots.map(potBill).join('')}</tbody>

    <tbody><tr class="total"><td><b class="bbase">Total</b><span class="bsub">avg ${money(r.billsAvg + r.potsSet)}</span></td><td class="n bavg">${money(r.billsAvg + r.potsSet)}</td><td class="n bamt" id="btotal">${money(r.billsTotal + r.potsSet)}</td>
      <td class="n diff ${tone}" id="bdiff">${F.diff(bd)}</td><td></td></tr></tbody>
    ${pausedRows(r.bills.filter(b => b.stopped))}
  </table>
  <form class="inline" method="post" action="/bill/add" style="margin-top:12px">
    <input class="amount" type="text" name="amount" inputmode="decimal" placeholder="12.99" aria-label="Amount">
    <input class="name" type="text" name="name" placeholder="New bill" aria-label="Bill name">
    <button type="submit">Add</button>
  </form>
  <div class="labels bnote">Tap an amount to change it: it carries over to next month. Spare cash updates as you type.</div>
</div>`;
  }

  // ---------- pots ----------
  function potBlock(p) {
    const status = p.blank ? `<button type="button" class="link muted potset">Set an amount</button>`
      : (p.over > 0.004 ? `<span class="bad">${money(p.over)} over</span>` : `<span class="good">${money(p.left)} left</span>`);
    const line = p.blank ? (p.spent > 0 ? `${money(p.spent)} spent so far` : '') : `${money(p.spent)} of ${money(p.amount)}`;
    return `
    <div class="pot" data-key="${esc(p.key)}" data-name="${esc(p.name)}" data-amount="${p.blank ? '' : f2(p.amount)}">
      <div class="potrow"><b>${esc(p.name)}</b><span class="potside">${status}<span class="potmore"><button type="button" class="more" aria-haspopup="true" aria-label="Change or delete ${esc(p.name)}">⋯</button></span></span></div>
      <div class="potbar"><i class="${p.over > 0.004 ? 'over' : ''}" style="width:${p.blank ? 0 : p.pct}%"></i></div>
      <div class="labels">${line}</div>
    </div>`;
  }

  function potsCard(r, err) {
    return `<div class="card" data-id="pots" data-card="pots">
    <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot pot"></i> Monthly pots<button type="button" class="fold" title="Fold">▾</button></h2>
    ${errorBox(err, 'pot')}
    ${r.pots.map(potBlock).join('')}
    <form class="inline" method="post" action="/pot/add" style="margin-top:12px">
      <input class="amount" type="text" name="amount" inputmode="decimal" placeholder="400" aria-label="Amount">
      <input class="name" type="text" name="name" placeholder="New pot" aria-label="Pot name">
      <button type="submit">Add</button>
    </form>
    <div class="labels bnote">Spends and bills in a pot's category fill it. Over comes off spare.</div>
  </div>`;
  }

  // ---------- history cards (from the months saved at payday) ----------
  const FIRST = '<div class="labels">Fills in at your first payday.</div>';
  const head = (id, title) => `<h2><span class="handle" title="Drag to move">⠿</span> <i class="dot "></i> ${title}<button type="button" class="fold" title="Fold">▾</button></h2>`;
  const pill = x => Math.abs(x) < 0.005 ? '' : (x > 0 ? 'bad' : 'good');
  const chev = n => `<button type="button" class="chev" aria-expanded="false" aria-label="Show the shops"><svg viewBox="0 0 12 8" width="10" height="7" aria-hidden="true"><path d="M1.5 2 6 6.5 10.5 2"/></svg><span>${n}</span></button>`;

  function lastMonthCard(r) {
    const m = r.lastMonth;
    if (!m) return `<div class="card" data-id="lastmonth" data-card="lastmonth">${head('lastmonth', "Last month's spending")}${FIRST}</div>`;
    const rows = m.cats.map(c => `
      <tr data-id="cat:${esc(c.cat)}"><td><b class="bbase">${esc(c.cat)}</b>
          <span class="bsub">${c.items.slice(0, 3).map(i => esc(i.name)).join(', ')}${c.items.length > 3 ? ' …' : ''} · avg ${money(c.avg)}</span></td>
        <td class="n lamt">${money(c.total)}</td>
        <td class="n diff ${pill(c.diff)}">${Math.abs(c.diff) < 0.005 ? '' : F.diff(c.diff)}</td>
        <td class="lchev">${chev(c.items.length)}</td></tr>
      ${c.items.map(i => `<tr class="item" data-cat="cat:${esc(c.cat)}" data-name="${esc(i.name)}" data-amount="${f2(i.total)}" hidden><td>${esc(i.name)}</td><td class="n">${money(i.total)}</td>
        <td class="n"><button type="button" class="small tobill" title="Make it a bill">→ Bill</button></td><td></td></tr>`).join('')}
    `).join('');
    return `<div class="card" data-id="lastmonth" data-card="lastmonth">
  ${head('lastmonth', "Last month's spending")}
  <div class="sub">${F.day(m.start)} to ${F.day(m.end)}</div>
  <table class="dlast">
    <tbody>
      <tr class="lbills"><td><b class="bbase"><i class="dot bill"></i>Bills</b><span class="bsub">In the Bills card · avg ${money(m.billsAvg)}</span></td>
        <td class="n lamt k-bill">${money(m.bills)}</td>
        <td class="n diff ${pill(m.billsDiff)}">${Math.abs(m.billsDiff) < 0.005 ? '' : F.diff(m.billsDiff)}</td><td></td></tr>
    </tbody>
    <tbody data-sort="lastmonth">${rows}</tbody>
    <tbody><tr class="total"><td><b class="bbase">Total</b></td><td class="n lamt">${money(m.total)}</td>
      <td class="n diff"></td><td></td></tr></tbody>
  </table>
</div>`;
  }

  function catsCard(r) {
    if (!r.hasHistory) return `<div class="card" data-id="cats" data-card="cats">${head('cats', 'Spending by category')}${FIRST}</div>`;
    const now = {};
    r.spends.forEach(x => { const c = x.cat || 'Unsorted'; (now[c] = now[c] || []).push(x); });
    const rows = r.cats.map(c => `
      <details data-id="cat:${esc(c.cat)}"><summary><span class="what">${esc(c.cat)}<span class="note">now ${money(c.now)} · usual ${money(c.avg)}</span></span>
        <span class="val ${pill(c.diff)}">${F.diff(c.diff)}</span></summary>
        <div class="inside">${(now[c.cat] || []).map(x => `<div><span>${esc(x.name)}</span><span>${money(x.amount)}</span></div>`).join('') || '<div>Nothing this month.</div>'}</div></details>
    `).join('');
    return `<div class="card" data-id="cats" data-card="cats">
    ${head('cats', 'Spending by category')}
    <div class="sub">This month so far vs the average of your saved months. Tap one to see inside.</div>
    <div data-sort="cats">${rows}</div>
  </div>`;
  }

  function periodsCard(r) {
    if (!r.hasHistory) return `<div class="card" data-id="periods" data-card="periods">${head('periods', '6 months, 12 months and this year')}${FIRST}</div>`;
    const P = r.periods, cols = [P.six, P.twelve, P.ytd];
    const cell = (f, cls) => cols.map(c => `<td class="n ${cls ? cls(c) : ''}">${money(f(c))}</td>`).join('');
    const lab = c => `<span class="labels">${c.months} saved month${c.months === 1 ? '' : 's'}</span>`;
    return `<div class="card" data-id="periods" data-card="periods">
    ${head('periods', '6 months, 12 months and this year')}
    <div class="scroll"><table class="periods">
      <tr><th></th><th class="n">Last 6 months${lab(P.six)}</th><th class="n">Last 12 months${lab(P.twelve)}</th><th class="n">${P.year} so far${lab(P.ytd)}</th></tr>
      <tr><td>Wage</td>${cell(c => c.wage)}</tr>
      <tr><td>Bills</td>${cell(c => c.bills)}</tr>
      <tr><td>Spending</td>${cell(c => c.spending)}</tr>
      <tr class="total"><td>Left over</td>${cell(c => c.left, c => c.left < 0 ? 'bad' : 'good')}</tr>
    </table></div>
  </div>`;
  }

  // ---------- Move & rename: the saved order (fintrack/layout.py) ----------
  // A box's rows as groups: a row with a data-id starts one; a category's hidden shop rows (tr.item) stay right after it.
  function groups(box) {
    const gs = [];
    Array.from(box.children).forEach(c => {
      const home = !c.dataset.id && c.dataset.cat && gs.find(g => g[0].dataset.id === c.dataset.cat);
      if (home) home.push(c);
      else if (c.dataset.id || !gs.length) gs.push([c]);
      else gs[gs.length - 1].push(c);
    });
    return gs;
  }
  function regroup(box, ids) {
    const gs = groups(box);
    (ids ? M.order(gs, ids, g => g[0].dataset.id) : gs).forEach(g => g.forEach(el => box.appendChild(el)));
  }
  function applyLayout(state) {
    document.querySelectorAll('[data-sort]').forEach(box => {
      const ids = state.layout && state.layout[box.dataset.sort];
      if (Array.isArray(ids)) regroup(box, ids);
    });
  }

  // ---------- views: ?view=ideas / ?view=invite / ?view=drive show one box in place of the home page parts ----------
  // The same address without ?view= (demo / today / ... stay), or with another view.
  function viewUrl(view) {
    const u = new URL(location.href);
    u.searchParams.delete('error'); u.searchParams.delete('view'); u.hash = '';
    if (view) u.searchParams.set('view', view);
    return u.pathname + u.search;
  }
  function ideaNote(n, done) {
    const form = (action, label, extra) => `<form method="post" action="${action}"${extra || ''}><input type="hidden" name="id" value="${n.id}">${label}</form>`;
    return `<div class="note${done ? ' done' : ''}">
        <span class="txt">${esc(n.text)}<span class="sub">${esc(M.IDEA_TAGS[n.tag] || M.IDEA_TAGS.idea)} · ${esc(F.day(n.at))}</span></span>
        ${form('/ideas/done', done ? '<button type="submit">\u21A9 Not done</button>' : '<button type="submit" title="Built or sorted">\u2705 Done</button>')}
        ${form('/ideas/remove', '<button type="submit" aria-label="Delete">\u00D7</button>', ' data-confirm="Delete this note?"')}
      </div>`;
  }
  function ideasView(state, today) {
    const notes = (state.ideas || []).slice().reverse(), open = notes.filter(n => !n.done), done = notes.filter(n => n.done);
    const tags = Object.keys(M.IDEA_BUTTONS).map((k, i) =>
      `<input type="radio" name="tag" id="tag-${k}" value="${k}"${i === 0 ? ' checked' : ''}><label for="tag-${k}">${M.IDEA_BUTTONS[k]}</label>`).join('');
    return `<a class="back" href="${esc(viewUrl(''))}">\u2039 Home</a>
  <h1>\u{1F4A1} Ideas &amp; feedback</h1>
  <p class="hint">Jot anything down as it comes to you. When you're ready, copy them all into a chat with Claude.</p>
  <div class="card">
    <form class="new" method="post" action="/ideas/add">
      <textarea name="text" maxlength="1000" placeholder="What's on your mind?" required aria-label="Your note"></textarea>
      <div class="tags" role="radiogroup" aria-label="Kind of note">${tags}</div>
      <button class="go" type="submit">Save note</button>
    </form>
  </div>
  <h2>Open (${open.length})</h2>
  <div class="card">${open.map(n => ideaNote(n, false)).join('') || '<p class="empty">No notes yet.</p>'}</div>
  ${open.length ? `<p><button type="button" class="go" id="copybtn">\u{1F4CB} Copy all for Claude</button><span class="copied" id="copied" hidden>Copied \u2705</span></p>
  <textarea id="copytext" readonly aria-hidden="true" tabindex="-1">${esc(M.ideasCopy(state, M.VERSION, today))}</textarea>` : ''}
  ${done.length ? `<details><summary>Done (${done.length})</summary><div class="card">${done.map(n => ideaNote(n, true)).join('')}</div></details>` : ''}`;
  }
  function showView(state, today) {
    const view = new URLSearchParams(location.search).get('view'), body = document.body;
    document.querySelectorAll('a[data-view]').forEach(a => { a.href = viewUrl(a.dataset.view); });
    document.querySelectorAll('#invite a.back, #drive a.back, #account a.back').forEach(a => { a.href = viewUrl(''); });
    if (!['ideas', 'invite', 'drive', 'account'].includes(view)) return;
    body.dataset.view = view;                                    // lite.css hides the home page parts
    const box = document.getElementById(view);
    if (!box) return;
    if (view === 'ideas') {
      box.innerHTML = ideasView(state, today);
      box.querySelectorAll('form[data-confirm]').forEach(f => f.addEventListener('submit', e => {
        e.preventDefault();                                                // ask first; yes = send it (form.submit = the route)
        root.Sheet.confirm('🗑 ' + f.dataset.confirm, '', 'Delete', true).then(yes => { if (yes) f.submit(); });
      }));
      const btn = document.getElementById('copybtn');
      if (btn) btn.addEventListener('click', async () => {
        const text = document.getElementById('copytext');
        try { await navigator.clipboard.writeText(text.value); }
        catch (e) { text.select(); document.execCommand('copy'); }
        document.getElementById('copied').hidden = false;
      });
    }
    box.hidden = false;
  }

  // ---------- put it on the page ----------
  function swap(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.outerHTML = html;
  }

  function render(state, err, today) {
    const r = M.compute(state, today);
    const cardName = {};
    r.cards.forEach(c => { cardName[c.key] = c.name; });
    r.bills.forEach(b => { b.cardName = b.card ? cardName[b.card] : ''; });
    // PAGE: the numbers the page script starts from (live writes the same four into its script; Go A adds the pots)
    root.LITE_PAGE = {bills: r.billsTotal, left: r.left, typed: r.spendsTotal, wage: r.pay,
                      pots: r.potsSpent, potBills: r.potBills, potsSet: r.potsSet, potsOver: r.potsOver, cards: r.cards.map(c => c.name)};

    // an error from the last form (live: /?error=CODE)
    if (err && ERRORS[err] && !INLINE.includes(err)) {
      const quick = document.getElementById('quick');
      if (quick) quick.insertAdjacentHTML('beforebegin', `<div class="error fade">${ERRORS[err]}</div>\n\n  `);
    }

    // New payday panel: Pay, and Left filled in with what was really left at the end of the month
    const spare = M.monthEndSpare(state), fill = spare > 0 ? f2(spare) : '';
    const pf = document.getElementById('payform');
    if (pf) {
      pf.dataset.pay = f2(r.pay);
      pf.dataset.left = fill;
      document.getElementById('qpay').setAttribute('value', f2(r.pay));
      document.getElementById('qleft').setAttribute('value', fill);
      const lh = document.getElementById('lhval');
      if (lh) lh.textContent = money(spare);
    }

    // payday date (the pill and the box) and the last backup
    const day = document.getElementById('qday'), pillEl = document.getElementById('paypill');
    if (day) day.setAttribute('value', state.payDay ? M.ordinal(state.payDay) : '');
    if (pillEl) {
      const next = M.nextPayday(state.payDay, today);
      pillEl.hidden = !next;
      if (next) pillEl.textContent = '📅 ' + M.paydayText(next, today);
    }
    const saved = document.getElementById('lastsaved');
    if (saved) saved.textContent = M.backupText(state.lastBackup, today);

    // spare cash statement
    document.getElementById('spare-big').textContent = money(r.leftNow);
    document.querySelector('.st-rows').innerHTML = statementRows(r);
    document.querySelector('.st-side').innerHTML = r.cards.map((c, i) => zopaTile(c, i === 0)).join('');

    // cards
    swap('#cards > [data-card="spend"]', spendCard(r, err));
    swap('#cards > [data-card="pots"]', potsCard(r, err));
    swap('#cards > [data-card="card"]', cardCards(r, err));
    swap('#cards > [data-card="bills"]', billsCard(r, err));
    swap('#cards > [data-card="lastmonth"]', lastMonthCard(r));
    swap('#cards > [data-card="cats"]', catsCard(r));
    swap('#cards > [data-card="periods"]', periodsCard(r));
    applyLayout(state);
    showView(state, today);
    return r;
  }

  root.LiteRender = {render, regroup, ERRORS, INFO, spendCard, potsCard, cardCards, billsCard, zopaTile, statementRows};
})(window);
