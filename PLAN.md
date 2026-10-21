# Lite plan (agreed with Darren before building)

## What Lite is
- HTML + CSS + JavaScript only. Hosted on GitHub Pages.
- Each person's data saves in **their own browser** (localStorage). Darren never sees anyone's data.
- No Python server, no PythonAnywhere. The Python code stays in the repo **as a guide only**.

## Tickets
In this repo: map = issue #1, Bill details = issue #2. (financial-tracker #22/#25 = old, read only.)

## Rules
1. **The look = 100% the LIVE site, v3.62** (branch `live` of DF-AI-Lab/financial-tracker).
   Not the Lite /demo. The ONLY change is the word "Lite".
2. **Copy the CSS unchanged** (look.css + the page's own styles, byte for byte).
3. **Never change** DF-AI-Lab/financial-tracker or the live site. Read only.
4. **Done = side-by-side screenshots at phone width**, live v3.62 vs Lite, same fake data.
   Any difference = not done. Darren's phone screenshots are the target.
5. **Sonnet builds, Claude (Opus) checks**: reads every diff, takes the screenshots, says done.
6. Fake data only in the repo. Never real statements or numbers.
7. Version: `fintrack/appversion.py`, +0.01 per push.

## How we get it identical
- Run a local copy of live v3.62 with a fake database, save the page it makes.
- That saved page + the same CSS = the Lite page. Swap in "Lite", nothing else.
- Screenshot both at 390 px wide (phone) and compare pixel by pixel.

## Steps done
1. **Look** ✅ 21 Oct: LOOK LOCKED (Darren agreed). docs/look.css never changes.
2. **Maths** ✅ 21 Oct (v0.04): spare cash, spends, credit card, bills in JS. Saved for the tab only.
3. **Go A = build steps 1-4** ✅ 21 Oct (v0.08): saving (localStorage) + backup file, bills (add/name/due/Paid/Stop/delete/template), payday + history cards, pots. ?demo=1 = fake data for the tab only.

## Agreed design (grill, 21 Oct, Darren said "agreed")
**Basics**
- Everything typed in by hand. **No statements, no PDFs** (old step 4 is gone).
- Android only for now, installed from the web (PWA), works offline.
- Same look as live. New parts reuse live's styles. One new colour: **pots = orange**. Mock-ups were shown first (mockups/, fake data; agreed changes: pots orange, "Paid ⓘ ☐" green word, payday panel hidden under the tab).

**Bills**
- ⋯ menu: Change amount, Change name, 📅 Due day, ⏸ Stop counting, 🗑 Delete (no Replaces…). Add a bill box.
- Grey line: "avg £X · due 1st". After the due day: **Paid ⓘ ☐** (green word, tap ⓘ = short help, user ticks; never
  ticked by itself). Stopped = greyed, not counted every month until Count it again, with a short **Stopped ⓘ**.
- Avg / Last month / Diff come from the months saved at payday. Amounts carry over to next month.
- Template for new people: Rent / Mortgage, Council tax, Gas & electric, Water, Phone, Broadband, TV licence,
  Car insurance (amounts blank, add/delete any). No food.
- A credit card payment is a bill (e.g. Zopa £100). Tick Paid → the card asks "Take £100 off the card?"
  Yes £100 / Other amount / No (Yes = a Paid off line).

**Payday**
- Typing the new pay = the reset: the month is saved (bills + spends), a new month starts.
- New payday panel stays hidden under the arrow tab (like live). **Left from last month** is filled in with last
  month's spare, can be changed, ⓘ "please check this each month". The PDF drop box goes; **Save a backup?** there.

**Pots**
- A pot = a category + a monthly amount (e.g. Shopping £400). Spends with that category go in by themselves.
- The pot amount comes off spare like a bill; going over comes off spare too; underspent goes back to spare.
- Shown in the top card (ring slice + key line + "− Pots" line) and a **Monthly pots** card with bars.
- Template pots: Shopping, Fuel, Going out (blank amounts).

**Cards**
- Credit cards: add / remove any number (one example card to start). One top tile per card.
- Keep: Last month's spending (from the saved month), Spending by category (Subscriptions = just a category),
  6 / 12 months / year so far (from saved months).
- Drop: Subscriptions card, PDF drop.

**Safety + saving**
- Data in the phone's browser (localStorage) + a **backup file** (one tap → Downloads; Load backup).
- Lock like live: fingerprint (passkey) + passcode, asks on open / after 5 min. Plain screen lock (no scrambling of
  the live data).
- **10 backup codes** at setup. The backup file is scrambled; it opens with the passcode OR any backup code
  (forgot passcode = a code + load backup + new passcode). The app's code is public, so no secret key in the app.
- Optional ☁️ Google Drive copy in the user's own Drive (Darren sets up the Google side once; test after).

**Settings:** Save / Load backup, Google Drive, Move & rename (like live), 🔄 Update, 💡 Ideas & feedback, Cards open,
📱 **Invite** (a QR code + Share button for the Lite link, so a friend can scan it and install their own copy; it
holds the link only, never any data. Added by Darren 21 Oct).

## Build order (one step at a time, Darren says go)
1. 💾 Saving on the phone + backup file ✅
2. 🧾 Bills (add, name, due day, Paid ⓘ, Stop ⓘ, delete, template) ✅
3. 📅 Payday + history (save the month, Left filled in, last month, categories, 6/12 months) ✅
4. 🟠 Pots ✅
5. 💳 Several credit cards + the Zopa question ✅ (v0.10)
6. 🔒 Fingerprint + passcode + 10 codes + scrambled backup ✅ (v0.11)
7. ✏️ Move & rename + Update + Ideas + 📱 Invite QR code ✅ (v0.12)
8. 📲 Install + works offline ✅ (v0.13)
9. ☁️ Google Drive (optional) ✅ (v0.14; Darren does DRIVE_SETUP.md once, then it is switched on)
10. Darren's 21 Oct feedback round (back button, pots in Bills, start vs actual spare, payday date, 🔔 reminders, tap card tops, category pick list, backup box, ⓘ bubbles) ⬅️ NEXT
Then the rest of the map (Lite issue #1); Bill details (#2) is mostly covered by step 2.

## GitHub Pages (Darren does once)
Repo must be public. Settings → Pages → Branch = the branch Claude names, folder `/docs` → Save.
DONE 21 Oct: https://df-ai-lab.github.io/wheres-my-money-lite/ (branch claude/jolly-bardeen-j3jk6i, /docs).
