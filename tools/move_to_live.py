"""Move the demo to live (ONLY when Darren says "move to live"): copy every file of docs/demo/ to docs/ (live).
Live = Darren's real money at the site's root; the demo = docs/demo/, always fake data. Run: python3 tools/move_to_live.py"""
import shutil
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"
DEMO = DOCS / "demo"

for old in DOCS.iterdir():                        # live files the demo no longer has
    if old.is_file() and not old.name.startswith(".") and not (DEMO / old.name).exists():   # keep .nojekyll
        old.unlink()
for f in DEMO.iterdir():
    if f.is_file():
        shutil.copy2(f, DOCS / f.name)
# live keeps its own install id (v0.35): the demo's id would make the phone see live as the demo app
m = DOCS / "manifest.json"
m.write_text(m.read_text().replace('"id": "/wheres-my-money-lite/demo/"', '"id": "/wheres-my-money-lite/"'))
print("live is now v" + (DOCS / "version.json").read_text().split('"')[3])
