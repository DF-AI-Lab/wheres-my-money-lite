"""Go B step 8 (PLAN.md): install from the web (Android, PWA) + works offline (a service worker). Fake data only."""
import json
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"
TODAY = "?today=2024-11-08"
APP_FILES = ["./", "index.html", "money.js", "render.js", "lite.js", "lock.js", "look.css", "lite.css", "manifest.json",
             "icon-192.png", "icon-512.png", "invite-qr.svg"]


def ready(page):
    """Wait until the service worker is running and controls this page."""
    page.evaluate("navigator.serviceWorker.ready.then(() => true)")
    if not page.evaluate("!!navigator.serviceWorker.controller"):
        page.reload()
        page.wait_for_function("!!navigator.serviceWorker.controller", timeout=5000)


def test_manifest_is_ready_for_install_on_android():
    m = json.loads((DOCS / "manifest.json").read_text())
    assert "Lite" in m["name"] and m["short_name"]
    assert m["display"] == "standalone" and m["start_url"] == "./" and m["scope"] == "./" and m["id"]
    sizes = {i["sizes"] for i in m["icons"]}
    assert {"192x192", "512x512"} <= sizes
    for i in m["icons"]:
        assert (DOCS / i["src"]).exists()
    assert any("maskable" in i.get("purpose", "") for i in m["icons"]) and any("any" in i.get("purpose", "any") for i in m["icons"])


def test_a_service_worker_keeps_every_app_file(page, base):
    page.goto(base + TODAY)
    ready(page)
    cached = page.evaluate("""async () => { const out = [];
        for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(new URL(r.url).pathname);
        return out; }""")
    for f in APP_FILES:
        want = "/" if f == "./" else "/" + f
        assert any(p == want for p in cached), (f, cached)
    names = page.evaluate("caches.keys()")
    version = page.locator(".appver").inner_text().lstrip("v")
    assert names == [f"wmm-lite-{version}"]                           # one cache, named after this version
    assert not page.errors


def test_it_opens_with_no_internet(page, base):
    page.goto(base + TODAY)
    post_spend(page)
    ready(page)
    page.context.set_offline(True)
    page.reload()
    assert page.locator("#cards").is_visible()
    assert page.locator('[data-card="spend"] tr.drow:has-text("Offline test")').count() == 1   # the data is on the phone
    page.goto(base.replace("index.html", "") + TODAY)                 # the home address too (what the app icon opens)
    assert page.locator("#cards").is_visible()
    page.context.set_offline(False)


def post_spend(page):
    page.evaluate("""() => { const f = document.querySelector('form[action="/add"]');
        f.elements.amount.value = '2'; f.elements.name.value = 'Offline test'; }""")
    with page.expect_navigation():
        page.evaluate("document.querySelector('form[action=\"/add\"]').requestSubmit()")
    page.wait_for_load_state()


def test_version_json_always_comes_from_the_internet(page, base):
    """The Update check must never be answered from the cache (else it could never see a new version)."""
    page.goto(base + TODAY)
    ready(page)
    page.route("**/version.json*", lambda r: r.fulfill(status=200, content_type="application/json", body='{"version": "9.99"}'))
    v = page.evaluate("fetch('version.json', {cache: 'no-store'}).then(r => r.json()).then(j => j.version)")
    assert v == "9.99"


def test_install_button_shows_when_the_phone_offers_it(page, base):
    page.goto(base + TODAY)
    assert page.locator("#installbtn").count() == 1 and page.locator("#installbtn").is_hidden()
    page.evaluate("""() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__asked = true; };
        e.userChoice = Promise.resolve({outcome: 'accepted'}); window.dispatchEvent(e); }""")
    page.click("#setbtn")
    assert page.locator("#installbtn").is_visible()
    page.click("#installbtn")
    page.wait_for_timeout(200)
    assert page.evaluate("window.__asked") is True
    assert page.locator("#installbtn").is_hidden()                    # asked once; it goes


def test_old_caches_are_cleared_when_a_new_version_starts(page, base):
    page.goto(base + TODAY)
    ready(page)
    page.evaluate("caches.open('wmm-lite-0.01').then(c => c.put('old.txt', new Response('x')))")
    # a fresh worker start (like after an update) clears every cache that is not this version's
    page.evaluate("navigator.serviceWorker.getRegistration().then(r => r.unregister())")
    page.reload()
    ready(page)
    page.wait_for_timeout(300)
    version = page.locator(".appver").inner_text().lstrip("v")
    assert page.evaluate("caches.keys()") == [f"wmm-lite-{version}"]
