# Where's My Money? Lite

**THIS REPO = LITE (made 21 Oct 2026, v0.01).** A full copy of the financial-tracker v3 app (v3.62) to grow the Lite
app in. The main app lives in DF-AI-Lab/financial-tracker: never change that repo from here.
- `/` = templates/ + static/ (the v3 page + a 'Lite' badge). `/demo` = demo/templates + demo/static (a copy to try
  changes on first; web.home(folder=...)). Changes made on /demo go back to /demo.
- Version: fintrack/appversion.py, starts at 0.01, +0.01 per push.
- Plan: map = Lite issue #1 (was financial-tracker #22, read only). Next: trim what Lite doesn't need (PC .bat files, v2 phone parts,
  prototypes), then ticket #25 Bill details. Not online yet (later: same PythonAnywhere site at /lite).
- **21 Oct BIG CHANGE: Lite = HTML + CSS + JS only, on GitHub Pages, data in each person's browser (localStorage).
  No Python server. Python stays as a guide only. Read `PLAN.md` first (rules + steps).** Look = 100% live v3.62
  (financial-tracker branch `live`, read only), only change = the word "Lite". Done = side-by-side phone screenshots.
- **WHO BUILDS: Sonnet subagent builds, Opus checks** (read every diff, run the screenshots, decide done).
- **21 Oct STEP 1 BUILT (v0.02): `docs/` = the GitHub Pages site** (index.html = live v3.62's rendered page on fake data,
  look.css/icons byte-copies of live; only changes: '· Lite' in the tagline, version text, relative paths, a small
  script that stops server calls/forms). Checked: phone-width screenshots, light + dark, pixel diff = tagline line only.
  LOOK LOCKED (Darren agreed 21 Oct). Live at https://df-ai-lab.github.io/wheres-my-money-lite/
  (Pages = this branch, /docs). Next: step 2 maths in JS. Reference: run live `live` branch copy in a scratch dir with tests/data fake PDFs (see git log of this step).
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
- Darren: copy-paste things always in a code block. Short replies, spacing, one next step.
- Everything below is the main app's history, kept for now.

---

# Financial Tracker (main app notes)

**Front page for this project. Read this first. Keep it short and current; update it at the end of every session.**
_Last updated: 15 Oct 2026._

## What it is
A personal tool (user only, no login) for one HSBC current account. The user drops monthly statement PDFs in a folder,
runs one command, and gets: bills, payday-to-payday cycles, what is Common / Random / One-off, and a "Latest pay?"
question that shows what is left after a typical month. Everything is Python 3 + pdfplumber + SQLite.
Older project (do not build on it): `python-finance-tracker` repo, see its `IDEA.md`.

## Read next
- `SPEC.md`: the agreed plan for the next build (steps 1-9). Map + tickets: GitHub issue #1 on this repo.
- `DECISIONS.md`: everything the user said yes to (rules, question-list behaviour, rent rule). Overrides anything else.
- `FUTURE_FEATURES.md`: what is built and what is planned.
- `README.md`: how to run on Windows. `PHONE_SETUP.md`: the phone copy setup, step by step.

## How it runs (user's PC, Windows)
`C:\ftvenv\Scripts\python.exe run.py` (also `run.py test`, `run.py fix`, `run.py folder "C:\path"`, `cat N`, `show N`,
`add 12.50 Costa`, `spends`, `remove N`). In PowerShell always put `C:\ftvenv\Scripts\python.exe` in front.
Real PDFs live in `...\Financial Tracker Project\statements` (next to the code folder). The database `tracker.db` lives
next to it. **Never commit PDFs or .db files** (.gitignore covers them). The user downloads the repo as a ZIP each time and
extracts it inside `Financial Tracker Project`; they are not a developer: give exact, copy-paste commands.

## Code map (`fintrack/`)
parse.py (PDF -> statements, column x positions from the header row) | checks.py (balance check) | dedupe.py |
cycles.py (payday cycles, wage = VERTU MOTORS PLC >= 500, plus names added with `run.py wage NAME`: wages.py, kv table) | common.py (analyse: Common/Random/One-off, answers, rules) |
questions.py (the confirm-as-you-go list: `common 1 2`, `all`, `later`, `stop`, `fix`) | store.py (SQLite: statements,
payments, items, rules) | paydayrule.py (rent-by-transfer rule) | left.py (pay question) | settings.py (remembered folder).
`run.py` ties it together. Tests in `tests/` (fake data only; `tools/make_fake_*.py` build the fake PDFs).
Run tests: `.venv/bin/pytest -q` (create with `python3 -m venv .venv && .venv/bin/pip install pdfplumber reportlab pytest`).

