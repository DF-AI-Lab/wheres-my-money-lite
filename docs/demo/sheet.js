/* Where's My Money? Lite - slide-up sheets instead of the browser's OK / Cancel boxes (Darren, 22 Oct, mock 2a/2b/2c).
   Sheet.confirm(title, text, ok, danger) -> Promise<true|false>
   Sheet.ask(title, label, value, mode)    -> Promise<text|null>   (mode 'decimal' / 'numeric' = the number keyboard)
   Sheet.tell(title, text)                 -> Promise<undefined>
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
      <form class="sheetform"><input class="sheetin" type="text" autocomplete="off"${im} value="${esc(value)}" aria-label="${esc(label || title)}">
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

  root.Sheet = {confirm, ask, tell};
})(typeof window !== 'undefined' ? window : globalThis);
