// Passport — screens. Same steps on every app; the look comes from the app's theme.json.
// Usage: PassportUI.start({ app: 'wmm', theme, mount: element, onUnlocked })

const PassportUI = (() => {
  let T, APP, root, onUnlocked, onSignOut, timer;
  let autoFinger = true; // pop fingerprint up by itself once per lock (not again after a cancel or wrong passcode)
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const first = (name) => esc(String(name || '').split(' ')[0]);
  const icon = {
    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    finger: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11a5 5 0 0 1 10 0v2a9 9 0 0 1-1.2 4.5"/><path d="M12 11v3a6 6 0 0 1-2 4.5"/><path d="M4.5 15A8 8 0 0 1 4 12a8 8 0 0 1 14-5.3"/><path d="M9.5 11a2.5 2.5 0 0 1 5 0v2"/></svg>',
    back: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-6 6M11 9l6 6"/></svg>',
    google: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4c2-1.8 3.1-4.5 3.1-7.6z"/><path fill="#34A853" d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6c-.9.6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.7v2.7A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.2 13.6a6 6 0 0 1 0-3.8V7.1H2.7a10 10 0 0 0 0 9.2z"/><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.7 7.1l3.5 2.7C7 7.8 9.3 6 12 6z"/></svg>',
  };

  // ---------- shared pieces ----------
  function appSection(small) {
    const logo = T.logo.type === 'svg' ? T.logo.value : `<span${T.logo.value.length > 2 ? ' class="long"' : ''}>${esc(T.logo.value)}</span>`;
    return `<header class="ps-app${small ? ' small' : ''}">
      <div class="ps-tile">${logo}</div>
      <h1 class="ps-name">${esc(T.name)}</h1>
      ${small ? '' : `<p class="ps-tag">${esc(T.tagline)}</p>`}
    </header>`;
  }
  const driveLine = (p) => `<p class="ps-drive">${icon.folder} Saves to Drive: ${esc(PassportCloud.ROOT)} / ${p ? esc(p.id) : 'DF……'} / ${esc(T.drive)}</p>`;
  const err = (msg) => (msg ? `<p class="ps-err" role="alert">${msg}</p>` : '');

  // v0.4.0 number pad: on-screen buttons, no text box. So phones can't pop up saved passwords.
  let keyFn = null; // laptop keyboard typing for the pad on screen now
  const padHtml = (label, finger) => `<div class="ps-pad-wrap">
      <p class="ps-pad-label" id="padlbl">${label}</p>
      <div class="ps-dots" id="dots" role="img" aria-label="0 of 6 numbers typed">${'<span class="ps-dot"></span>'.repeat(6)}</div>
      <div class="ps-pad-msg" id="msg" aria-live="polite"></div>
      <div class="ps-pad" role="group" aria-labelledby="padlbl">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="ps-key" type="button" data-n="${n}">${n}</button>`).join('')}
        ${finger ? `<button class="ps-key ps-key-icon ps-key-fp" type="button" id="fp" aria-label="Use fingerprint">${icon.finger}</button>` : '<span></span>'}
        <button class="ps-key" type="button" data-n="0">0</button>
        <button class="ps-key ps-key-icon" type="button" id="del" aria-label="Delete">${icon.back}</button>
      </div>
    </div>`;

  // wire up the pad on screen. onDone(passcode) runs after the 6th number.
  function pad(onDone) {
    let pin = '', wait = false, locked = false;
    const box = $('#dots'), dots = [...box.children];
    const draw = () => {
      dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
      box.setAttribute('aria-label', `${pin.length} of 6 numbers typed`);
    };
    const press = (n) => {
      if (wait || locked || pin.length >= 6) return;
      if (navigator.vibrate) navigator.vibrate(10);
      pin += n; box.classList.remove('bad'); $('#msg').innerHTML = ''; draw();
      if (pin.length === 6) { wait = true; const p = pin; setTimeout(() => onDone(p), 120); }
    };
    const del = () => { if (!wait && !locked) { pin = pin.slice(0, -1); draw(); } };
    root.querySelectorAll('.ps-key[data-n]').forEach((b) => b.addEventListener('click', () => press(b.dataset.n)));
    on('#del', 'click', del);
    keyFn = (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); del(); }
    };
    document.addEventListener('keydown', keyFn);
    return {
      fail(msg) { // wrong code: clear, shake, say why
        pin = ''; wait = false; draw();
        box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad');
        $('#msg').innerHTML = err(msg);
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      },
      lock(v) { locked = v; if (v) { pin = ''; wait = false; draw(); } root.querySelectorAll('.ps-key').forEach((b) => { b.disabled = v; }); },
      say(html) { $('#msg').innerHTML = html; },
    };
  }

  function show(html) {
    clearInterval(timer);
    if (keyFn) { document.removeEventListener('keydown', keyFn); keyFn = null; }
    root.innerHTML = `<main class="ps-screen">${html}</main>`;
    const f = root.querySelector('input:not([readonly])'); if (f) f.focus();
  }
  const $ = (s) => root.querySelector(s);
  const on = (s, ev, fn) => { const el = $(s); if (el) el.addEventListener(ev, fn); };
  const busy = (btn, text) => { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = text; };

  function unlock() {
    Passport.setUnlocked(APP, true); autoFinger = true;
    const email = Passport.appAccount(APP);
    // quiet save to Drive (only if Google is still signed in), then carry on
    if (Passport.needsSync(email)) return Passport.sync(email).catch(() => {}).then(route);
    route();
  }
  const CLOUD = Passport.cloud;

  // ---------- router ----------
  function route() {
    const email = Passport.appAccount(APP);
    if (!email) return welcome();
    const p = Passport.find(email);
    if (!p) return CLOUD ? welcome() : setup(email);
    if (!Passport.isUnlocked(APP)) return login();
    return onUnlocked ? onUnlocked(p, settings) : settings();
  }

  // 1. first open
  function welcome(msg) {
    show(`${appSection()}
      <div class="ps-grow"></div>
      ${err(typeof msg === 'string' ? msg : '')}
      <button class="ps-btn ps-google" id="g">${icon.google} Continue with Google</button>
      <p class="ps-small">Pick the Google account that has your Drive.</p>
      ${CLOUD ? '<p class="ps-small">On Google\'s screen, <b>tick the Google Drive box ☑</b> so your passport can be saved.</p>' : ''}`);
    on('#g', 'click', CLOUD ? realGoogle : google);
  }

  function signInError(e) {
    const m = e.message || String(e);
    const say = m === 'no_drive' ? 'Please tick the <b>Google Drive</b> box on Google\'s screen, so your passport can be saved.'
      : /popup|access_denied/.test(m) ? 'Google sign-in was closed. Try again.'
      : 'Couldn\'t reach Google or Drive. Try again.';
    return `${say}<br><small>(${esc(m)})</small>`;
  }

  // real Google pop-up, then look for your passport in Drive
  async function realGoogle() {
    busy($('#g'), 'Opening Google…');
    try {
      const me = await PassportCloud.signIn();
      $('#g').textContent = 'Looking for your passport…';
      Passport.setAppAccount(APP, me.email);
      Passport.setUnlocked(APP, false);
      const p = await Passport.pull(me.email);
      p ? found(p) : setup(me.email, '', me.name);
    } catch (e) {
      welcome(signInError(e));
    }
  }

  // DEMO ONLY: stands in for the real Google pop-up
  function google(msg) {
    show(`${appSection(true)}
      <div class="ps-demo-note">Demo only: the real version opens Google's own sign-in.</div>
      <form id="f" class="ps-form">
        <label class="ps-label" for="em">Google email</label>
        <input class="ps-input" id="em" type="email" autocomplete="email" placeholder="you@gmail.com" required>
        ${err(typeof msg === 'string' ? msg : '')}
        <button class="ps-btn" type="submit">Continue</button>
        <button class="ps-link" type="button" id="back">Back</button>
      </form>`);
    on('#back', 'click', welcome);
    on('#f', 'submit', (e) => {
      e.preventDefault();
      const em = $('#em').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(em)) return google('Type a real email.');
      Passport.setAppAccount(APP, em);
      Passport.setUnlocked(APP, false);
      const p = Passport.find(em);
      p ? found(p) : setup(em);
    });
  }

  // 2nd app: passport found
  function found(p) {
    show(`${appSection()}
      <div class="ps-center">
        <h2 class="ps-h">Welcome back, ${first(p.name)}</h2>
        <p class="ps-sub">We found your passport. No need to sign up again.</p>
      </div>
      <div class="ps-grow"></div>
      <button class="ps-btn" id="go">Enter passcode</button>`);
    on('#go', 'click', login);
  }

  // make a passcode on the pad, then type it again. done(passcode) once both match.
  function choosePasscode(head, label, done, back, msg) {
    show(`${head}${padHtml(label)}
      ${back ? '<button class="ps-link" type="button" id="back">Back</button>' : ''}`);
    on('#back', 'click', back);
    const one = pad((a) => {
      if (!Passport.isPasscode(a)) return one.fail('Passcode must be exactly 6 numbers.');
      show(`${head}${padHtml('Type it again')}
        <button class="ps-link" type="button" id="back">Start again</button>`);
      on('#back', 'click', () => choosePasscode(head, label, done, back));
      const again = pad((b) => (a === b ? done(a, again)
        : choosePasscode(head, label, done, back, 'The two passcodes don\'t match. Try again.')));
    });
    if (msg) one.say(err(msg));
  }

  // 2. first time: name, then passcode on the pad
  function setup(email, msg, name) {
    show(`${appSection(true)}
      <p class="ps-kicker">FIRST TIME ONLY</p>
      <h2 class="ps-h">Set up your passport</h2>
      <form id="f" class="ps-form">
        <label class="ps-label" for="nm">Full name</label>
        <input class="ps-input" id="nm" autocomplete="name" placeholder="Darren Fawcett" value="${esc(name || '')}" required>
        <label class="ps-label" for="em">Email (from Google)</label>
        <input class="ps-input" id="em" value="${esc(email)}" readonly>
        ${err(msg)}
        <button class="ps-btn" type="submit">Next</button>
      </form>`);
    on('#f', 'submit', (e) => {
      e.preventDefault();
      const nm = $('#nm').value.trim();
      if (!nm) return setup(email, 'Type your name.');
      const head = `${appSection(true)}<p class="ps-kicker">FIRST TIME ONLY</p>`;
      choosePasscode(head, 'Make a 6-digit passcode', async (a, p) => {
        p.say('<p class="ps-sub">Making your passport…</p>');
        const { codes } = await Passport.create({ email, name: nm, passcode: a });
        if (CLOUD) await Passport.sync(email).catch(() => {}); // save to Drive now (Settings shows if it didn't)
        backupCodes(codes, fingerOffer);
      }, () => setup(email, '', nm));
    });
  }

  // 3. backup codes
  function backupCodes(codes, next) {
    show(`<p class="ps-kicker">SAVE THESE</p>
      <h2 class="ps-h">Your 10 backup codes</h2>
      <p class="ps-sub">Use one if you forget your passcode. Each works once.</p>
      <div class="ps-codes">${codes.map((c) => `<code>${c}</code>`).join('')}</div>
      <div class="ps-row">
        <button class="ps-btn ps-ghost" id="cp">Copy</button>
        <button class="ps-btn ps-ghost" id="dl">Download</button>
      </div>
      <div class="ps-grow"></div>
      <button class="ps-btn" id="ok">I saved them</button>`);
    const text = 'Passport backup codes (each works once):\n' + codes.join('\n');
    on('#cp', 'click', async () => { try { await navigator.clipboard.writeText(text); $('#cp').textContent = 'Copied ✓'; } catch { $('#cp').textContent = 'Copy failed'; } });
    on('#dl', 'click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      a.download = 'passport-backup-codes.txt'; a.click();
    });
    on('#ok', 'click', next);
  }

  // 4. fingerprint offer (only if this phone can)
  async function fingerOffer() {
    const email = Passport.appAccount(APP); const p = Passport.find(email);
    if (!(await Passport.fingerprintAvailable()) || p.fingerprints[APP] || Passport.appPref(APP, 'noFinger')) return unlock();
    show(`<div class="ps-center ps-gap">
        <div class="ps-big-icon">${icon.finger}</div>
        <h2 class="ps-h">Turn on fingerprint?</h2>
        <p class="ps-sub">Open ${esc(T.name)} with a touch. Your passcode still works too.</p>
      </div>
      <div class="ps-grow"></div>
      <div id="msg"></div>
      <button class="ps-btn" id="yes">Yes, turn it on</button>
      <button class="ps-link" id="no">Not now</button>`);
    on('#no', 'click', () => { Passport.setAppPref(APP, 'noFinger', true); unlock(); });
    on('#yes', 'click', async () => {
      try { await Passport.enrollFingerprint(email, APP, T.name); unlock(); }
      catch { $('#msg').innerHTML = err('Fingerprint didn\'t work. You can try again in Settings.'); }
    });
  }

  // 5. lock screen (every time after)
  async function login(msg) {
    const email = Passport.appAccount(APP); const p = Passport.find(email);
    const canFinger = p.fingerprints[APP] && (await Passport.fingerprintAvailable());
    const lockMs = Passport.lockedFor(email);
    show(`${appSection(true)}
      <h2 class="ps-h ps-center">Welcome back, ${first(p.name)}</h2>
      ${padHtml('Enter your passcode', canFinger)}
      <button class="ps-link" type="button" id="fg">Forgot? Use a backup code</button>
      ${driveLine(p)}
      <button class="ps-link" id="other">Use another Google account</button>`);
    on('#fg', 'click', () => backupLogin());
    on('#other', 'click', signOut);
    const pd = pad(async (pc) => {
      const r = await Passport.checkPasscode(email, pc);
      if (r.ok) return unlock();
      if (r.lockedMs) return lockCountdown(pd);
      pd.fail(`Wrong passcode. ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.`);
    });
    const tryFinger = async (quiet) => {
      try { if (await Passport.verifyFingerprint(email, APP)) unlock(); }
      catch { if (!quiet) pd.say(err('Fingerprint didn\'t work. Use your passcode.')); }
    };
    on('#fp', 'click', () => tryFinger(false));
    if (lockMs) return lockCountdown(pd);
    if (msg) pd.say(err(msg));
    // fingerprint on → pop it up straight away (cancel = type passcode instead)
    if (canFinger && autoFinger && !msg) { autoFinger = false; tryFinger(true); }
  }

  // too many wrong tries: pad greyed out with a countdown
  function lockCountdown(pd) {
    const email = Passport.appAccount(APP);
    const tick = () => {
      if (!$('#dots')) return clearInterval(timer);
      const ms = Passport.lockedFor(email);
      if (!ms) { clearInterval(timer); pd.lock(false); pd.say(''); return; }
      pd.lock(true);
      pd.say(err(`Locked: too many wrong tries. Try again in ${Math.ceil(ms / 1000)}s.`));
    };
    tick(); timer = setInterval(tick, 500);
  }

  // locked out → backup code → new passcode
  function backupLogin(msg) {
    const email = Passport.appAccount(APP);
    show(`${appSection(true)}
      <h2 class="ps-h">Use a backup code</h2>
      <p class="ps-sub">Type one of your 10 codes. It will stop working after this.</p>
      <form id="f" class="ps-form">
        <label class="ps-label" for="bc">Backup code</label>
        <input class="ps-input ps-mono" id="bc" inputmode="numeric" autocomplete="off" placeholder="1234-5678">
        ${err(msg)}
        <button class="ps-btn" type="submit" id="go">Continue</button>
        <button class="ps-link" type="button" id="back">Back</button>
      </form>
      <button class="ps-link" id="rg">No codes left? Reset with Google</button>`);
    on('#back', 'click', () => login());
    // Google is the real key: prove it's your account, then make a new passcode
    on('#rg', 'click', async () => {
      if (!CLOUD) return backupLogin('Pretend mode: reset with Google works in the real version.');
      try {
        const me = await PassportCloud.signIn();
        if (me.email.toLowerCase() !== email) return backupLogin('That\'s a different Google account.');
        await Passport.pull(email);
        Passport.setUnlocked(APP, false); // no hidden key open = a new one gets made
        newPasscode(null);
      } catch (e) { backupLogin(signInError(e)); }
    });
    on('#f', 'submit', async (e) => {
      e.preventDefault(); busy($('#go'), 'Checking…');
      const r = await Passport.useBackupCode(email, $('#bc').value);
      if (r.ok) return newPasscode(r.left);
      backupLogin(r.lockedMs ? `Locked: try again in ${Math.ceil(r.lockedMs / 1000)}s.` : `That code didn't work. ${r.triesLeft} tries left.`);
    });
  }

  // left = backup codes left (after a backup code). null = Reset with Google (makes a new hidden key)
  function newPasscode(left) {
    const head = `<h2 class="ps-h ps-center">Make a new passcode</h2>
      <p class="ps-sub ps-center">${left === null
        ? 'You\'ll get new backup codes too. Private stuff locked with the old passcode (like Secrets) can\'t be opened any more.'
        : `${left} backup codes left.`}</p>`;
    choosePasscode(head, 'New 6-digit passcode', async (a, p) => {
      p.say('<p class="ps-sub">Saving…</p>');
      const codes = await Passport.setPasscode(Passport.appAccount(APP), a);
      codes ? backupCodes(codes, unlock) : unlock();
    });
  }

  // some things need the hidden key open: after fingerprint it's still locked, so ask for the passcode
  function needKey(next, back, msg) {
    const email = Passport.appAccount(APP);
    if (Passport.key(email)) return next();
    show(`${appSection(true)}
      <h2 class="ps-h ps-center">Type your passcode</h2>
      <p class="ps-sub ps-center">This needs your passcode, not just your fingerprint.</p>
      ${padHtml('Your passcode')}
      <button class="ps-link" type="button" id="back">Back</button>`);
    on('#back', 'click', back);
    const pd = pad(async (pc) => {
      const r = await Passport.checkPasscode(email, pc);
      if (r.ok) return next();
      if (r.lockedMs) return lockCountdown(pd);
      pd.fail(`Wrong passcode. ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.`);
    });
    if (Passport.lockedFor(email)) return lockCountdown(pd);
    if (msg) pd.say(err(msg));
  }

  // settings (where the ID lives)
  // 🚪 sign out: this app forgets the Google account on this device. The app can tidy up first (onSignOut).
  async function signOut() {
    try { if (onSignOut) await onSignOut(); } catch {}
    Passport.signOut(APP); Passport.setUnlocked(APP, false);
    if (CLOUD) PassportCloud.signOut();
    welcome();
  }

  // v0.4.1 security level: how often this app asks (saved in the passport, so every device follows it)
  const LEVEL = {
    open: ['Open', 'Opens straight in. Private stuff still asks for your passcode.'],
    remember: ['7 days', 'Asks once a week on this device.'],
    locked: ['Every time', 'Asks every time you open it.'],
  };
  const day = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  function levelPicker() {
    const lv = Passport.level(APP), until = Passport.rememberedUntil(APP);
    return `<div class="ps-lv">
        <p class="ps-lv-h" id="lvlbl">Ask for passcode</p>
        <div class="ps-seg" role="radiogroup" aria-labelledby="lvlbl">${Passport.LEVELS.map((k) =>
          `<button type="button" role="radio" aria-checked="${k === lv}" data-lv="${k}">${LEVEL[k][0]}</button>`).join('')}</div>
        <p class="ps-lv-note">${LEVEL[lv][1]}${lv === 'remember' && until ? ` Unlocked here until ${esc(day(until))}.` : ''}</p>
      </div>`;
  }

  async function settings() {
    const email = Passport.appAccount(APP); const p = Passport.find(email);
    const can = await Passport.fingerprintAvailable();
    const fp = p.fingerprints[APP];
    // v0.3.5 (Darren): all on one screen. '‹ Home' at the top, fingerprint = a switch, two buttons per line.
    show(`<div class="ps-set">
      ${onUnlocked ? `<button class="ps-home" id="back">‹ Home</button>` : ''}
      <header class="ps-me"><div class="ps-tile">${T.logo.type === 'svg' ? T.logo.value : esc(T.logo.value)}</div>
        <div><h2 class="ps-h">Your passport</h2><p class="ps-ok">You're in ✓</p></div></header>
      <dl class="ps-card">
        <div><dt>Passport</dt><dd>${esc(p.id)}</dd></div>
        <div><dt>Name</dt><dd>${esc(p.name)}</dd></div>
        <div><dt>Email</dt><dd>${esc(p.email)}</dd></div>
        <div><dt>Drive folder</dt><dd>${CLOUD ? esc(PassportCloud.ROOT) + ' / ' : ''}${esc(p.id)} / ${esc(T.drive)}</dd></div>
        <div><dt>Backup codes left</dt><dd>${Passport.backupLeft(p)} of 10</dd></div>
        <div><dt>Hidden key</dt><dd>${Passport.key(email) ? 'Open ✓' : 'Locked'}</dd></div>
        <div><dt>Saved in Drive</dt><dd>${!CLOUD ? 'Pretend mode' : p.dirty ? 'Not yet' : 'Yes ✓'}</dd></div>
        <div><dt id="fplbl">Fingerprint</dt><dd>${can
          ? `<button class="ps-switch" id="fpt" role="switch" aria-checked="${fp ? 'true' : 'false'}" aria-labelledby="fplbl" title="${fp ? 'Turn fingerprint off' : 'Turn fingerprint on'}"></button>`
          : 'Not on this device'}</dd></div>
      </dl>
      ${levelPicker()}
      <div id="msg"></div>
      ${CLOUD && p.dirty ? '<button class="ps-btn" id="sv">Save to Drive now</button>' : ''}
      <div class="ps-row">
        <button class="ps-btn ps-ghost" id="cpw">Change passcode</button>
        <button class="ps-btn ps-ghost" id="nb">New backup codes</button>
      </div>
      ${Passport.level(APP) === 'open'
        ? '<button class="ps-btn ps-ghost ps-out" id="out">Sign out</button>'
        : `<div class="ps-row">
        <button class="ps-btn ps-ghost" id="lock">🔒 Lock now</button>
        <button class="ps-btn ps-ghost ps-out" id="out">Sign out</button>
      </div>`}
      <p class="ps-small">Sign out to use another Google account. Your passport stays safe in Drive.</p>
      </div>`);
    on('#sv', 'click', async () => {
      busy($('#sv'), 'Saving…');
      try { await Passport.sync(email, true); settings(); }
      catch { await settings(); $('#msg').innerHTML = err('Couldn\'t save to Drive. Try again.'); }
    });
    on('#back', 'click', route);
    on('#cpw', 'click', () => needKey(() => newPasscode(Passport.backupLeft(Passport.find(email))), settings));
    on('#lock', 'click', () => { Passport.setUnlocked(APP, false); login(); });
    root.querySelectorAll('[data-lv]').forEach((b) => b.addEventListener('click', () => { Passport.setLevel(APP, b.dataset.lv); settings(); }));
    on('#out', 'click', signOut);
    on('#nb', 'click', () => needKey(async () => backupCodes(await Passport.newBackupCodes(email), settings), settings));
    on('#fpt', 'click', async () => {
      if (fp) { Passport.removeFingerprint(email, APP); return settings(); }
      try { await Passport.enrollFingerprint(email, APP, T.name); settings(); }
      catch { $('#msg').innerHTML = err('Fingerprint didn\'t work. Try again.'); }
    });
  }

  // ---------- start ----------
  function applyTheme(theme) {
    const r = document.documentElement.style;
    for (const [k, v] of Object.entries(theme.colors)) r.setProperty('--ps-' + k, v);
    r.setProperty('--ps-font', `'${theme.font}', system-ui, sans-serif`);
    document.documentElement.dataset.align = theme.align || 'center';
    if (theme.fontUrl) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = theme.fontUrl; document.head.appendChild(l);
    }
  }

  function start(opts) {
    APP = opts.app; T = opts.theme; root = opts.mount; onUnlocked = opts.onUnlocked; onSignOut = opts.onSignOut;
    Passport.setDefaultLevel(APP, T.security); // theme.json "security": open | remember | locked (none = locked)
    applyTheme(T);
    route();
  }

  return { start, settings, needKey, route };
})();