## How we work (important)
- **The user has ADHD: short replies, plenty of spacing, emojis as signposts, one clear next step.** Tell them the score
  after every build round. Explain plainly; say which file/folder/command.
- **Tests first, then build.** Write failing tests from made-up data, commit, hand the build to a Haiku subagent
  (max 5 rounds, usually passes in 1), then **verify yourself**: run the full suite, check `git status` only touched the
  allowed files, try it on real data. Haiku has (a) claimed things that were not true and (b) added unrequested behaviour
  to satisfy a bad test: read the diff. If a test contradicts the documented rule, fix the test, not the code.
- Real statement layouts differ from fake ones: every real bug so far came from real PDFs (footer text glued on, small
  print read as payments, bank text in names). When the user shows an odd result, reproduce it in the fake PDFs first.
- Credits are limited: do not start loops unasked; nothing should run in the background.
- Push to branch `claude/stoic-archimedes-da95na` AND `main` (the user downloads `main`). Repo: DF-AI-Lab/financial-tracker
  (dash, not underscore; attach it with add_repo). Pull requests only if asked.

## Where we are (1 Oct 2026)
Built and tested (365 tests): reading + balance check, duplicates, cycles, common/random/one-off, database, question list,
pay question, payday transfer (rent) rule, and from `SPEC.md`: **step 1** (same bill: DDs ignore the reference, one-off
"Same bill? y/n" for similar SO/BP references, Enter = no) and **step 2** (categories: guessed from keywords in
`fintrack/categories.py`, `cat 1 Car` in the question list and in `fix`) and **step 3** (yearly bills: `yearly 3`, left out like one-offs, WARNING line 11-13 months after the last payment) and **step 5** (spending by category: `fintrack/bycategory.py`, table after the picture, `run.py cat 2` opens one; "now" = the newest cycle so far) and **step 6** (`fintrack/spare.py`: LAST CYCLE expected vs actual + missing, and the pay question now shows
left over + wage - bills (last month's) - normal = expected spare; replaces format_left) and **step 7** (`fintrack/where.py`: WHERE DID THE X GO? / EXTRA X COME FROM?, reasons add up exactly,
`run.py show 2`; analyse keeps common_txns/random_txns) and **step 8** (`fintrack/typed.py`: `run.py add 12.50 Costa`, `run.py spends`, `run.py remove 1`; left now =
left over + pay (last typed, kv table) - bills - typed; typed spends auto-matched to the statement, unmatched asked) and **step 9** (home page: `web.py` Flask on 127.0.0.1:5000, `start.bat` double-click, `templates/home.html`
(written by hand, not Haiku), data from `fintrack/home.py` home_data; pay box, add/remove spend; one-time
`C:\ftvenv\Scripts\python.exe -m pip install flask`) and **step 4** (six-month picture printed by run.py: `fintrack/picture.py`; analyse gives each common item "last" and "type"). Planning map: GitHub issue #1.
Mock-up of the home page: `prototype/home.html`. **2 Oct: user ran steps 1-4 on all 18 months: works.** Rent 562.50
(rule 570 accepted; fixed: small payday top-ups hid the rent), IVA (BENNETT JONES, finished) marked one-off + cat Debt,
left after typical month 416.71 on 2,677. The user's code folder is still named `...stoic-archimedes...` (it holds main).

## Next
000000. **15 Oct: v3 IS LIVE on https://darrenfawcett2448.pythonanywhere.com (branch v3, v3.5).** PythonAnywhere user
   DarrenFawcett2448 (capitals; WSGI file /var/www/darrenfawcett2448_pythonanywhere_com_wsgi.py imports v3app.make_app
   ("/home/DarrenFawcett2448/wmm-data")), code in ~/whereismymoney (git clone -b v3), venv ~/wmm-venv (Python 3.13),
   data ~/wmm-data (tracker.db uploaded from the PC, v3_settings.json written by tools/pa_setup.py, update=git).
   Sign-in: email code weekly + 6-digit passcode. Gmail SMTP FAILS on PythonAnywhere free (connects, closes at AUTH):
   plan B = code saved in wmm-data/signin_code.txt (Files tab). Later: an HTTPS email API (Brevo/SendGrid) on the
   allow-list. Monthly 'Run until 1 month' reminder in Darren's Google Calendar (1st of the month, 9am).
   The old v2 phone site is replaced; v2 on the PC is the backup. Privacy check passed (1 payment reference only).
   VERSION RULE (Darren, 15 Oct): +0.01 per push: 3.51, 3.52, 3.53... (fintrack/appversion.py). Tell him the number.
   PC TEST COPY (v3.53+): v3.bat = :5001 on v3data, orange TEST COPY bar + "demo.v3.xx"; offers a newer downloaded backup
   as test data; Settings → Update pulls branch v3. LIVE (v3.58+): the real site's Update follows branch `live`
   (v3app.git_update: fetch + checkout -B live origin/live). RULE (Darren, 15 Oct): push to v3 only; move `live` to v3
   (git push origin v3:live) ONLY when Darren says the demo is agreed.
   v3.60: backups also before every statement PDF (keep 5) + Settings → Restore a backup (/backup/restore, saves a
   restore-*.db first, keeps auth_* kv so you stay signed in).
   NEXT (Darren, 15 Oct): FINGERPRINT = passkey (WebAuthn, platform authenticator) instead of typing the 6-digit
   passcode on the phone; passcode stays as fallback; weekly email code unchanged. Needs one pip package on
   PythonAnywhere (e.g. webauthn) - give Darren the exact Bash line. Build on v3, test on the PC copy, then live.
   v3.61 BUILT (15 Oct, 544 tests + Chromium virtual-authenticator check, by me): FINGERPRINT = fintrack/v3/passkey.py
   (py_webauthn; kv auth_passkeys = public keys + counter, auth_pk_challenge = one challenge, 5 min, used once;
   user verification REQUIRED; wrong answers count toward the 5-tries lock, cancelling does not). /passkey/setup
   (Settings → 👆 Fingerprint), /passkey/new/start + /passkey/new, /passkey/start + /passkey/unlock (in auth.PIN_PATHS),
   /passkey/forget. Unlock page asks at once, passcode box below. No webauthn package = fingerprint hidden. PC test now
   opens localhost:5001 (WebAuthn refuses IP addresses). 15 Oct LIVE + WORKING on Darren's phone (webauthn installed on PA, live = v3.61).
   v3.62 BUILT (15 Oct, 558 tests + browser check, by me): Settings → 💡 Ideas & feedback = fintrack/v3/ideas.py +
   templates/ideas.html (kv ideas [{id,text,tag idea|odd|love,at,done}]; /ideas, /ideas/add|done|remove; 📋 Copy all for
   Claude = open notes as text). Restore a backup keeps the ideas notes (like auth_*). PLAN: Darren jots notes, then
   pastes them into a chat to plan v4. 15 Oct: live = v3.62, Darren checked Ideas + fingerprint on the phone: both work.
   v3.55: Settings → Cards open at once (localStorage ft_maxopen, default 2; ft_openorder; opening one more folds the oldest),
   cards slide open/shut; spend/card errors show inside their card (error_at) and fade after 5 s.
00000. **v3 BRANCH (14 Oct night, 497 tests): the whole app as one website, built and click-tested; NOT on main.**
   v3app.py (make_app(data_dir): create_app(cloud=True, phone_http=None) + fintrack/v3/setup), v3.bat = PC test at
   :5001 on a copy of the data in <project>/v3data (v3_settings.json there: email, smtp, update zip|git, branch v3).
   fintrack/v3/: auth.py (email code, 30-day device cookie wmm_device, 5 tries/15 min lock, backup codes, sign out),
   backup.py (daily copy on first request, keep 7, /backup/download), fixitem.py (/fix), billswap.py (new-bill
   question New/Replaces, kv bill_swaps, old payee not counted from the swap's pay cycle, ⋯ Replaces…/Split back
   out). tools/privacy_check.py for move-in. V3_SETUP.md = Darren's steps. Map: GitHub issue 15. Agents built
   auth/backup/fixitem/billswap in worktrees; merged and reviewed. Next: Darren tests on the PC (V3_SETUP Part 1).
0000. **14 Oct v2.21: THE NEW LOOK IS LIVE on the PC main page / (user: 'move all this to live'). /demo redirects to /.
   web.home(demo=True) -> template flag `demo` = new look; CSS in static/look.css (linked by templates/demo_style.html).
   Version shows as 'v2.21' (fintrack/appversion.py, bump every push). Manifest name 'Where's My Money?'.
   The PHONE page (web.phone_page) still has the OLD look: next job = phone (its script uses old ids/markup; test it).**
   v3 PLAN (14 Oct): GitHub wayfinder map 'Map: v3, the whole app on PythonAnywhere' (issue 15, tickets 16-21; type in each
   ticket's first line, labels missing). V3_PLAN.md points at it. Work one ticket per session.
000. **14 Oct: new name idea 'Where's My Money?' (tagline 'Payday to payday'), not applied yet (page still says Wage Tracker).
   New app icon BUILT: the Lens (teal, white magnifier, mint £), `tools/make_icon.py` writes static/icon-*.png + app.ico.
   User wants a cleaner, more professional look next: mock it up first (fewer emojis, one accent colour, more space).**
   14 Oct BUILT (445 tests + browser check): DEMO page http://127.0.0.1:5000/demo = the new look, the normal page / is
   unchanged (user: 'only on the demo'). Same template home.html with demo=True: templates/demo_style.html (teal/mint,
   bills blue, spends gold, Manrope, emojis -> coloured dots via the emo() macro), templates/demo_top.html (spare cash
   as a statement (top: icon + name = a home link to /demo, 'Payday to payday', no dates) Pay / + Left / - Bills / - Spends = Spare, tap Pay or Left to open the same forms, thin 3-colour ring
   bills/spends/spare of pay+left, tiles + Zopa ring: used pink-purple / free lilac, % of limit in the middle). Forms post as before; web.home_url sends you back to /demo when the
   Referer is /demo. Demo header is sticky (icon+name = smooth scroll to top + icon spin, no reload; ⚙ Settings menu right; JS moves the .editbar
   (Update, Move & rename, Put the order back) into it; menu stays open while editing; 'demo.v.X' under it from fintrack/appversion.py VERSION = 2.20 now:
   BUMP IT (2.14, 2.15...) with every push to main and tell the user the number). v2.15: arrow tab on the header line (#quicktab, SVG chevron flipped by CSS on aria-expanded, starts hidden) opens the New payday
   panel (#quick in demo_top: payform with Pay + Left + one long Work it out; JS posts /left first if Left changed;
   the #dropbar is moved into it). Tapping Pay/Left in the statement opens it. v2.17: panel slides (Web Animations, reduced-motion = instant); demo top
   has NO spare-last-month/avg tiles (user: no purpose there; they stay on /); both rings 96px, top-aligned, same card
   padding; Credit card card in Zopa colours (--zused/--zfreetext). v2.18: demo Bills card = templates/demo_bills.html (same tr.bill rows/data/forms
   so the page script works; name split by web 'tagsplit' filter into bold name + 'Household · BP · avg' line; diff as
   a pill; ⋯ menu = Change amount / Put back / Stop or Count it again, all clicking the existing buttons/forms). v2.19: demo Last month's spending = templates/demo_last.html (same
   rows/items/→ Bill; round ⌄ N button opens the shops). v2.20: every other card restyled the same way on the demo (spend + credit
   card rows = tr.drow: name, 'date · category' line, amount, small ×; where/cats/subs/periods by CSS only: thin lines,
   chevrons, diff pills). Normal / page HTML checked byte-for-byte unchanged. Mock-ups: https://claude.ai/artifact/McghmHZfrh5aYrhABkgprC. Next: user adds more mock ideas, then
   swap the demo onto / (and the phone) when they say so.
00. **4 Oct (grill session): step 10 phone copy BUILT (391 tests)** on PythonAnywhere instead of the AWS v3 design (the user
   chose it in the grill and drew the diagram: PC -> JSON/page -> PythonAnywhere <-> phone; phone changes go back to the PC,
   which asks y/n). See SPEC.md step 10 + DECISIONS.md 4 Oct. Code: `cloud/flask_app.py` (the site: page.html,
   changes.json, first key kept, PIN hash, 5 tries = 15 min lock), `fintrack/phone.py` (PC side: connect/pin/upload/
   fetch/apply, key in ~/.financial_tracker_phone_key.txt so test + real DBs share it), `web.phone_page` (home.html with
   phone=True: PC-only cards/script hidden, spends done by a small script + localStorage, Send button), `web.push` after
   every change, `/phone` box on the PC page, run.py asks at start (Enter = all) and pushes at the end, `run.py phone URL`,
   `run.py pin N`. Built by me, not Haiku. Tried in Chromium at phone width against a local copy of the site.
   4 Oct LIVE: https://darrenfawcett2448.pythonanywhere.com (Python 3.13), real data on the phone, phone spend reached
   the PC prompt. Real DB found only after making an (empty) `Financial Tracker Project\statements` folder.
   Known snags: fake PDFs are paid by ACME so `run.py test` gives "No paydays" on the phone (PHONE_SETUP Part 2 is
   misleading: skip to Part 3); `run.py wage NAME test` would save "NAME test". User told to run setup.bat in the new
   folder so shortcuts point at it, and to use the PC home page's "From your phone" box.
   4 Oct ROUND 2 BUILT (404 tests + browser check, Haiku built both parts, I fixed and verified). User's choices (grill):
   the WEBSITE is the main screen (phone and PC); the PC runs hidden (setup.bat -> hidden.vbs/server.bat) and every
   5 min (web.engine_tick thread) does phone changes STRAIGHT AWAY (no y/n; phone.sync_once, kv phone_done stops doing a
   change twice) and moves HSBC '*statement*.pdf' from Downloads into statements (fintrack/downloads.py, kv
   downloads_seen). Phone can change spends, pay (+clear), left, this-cycle bills, answer sort/quick questions (change
   types in phone.apply_changes; site accepts them, cloud/flask_app.py MUST BE RE-PASTED on PythonAnywhere). Phone page:
   ⏳ Syncing N / ✅ Up to date / 📴 Offline, changes sent at once (localStorage queue), reloads when /stamp changes,
   tables become cards under 640px (CSS media query, [data-card] tables, data-label from headers). Email fetch ON HOLD
   (user asks HSBC for the PDF; check if HSBC can email it). Browser check script: see git log of this round.
   4 Oct evening: phone page acts instantly (removed spends vanish, numbers follow), every device applies ALL waiting
   changes (applyPending: pay/left/bills/cleared spends), cards = 3 equal columns. User ran setup.bat: hidden start
   WORKS on Windows (127.0.0.1:5000 with no window). User very happy. Next: wait for oddities from real use.
   OPEN (user, 4 Oct): ZOPA CREDIT CARDS (DD, saved 'common' by the user, cat Debt) is NOT in the Bills list. Real DB:
   paid once only, 14 Sep 2026 (100.00), inside the cycle still running, so pay_block/analysis (complete cycles only)
   skips it. auto_bills needs 2+ months, so it was asked. Agreed direction: a bill saved as common with a payment in
   the current cycle shows straight away (last = this cycle's amount). Write the failing test first (fake data).
   DECIDED (user, 4 Oct, see DECISIONS.md 'new and stopped bills'): every DD/SO straight into Bills even if paid once
   (marked 🆕 new until paid in 2 cycles); not paid in the last finished cycle = stopped and NOT counted (plus a tap
   'Stopped' button); card payments stay questions. BUILT 4 Oct (414 tests): questions.auto_bills (any DD/SO),
   spare.pay_block (new/stopped flags, bills paid only in the running cycle, spare.common_key = analyse's key: saved
   label or payee name, NOT the DD|..| item key), billchange get/set_stopped (kv stopped_bills: {key: ISO date} or
   "no" = Undo beats the auto stop), POST /stopped, phone change {type bill, key, stopped}, Stop / Undo button per
   bill. Real DB copy: Zopa Credit Cards shows (100, NEW). Haiku built it; I rewrote pay_block (it had re-keyed bills).
   Always-subscriptions (user, 4 Oct): fintrack/subs.py ALWAYS list (Claude/ANTHROPIC, ChatGPT/OPENAI, Google Play,
   Audible), card payments matched on description + detail (overseas payments: shop name is in detail), no regularity
   checks, refunds and cash never count. Add more names to ALWAYS. Real DB: all 4 show (ChatGPT stopped, last Jun 2026).
   5 Oct BUILT (421 tests + browser check): fold any card (▾ on the h2, localStorage ft_folded, per device); Last month's
   spending: Bills row stays bundled, each category opens (▸ N) to its payees of 4.00+ last cycle (pay_block spending
   row "items") with → Bill; Subscriptions → Bill (subs "keys"/"bill"; stays in Subscriptions too). → Bill = the
   existing sort save {kind bill} (PC: /sort/save; phone: 'sort' change, no site re-paste). Haiku built it; I fixed the
   phone CSS that hid opened items and the fold button style.
   5 Oct BUILT (431 tests + browser check): 💳 Credit card (Zopa, limit 500): `fintrack/creditcard.py` (kv credit_card,
   typed by hand: Add = spend, Paid off = negative; used = sum, free = limit - used; not part of spare cash), card 'card'
   in CARDS, POST /card/add|remove|limit, phone change {type card, action add/remove/limit} (cloud/flask_app.py
   accepts 'card': RE-PASTE on PythonAnywhere). Top row: pay box spans 2 rows, 4 half-height tiles (spare last month,
   avg, Zopa used, Zopa free: plain numbers).
   5 Oct grill + BUILT (441 tests + browser check, by me): payments clear the OLDEST lines first (creditcard.allocate:
   owed / part "£X left" / paid = crossed out, no Remove); Used box INSIDE the card adds a "Correction" line (set_used,
   POST /card/balance, phone action balance; minus = like a payment, plus = like an item); only the 5 newest crossed
   lines + 5 used-up payments kept, the rest folded into "carry"; the Zopa DD in statements is NOT a payment (bank is a
   month behind). Phone follows PC layout/names: web.push_soon (2 s, once) after /layout, /name, /layout/reset, /bill,
   /left, /ask, /sort/save, /upload. Folding stays per device. See DECISIONS.md 5 Oct.
0. 3 Oct: user changed jobs (from Apr 2026); cycles were stuck at 31 Mar. Added `run.py wage NAME` (fintrack/wages.py).
   Same day: `run.py early` / `early N` (fintrack/early.py): rent sent the day before payday counts in the next cycle
   (moved payments are re-dated to the payday in load_moved; kv key moved_early).
   Then SPARE CASH = pay - bills only (no left over, no 'spend like usual'): see DECISIONS.md 3 Oct.
   Home page top = countdown (spare - typed spends); tiles = spare last month + 6-month avg (fintrack/sparehist.py). Also added setup.bat (shortcuts + start with Windows). v2 ideas from today are in FUTURE_FEATURES.md.
1. All 9 SPEC steps built (3 Oct). Home page tried on real data: liked it. Then added: bills first in "Last month's
   spending", and a 6 months / 12 months / year-so-far totals table (`fintrack/periods.py`, per-payment rule).
   Haiku warning (3 Oct): it hard-coded "3-mth avg", reverted the template it was told not to touch, and skipped a
   payment by a hard-coded name to match a wrong test sum. Read every diff; write small modules yourself. (3 Oct: step 7 checked on real data, adds up: 7.34 = IVA 279 paid - food shopping 240 less ...) (3 Oct: steps 5-6 checked on real data; last cycle missing only 7.34,
expected spare 292.74 on 2,677) (tests first, Haiku builds, verify yourself, tell the user the score). Terminal first.
2. 3 Oct small fixes DONE: pay block redone to the user's layout (bills avg/last -> SPARE CASH = No. 1 -> last month's
   non-bill spending by category -> left if usual; `spare.pay_block`), subscription spotter (`fintrack/subs.py`), a typed
   sentence at the rent question is not saved as a label. User skipped: show guessed categories in `fix`, "finished" kind.
   Still open: where.py bill note says "last month" even when the usual is the average.
   3 Oct BUILT (329 tests): Bills card under 'Add a spend'; every avg/last table = avg | Last month | Diff (green minus);
   unpaid bills show the average with * + footnote; tap a bill's Last month amount to change it for THIS cycle only
   (`fintrack/billchange.py`, kv 'bill_changes' with the cycle start, POST /bill, also used by run.py); subscriptions =
   one table: Monthly price | Last 12 months | This year ('Paid so far' dropped). 6/12 months table untouched.
   3 Oct BUILT (333 tests): bill boxes update spare cash/Diff/Total live as you type (page script, quiet POST /bill
   with X-Requested-With: fetch -> 204), several at once, x puts back. 'Left from last month' box under the pay box
   (POST /left, x removes; billchange.get_left, kv 'left_over_typed' with the cycle start): spare = pay + left - bills,
   hero line 'Pay + left - bills', terminal '+ Left from last month'.
   3 Oct BUILT (337 tests): '✏️ Move & rename' button on the home page: drag cards and rows (Bills, Last month's
   spending, Spending by category, Subscriptions) by the handle, click a name to rename it (empty = normal name),
   '↺ Put the order back'. Kept for good (`fintrack/layout.py`, kv 'layout'; POST /layout, /name, /layout/reset);
   page only. Cards are rendered in the saved order (Jinja set-blocks in home.html). Bill changes still reset at payday.
   Also: click a handle to pick a card/row, then arrow up/down moves it (drag did not auto-scroll for the user);
   dragging near the window edge now scrolls too.
   AGREED PLAN 3 Oct (v2, build in this order, one at a time, user says go):
   (1) BUILT 3 Oct (340 tests): `fintrack/update.py` (stdlib only; skips statements/, *.db, PDFs, .env; never
       deletes; version.txt), POST /update, start.bat restarts web.py on exit code 3, update.bat = python -m fintrack.update.
       Was: '🔄 Update' button on the home page + update.bat backup: fetch main.zip from GitHub, replace the code
       folder, keep statements + tracker.db. (3) BUILT 3 Oct (342 tests): DD/SO paid in 2+ months = bill automatically
       (questions.auto_bills, run before the question list), paid once = asked. (2) BUILT 3 Oct (345 tests): a new pay (different from the saved one) with typed spends
       asks 'New pay. Clear your typed spends?' on the page (confirm, clear=1 to POST /pay) and in run.py (y/n).
       (6a+6b) BUILT 3 Oct (353 tests): drop PDFs anywhere on the home page (or click the bar): `fintrack/inbox.py`
       (read from a temp copy; only new statements are kept in the statements folder), POST /upload; new items sorted on
       the page (`fintrack/sortpage.py`: buttons Bill/Random/One-off/Yearly, category, name; Copy for AI / Paste answers
       -> POST /sort/parse, POST /sort/save). The page starts with an empty database. 6c BUILT 3 Oct (359 tests): same bill /
       rent / typed-spend questions on the page ('❓ quick questions' card, `fintrack/pagequestions.py`, POST /ask; same rules
       and saved answers as run.py; kept typed spends in kv 'kept_spends'). run.py is now only needed for the extras.
       Was: (6+5) Drop a PDF on the home page: it is read in and the questions show on the page: a simple form
       (Bill / One-off / Yearly / Random + category per item) AND 'Copy for AI' / 'Paste answers'. Replaces the
       keyword question list. (4) BUILT 3 Oct (363 tests): new job spotted by itself (`fintrack/newjob.py`: no known wage for
       35+ days and another payer 500+ in 2+ months since -> '💼 Is X your new job?' in the quick questions; yes = add_payer,
       no = kv 'not_wage'). ALL of the 3 Oct v2 plan is built. See FUTURE_FEATURES.md.
   3 Oct late (365 tests): silent start: hidden.vbs runs server.bat (FT_QUIET, no window, no browser, restarts on
   exit 3) from the Startup shortcut; setup.bat remakes shortcuts (desktop = hidden.vbs open, icon static/app.ico);
   stop.bat kills web.py; /manifest.json + static/icon-*.png so Chrome/Edge can install it as an app. start.bat
   unchanged on purpose (never rewrite a running .bat). Windows scripts NOT tried on Windows yet: ask the user.
   END OF 3 Oct: user is testing v2 on real data (told to back up tracker.db first). NEXT SESSION: fix anything odd
   they report; then v3 = phone version on AWS:
   AGREED design in FUTURE_FEATURES.md 'v3 AGREED DESIGN (4 Oct)'. The user is drawing an architecture diagram
   first: check it against that section before building. 4 Oct: user had not run setup.bat yet (silent start untested).
3. After each step the user runs it on their 18 months and reports anything odd; add a test for every real oddity.
4. Ideas after that: FUTURE_FEATURES.md (email fetch, other banks...).
