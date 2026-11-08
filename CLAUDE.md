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
- **1 Nov v0.60 (demo only; live still v0.59; Opus tests, Sonnet built, Opus checked): ORBIT INBOX.** Orbit Agent (its own Worker = the MCP;
  NO server/MCP in Lite) drops job files wmm-job-YYYYMMDD-HHMMSS-xxxx.json (demo: wmm-demo-job-) in Drive. lite.js jobsRun (Drive on + token
  + unlocked: on load, after the quiet reconnect, when shown again; waits for 'lockon' to go; syncBlocked = retry 5 s): list, M.jobOrder
  (by name), M.applyJob, delete each file, save, reload, toast .synctoast.jobtoast 'Added by Orbit: £5.10 Tesco'. Kinds add_spend
  (date/upcoming/no date = maybe), add_bill (day), card_spend, card_paid_off (first card), remove_spend (target = job id: spend, bill or
  card line with that `job` field; spends keep their own number id). state.jobsDone (newest 300) = no doubles; unknown kind/v = file
  left alone. Every Drive save also writes wmm-summary.json (demo: wmm-demo-summary.json, DK('summary')), NOT scrambled, totals only:
  M.summary {updated, spare, spent, to_come_out, pots:[{name,budget,used}], card:{used,free}, bills:[{name,amount,day,paid}] (not paused; paid = ticked or due day gone)}. Privacy page says so. Old Drive tests
  skip the summary file on purpose. CATCH: drive.file = Lite only sees Orbit's files if Orbit uses the SAME Google Cloud project (client).
  Tests 118 node + 262 browser (test_v060.py; pytest-xdist -n 4 works). Pushed to jolly-bardeen (Pages) = demo site.
- **RULE (Darren, 25 Oct): every ⓘ note FLOATS over the page (the .infotip bubble), never pushes into the space or changes a card's
  size. ⓘ buttons stay on the same line as their label, never wrap onto a new line.**
- Darren: copy-paste things always in a code block. Short replies, spacing, one next step.
- **2 Nov v0.61 (demo only; live still v0.59): 🛂 PASSPORT ID = THE LOCK (Opus wrote tests, built, checked).** docs/demo/passport/ = a COPY of
  DF-AI-Lab/Passport-ID v0.3.3 (config/google/passport/ui.js + passport.css, never edit here; update from Passport-ID) + theme.json (WMM dark
  mint, Manrope, lite-192.png logo, drive "WMM"). lockui.js GONE. passport-lock.js = adapter keeping the old names (Lock.seal/open/openWith/adopt,
  LockUI.record/adopt/demo + passportId/email/cloud/driveName/lockNow/settings, LiteName). Lock cover = #wmmlock > #passport (NOT #lock: Passport's
  own 'Lock now' button is id="lock"). Settings 'Lock' group = #passportbtn ('Your passport: DF…' → PassportUI.settings: passcode, codes,
  fingerprint, Lock now, Sign out) + #locknow. 5-min idle lock kept (sessionStorage lite_unlock).
  KEYS (wmmkey.js, node + browser): localStorage lite_key_v1 = {v:2, pub (RSA-OAEP public, clear), priv + mb (locked by HKDF(Passport.key,
  'wmm-lite'/'backups'))}. Backup v2 = data under random K, K under pub, priv + mb ride along. Saving needs NO hidden key (fingerprint unlock still
  saves); opening needs the passport passcode (any device, same passport). After a passcode: sessionStorage lite_tab_key = WMM's derived key for
  this tab (not the hidden key; cleared on lock/sign out) so 🔁 sync/pair open copies quietly. OLD LOCK: first passcode on a device with
  lite_lock_v1 moves its mb in (it was stored in the clear, so no old passcode needed), then lite_lock_v1 is deleted. Old v1 backups open with the
  OLD passcode/old codes (their own wrapped copies) or with the passport via mb.
  DRIVE: token = WMM's own or Passport's (sessionStorage passport-google-token, same client). With a passport every file goes in App data - DON'T
  DELETE / DF…… / WMM (lite_drive_ppdir, Safety copies = lite_drive_ppsafe); moveIn() moves old files (backups, safety copies, summary, pair note,
  Orbit jobs) there ONCE (PATCH addParents/removeParents, lite_drive_moved = passport id). All lookups stay by NAME, so Orbit jobs/summary are found
  anywhere. First unlock of a passport here (lite_drive_ppseen) = Drive on with the passport's Gmail; another Gmail than before = fresh file ids.
  WIPED DEVICE: Passport Google sign-in + passcode, then (no money here: lite_state_v1 missing or lite_drive_blank) lite_drive_restore='need' →
  restore screen in #passport (#wmmrestore; newest copy; v2 opens with the key; old v1 asks the OLD passcode #wmmold/#wmmoldgo; 'Start new' = Drive
  off). Saves wait while 'need'. SIGN OUT (Passport settings) = save to Drive if dirty (else download a backup file), then every lite_* key
  (not lite_demo_*) leaves this device; next sign-in reloads clean. DEMO: no lock; ?lock=1 = pretend Passport (PASSPORT_CONFIG.googleClientId ''
  set inline; passport-demo-v2, app 'wmm-demo', lite_demo_* keys); ?lock=google = the REAL passport with demo money + Drive folder 'WMM demo';
  ?lock=0 off. tools/move_to_live.py now copies sub-folders (passport/). Tests: conftest seeds a passport (PIN, PP_CODES, MK, DF123456,
  fake.person@example.com) + KEYREC + ppseen; test_v061.py (PDrive = fake Drive with q filters + parents); gob6/v042/v043/v044 rewritten for
  Passport, v057/v058 removed (replaced by v061). Tests 124 node + 262 browser (-n 4 --timeout; -n 8 makes timing tests flaky). NEXT: Darren tries /demo/?lock=1 then ?lock=google; Orbit should write jobs into the WMM folder.
