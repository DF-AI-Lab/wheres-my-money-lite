/* Where's My Money? Lite - step 2: draws the parts of the page that depend on the numbers.
   A port of live's Jinja templates (demo_top.html, demo_bills.html and the spend / credit card cards of home.html):
   the markup it writes is the same markup live sends. Everything statement-based stays as the static HTML.
   Lite.render(state) runs once, before the page's own script, so that script binds to what is drawn here. */
(function (root) {
  'use strict';
  const M = root.Money, F = M.fmt, money = F.money;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const f2 = x => x.toFixed(2);

  const ERRORS = {
    pay: 'Sorry, I could not read that as money.',
    spend: 'Sorry, type an amount and a name, e.g. 12.50 and Costa.',
    card: 'Sorry, type an amount and a name for the credit card, e.g. 40 and Shell.',
  };

  // ---------- the pieces ----------
  function statementRows(r) {
    const left = r.left ? money(r.left) : 'Add';
    return `
      <div class="r"><span>Pay</span><button type="button" class="link tap" data-edit="qpay" title="Change this month's pay">${money(r.pay)}</button></div>
      <div class="r"><span>+ Left from last month</span><button type="button" class="link tap" data-edit="qleft" title="Change what was left from last month">${left}</button></div>
      <div class="r"><span><i class="dot bill"></i>− Bills</span><span class="k-bill" id="st-bills">${money(r.billsTotal)}</span></div>
      <div class="r"><span><i class="dot spend"></i>− Spends</span><span class="k-spend" id="st-spends">${money(r.spendsTotal)}</span></div>
      <div class="r tot"><span>Spare</span><span id="st-spare">${money(r.leftNow)}</span></div>
    `;
  }

  function zopaTile(r) {
    const c = r.card, pc = c.pc, pcr = Math.min(Math.max(pc, 0), 100), n = F.r0(pc);
    return `


    <div class="tile wide zcard"><div class="zl">
        <div class="label">Zopa credit card</div>
        <div class="zrow"><i class="dot zused"></i><span>Used</span><b id="ccused">${money(c.used)}</b></div>
        <div class="zrow"><i class="dot zfree"></i><span>Free</span><b class="${c.free < 0 ? 'bad' : 'zfreeval'}" id="ccfree">${money(c.free)}</b></div>
        <div class="zlimit">Limit ${money(c.limit)}</div></div>
      <svg id="zring" viewBox="0 0 100 100" role="img" aria-label="${n}% of the limit used">
        <circle cx="50" cy="50" r="40" class="z-free"/>
        <circle cx="50" cy="50" r="40" class="z-used" transform="rotate(-90 50 50)"
          stroke-dasharray="${Math.max(pcr * 2.5133 - 1.5, 0).toFixed(1)} 251.3"/>
        <text x="50" y="52" text-anchor="middle" class="z-pc">${n}%</text>
        <text x="50" y="67" text-anchor="middle" class="z-sub">used</text>
      </svg>
    </div>
  `;
  }

  function spendCard(r, err) {
    const rows = r.spends.map(s => `

          <tr class="drow"><td><b>${esc(s.name)}</b><span class="labels">${F.day(s.date)} · ${esc(s.cat || 'Unsorted')}</span></td><td class="n">${money(s.amount)}</td>
              <td class="n"><form method="post" action="/remove"><input type="hidden" name="id" value="${s.id}"><button class="small xbtn" type="submit" title="Remove" aria-label="Remove ${esc(s.name)}">×</button></form></td></tr>

        `).join('');
    return `<div class="card" data-id="spend" data-card="spend">
    <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot spend"></i> Add a spend<button type="button" class="fold" title="Fold">▾</button></h2>
    ${err === 'spend' ? `<div class="error fade">${ERRORS.spend}</div>` : ''}

    <form class="inline" method="post" action="/add">
      <input class="amount" type="text" name="amount" inputmode="decimal" placeholder="12.50" aria-label="Amount">
      <input class="name" type="text" name="name" placeholder="Costa" aria-label="What">
      <button type="submit">Add</button>
    </form>
    ${r.spends.length ? `
      <table style="margin-top:12px">
        ${rows}
      </table>
    ` : ''}

    <div class="sum" style="margin-top:12px">
      <span>Money for spending</span><span class="n" id="mfs">${money(r.moneyForSpending)}</span>
      <span>Typed so far</span><span class="n" id="typed">${money(r.moneyForSpending - r.leftNow)}</span>
      <span class="eq">Left now</span><span class="n eq" id="leftnow">${money(r.leftNow)}</span>
    </div>
  </div>`;
  }

  function cardCard(r, err) {
    const c = r.card;
    const rows = c.rows.map(x => `

          <tr class="drow ${x.status === 'paid' ? 'crossed' : ''}"><td><b>${esc(x.name)}</b><span class="labels">${F.day(x.date)}${x.status === 'part' ? ' · ' + money(x.left) + ' left' : ''}</span></td>
              <td class="n ${x.amount < 0 ? 'good' : ''}">${money(x.amount)}</td>
              <td class="n">${x.removable ? `<form method="post" action="/card/remove"><input type="hidden" name="id" value="${x.id}"><button class="small xbtn" type="submit" title="Remove" aria-label="Remove ${esc(x.name)}">×</button></form>` : ''}</td></tr>

        `).join('');
    return `<div class="card" data-id="card" data-card="card">
    <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot zused"></i> Credit card<button type="button" class="fold" title="Fold">▾</button></h2>
    ${err === 'card' ? `<div class="error fade">${ERRORS.card}</div>` : ''}

    <form class="inline" method="post" action="/card/add">
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
      <span>Limit</span><span class="n"><form class="inline" method="post" action="/card/limit"><input class="amount" type="text" name="amount" inputmode="decimal" value="${f2(c.limit)}" aria-label="Limit"><button class="small" type="submit">Change</button></form></span>
      <span>Used <span class="labels">type the Zopa app's amount to make it exact</span></span><span class="n"><form class="inline" method="post" action="/card/balance" id="ccbalform"><input class="amount" type="text" name="amount" id="ccused2" inputmode="decimal" value="${f2(c.used)}" aria-label="What the Zopa card owes now"><button class="small" type="submit">Change</button></form></span>
      <span class="eq">Free</span><span class="n eq" id="ccfree2">${money(c.free)}</span>
    </div>
  </div>`;
  }

  function billRow(b) {
    const nm = F.tagsplit(b.name), dflt = b.last > 0 ? b.last : b.avg;
    const tags = nm[1].map(t => `${esc(t)} · `).join('');
    const tone = b.diff !== null && b.diff < -0.005 ? 'good' : (b.diff !== null && b.diff > 0.005 ? 'bad' : 'muted');
    return `


      <tr class="bill${b.stopped ? ' stopped' : ''}" data-id="${esc(b.id)}" data-key="${esc(b.key)}" data-avg="${b.stopped ? 0 : F.pyfloat(b.avg)}" data-avg0="${F.pyfloat(b.avg)}" data-default="${b.stopped ? 0 : F.pyfloat(dflt)}" data-default0="${F.pyfloat(dflt)}" data-estimated="${b.last <= 0 ? 1 : 0}" data-changed="${b.changed ? 1 : 0}" data-used="${F.pyfloat(b.used)}" data-new="${b.new ? 1 : 0}" data-stopped="${b.stopped ? 1 : 0}">
        <td><span class="handle" title="Drag to move">⠿</span><span class="rname" data-id="${esc(b.id)}" data-orig="${esc(b.orig)}">${esc(b.name)}</span><b class="bbase">${esc(nm[0])}</b>
          <span class="bsub">${tags}avg ${money(b.avg)}${b.new ? ' · <span class="bnew">new</span>' : ''}${b.stopped ? ' · <span class="bstop">stopped</span>' : ''}</span>
          <form method="post" action="/stopped" class="stopform" hidden><input type="hidden" name="key" value="${esc(b.key)}"><input type="hidden" name="stopped" value="${b.stopped ? '0' : '1'}"><button class="small stopbtn" type="submit">${b.stopped ? 'Undo' : 'Stop'}</button></form></td>
        <td class="n bavg">${money(b.avg)}</td>
        <td class="n bamt">
          <button type="button" class="link ${b.estimated ? 'muted' : ''}" title="Change it for this pay cycle">${money(b.used)}${b.estimated ? '*' : ''}</button>
          <input class="amount billbox" type="text" inputmode="decimal" value="${f2(b.used)}" aria-label="New amount for ${esc(b.name)}" hidden>
          <button type="button" class="small x" title="Put it back" ${b.changed ? '' : 'hidden'}>✖</button>
        </td>
        <td class="n diff ${tone}">${F.diff(b.diff)}</td>
        <td class="bmore"><button type="button" class="more" aria-haspopup="true" aria-label="Change or stop ${esc(nm[0])}">⋯</button></td></tr>
    `;
  }

  function billsCard(r) {
    const bd = r.billsDiff, tone = bd < -0.005 ? 'good' : (bd > 0.005 ? 'bad' : '');
    return `<div class="card" data-id="bills" data-card="bills">
  <h2><span class="handle" title="Drag to move">⠿</span> <i class="dot bill"></i> Bills (every month)<button type="button" class="fold" title="Fold">▾</button></h2>
  <table id="bills" class="dbills">
    <thead><tr><th>Bill</th><th class="n">${r.cycles}-mth avg</th><th class="n">Last month</th><th class="n">Diff</th><th></th></tr></thead>
    <tbody data-sort="bills">
    ${r.bills.map(billRow).join('')}
    </tbody>

    <tbody><tr class="total"><td><b class="bbase">Total</b><span class="bsub">avg ${money(r.billsAvg)}</span></td><td class="n bavg">${money(r.billsAvg)}</td><td class="n bamt" id="btotal">${money(r.billsTotal)}</td>
      <td class="n diff ${tone}" id="bdiff">${F.diff(bd)}</td><td></td></tr></tbody>
  </table>
  <div class="labels bnote">
    ${r.anyEstimated ? '* not paid last month, average used<br>' : ''}
    ⋯ → Change amount = this pay cycle only (or tap the blue amount). Spare cash updates as you type.
  </div>
</div>`;
  }

  // ---------- put it on the page ----------
  function swap(selector, html) {
    const el = document.querySelector(selector);
    if (el) el.outerHTML = html;
  }

  function render(state, err) {
    const r = M.compute(state);
    // PAGE: the numbers the page script starts from (live writes the same four into its script)
    root.LITE_PAGE = {bills: r.billsTotal, left: r.left, typed: r.spendsTotal, wage: r.pay};

    // an error from the last form (live: /?error=CODE)
    if (err && ERRORS[err] && err !== 'spend' && err !== 'card') {
      const quick = document.getElementById('quick');
      if (quick) quick.insertAdjacentHTML('beforebegin', `<div class="error fade">${ERRORS[err]}</div>\n\n  `);
    }

    // New payday panel: Pay and Left values
    const pf = document.getElementById('payform');
    if (pf) {
      pf.dataset.spends = r.spends.length ? '1' : '0';
      pf.dataset.pay = f2(r.pay);
      pf.dataset.left = r.left ? f2(r.left) : '';
      document.getElementById('qpay').setAttribute('value', f2(r.pay));
      document.getElementById('qleft').setAttribute('value', r.left ? f2(r.left) : '');
    }

    // spare cash statement
    document.getElementById('spare-big').textContent = money(r.leftNow);
    document.querySelector('.st-rows').innerHTML = statementRows(r);
    document.querySelector('.st-side').innerHTML = zopaTile(r);

    // cards
    swap('#cards > [data-card="spend"]', spendCard(r, err));
    swap('#cards > [data-card="card"]', cardCard(r, err));
    swap('#cards > [data-card="bills"]', billsCard(r));
    return r;
  }

  root.LiteRender = {render, ERRORS, spendCard, cardCard, billsCard, zopaTile, statementRows};
})(window);
