# Lite plan (agreed with Darren before building)

## What Lite is
- HTML + CSS + JavaScript only. Hosted on GitHub Pages.
- Each person's data saves in **their own browser** (localStorage). Darren never sees anyone's data.
- No Python server, no PythonAnywhere. The Python code stays in the repo **as a guide only**.

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

## Steps
1. **Look** - one static page (`docs/index.html`) with fake data, live on GitHub Pages.
   No maths, no saving. ⬅️ NOW
2. **Maths** - turn the Python rules (cycles, bills, spare cash) into JavaScript.
3. **Saving** - your data in localStorage (+ download / load a backup file).
4. **Statements** - read the bank PDF in the browser (no upload anywhere).
5. Then: ticket #25 Bill details and the rest of the map (financial-tracker issue #22).

## GitHub Pages (Darren does once)
Repo must be public. Settings → Pages → Branch = the branch Claude names, folder `/docs` → Save.
