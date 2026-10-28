# Where's My Money? Lite

**THIS REPO = LITE (made 21 Oct 2026, v0.01). It is the only repo: never read, use or link any other repo.**
(It started as a copy of the old v3 app; that app is retired.)
- `/` = templates/ + static/ (the v3 page + a 'Lite' badge). `/demo` = demo/templates + demo/static (a copy to try
  changes on first; web.home(folder=...)). Changes made on /demo go back to /demo.
- Version: fintrack/appversion.py, starts at 0.01, +0.01 per push.
- Plan: map = Lite issue #1. Next: trim what Lite doesn't need (PC .bat files, v2 phone parts,
  prototypes), then ticket #25 Bill details. Not online yet (later: same PythonAnywhere site at /lite).
- **21 Oct BIG CHANGE: Lite = HTML + CSS + JS only, on GitHub Pages, data in each person's browser (localStorage).
  No Python server. Python stays as a guide only. Read `PLAN.md` first (rules + steps).** Look = the old v3.62 page,
  only change = the word "Lite". Done = side-by-side phone screenshots.
- **WHO BUILDS: Sonnet subagent builds, Opus checks** (read every diff, run the screenshots, decide done).
- **21 Oct STEP 1 BUILT (v0.02): `docs/` = the GitHub Pages site** (index.html = live v3.62's rendered page on fake data,
  look.css/icons byte-copies of live; only changes: '· Lite' in the tagline, version text, relative paths, a small
  script that stops server calls/forms). Checked: phone-width screenshots, light + dark, pixel diff = tagline line only.
  LOOK LOCKED (Darren agreed 21 Oct). Live at https://df-ai-lab.github.io/wheres-my-money-lite/
  (Pages = this branch, /docs). Next: step 2 maths in JS. 
- **21 Oct STEP 2 BUILT (v0.04, Sonnet built, I checked):** docs/money.js (maths, node + browser), render.js (ports the
  Jinja for top card, Zopa tile, Add a spend, Credit card, Bills), lite.js (in-browser 'server': routes -> state in
  sessionStorage 'lite_state_v1' (Store, step 3 = localStorage), reload like live's redirect; ?today=YYYY-MM-DD).
  Checks: `node --test tests_js/money.test.js` (4 pass) and `tools/lite_compare.py LIVE_COPY OUT` (9 scenarios, Lite vs
  live pixel compare: all OK). Darren's real numbers (21 Oct: spare 53.66, card 293.36) checked PRIVATELY in scratch:
  all match. REPO + PAGES ARE PUBLIC: never commit real data. Bills sort by avg (no Move & rename order yet).
- **21 Oct GRILL AGREED: no statements/PDFs, all typed by hand; new design + build order 1-9 in PLAN.md.** Next = step 1 saving.
- **21 Oct GO A BUILT (v0.08, Opus wrote tests, Sonnet built, Opus checked):** PLAN steps 1-4. State v2 in money.js
  (bills amount/due/paid, pots, history = months saved at payday). Real data = localStorage 'lite_state_v1' from
  TEMPLATE(); `?demo=1` = FAKE() in sessionStorage 'lite_demo_v1' (never touches real data). Settings: Save / Load backup
  (plain JSON for now; scrambled in step 6). New CSS only in docs/lite.css (pots orange). Tests: `node --test
  tests_js/*.test.js` (18) + `python3 -m pytest -q tests_browser` (20, playwright). tools/lite_compare.py now differs
  on purpose (pots, due days). Next = step 5 (several cards + Zopa question).
- **21 Oct REVIEW FIXES (v0.09, by me):** no Paid tick box (only ⓘ 'check your bank app' once the due day has gone);
  a category on every bill (grey line + ⋯ → 🏷 Category, POST /bill/cat); Last month's spending rows have avg + diff
  pills, every category opens to its shops with → Bill (adds a bill). Tests 20 node + 22 browser.
- **21 Oct GO B BUILT (v0.10-v0.14, Opus wrote tests, Sonnet built, Opus checked; work on branch
  claude/busy-hamilton-qv12p1, also pushed to jolly-bardeen = Pages):** step 5 several cards (state v3 `cards`, Zopa
  question once a card bill's due day has gone), 6 lock (docs/lock.js + lockui.js: passcode, 10 codes, fingerprint
  passkey, scrambled backup; tests seed a lock via conftest.py), 7 Move & rename / Update (version.json) / Ideas
  (?view=ideas) / Invite (?view=invite, docs/invite-qr.svg), 8 sw.js offline + install (bump sw.js VERSION every
  version), 9 Google Drive (docs/config.js googleClientId empty until Darren does DRIVE_SETUP.md). Tests 43 node + 67 browser.
  NEXT: Darren's feedback round (PLAN.md step 10).
- **21 Oct STEP 10 BUILT (v0.15, Opus wrote tests, Sonnet built, Opus checked):** Darren's 9 feedback changes. State adds
  payDay (1-31), cats (own categories), lastBackup. Money: startSpare, nextPayday/paydayText/setPayDay/paydayDue,
  categories, reminders, setBackupDay/backupText. Routes /payday/day, /backup/saved. Bell = #bellbtn under ⚙ Settings
  (beside the version: no room next to the name at 390 px). Pots = tr.potbill rows in Bills (not tr.bill; Total includes
  them, spare counts them once). Tests 57 node + 93 browser. NEXT: Darren tries v0.15 on the phone.
- **21 Oct v0.16 (Opus tests, Sonnet built, Opus checked):** green 'Paid' then ⓘ once a bill's due day has gone; bell list
  scrolls + Clear all (/reminders/clear: due bills paid=true, s.snooze=today hides payday/card/backup that day); a bill in
  a pot's category (pot with an amount) is paid FROM the pot (bill.pot; out of billsTotal, into pot spent; billsAll for
  monthEndSpare). Tests 62 node + 97 browser.
