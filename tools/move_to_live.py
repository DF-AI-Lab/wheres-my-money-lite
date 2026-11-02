"""Move the demo to live (ONLY when Darren says "move to live"): copy every file of docs/demo/ to docs/ (live).
Live = Darren's real money at the site's root; the demo = docs/demo/, always fake data. Run: python3 tools/move_to_live.py
v0.61: sub-folders too (docs/demo/passport/ = Passport ID)."""
import shutil
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"


def move(docs=DOCS):
    demo = docs / "demo"
    for old in docs.iterdir():                    # live files the demo no longer has
        if old.is_file() and not old.name.startswith(".") and not (demo / old.name).exists():   # keep .nojekyll
            old.unlink()
    for f in demo.iterdir():
        if f.is_file():
            shutil.copy2(f, docs / f.name)
        elif f.is_dir():                          # v0.61: passport/ (a fresh copy, so nothing old is left in it)
            if (docs / f.name).exists():
                shutil.rmtree(docs / f.name)
            shutil.copytree(f, docs / f.name)
    # live keeps its own install id (v0.35): the demo's id would make the phone see live as the demo app
    m = docs / "manifest.json"
    m.write_text(m.read_text().replace('"id": "/wheres-my-money-lite/demo/"', '"id": "/wheres-my-money-lite/"'))
    return (docs / "version.json").read_text().split('"')[3]


if __name__ == "__main__":
    print("live is now v" + move())
