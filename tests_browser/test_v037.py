"""v0.37 (Darren, 24 Oct). Phone width, fake data only. Google is faked (no network).
1. Spends: '+ category' on an Unsorted spend, ⋯ → 🏷 Category (like bills).
2. Bell: bills due the same day = one line; ▸ opens one short line per bill (tap = jump + flash); ✓ ticks them all.
3. ⏸ Pause (was Stop counting): paused bills leave the list into one folded line at the bottom of Bills.
4. Drive: reconnects by itself on the first tap; saves once when the app is hidden (if something changed);
   one file per pay month, the last 3 kept."""
import json

from conftest import DEMO, stored, post
from test_gob9 import GSI

TODAY = "?today=2024-11-08"


# ---------- 1. spend category ----------

def test_plus_category_on_an_unsorted_spend(page, base):
    page.goto(base + DEMO)
    costa = page.locator('[data-card="spend"] tr.drow[data-name="Costa"]')
    link = costa.locator(".addlink")
    assert link.inner_text().strip() == "+ category"
    tesco = page.locator('[data-card="spend"] tr.drow[data-name="Tesco"]')
    assert tesco.locator(".addlink").count() == 0 and "Food shopping" in tesco.inner_text()
    link.click()
    box = page.locator(".litesheet").last
    with page.expect_navigation():
        box.locator('.picklist button:text-is("Shopping")').click()
    page.wait_for_load_state()
    costa = page.locator('[data-card="spend"] tr.drow[data-name="Costa"]')
    assert costa.locator(".addlink").count() == 0
    assert "Shopping" in costa.inner_text()


def test_spend_menu_has_category(page, base):
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "6.20", "name": "Greggs"})
    page.click('[data-card="spend"] tr.drow[data-name="Greggs"] button.more')
    page.click('.bmenu [role=menuitem]:has-text("Category")')
    box = page.locator(".litesheet").last
    with page.expect_navigation():
        box.locator('.picklist button:text-is("Food shopping")').click()
    page.wait_for_load_state()
    assert [x["cat"] for x in stored(page)["spends"] if x["name"] == "Greggs"] == ["Food shopping"]


# ---------- 2. the bell ----------

def open_bell(page, base):
    page.goto(base + DEMO)
    page.click("#bellbtn")
    return page.locator("#bellmenu")


def test_bell_one_line_per_day(page, base):
    bell = open_bell(page, base)
    assert page.locator("#bellcount").inner_text() == "4"              # Tv Licence, the 1st (2 bills), Bills, Energy Co
    group = bell.locator('.remind[data-kind="bills"]')
    assert group.count() == 1
    assert "2 bills" in group.inner_text() and "1st" in group.inner_text()
    assert group.locator(".remgo").count() == 0                         # a group has no Show
    assert group.locator(".remdone").count() == 1
    single = bell.locator('.remind[data-key="Energy Co"]')
    assert single.locator(".remgo").count() == 1 and single.locator(".remdone").count() == 1


def test_open_a_day_and_tap_a_bill_to_flash_it(page, base):
    bell = open_bell(page, base)
    group = bell.locator('.remind[data-kind="bills"]')
    subs = bell.locator('.remsub')
    assert subs.count() == 0 or not subs.first.is_visible()
    group.locator(".remchev").click()
    assert bell.locator('.remsub[data-key="Rent"]').is_visible()
    assert bell.locator('.remsub[data-key="Council Tax"]').is_visible()
    assert "£550.00" in bell.locator('.remsub[data-key="Rent"]').inner_text()
    bell.locator('.remsub[data-key="Council Tax"]').click()
    page.wait_for_timeout(700)
    assert "pulse" in page.locator('tr.bill[data-key="Council Tax"]').get_attribute("class")


def test_tick_a_day_ticks_every_bill_in_it(page, base):
    bell = open_bell(page, base)
    with page.expect_navigation():
        bell.locator('.remind[data-kind="bills"] .remdone').click()
    page.wait_for_load_state()
    s = json.loads(page.evaluate("sessionStorage.getItem('lite_demo_v1')"))
    paid = {b["key"]: b["paid"] for b in s["bills"]}
    assert paid["Rent"] and paid["Council Tax"] and not paid["Energy Co"]
    assert page.locator("#bellcount").inner_text() == "3"


# ---------- 3. pause ----------

def test_pause_folds_a_bill_away_and_resume_brings_it_back(page, base):
    page.goto(base + DEMO)
    before = page.locator("#btotal").inner_text()
    page.click('tr.bill[data-key="Gym Club"] button.more')
    menu = page.locator(".bmenu")
    assert menu.locator('[role=menuitem]:has-text("Pause")').count() == 1
    assert menu.locator('[role=menuitem]:has-text("Stop counting")').count() == 0
    with page.expect_navigation():
        menu.locator('[role=menuitem]:has-text("Pause")').click()
    page.wait_for_load_state()
    assert page.locator('tr.bill[data-key="Gym Club"]').count() == 0      # gone from the list
    assert page.locator("#btotal").inner_text() != before
    fold = page.locator(".pausedfold")
    assert fold.is_visible() and "1 paused" in fold.inner_text() and "£50.00" in fold.inner_text()
    row = page.locator('tr.pbill[data-key="Gym Club"]')
    assert not row.is_visible()
    fold.click()
    assert row.is_visible()
    with page.expect_navigation():
        row.locator("button.resume").click()
    page.wait_for_load_state()
    assert page.locator('tr.bill[data-key="Gym Club"]').count() == 1
    assert page.locator(".pausedfold").count() == 0
    assert page.locator("#btotal").inner_text() == before


