"""v0.28 (Darren, 22 Oct): LIVE = docs/ (his real money, moves only when he says "move to live"),
DEMO = docs/demo/ (where new work lands; ALWAYS fake data, never the real data, no lock). Fake data only."""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

from conftest import _context, _page

SITE = Path(__file__).resolve().parent.parent / "docs"
TODAY = "?today=2024-11-08"
REAL = {"marker": "Darren's real data - must never change"}


@pytest.fixture(scope="module")
def site():
    """The whole Pages site: live at /, demo at /demo/ (same origin, like df-ai-lab.github.io)."""
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=SITE,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                break
        time.sleep(0.1)
    yield f"http://127.0.0.1:{port}/"
    p.terminate()


@pytest.fixture
def phone(browser):
    ctx = _context(browser)
    ctx.add_init_script("try { localStorage.setItem('lite_state_v1', %s); } catch (e) {}" % json.dumps(json.dumps(REAL)))
    yield _page(ctx)
    ctx.close()


def test_live_is_a_full_copy_at_the_root():
    for f in ["index.html", "money.js", "lite.js", "sheet.js", "sw.js", "version.json", "manifest.json", "look.css", "lite.css"]:
        assert (SITE / f).exists(), f
        assert (SITE / "demo" / f).exists(), f


def test_demo_always_shows_fake_data_and_never_touches_the_real_data(phone, site):
    phone.goto(site + "demo/" + TODAY)                                # no ?demo=1 needed
    assert phone.locator("#cards").is_visible()
    assert phone.locator("#lock").is_hidden()                         # no lock in the demo
    assert phone.locator(".appver").inner_text().startswith("demo.v")  # you can see it is the demo
    assert phone.evaluate("Lite.Store.demo") is True
    phone.evaluate("""() => { const f = document.querySelector('form[action="/add"]');
        f.elements.amount.value = '3'; f.elements.name.value = 'Demo spend'; }""")
    with phone.expect_navigation():
        phone.click('form[action="/add"] button[type=submit]')
    phone.wait_for_load_state()
    assert phone.evaluate("Lite.Store.demo") is True                  # still the demo after a change
    assert json.loads(phone.evaluate("localStorage.getItem('lite_state_v1')")) == REAL
    assert not phone.errors


def test_live_is_not_the_demo(phone, site):
    phone.goto(site + TODAY)
    assert phone.evaluate("Lite.Store.demo") is False
    assert "demo" not in phone.locator(".appver").inner_text().lower()


def _ready(page, sw):
    """Wait until this copy's own service worker (sw = its sw.js address) controls the page (it may reload once)."""
    for _ in range(3):
        try:
            page.wait_for_function("u => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL === u",
                                   arg=sw, timeout=5000)
            page.wait_for_timeout(1000)                               # the page reloads once when its worker takes over
            page.wait_for_load_state()
            return
        except Exception:
            page.wait_for_load_state()
            page.reload()
    raise AssertionError("no service worker " + sw)


def test_live_and_demo_keep_their_own_offline_copies(phone, site):
    phone.goto(site + TODAY)
    _ready(phone, site + "sw.js")
    live_v = phone.evaluate("Money.VERSION")
    phone.goto(site + "demo/" + TODAY)
    _ready(phone, site + "demo/sw.js")
    phone.wait_for_load_state()
    demo_v = phone.evaluate("Money.VERSION")
    names = sorted(phone.evaluate("caches.keys()"))
    assert names == sorted([f"wmm-lite-{live_v}", f"wmm-lite-demo-{demo_v}"])   # the demo never deletes live's copy
    # live's offline page is live's page, not the demo's
    page_text = phone.evaluate(f"caches.open('wmm-lite-{live_v}').then(c => c.match('{site}')).then(r => r.text())")
    assert page_text == (SITE / "index.html").read_text()
    demo_keys = phone.evaluate(f"caches.open('wmm-lite-{live_v}').then(c => c.keys()).then(k => k.map(r => r.url))")
    assert not [u for u in demo_keys if "/demo/" in u]                # live's cache holds no demo files
    phone.goto(site + TODAY)
    _ready(phone, site + "sw.js")
    assert sorted(phone.evaluate("caches.keys()")) == names


def test_demo_drive_copy_is_its_own_file_never_the_live_one(phone, site):
    # v0.32 (23 Oct): demo + live share one Google client id and one website, so the demo's fake data goes to its own
    # Drive file and remembers it under its own key: a live Load can never pick up the demo's fake copy
    from test_gob9 import fake_google
    phone.add_init_script("window.LITE_CONFIG = {googleClientId: 'test-client.apps.googleusercontent.com'};")
    files = {}
    fake_google(phone, files)
    phone.goto(site + "demo/" + TODAY + "&view=drive")
    phone.click("#driveconnect")
    phone.wait_for_selector("#drivesave:not([hidden])")
    phone.click("#drivesave")
    phone.wait_for_selector("#driveok:not([hidden])")
    body = files["_uploads"][-1]["body"]
    assert "wheres-my-money-demo-backup.json" in body and '"wheres-my-money-backup.json"' not in body
    assert phone.evaluate("localStorage.getItem('lite_drive_file')") is None
    assert phone.evaluate("localStorage.getItem('lite_demo_drive_file')") == "file1"
    assert json.loads(phone.evaluate("localStorage.getItem('lite_state_v1')")) == REAL


def test_demo_has_the_real_google_client_id():
    cfg = (SITE / "demo" / "config.js").read_text()
    assert "1018863337394-dhhfi006uhdf715dovuqetkl22tj5gdo.apps.googleusercontent.com" in cfg