- **3 Nov v0.62 (demo only; live still v0.59): Darren tried ?lock=google: money did not come back + Google asked 'tick the Drive box' every sign-in.**
  1) Sign out then sign in on the SAME page: the restore ran while lite.js `signedOut` was still true, so Store.save did nothing and the
  reload showed starter money. Fix: restoreFinish clears signedOut; passport-lock goIn() (no copy / Start new) reloads clean when signed out.
  2) Passport v0.3.4 (Passport-ID repo first, then copied): PassportCloud.signOut no longer calls oauth2.revoke (it took the Drive permission
  away). Note: opening the ?lock=google link itself wipes the demo on purpose; after the first time use plain /demo/.
  Tests 124 node + 263 browser (test_v062.py). test_v055 scan test is flaky before and after (fails ~half the runs alone).
- **3 Nov v0.63 (demo only; live still v0.59; mock https://claude.ai/artifact/Si9fuCGNRNq8DzxoNjfiYH): Passport settings on ONE screen.**
  Passport v0.3.5 (Passport-ID first, then copied): settings = .ps-set: #back '‹ Home' (.ps-home) at the top (no big 'Back to…' button),
  .ps-me logo + 'Your passport' + 'You're in ✓', card rows (Fingerprint last = #fpt .ps-switch role=switch aria-checked; no fingerprint =
  'Not on this device'), .ps-row #cpw Change passcode | #nb New backup codes, .ps-row #lock 🔒 Lock now | #out Sign out (.ps-out red).
  lite.css #wmmlock overrides for .ps-home/.ps-switch/.ps-out. gob6/v044 changed on purpose (switch, 'New backup codes').
  Tests 124 node + 264 browser (test_v062.py). Flaky under -n 4 only: test_gob9 save, test_v055 scan.
- **3 Nov v0.63 MOVED TO LIVE (Darren: "we moving to live, i got a copy"): live = demo = v0.63 (so Passport ID v0.61-v0.63 is live).**
  Live now has passport/, passport-lock.js, wmmkey.js; lockui.js gone. On first passcode the old lite_lock_v1 moves into the passport.
  Tests 124 node + 264 browser (3 timing flakes under -n 4 passed alone: test_v055 typed code, test_v061 sign out, test_v048 cloud tap).
