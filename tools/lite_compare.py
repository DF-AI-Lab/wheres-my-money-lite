"""Lite vs live v3.62: do the same things on both pages, screenshot at phone width, compare pixel by pixel.

    python tools/lite_compare.py LIVE_CODE_DIR OUT_DIR [scenario ...]

LIVE_CODE_DIR = a read-only copy of DF-AI-Lab/financial-tracker branch `live` (never changed).
The live copy runs on the fake test statements (ACME pays 2500, today = 25 Oct 2024) with Costa 12.50, Tesco 34.20 and
a 45.00 Amazon card line typed in: the Lite fake data must start the same. Lite is docs/ served as static files and
opened with ?today=2024-10-25. Each scenario starts both from fresh, does the same clicks/typing, reloads, and
compares. The '· Lite' tagline and the version text are blanked on both before comparing (the only allowed changes).
Writes OUT_DIR/<scenario>-live.png, -lite.png, -side.png and prints OK / DIFF per scenario. Exit 1 on any DIFF.
Needs: flask pdfplumber reportlab webauthn playwright pillow. Fake data only.
"""
import json
import shutil
import socket
import subprocess
import sys
import time
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs"
LIVE_PORT, LITE_PORT = 5011, 8099
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
TODAY = "2024-10-25"


# Each step: ("form", form_selector, {field_name: value}, button_selector or None, dialog "accept"/"dismiss"/None)
#            ("fill", selector, value)  types into a box (shown or hidden) and fires input/change
#            ("wait", ms)
# No Stop scenario: on live, Stop depends on statement payment dates (Lite's Stop rules = issue #2).
SCENARIOS = {
    "start": [],
    "add_spends": [("form", 'form[action="/add"]', {"amount": "9.99", "name": "Greggs"}, None, None),
                   ("form", 'form[action="/add"]', {"amount": "20", "name": "Shell fuel"}, None, None)],
    "remove_spend": [("form", 'form[action="/remove"]:has(input[value="1"])', {}, None, None)],
    "bill_change": [("fill", 'input.billbox[aria-label="New amount for Rent"]', "600"), ("wait", 1500)],
    "card": [("form", 'form[action="/card/add"]', {"amount": "40", "name": "Shell"}, None, None),
             ("form", 'form[action="/card/limit"]', {"amount": "600"}, None, None),
             ("form", "#ccbalform", {"amount": "100"}, None, None)],
    "card_paid": [("form", 'form[action="/card/add"]', {"amount": "30"}, 'button[name="paid"]', None)],
    "pay_keep": [("form", "#payform", {"pay": "2600"}, None, "dismiss")],
    "pay_clear": [("form", "#payform", {"pay": "2600"}, None, "accept")],
    "left": [("fill", "#qleft", "150"), ("form", "#payform", {}, None, "dismiss")],
}


def _wait_port(port, secs=90):
    end = time.time() + secs
    while time.time() < end:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.3)
    raise RuntimeError(f"nothing on port {port}")


def serve_live(live, work):
    """Child mode: build the fake live data and serve it (cookies written to work/cookies.json)."""
    sys.path.insert(0, str(live))
    import run, v3app                                         # noqa: E401
    from fintrack.v3 import auth
    acme = "ACME MOTORS PLC"
    if work.exists():
        shutil.rmtree(work)
    inbox = work / "statements"
    inbox.mkdir(parents=True)
    for n in ("statement_2024_08.pdf", "statement_2024_09.pdf", "statement_2024_10.pdf"):
        shutil.copy(live / "tests/data" / n, inbox / n)
    run.main(in_dir=inbox, out_dir=work / "output", ask=lambda p: "2500", wage_payer=acme, ask_items=lambda p: "")
    d = work / "v3data"
    d.mkdir()
    shutil.copy(work / "tracker.db", d / "tracker.db")
    app = v3app.make_app(d, wage_payer=acme, today=date.fromisoformat(TODAY),
                         updater=lambda: {"changed": [], "version": "t"}, restart=lambda: None)
    c = app.test_client()
    auth.sign_in_for_tests(app, c)
    c.post("/add", data={"amount": "12.50", "name": "Costa"})
    c.post("/add", data={"amount": "34.20", "name": "Tesco"})
    c.post("/card/limit", data={"limit": "500"})
    c.post("/card/add", data={"amount": "45.00", "name": "Amazon"})
    (work / "live_home.html").write_text(c.get("/").get_data(as_text=True))
    json.dump({k.key: k.value for k in c._cookies.values()}, open(work / "cookies.json", "w"))
    app.run(port=LIVE_PORT)


