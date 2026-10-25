"""v0.46 (Darren, 25 Oct): 1) the lock came up while he was using the app: scrolling and reading now count as use,
so it locks only after 5 minutes with no use. 2) the Settings menu got too long for a phone: it scrolls inside."""

TODAY = "?today=2024-11-08"
OLD = "sessionStorage.setItem('lite_unlock', String(Date.now() - 4.5 * 60 * 1000))"
AGE = "Date.now() - Number(sessionStorage.getItem('lite_unlock'))"


def test_scrolling_counts_as_use(page, base):
    page.goto(base + TODAY)
    page.evaluate(OLD)
    page.mouse.move(200, 400)
    page.mouse.wheel(0, 300)
    page.wait_for_timeout(200)
    assert page.evaluate(AGE) < 5000


def test_touch_and_mouse_count_as_use(page, base):
    page.goto(base + TODAY)
    for ev in ("touchstart", "mousemove", "scroll"):
        page.evaluate(OLD)
        page.evaluate(f"document.dispatchEvent(new Event('{ev}'))")
        assert page.evaluate(AGE) < 5000, ev


def test_still_locks_after_no_use(page, base):
    page.goto(base + TODAY)
    page.evaluate("sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000))")
    page.mouse.wheel(0, 300)        # use after 5 minutes away = lock first, never a quiet skip
    page.wait_for_selector('#lock[data-step="unlock"]')


def test_settings_menu_scrolls_on_a_small_phone(page, base):
    page.set_viewport_size({"width": 390, "height": 640})
    page.goto(base + TODAY)
    page.click("#setbtn")
    m = page.locator("#setmenu")
    box = m.bounding_box()
    assert box["y"] + box["height"] <= 640 + 1                          # fits on the screen
    assert m.evaluate("e => e.scrollHeight > e.clientHeight")           # and scrolls inside
    last = m.locator(".small:visible").last
    last.scroll_into_view_if_needed()
    b = last.bounding_box()
    assert b["y"] + b["height"] <= 640 + 1
    assert page.evaluate("scrollY") == 0                                # the page behind did not move
    assert not page.errors


# ---------- 3. editing (mock C): the menu closes, a pill at the bottom holds Reset + Done ----------

def test_editing_closes_the_menu_and_shows_the_pill(page, base):
    page.goto(base + TODAY)
    assert page.locator("#editpill").is_hidden()
    page.click("#setbtn"); page.click("#editbtn")
    assert page.evaluate("document.body.classList.contains('editing')")
    assert page.locator("#setmenu").is_hidden()
    pill = page.locator("#editpill")
    assert pill.is_visible()
    b = pill.bounding_box()
    assert b["y"] + b["height"] <= 844 and b["y"] > 844 - 120          # small, at the bottom
    assert b["x"] >= 0 and b["x"] + b["width"] <= 390
    page.click("#editdone")
    assert not page.evaluate("document.body.classList.contains('editing')")
    assert pill.is_hidden()
    assert not page.errors


def test_pill_reset_asks_first(page, base):
    from conftest import sheet
    page.goto(base + TODAY)
    page.click("#setbtn"); page.click("#editbtn")
    page.click("#editreset")
    sheet(page, None)                                                    # Cancel = nothing happens
    assert page.evaluate("document.body.classList.contains('editing')")
    assert page.locator("#editpill").is_visible()