# ---------- 4. Google Drive auto ----------

FAKE_GSI = """window.__asks = []; window.google = {accounts: {oauth2: {initTokenClient: cfg => ({requestAccessToken: o => {
    window.__asks.push((o && o.prompt) === undefined ? 'full' : o.prompt);
    setTimeout(() => cfg.callback({access_token: 'tok123', expires_in: 3600}), 10); }})}}};"""


def fake_drive(page, listed=None):
    """Drive with a list of files already there. Records uploads and deletes."""
    log = {"uploads": [], "deletes": []}
    page.route(GSI + "*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=FAKE_GSI))

    def api(route):
        req = route.request
        if "upload/drive/v3/files" in req.url:
            log["uploads"].append({"method": req.method, "url": req.url, "body": req.post_data or ""})
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": "new%d" % len(log["uploads"])}))
        if req.method == "DELETE":
            log["deletes"].append(req.url.split("/files/")[1].split("?")[0])
            return route.fulfill(status=204, body="")
        if req.method == "GET":
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"files": listed or []}))
        return route.fulfill(status=404, body="")
    page.route("https://www.googleapis.com/**", api)
    return log


def hide(page):
    page.evaluate("""() => { Object.defineProperty(document, 'visibilityState', {value: 'hidden', configurable: true});
        document.dispatchEvent(new Event('visibilitychange')); }""")
    page.wait_for_timeout(600)


def connect(page, base):
    page.add_init_script("window.LITE_CONFIG = {googleClientId: 'test-client.apps.googleusercontent.com'};")
    page.goto(base + TODAY + "&view=drive")
    page.click("#driveconnect")
    page.wait_for_selector("#drivesave:not([hidden])")


def test_auto_save_when_the_app_is_hidden_one_file_per_pay_month(page, base):
    log = fake_drive(page)
    connect(page, base)
    page.goto(base + TODAY)
    hide(page)
    assert log["uploads"] == [], "nothing changed: nothing sent"
    post(page, 'form[action="/add"]', {"amount": "3", "name": "AutoCheck"})   # a change, then the page reloads
    hide(page)
    assert len(log["uploads"]) == 1
    up = log["uploads"][0]
    assert "wheres-my-money-backup Nov 2024.json" in up["body"] and "AutoCheck" not in up["body"]   # scrambled
    hide(page)
    assert len(log["uploads"]) == 1, "sent once, not again until something changes"
    post(page, 'form[action="/add"]', {"amount": "4", "name": "Again"})
    hide(page)
    assert log["uploads"][-1]["method"] == "PATCH" and "/files/new1" in log["uploads"][-1]["url"]   # same month = same file


def test_reconnects_by_itself_on_the_first_tap(page, base):
    fake_drive(page)
    connect(page, base)
    assert page.evaluate("window.__asks") == ["full"]                   # the first time: the full Google sign-in
    page.evaluate("sessionStorage.removeItem('lite_drive_token')")      # a new visit: the hour-long token has gone
    page.goto(base + TODAY)
    page.mouse.click(5, 400)
    page.wait_for_timeout(500)
    assert page.evaluate("window.__asks") == [""]                       # quiet: no account picker
    assert page.evaluate("sessionStorage.getItem('lite_drive_token')")


def test_a_new_month_keeps_only_the_last_three(page, base):
    old = [{"id": i, "name": "wheres-my-money-backup %s 2024.json" % m, "modifiedTime": "2024-%02d-01T00:00:00Z" % n}
           for i, m, n in (("jul", "Jul", 7), ("aug", "Aug", 8), ("sep", "Sep", 9))]
    log = fake_drive(page, listed=old + [{"id": "new1", "name": "wheres-my-money-backup Oct 2024.json",
                                          "modifiedTime": "2024-11-08T00:00:00Z"}])
    connect(page, base)
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "3", "name": "X"})
    hide(page)
    assert log["uploads"][0]["method"] == "POST"                        # the month's first save = a new file
    assert log["deletes"] == ["jul"]


def test_drive_page_says_auto_save_is_on_and_can_turn_it_off(page, base):
    fake_drive(page)
    connect(page, base)
    text = page.locator("#drive").inner_text()
    assert "Auto-save is on" in text
    page.click("#driveoff")
    assert page.locator("#driveconnect").is_visible()
    assert page.evaluate("localStorage.getItem('lite_drive_on')") is None
