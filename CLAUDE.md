# Where's My Money? Lite

**THIS REPO = LITE (made 21 Oct 2026, v0.01).** A copy of the financial-tracker v3 app (v3.62) to grow the Lite
app in. The main app lives in DF-AI-Lab/financial-tracker: never change that repo from here.

## ⛔ No Python on a PC
Darren does NOT run Python, .bat files or any command on a PC. Never ask him about Python, venvs, pip,
`run.py`, `C:\...` paths or Windows. Old PC code is still in the repo only because the site uses it; ignore it.

## What's here
- `/` = templates/ + static/ (the v3 page + a 'Lite' badge). `/demo` = demo/templates + demo/static (a copy to try
  changes on first; web.home(folder=...)). Changes made on /demo go back to /demo.
- Version: fintrack/appversion.py, starts at 0.01, +0.01 per push.
- Plan: map = financial-tracker issue #22. Next: trim what Lite doesn't need (.bat files DONE v0.02; still: v2 phone parts,
  prototypes), then ticket #25 Bill details. Not online yet (later: same PythonAnywhere site at /lite).
- Tests (for Claude only): `.venv/bin/pytest -q`.

## How we work
- Darren has ADHD: short replies, plenty of spacing, one clear next step.
- Old main-app history and docs are in `archive/` (history only: do not follow its PC steps).
