# How to work with me (Darren)

These rules come from DF-AI-Lab/project-starter. Keep this section the same in every project. Put anything specific to this project under "This project" at the bottom.

## Talking to me
* Plain English. Short messages, well spaced. One question at a time.
* I'm learning: explain the simple idea first, then the detail. Let me try things myself when it helps.
* Correct me when I'm wrong. Don't agree just to be agreeable.
* No raw logs, jargon or progress updates unless I ask.
* When something goes wrong: what happened, why, what you'll do, and whether you need me.
* Stop and ask before anything that deletes data, installs things or can't easily be undone.

When you finish a build or a big task, report under these six headings, a short line or two each:
1. **Done:** what's done
2. **Works?** tests, checked on phone or not
3. **Live?** saved and live, or does something still need merging
4. **Choices I made:** any decisions you made for me
5. **Not done yet:** anything missing or left out
6. **Your turn:** what I need to do next

No file names, branch names or code terms unless I ask. Put the detail in the project file, not the chat.

## The project file
* Each project has one master project file named after the project, e.g. `food-tracker.md`. It holds the current truth, not a history. If there isn't one, create it from `project-template.md`.
* Its **"Where we are"** section is the handoff between chats: current step, next action, things to avoid.
* Never put status or "pick up from here" notes in CLAUDE.md.

## Start of a chat ("carry on")
* Read "Where we are" (other sections only when needed). Tell me in 2–3 lines where we are and what's next, then wait for my go-ahead.
* If another chat looks like it's working on this project (recent notes or unmerged branches), warn me first. One chat per project at a time.

## "wrap up"
* Update "Where we are" (replace the old status, don't add to it) and add a change-log line.
* Run tests only if code changed in this chat.
* Save everything to GitHub with a short plain-English note. This is a cloud chat: anything not pushed is lost.
* Don't delete old branches or ask me about them. Only mention a branch if it has work that isn't merged.
* **"merge it"** means merge into main, which makes it live.

## GitHub
* Account: **DF-AI-Lab**. Repos are private unless I ask.
* Never upload secrets or personal files (receipts, IDs, keys, `.env`, big build folders). Use `.gitignore`.

## Saving tokens
* If I send an image, write the important details into the project file as text so we don't need the image again.
* PDFs: read only the pages needed. If a PDF will be reused, save a .txt copy once.
* Don't re-read files already read in this chat unless they've changed.
* Only use agents for bulky jobs that return a short answer.
* Tell me when a chat is getting long and suggest "wrap up" + a new chat.

## Who does what
* Planning, grilling and the list of tests: Opus. Save the plan to the project file.
* Big build: Sonnet builds from the project file, in a new chat, or as a Sonnet agent if you're Opus (then Opus checks the work). Unless I want to write the code myself to learn.
* Small add-on: whatever model is running just does it, no agent.
* Review: Opus. Haiku only for tiny jobs (summarising, renaming, tidying).
* You can't switch models yourself, so tell me which model to switch to at each stage.

## This project
**Where's My Money? Lite.** Made 21 Oct 2026 as a full copy of the financial-tracker v3 app (v3.62), to grow the Lite app in.
Current status and history: `wheres-my-money-lite.md` (read "Where we are" first).

* The main app lives in DF-AI-Lab/financial-tracker: **never change that repo from here.**
* `/` = templates/ + static/ (the v3 page + a 'Lite' badge). `/demo` = demo/templates + demo/static (a copy to try changes on first; `web.home(folder=...)`). Changes made on /demo go back to /demo.
* Version: `fintrack/appversion.py`, starts at 0.01, +0.01 per push. Tell me the number.
* Plan: map = financial-tracker issue #22.

### What the app is
A personal tool (me only) for one HSBC current account. Statement PDFs in, bills / payday-to-payday cycles / Common-Random-One-off / "what's left" out. Python 3 + pdfplumber + SQLite + Flask. Older project (do not build on it): `python-finance-tracker`.
Docs: `SPEC.md`, `DECISIONS.md` (everything I said yes to; overrides anything else), `FUTURE_FEATURES.md`, `README.md`, `V3_SETUP.md`.
Real PDFs and `tracker.db` live outside the repo. **Never commit PDFs or .db files.**

### How it runs (my PC, Windows)
`C:\ftvenv\Scripts\python.exe run.py` (also `test`, `fix`, `folder "C:\path"`, `cat N`, `show N`, `add 12.50 Costa`, `spends`, `remove N`). In PowerShell always put `C:\ftvenv\Scripts\python.exe` in front. Give me exact copy-paste commands. Tests: `.venv/bin/pytest -q` (create with `python3 -m venv .venv && .venv/bin/pip install pdfplumber reportlab pytest`).

### Code map (`fintrack/`)
parse.py (PDF -> statements, column x positions from the header row) | checks.py (balance check) | dedupe.py |
cycles.py (payday cycles, wage = VERTU MOTORS PLC >= 500, plus names added with `run.py wage NAME`: wages.py, kv table) | common.py (analyse: Common/Random/One-off, answers, rules) |
questions.py (the confirm-as-you-go list: `common 1 2`, `all`, `later`, `stop`, `fix`) | store.py (SQLite: statements,
payments, items, rules) | paydayrule.py (rent-by-transfer rule) | left.py (pay question) | settings.py (remembered folder).
`run.py` ties it together. Tests in `tests/` (fake data only; `tools/make_fake_*.py` build the fake PDFs).

### How we build
- **Tests first, then build.** Write failing tests from made-up data, commit, hand the build to a Haiku subagent (max 5 rounds), then **verify yourself**: run the full suite, check `git status` only touched the allowed files, try it on real data. Haiku has claimed untrue things and added unrequested behaviour to satisfy a bad test: read the diff. If a test contradicts the documented rule, fix the test, not the code.
- Real statement layouts differ from fake ones: every real bug came from real PDFs. When I show an odd result, reproduce it in the fake PDFs first.
- Credits are limited: no loops unasked; nothing in the background.
- Push to the session branch. Pull requests only if asked.
