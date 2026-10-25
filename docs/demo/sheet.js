/* Where's My Money? Lite - slide-up sheets instead of the browser's OK / Cancel boxes (Darren, 22 Oct, mock 2a/2b/2c).
   Sheet.confirm(title, text, ok, danger) -> Promise<true|false>
   Sheet.ask(title, label, value, mode)    -> Promise<text|null>   (mode 'decimal' / 'numeric' = the number keyboard)
   Sheet.tell(title, text)                 -> Promise<undefined>
   Sheet.day(title)                        -> Promise<'1'..'31'|null>   (a grid of days, v0.36)
   Sheet.pick(title, names, current)       -> Promise<name|null>        (a list to tap; ＋ New category asks for the name)
   Sheet.choose(title, text, a, b)         -> Promise<'a'|'b'|null>      (two ways; Not now = null, v0.45)
   Sheet.ask(..., 'date')                  -> a date box (YYYY-MM-DD)
   Escape or a tap outside = Cancel. Enter in the box = Save. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  function open(html, cancelValue, wire) {
    return new Promise(done => {
      const back = document.createElement('div');
      back.className = 'sheetback litesheet';
      back.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>' + html + '</div>';
      const close = v => { document.removeEventListener('keydown', key, true); back.remove(); done(v); };
      const key = e => { if (e.key === 'Escape') { e.preventDefault(); close(cancelValue); } };
      back.addEventListener('click', e => { if (e.target === back) close(cancelValue); });
      document.addEventListener('keydown', key, true);
      const cancel = back.querySelector('button.cancel');
      if (cancel) cancel.addEventListener('click', () => close(cancelValue));
      document.body.appendChild(back);
      wire(back, close);
    });
  }

  function confirm(title, text, ok, danger) {
    return open(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <button type="button" class="ok ${danger ? 'bad' : 'pri'}">${esc(ok || 'OK')}</button>
      <button type="button" class="ter cancel">Cancel</button>`, false, (back, close) => {
      const b = back.querySelector('button.ok'); b.addEventListener('click', () => close(true)); b.focus();
    });
  }

  function ask(title, label, value, mode) {
    const im = mode === 'decimal' || mode === 'numeric' ? ` inputmode="${mode}"` : '';
    return open(`<h3>${esc(title)}</h3>${label ? `<div class="sheetlbl">${esc(label)}</div>` : ''}
      <form class="sheetform"><input class="sheetin" type="${mode === 'date' ? 'date' : 'text'}" autocomplete="off"${im} value="${esc(value)}" aria-label="${esc(label || title)}">
      <button type="submit" class="ok pri">Save</button></form>
      <button type="button" class="ter cancel">Cancel</button>`, null, (back, close) => {
      const input = back.querySelector('.sheetin');
      back.querySelector('form').addEventListener('submit', e => { e.preventDefault(); close(input.value); });
      input.focus(); input.select();
    });
  }

  function tell(title, text) {
    return open(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <button type="button" class="ok pri">OK</button>`, undefined, (back, close) => {
      const b = back.querySelector('button.ok'); b.addEventListener('click', () => close(undefined)); b.focus();
    });
  }

  function choose(title, text, a, b) {
    return open(`<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <button type="button" class="ok pri">${esc(a)}</button>
      <button type="button" class="alt sec">${esc(b)}</button>
      <button type="button" class="ter cancel">Not now</button>`, null, (back, close) => {
      back.querySelector('button.ok').addEventListener('click', () => close('a'));
      back.querySelector('button.alt').addEventListener('click', () => close('b'));
      back.querySelector('button.ok').focus();
    });
  }

  function day(title) {
    const days = Array.from({length: 31}, (_, i) => `<button type="button" data-v="${i + 1}">${i + 1}</button>`).join('');
    return open(`<h3>${esc(title)}</h3><div class="daygrid">${days}</div>
      <button type="button" class="ter cancel">Cancel</button>`, null, (back, close) => {
      back.querySelectorAll('.daygrid button').forEach(b => b.addEventListener('click', () => close(b.dataset.v)));
      back.querySelector('.daygrid button').focus();
    });
  }

  function pick(title, names, current) {
    const list = names.map(n => `<button type="button" data-v="${esc(n)}"${n === current ? ' aria-current="true"' : ''}>${esc(n)}</button>`).join('');
    return open(`<h3>${esc(title)}</h3><div class="picklist">${list}<button type="button" class="picknew">＋ New category</button></div>
      <button type="button" class="ter cancel">Cancel</button>`, null, (back, close) => {
      back.querySelectorAll('.picklist button[data-v]').forEach(b => b.addEventListener('click', () => close(b.dataset.v)));
      back.querySelector('.picknew').addEventListener('click', () => close(NEW));
      back.querySelector('.picklist button').focus();
    }).then(v => v !== NEW ? v
      : ask('🏷 New category', 'Name of the new category', '').then(t => t !== null && t.trim() ? t.trim() : null));
  }
  const NEW = {};

  root.Sheet = {confirm, ask, tell, day, pick, choose};
})(typeof window !== 'undefined' ? window : globalThis);