- **21 Oct v0.17 (Darren chose it):** ACTUAL SPARE = REAL MONEY LEFT = pay + left − every bill − every spend (pot spends
  too) = monthEndSpare. Starting spare = the plan (pay + left − own bills − pots set). Top rows: ... Starting spare, + Pots
  not spent yet (potsLeft), − Pots over, − Spends (not in a pot), Actual spare. Ring pots slice = potsSpent. Add a spend
  card: mfs = pay + left − billsAll, typed = every spend. Tests 61 node + 98 browser.
- **21 Oct v0.18-0.20:** bell Show makes the target pulse (class .pulse ~2.7 s, green glow + outline; tr = a rounded .pulsebox overlay 10px outside +
  outline; reduced motion = one calm highlight; Show payday/backup pulses #quick). Tests 61 node + 100 browser.
- **22 Oct v0.21:** top card = Pay, + Left, − Bills, − Spends, ONE pot line "Pots left" (#st-potleft = potsLeft − potsOver, "(£X over)" note;
  "Pots over" if negative), then the line, Starting spare, Actual spare. No #st-pots / #st-over. Tests 61 node + 101 browser.
- **22 Oct v0.22:** no "(not in a pot)" words: ⓘ on − Spends (.r.spends) and on Pots left explain them. Tests 61 node + 102 browser.
- **22 Oct v0.23:** 521-640 px (phone zoomed out) used look.css boxed card rows for Bills/Last month; lite.css now gives them the
  phone (≤520) rows there too. Tests 61 node + 103 browser.
- **22 Oct v0.24 (mock B):** "Start a new month?" = #newmonth .sheetback sheet (slides up; New pay + Left; .pri Yes / .sec just the pay /
  .ter Cancel = nothing; Escape or tap outside = Cancel), no browser confirm. Other confirm()s still browser boxes. Tests 61 node + 104 browser.
- **22 Oct v0.25 (mock B):** bill row = .bline (.bbase name + .bdate "· 1st", 13px) then .bsub "cat · avg"; due day gone (duePassed, not
  stopped) = .bline.paid: green name with ::before ✓, green date, then ⓘ. No "Paid" word / .bpaid. Tests 61 node + 104 browser.
- **22 Oct v0.26:** bill ⋯ → ✅ Mark as paid / ↩️ Not paid yet (POST /bill/paid, tr data-paid; green = !stopped && (paid || duePassed),
  ⓘ INFO.marked when paid by hand). #headupd "🔄 Update" under the icon (.brandcol): no confirm, .brand.spinning, sw update, reload.
  Tests 61 node + 107 browser.
- **22 Oct v0.27 (mock C2):** no #headupd button; #updband (fixed bottom edge band "✨ New version vX · Update") shows only when version.json > Money.VERSION
  (checked on load + when the page comes back into view); tap = .brand.spinning, sw update, reload. Header size unchanged. Tests 61 node + 109 browser.