- **4 Nov v0.64 (demo only; live still v0.63; mock https://claude.ai/artifact/5jrk4Euv1xNFioJpeZaWjD): Darren: the PC wrote over the phone's
  Drive copy (no check unless ?beta=sync) + the payday box said "Last month's spare" for THIS month's spare.**
  1) #quick = 'This month': .nmrow #nm-pay / #nm-left (lock icon, = state.left as set on payday) / .sofar #nm-sofar (monthEndSpare, live) /
  .nmday #qday; #nmstart 'Start a new month' shows #nmform (the old #payform, labels New pay / Really left in your bank, button
  'Start new month', same #newmonth sheet). .tap opens the form too. Hint 'The app thinks £X is left'.
  2) lite.js guardNewer(hidden) in driveSaveNow for everyone (not only sync): newest Drive copy stamp != DK('synced') = another device saved
  since: hidden/typing = refuse (stays dirty); else open it, same money = carry on, else Sheet.choose '⚠️ Another device saved too' (Drive
  copy = syncUse reload / This device's = safeKeep (copy to 'wmm-lite-safety other device YYYY-MM-DD.json') then write / Not now = nothing).
  Drive Load + restore now set DK('synced').
  3) 📱 Your devices (?view=devices, Settings → Cloud #devlink): Drive notes wmm-lite-devices.json {main, devices:[{id,name}]} and
  wmm-lite-invite.json {code, exp, main, from, joined} (demo: wmm-lite-demo-*). DK('devid'/'role' main|linked/'mainname'/'outbox'/'devices'/
  'reqdone'). #devmain = devMakeMain (safeKeep the old Drive copy, write this money). Main: #devinvite code + QR (?join=CODE), polls joined.
  Other device: #devjoinform = devJoin (copies the Main's newest copy; its old money = DRIVE_UNDO + a downloaded file). LINKED: run() applies
  locally + outAdd (label from changeLabel, same-thing edits merged) → outSend = one file wmm-lite-req-<devid>-<ms>.json; never writes the
  backup (driveSaveNow throws), no Orbit jobs; #devwait band '⏳ N changes waiting for your <Main>'; when its req files are gone it loads the
  Main's copy (toast). MAIN: mainCheck lists all req files → #approve sheet (.aprow tick boxes, #apyes 'Add ticked (N)' / #apno Not now) →
  ROUTES replayed, saved to Drive, THEN files deleted (DK('reqdone') stops doubles). devCheck on load, unlock, visible, every 30 s. Old
  #pairbox only shows with ?beta=sync. Not built: the 'you changed this on the phone too' flag from mock 4.
  Tests changed on purpose: golite/step10/step11 tap #nmstart; gob9/v037/v038/v061 fakes return modifiedTime / sort newest / seed
  lite_drive_synced; v055 greyed test = #pairbox hidden. Tests 124 node + 272 browser (test_v064.py). Flaky under -n 4 (pass alone, old
  code too): test_v045 both_changed_keep, test_v055 scan.
- **4 Nov v0.65 (demo only; live still v0.63):** Pay in 'This month' is a button (#nmpayedit, pencil) = Sheet.ask then POST /pay (change this
  month's pay any time, no new month). Tests 124 node + 273 browser (flake under -n 4: test_v048 cloud tap).
- **4 Nov v0.66 (demo only; live still v0.63):** Left from last month in 'This month' is a button too (#nmleftedit, pencil, no lock icon) =
  Sheet.ask then POST /left (fix it any time; Left so far + every total follow). Tests 124 node + 274 browser.
- **4 Nov v0.67 (demo only; live still v0.63): Darren: "PC not updating" (it was never linked: a code was needed).** lite.js devCheck now also runs
  with no role: autoFollow(note) = a Main is in wmm-lite-devices.json and it isn't this device -> this device's own money (if not blank and
  different) goes to Safety copies via safeUpload ('wmm-lite-safety this device before following DATE.json'), then it joins the list, role
  linked, copies the Main's newest copy, reloads (toast 'Linked'). No code needed (same Google account = same person). Checks: start-up,
  shown again, every 30 s. Main saves to Drive 5 s after a change (was 60 s). Linked with no Google token = #devwait.tapme '🔄 Tap to get
  your Main's latest' (quiet reconnect, then devCheck). Only the Main approves changes (as v0.64). Tests 124 node + 275 browser
  (flaky under -n 4, pass alone: test_v055 scan, test_v061 sign out).
- **4 Nov v0.67 MOVED TO LIVE (Darren: "worked it back and forth, move to live"): live = demo = v0.67** (so v0.64-v0.67 are live: This month box,
  Pay/Left edit, never write over another device, Your devices Main + auto-follow).
- **8 Nov: SITE WENT 404.** Pages was built from branch jolly-bardeen; PR #3 merged it into main and the branch was deleted, so
  GitHub turned Pages off. Darren set Pages = **main /docs** (working again). "Move to live" now = get it onto main. Never delete
  the Pages branch.