def do_steps(page, steps):
    for st in steps:
        if st[0] == "wait":
            page.wait_for_timeout(st[1])
        elif st[0] == "fill":
            page.evaluate("""([sel, v]) => { const e = document.querySelector(sel); e.hidden = false;
                e.value = v; e.dispatchEvent(new Event('input', {bubbles: true}));
                e.dispatchEvent(new Event('change', {bubbles: true})); }""", [st[1], st[2]])
        else:
            _, sel, fields, button, dialog = st
            if dialog:
                page.once("dialog", lambda d, how=dialog: d.accept() if how == "accept" else d.dismiss())
            page.evaluate("""([sel, f]) => { const form = document.querySelector(sel);
                for (const [k, v] of Object.entries(f)) form.querySelector(`[name="${k}"]`).value = v; }""", [sel, fields])
            btn = page.locator(f"{sel} {button or '[type=submit]'}").first
            if btn.is_visible():
                btn.click()                                        # like a person: the page's own handlers run
            else:
                btn.evaluate("b => b.form.submit()")               # hidden forms: the ⋯ menu sends them this way
            page.wait_for_timeout(1200)
            page.wait_for_load_state("networkidle")


def shoot(page, out):
    page.reload(wait_until="networkidle")
    page.wait_for_timeout(800)
    boxes = page.evaluate("""() => ['.tagline', '.appver'].map(s => document.querySelector(s))
        .filter(e => e).map(e => { const r = e.getBoundingClientRect();
        return [r.left, r.top + scrollY, r.right, r.bottom + scrollY]; })""")
    page.screenshot(path=str(out), full_page=True)
    return boxes


def compare(a_path, b_path, boxes, side_path):
    from PIL import Image, ImageChops, ImageDraw
    a, b = Image.open(a_path).convert("RGB"), Image.open(b_path).convert("RGB")
    if a.size != b.size:
        result = f"size {a.size} vs {b.size}"
    else:
        ma, mb = a.copy(), b.copy()
        for img in (ma, mb):
            dr = ImageDraw.Draw(img)
            for x0, y0, x1, y1 in boxes:
                dr.rectangle([x0 * 2 - 2, y0 * 2 - 2, x1 * 2 + 2, y1 * 2 + 2], fill="black")
        box = ImageChops.difference(ma, mb).getbbox()
        result = "OK" if box is None else f"differs in box {box} (2x pixels)"
    h = max(a.height, b.height)
    side = Image.new("RGB", (a.width + b.width + 20, h), "white")
    side.paste(a, (0, 0))
    side.paste(b, (a.width + 20, 0))
    side.save(side_path)
    return result


def main(live, out, names):
    from playwright.sync_api import sync_playwright
    out.mkdir(parents=True, exist_ok=True)
    lite_srv = subprocess.Popen([sys.executable, "-m", "http.server", str(LITE_PORT)], cwd=DOCS,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    bad = 0
    try:
        _wait_port(LITE_PORT)
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=CHROME)
            for name in names:
                work = out / "live-work"
                srv = subprocess.Popen([sys.executable, "-I", __file__, "--serve", str(live), str(work)],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try:
                    _wait_port(LIVE_PORT)
                    shots = {}
                    for side in ("live", "lite"):
                        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2,
                                                  is_mobile=True, has_touch=True)
                        if side == "live":
                            ck = json.load(open(work / "cookies.json"))
                            ctx.add_cookies([{"name": k, "value": v, "url": f"http://localhost:{LIVE_PORT}/"}
                                             for k, v in ck.items()])
                            url = f"http://localhost:{LIVE_PORT}/"
                        else:
                            url = f"http://localhost:{LITE_PORT}/?today={TODAY}"
                        page = ctx.new_page()
                        errors = []
                        page.on("pageerror", lambda e: errors.append(str(e)))
                        page.goto(url, wait_until="networkidle")
                        do_steps(page, SCENARIOS[name])
                        shots[side] = shoot(page, out / f"{name}-{side}.png")
                        if errors:
                            print(f"  {side} JS errors: {errors}")
                        ctx.close()
                    res = compare(out / f"{name}-live.png", out / f"{name}-lite.png",
                                  shots["live"] + shots["lite"], out / f"{name}-side.png")
                    print(f"{name}: {res}")
                    bad += res != "OK"
                finally:
                    srv.terminate()
                    srv.wait()
            browser.close()
    finally:
        lite_srv.terminate()
    return 1 if bad else 0


if __name__ == "__main__":
    if sys.argv[1] == "--serve":
        serve_live(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3:] or list(SCENARIOS)))