- **22 Oct v0.28: LIVE + DEMO (Darren: "same as v3").** WORK IN `docs/demo/` (the source; served at …/demo/, ALWAYS fake data: lite.js
  demoCopy = path has /demo/ → Store.demo, no lock, version shows "demo.v0.xx"). LIVE = `docs/` root = Darren's real money (localStorage, same
  origin as the demo!). RULE: push to demo only; `python3 tools/move_to_live.py` (copies docs/demo/* to docs/) ONLY when Darren says
  "move to live". sw.js: demo cache wmm-lite-demo-V, live wmm-lite-V, each deletes only its own; live's worker ignores …/demo/.
  Tests serve docs/demo at / (so it acts as live); tests_browser/test_livedemo.py serves the whole docs/. New CSS only in
  docs/demo/lite.css, never touch docs/demo/look.css. Version bump = the demo files (+ fintrack/appversion.py).
  Also v0.28: docs/demo/sheet.js (Sheet.confirm/ask/tell) replaced EVERY confirm/prompt/alert (test bans them); tests answer with
  conftest sheet(page, answer). Settings 🔄 Update removed (the ✨ band does it). Tests 61 node + 114 browser.
- **22 Oct v0.29 (mock B, Darren: "move straight to live too"):** the installed app clashed with the old v3 app (same lens icon, same
  name). Home-screen icons = lite-192/512/maskable-512.png (mint LITE tag, tools/make_lite_icon.py), manifest short_name "My Money Lite",
  apple-touch-icon = lite-192; the page header keeps icon-192.png. Tests 61 node + 119 browser (test_liteicon.py).
- **22 Oct v0.30 (moved to live 22 Oct):** after a save the page stays where you were: lite.js keepPlace() (in leave) saves sessionStorage
  'lite_place' = the tapped thing's form / [data-id] row / card + its screen top (pointerdown; sheets/menus ignored; else the sent form),
  backToPlace() on load scrolls it back (fallback scrollY). Tests 61 node + 124 browser (test_stayput.py).
- **WHERE WE ARE (23 Oct): live = demo = v0.30.** Darren reinstalls "My Money Lite" on the phone (old icon gave "could not open
  app"; uninstall the old Lite icon, keep v3, install from Chrome itself). Ideas waiting (only if he asks): Pause/Resume for subs
  (pause-first in the delete sheet, a Paused group), Google Drive setup (DRIVE_SETUP.md), calling it v1.00.
- **23 Oct v0.31 (demo only):** the Lite icon (lite-192.png) is now also in the page header, the lock screen and the browser tab
  (no plain icon-192 left in index.html). Browser tests: `LITE_CHROME=/opt/pw-browsers/chromium-*/chrome-linux64/chrome` picks this
  container's Chromium (conftest default = old path). Tests 61 node + 124 browser. (Zoomed-in header overlap: Darren said forget it.)
- **23 Oct v0.32 (demo only): GOOGLE DRIVE SET UP.** Darren made Google Cloud project "Wheres My Money Lite" (Drive API on,
  scope drive.file = non-sensitive, External, still TESTING: test user = Darren only; publishing needs Branding = a privacy
  policy page, not made yet). Client id in docs/demo/config.js. Demo uses its own Drive file wheres-my-money-demo-backup.json
  + localStorage key lite_demo_drive_file (live: wheres-my-money-backup.json / lite_drive_file). Tests 61 node + 126 browser.
  NEXT: Darren tries Connect/Save/Load on the demo; then privacy page + Publish app; later maybe auto-sync.
- **23 Oct v0.33 (demo only):** Darren tested Drive Save + Load on the demo: WORKS. Privacy page docs/demo/privacy.html (no email on
  it; contact = GitHub issues; own body bg/colour so dark mode reads), link under the Drive buttons (.drivepp), in sw.js FILES.
  Tests 61 node + 131 browser (test_privacy.py). NEXT: Darren fills Google Branding (home page, privacy link, authorised domain
  df-ai-lab.github.io) then Audience → Publish app. Privacy URL is /demo/privacy.html until "move to live", then the root one.
- **24 Oct v0.34 (demo only):** phones said "Could not open app" on install: Chrome remembered the old install (manifest id "./",
  synced from the PC through the Google account). manifest id is now "./?app=lite2" = a new app to Chrome. If it repeats, change the id again.
- **24 Oct INSTALL STILL BROKEN (open):** v0.34's new id did NOT help. Both Samsung phones: Chrome ⋮ → Install → "This app is already
  installed" → tap = "Could not open app". Samsung Internet: "Couldn't install web app". chrome://webapks on the phone shows NO Lite app
  (only Food Tracker live + V4 demo, DinnerSync demo, Petitions, v3 'My Money'). Android Apps list: no Lite. Not tried yet: uninstall the
  PC Lite install (Windows Start → My Money Lite → Uninstall; PC install was made only while debugging; chrome://apps is gone in new
  Chrome). Can't clear df-ai-lab.github.io site data (other apps share that origin). Ideas: different origin for Lite (own Pages repo/
  account or Netlify/Cloudflare), or 'Create shortcut' as a fallback. Live is still v0.30; Google Branding/Publish not done yet.
- **24 Oct v0.35 (demo) INSTALL CAUSE FOUND:** Chrome resolves a manifest id like "./?app=x" against the SITE ROOT
  (chrome://webapks showed Food Tracker = https://df-ai-lab.github.io/?app=live). Lite's "./" / "./?app=lite2" sat at the same
  root as Food Tracker's ids. Darren's 2nd phone: removed every df-ai-lab app -> Lite installed. Fix: full path ids, no "?":
  demo id "/wheres-my-money-lite/demo/"; on move to live give live "/wheres-my-money-lite/". Food Tracker should do the same
  (its own repo/chat). Changing an id = a new app to Chrome: old installs must be removed + reinstalled once.
- **24 Oct: v0.35 MOVED TO LIVE (Darren: "make the live same as the demo").** live = demo = v0.35, live id "/wheres-my-money-lite/".
  Darren installs LIVE on the phone; demo is tested in the browser only. Live's Drive uses the same client id; privacy page now at
  /wheres-my-money-lite/privacy.html (use that one for Google Branding).
- **24 Oct: Darren: "all works" = live v0.35 INSTALLS on the phone. Install problem CLOSED.** Next: Google Branding + Publish app.
- **24 Oct v0.36 (mocks A3 + D + H2; Darren: "send straight to both live and demo"): live = demo = v0.36.** Bills: no due day =
  green '+ date' (.addlink data-add=due → Sheet.day grid → /bill/due), Unsorted = '+ category' (Sheet.pick → /bill/cat); set = plain
  text. New bill glows once (sessionStorage lite_glow → tr.newglow). Spends: .spendseg Paid/Upcoming (hidden upcoming + date box
  .spenddate); spend.upcoming + date = expected; compute gives upcoming (today < date) / autoPaid (today >= date, green ✓);
  "Coming up"/"Paid" tr.sgrp only when something is coming up; every row ⓘ (SPEND_TIP in render.js) + ⋯ (Change date /spend/date,
  ✅ Paid /spend/paid, Remove = hidden /remove form). Upcoming spends count against spare like bills. newPayday keeps upcoming
  spends dated from the new payday on. tools/move_to_live.py now keeps live's manifest id. Tests 69 node + 145 browser.
  Ideas not built: bell reminder for upcoming spends; '+ category' on Unsorted spends.
- **24 Oct v0.37 BUILT (demo only; live still v0.36): the BUILD LIST below, all 4.** Money: setSpendCat (/spend/cat), setBillsPaid
  (/bills/paid keys=JSON), remindLines (bell lines: kind 'bills' = a day group {keys, items, total}, 'bill' = lone), driveName, drivePrune.
  Bell: .remind[data-kind=bills] has .remchev (svg) + .remdone, no .remgo; .remkids .remsub[data-key] = jump + pulse. Pause = the old
  stopped flag: ⋯ '⏸ Pause'; render puts stopped bills in tbody.paused (.pausedfold + tr.pbill hidden, button.resume posts /stopped 0).
  Drive (lite.js): token in sessionStorage lite_drive_token {t,exp}; localStorage lite_drive_on / _dirty (set by every route) / _last /
  _file = {name,id} (demo: lite_demo_drive_*); visibilitychange hidden (not our own reload: `leaving`) + dirty + token = driveSave(true);
  a new month file -> prune to 3; first pointerdown of a visit = driveConnect(quiet, prompt ''); #driveauto + #driveoff in ?view=drive.
  Privacy page updated. Old tests changed on purpose (bell counts 5->4, Stop counting -> Pause, Drive file names). Tests 77 node + 154 browser.
  NOT tried on a real phone/Google yet: Darren to test Drive auto on the demo (quiet reconnect may flash a Google box).
- **24 Oct v0.38 (demo only):** Darren's Drive showed TWO 'Oct 2024' demo files (Save tapped, then the app hidden = 2 saves at once).
  Fix: driveSave = one at a time (driveBusy); no saved id = look for this month's file by name first; drivePrune also drops a 2nd copy
  of a month. Backups now go in a Drive folder "Where's My Money Lite" (demo: "... (demo)", localStorage lite_drive_folder; folder made
  only when a new month file is made; no folder = saves loose). Darren added df.ai.lab.hq@gmail.com as a test user; NEXT = Branding +
  Publish app (no logo = no review). Tests 78 node + 157 browser.
- **24 Oct v0.39 (demo only):** Darren binned the old demo files, then 'Saved to your Drive' saved INTO the bin (Drive lets a PATCH
  update a binned file; a file in a binned folder too). Uploads now ask fields=id,trashed; trashed = gone: make a new file (and a new
  folder if that was binned). Tests 78 node + 159 browser.
- **24 Oct BUILD LIST (collect, then build ALL in one version):** 1) spends like bills: '+ category' on Unsorted spends
  (Sheet.pick, mock https://claude.ai/artifact/Dm56Qv5wkxwt7R2D6bD4Pz) + ⋯ → 🏷 Category; set = plain grey text. Darren: yes.
  2) bell: bills due the same day = ONE line (mock B https://claude.ai/artifact/31cf2qYr4eH4kupgwUCUfj): '1st · 5 bills · £X',
  ▸ opens one short line per bill inside the bell, ✓ ticks all; a group has no Show (tap a bill
  line inside = jump + flash that bill), a 1-bill day keeps Show + ✓. NO phone notifications (Darren: no noise).
  3) ⏸ Pause replaces 'Stop counting' in every bill's ⋯ (mock https://claude.ai/artifact/N7eHnWEmeMiW8EGR9A9dhK): paused bills leave
  the list into ONE folded line at the bottom of Bills '▸ ⏸ 3 paused · £X not counted', open = name, £, ▶ Resume. Bills stays clean.
  4) DRIVE AUTO (grill 24 Oct, NO server, NO email sign-in): after the fingerprint/passcode unlock (= a user gesture) the app quietly
  gets a Google token (GIS prompt:'' + login_hint = saved Gmail; may flash a second; first time = full Google sign-in once). Token = 1 hour,
  memory only. Saves stay local (localStorage). Drive = ONE FILE PER PAY MONTH ('wheres-my-money-backup Oct 2026.json'), overwritten on
  every visit (send once when the app is hidden/closed, only if something changed); new pay month = new file; keep the last 3 (app deletes
  older); Load = newest. Monthly bell '📥 Download a backup' for people without Gmail. Passcode unlock reconnects Drive the same way.
- **NEXT FIX LIST (Darren, 24 Oct: "on next"):** 1) Drive 'last saved' time shows 1 hour early: lite.js driveShow slices the UTC
  ISO string (DRIVE_LAST = toISOString). Show LOCAL time (new Date(at), getHours/getMinutes) so BST/GMT both read right (UK clocks
  go back 25 Oct). Only that spot is UTC: today() already uses local dates. Test: TZ Europe/London page, save at 18:19Z = '19:19'.
  2) Remember the Gmail: after Connect, GET drive/v3/about?fields=user(emailAddress) (works with drive.file), save it, pass
  login_hint on the quiet reconnect (Darren has 2 Google accounts: Google asked 'which account' every visit).
  3) Save 1 minute after the last change too (PC side-by-side windows never hide the page; closing a PC window can cut the save).
  4) A change not sent (dirty) = send it after the next visit's quiet reconnect.
  5) SAVE SIGN = mock A (https://claude.ai/artifact/QgQz31vDgMXdgiV2y9wyqr, Darren: "simple and professional"): a small cloud after
  'Lite' in the header, only when Drive is connected: saved = cloud + tick (draws in, tiny pop), saving = arrow floats up, waiting
  (dirty, not sent) = amber dot. Reduced motion = no animation.
- **24 Oct v0.40 BUILT (demo only; live still v0.36): the NEXT FIX LIST, all 5.** lite.js: 'last saved' = localTime() (UK time);
  DK('email') = the Gmail from drive/v3/about after a connect, passed as login_hint on the quiet reconnect (Turn off forgets it);
  DRIVE_DIRTY = time of the change, driveSoon() sends 1 minute after it (window.LITE_DRIVE_WAIT in tests); quiet reconnect then
  sends a change not sent (driveAuto); a change during an upload stays dirty. Header .tagline .savesign (cloud, mock A): driveSign()
  saved / 'saved pop' / saving / wait; hidden unless Drive on. Privacy page mentions the email. Tests 78 node + 167 browser (test_v040.py).
  NEXT: Darren tries it on the demo; then Branding + Publish; 'move to live' when he says.
- **24 Oct v0.41 MOVED TO LIVE (Darren: "move to live", clouds work): live = demo = v0.41.** after a save the page showed the top until 'load' (Google fonts + the Google sign-in script), then
  jumped back (Darren: 'flickers'). lite.js backToPlace: placeNow() right after render in start(), again after DOMContentLoaded
  (setTimeout, after the lock opens) and on load; page content hidden (style body > * visibility) until placed, 1.5 s max;
  stops re-placing once the person scrolls (wheel/touch/key). Tests 78 node + 168 browser (test_v041.py).
- **25 Oct: GOOGLE BRANDING DONE + APP PUBLISHED (In production, External, no logo = no review).** Home page /wheres-my-money-lite/,
  privacy /wheres-my-money-lite/privacy.html, authorised domain df-ai-lab.github.io. Any Gmail can now Connect Drive (not only test users).
- **25 Oct v0.42 (demo only; live still v0.41): Settings menu = mock B + A's grey lines** (https://claude.ai/artifact/8DuomnL4XwHkyLsUHSJjEi).
  index.html: .grp groups with p.sethead 'On this phone' (Save / Load backup), 'Cloud' (☁️ Google Drive backup), 'Lock' (fingerprint,
  codes, Lock now), Install last; span.sub grey line in each button. lite.js driveMenu(): '● On · Gmail' / 'Off · tap to connect';
  lockui.js fpMenu(): 'Set up fingerprint' / 'Fingerprint · ● On for this phone'. CSS hides a .grp with no visible .small (:has).
  Tests 78 node + 172 browser (test_v042.py). NEXT: Darren picks a lock-screen name mock (Lock 1 'Hi Darren 👋' big / Lock 2
  letter badge + 'Welcome back'); name typed with the first passcode, kept on the phone only, Settings → ✏️ Your name.
- **25 Oct v0.43 (demo only; live still v0.41): Lock 1 + 👤 Account (mock B).** Lock: #lockhi 'Hi <name> 👋' + #locktag "Where's My Money? · Lite"
  (no name = old title); #namebox/#myname 'Your first name' in the first-passcode step (hidden on forgot-reset). Name = localStorage lite_name
  (demo: lite_demo_name), this phone only; lockui.js root.LiteName {get,set}. Settings: 'Account' group first, #acclink sub = 'name · Gmail' /
  'Add your name'. ?view=account (#account.box): name form (#accname, Save name) + Google Drive card (#accstate ● On · Gmail / Off,
  #accswitch 'Use another Google account' = driveConnect(false, pick) prompt 'select_account', a NEW Gmail clears lite_drive_file/_folder and
  marks dirty; #accoff Turn off; #accconnect → ?view=drive when off). Demo has no lock, so the greeting shows on live only.
  Tests 78 node + 180 browser (test_v043.py). NEXT: Darren tries the Account page on the demo; 'move to live' when he says.
- **25 Oct v0.44 MOVED TO LIVE (Darren: "straight to live"): live = demo = v0.44 (so v0.42 menu + v0.43 Lock 1/Account are live too).**
  Backup codes screen: #copycodes '📋 Copy all codes' (clipboard, textarea fallback; text = a title line + the 10 codes) + #codescopied
  note (reset on each new set). Demo hides the Lock group + Drive menu line on purpose (no lock in the demo). Tests 78 node + 182 browser (test_v044.py).
- **25 Oct v0.45 MOVED TO LIVE (Darren: "send direct to live"; switch still hidden behind ?beta=sync): 🔁 KEEP MY DEVICES IN STEP (TEST, hidden).** Shows only after `?beta=sync`
  (localStorage lite_sync_beta; `?beta=off` hides) as #syncbox/#synctoggle in ?view=drive. On = DK('sync'). The newest Drive file =
  the shared copy; DK('synced') = 'id@modifiedTime' of the copy this device last sent/loaded. Change -> Drive in 5 s; checks on load,
  when shown and every 30 s (LITE_SYNC_EVERY), not while typing/menus/sheets/lock (syncBlocked). Newer + nothing unsent = load it,
  reload, .synctoast '↩️ Undo' (DK('undo')). Newer + unsent = Sheet.choose (new) 'Changes on both devices'. driveSaveNow refuses to
  write over a newer copy. Another lock: Lock.openWith fails -> 'Link this device' asks the other passcode once, Lock.adopt +
  LockUI.adopt = same key/passcode/codes. Turn on = 'Which copy to start with?' if different. Tests 78 node + 191 browser (test_v045.py).
- **25 Oct v0.46 (demo only; live still v0.45):** lock came up while Darren was using the app (only taps/keys counted as use). lockui.js:
  scroll/wheel/touchstart/mousemove also move the unlock stamp (at most every 5 s) = locks only after 5 min (Lock.IDLE_MS) with NO use.
  Settings menu too long: lite.css .setmenu max-height 100dvh − 96px + scrolls inside. Tests 78 node + 195 browser (test_v046.py).
- **25 Oct v0.47 MOVED TO LIVE (Darren: "move to live"; so v0.46 is live too): editing = mock C** (https://claude.ai/artifact/Ko5j6zmSpAos6uEPBjx3wS). Move & rename closes the
  Settings menu; #editpill (fixed bottom pill: '✏️ Editing', #editreset ↺ Reset = Sheet.confirm then the /layout/reset form, #editdone ✓ Done =
  editbtn). Also: a quiet Drive reconnect that returns after Turn off no longer turns Drive back on. Tests 78 node + 197 browser.
- **25 Oct v0.48 MOVED TO LIVE (Darren: "straight to live"):** tap the header cloud (.savesign, now role=button tabindex=0, Enter/Space too) = save to
  Drive now (lite.js driveTap: no token = loadGsi + quiet driveConnect first; stops the 'back to the top' link; error = Sheet.tell).
  Tests 78 node + 200 browser (test_v048.py).
- **25 Oct v0.49 (moved to live with v0.50):** every .sheet scrolls inside (max-height 100dvh − 24px; the long category pick list
  was cut off at the top). Spend ⋯ = ✏️ Change amount (/spend/amount, M.setSpendAmount; tr.drow data-amount) + ✏️ Change name
  (/spend/name, M.renameSpend), then Change date / Paid / Category / Remove. Bill ⋯ order: mock https://claude.ai/artifact/DD2QGgR38yKwvGBS95FmT8
  (Darren picked B, built in v0.50). Tests 80 node + 204 browser.
- **25 Oct v0.50 MOVED TO LIVE (Darren: "build B and send straight to live", all in one build):** bill ⋯ = mock B: menu() takes
  {row: [...]} = .brow big buttons (Amount + Mark paid/.pri or Not paid yet; bottom Pause/Resume + Delete .stop), middle Change name / Due day /
  Category / Pays a credit card, no emojis. Bill category dropdown .bmenu.catmenu scrolls. POTS: a 'takeaway' pot did not take 'Takeaways'
  spends (exact match). money.js catKey (case, spaces, trailing s) for pot ↔ spend/bill; addPot uses an existing category spelling (else adds
  the name to s.cats); pot ⋯ → 🏷 Category it takes (/pot/cat, M.setPotCat, .pot data-cat, '· takes X' line when it differs from the name).
  Pot spends AND bills in that category come out of the pot (as since v0.16). Tests 84 node + 209 browser.
- **25 Oct v0.51 MOVED TO LIVE (Darren: "build it and send straight to live"): All | Categories** (mock https://claude.ai/artifact/BgPMi2sR3uP4WiKXXzmnd7)
  in Add a spend and Bills: .catbar ('N spends/bills' + .catseg All/Categories) above the table; Categories = .catview (button.catrow per
  category: total, count, bar; tap = .catkids items) + .cattotal; card.bycat hides the table. money.js catTotals (loose like pots, biggest
  first, empty = Unsorted); compute r.spendCats (every spend = spendsAll) + r.billCats (own bills + a 'Pots' group = billsTotal + potsSet;
  paused left out). Choice per card in localStorage lite_catview. Tests 87 node + 214 browser (test_v051.py).
- **25 Oct v0.52 MOVED TO LIVE (Darren: "happy with all, build to live and demo"; mock https://claude.ai/artifact/1zmePagXQfUQeVn8QTFX5S):**
  pot rows in Bills count down (render potBill: .bsub 'Pots · £X left' / '£X over', .potbar i width = pct, td.bamt '.potspent / ' + the amount
  button; tr.potbill.over = red). Header: #setbtn + #bellbtn are svg icons; .settings = grid one block (bell under Settings on the left,
  .appver right, gap 12px). Settings + bell menus: thin grey scroll bar, overflow-x hidden. Drive menu line: Gmail in .sub .mail (own line),
  #driveinfo ⓘ (not .small) toggles #drivenote 'No Google account? Make one →' (accounts.google.com/signup); hidden with #drivelink in the demo.
  Test note: with lite_drive_on set and no Google (test browser) the first Settings tap can be eaten (also on v0.51); tests tap again.
  Tests 87 node + 220 browser (test_v052.py). Later idea (not now): OneDrive (Microsoft Graph, ~same work as Google), Dropbox; Yahoo has no drive.
- **25 Oct v0.53 MOVED TO LIVE (Darren: "move to live"; live = demo = v0.53; mock https://claude.ai/artifact/WaG2BrPssY63gawGKpx83j):** Spare cash left label has a
  button.info ⓘ ('This is a guide. Check your bank app...'). Pots line (render potsLine): .potword; net < 0 = tr .r.pots.over, 'Pots over' +
  #st-potleft '−£X' in red (var(--bad)), dot stays orange, no '(£X over)' note; Pots left with a pot over = red '.potnote £X over' AFTER the ⓘ,
  all one line (nowrap). Tests 87 node + 223 browser (test_v053.py).
- **25 Oct v0.54 (demo only; live still v0.53):** Darren asked why phone + PC don't match (Drive backup only saves; each device has its own data).
  '🔁 Keep my devices in step' (#syncbox) now shows to EVERYONE with Drive on, greyed out (.syncbox.locked, input disabled, tag 'In development');
  only a device opened once with ?beta=sync can tick it (tag 'TEST'). test_v045 hidden test changed on purpose. Tests 87 node + 225 browser (test_v054.py).
- **25 Oct v0.55 MOVED TO LIVE (Darren: "move to live"; live = demo = v0.55, so v0.54 too): Drive tab = all in one (mock https://claude.ai/artifact/XvEVsgGDZzfsVTLCdSFroq).** #drivedl '⬇️ Download
  from Drive' (newest Drive file as a file here, everyone). #syncbox/#synctoggle GONE: #pairbox '🔗 Paired devices' (greyed .locked 'In development'
  unless ?beta=sync): rows This device + paired (localStorage DK('paired') [{name,at}], device name from the browser) + Unpair. #pairgo = this device
  SHARES: writes Drive note wmm-lite-pair.json (demo: wmm-lite-demo-pair.json) {code 6 digits, exp 10 min, from, copy = its backupFile()}, shows
  #pairscreen (QR from docs/demo/qrcode.js = qrcode-generator MIT, loaded lazily; link ?pair=CODE; #pairnum), polls (LITE_PAIR_EVERY). Other device:
  ?pair=CODE opens view=drive + #pairjoin, or #paircodeform: Sheet.choose keep the SHARING device's money (first) or its own, sends it to Drive,
  marks the note joined; sharer then turns sync on, syncCheck, deletes the note. root.LiteSync {on, off} (tests). Tests 87 node + 229 browser
  (test_v055.py; test_v054 removed, test_v045 uses LiteSync on purpose).
- **25 Oct v0.56 MOVED TO LIVE (Darren: "build it and send straight to live"): DAILY SAFETY COPIES (Drive was the only copy).** lite.js safeDaily(mainId):
  before a save PATCHes this month's Drive file, the day's first save copies it (files/{id}/copy) to 'wmm-lite-safety YYYY-MM-DD.json' (demo:
  wmm-lite-demo-safety) in folder 'Safety copies' inside the app folder (DK('safedir')); once a day (DK('safeday')), never written again, newest 30
  kept. Names do NOT start with DRIVE_BASE, so Load/newest/sync/prune never see them. A binned folder = find/make the folders again. Drive tab:
  #safebox list (.saferow Load = loadBackup / ⬇️), #safeall 'Download all' (one JSON {copies:[{day,file}]}); Save/Load/Turn off now inside
  details#drivemore 'More options'. Any Load (file or Drive) keeps the old money in DK('undo') + toast '📂 Backup loaded ↩️ Undo'. Old Drive
  tests click the tucked buttons with dispatch_event and ignore safety files on purpose. Tests 87 node + 234 browser (test_v056.py).
- **28 Oct v0.57 MOVED TO LIVE (Darren: "go"; live = demo = v0.57): SIGN IN ON A WIPED DEVICE.** Darren's PC browser storage was wiped and Lite said
  "Choose a passcode" like a new person. Now no lock record = lock step 'welcome': #signin 'Sign in with Google' (Gmail = username) ->
  lite.js root.LiteRestore.find (driveConnect, newest driveList file, alt=media) -> step 'restore' (#restoreinfo date + Gmail, #rname,
  #rpin passcode OR backup code) -> Lock.adopt -> same lock record (mb/pin/codes), money saved, lite_drive_file = that file, reload, in.
  Plain (pre-lock) copy = loaded, then newpin with #restorednote. No copy / error / #restorenew 'Start new instead' = LiteRestore.off
  (Drive keys cleared, so a new start never writes over the copy). #imnew = old newpin step. DEMO: ?lock=1 = try as a wiped device
  (lite.js clears ONLY lite_demo_* keys, sessionStorage lite_demo_lock; lockui keys lite_demo_lock_v1 / lite_demo_unlock), ?lock=0 off.
  test_gob6/test_v043 tap #imnew first (on purpose). Tests 87 node + 244 browser (test_v057.py).
- **28 Oct v0.58 MOVED TO LIVE (Darren: "send it to live"): DRIVE PUSHED AT SETUP.** After the first passcode + codes (lockui `fresh`), step
  'drive': '☁️ Keep your money safe', #drivego = LiteRestore.connect (driveConnect; a Google account that ALREADY has a copy is not used:
  restoreOff + #lockerr 'already a copy'), link 'Make one with your own email →' (accounts.google.com/signup; Yahoo/Hotmail people make a
  Google account with their own email), #driveskip + ⚠️ warning. Bell line kind 'drive' '☁️ Not backed up' (Connect → ?view=drive) while
  Drive is off (not in the demo without a lock). Old tests tap #driveskip / count the Drive line on purpose. Tests 87 node + 250 browser.
  Parked: Cloudflare Pages (own origin, at production), OneDrive.
- **28 Oct v0.59 MOVED TO LIVE (Darren: "do these direct to live"; mock https://claude.ai/artifact/XbW57xUDPGfMqHwbKiLnSa):** Spends: Upcoming
  shows .whenseg 'No date yet | Pick date' to the right (.spendtop row, fades in; hidden input nodate; date box only for Pick date). spend.nodate =
  upcoming until Paid (never autoPaid; carried to the next month at payday; a date set clears it). Upcoming rows slanted + .paidq 'Paid?' under the
  amount (/spend/paid). Group 'Still to come'; bottom box Money for spending / Paid so far / #tocome Still to come / Left now. Bills: bill.due can be
  'varies' (setDue; compute varies, dueText 'varies', never past due); ⋯ Due day = Sheet.due (Set day | Varies on one line); '+ date' grid has
  .dayvaries. test_v036 changed on purpose. Tests 93 node + 255 browser (test_v059.py; LITE_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome).
- **RULE (Darren, 25 Oct): every ⓘ note FLOATS over the page (the .infotip bubble), never pushes into the space or changes a card's
  size. ⓘ buttons stay on the same line as their label, never wrap onto a new line.**
- Darren: copy-paste things always in a code block. Short replies, spacing, one next step.
