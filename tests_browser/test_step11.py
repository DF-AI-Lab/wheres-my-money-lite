"""Darren's 21 Oct evening feedback (v0.16): green Paid ⓘ, the bell list scrolls + Clear all, bills paid from a pot.
Phone width, fake data only."""
import json
from conftest import DEMO, stored, post, bill_menu

TODAY = "?today=2024-11-08"


def test_due_bill_name_and_date_turn_green_with_a_tick(page, base):
    """Darren, 22 Oct (mock B): name + date on one line; once the due day has gone they go green with ✓, then ⓘ.
    Category · avg on the line under. The date is a little smaller than the name."""
    page.goto(base + DEMO)                                            # 8 Nov: Rent (due 1st) has gone
    rent = page.locator('tr.bill[data-key="Rent"]')
    line = rent.locator(".bline")
    assert line.locator(".bbase").inner_text() == "Rent"
    assert line.locator(".bdate").inner_text().strip() == "· 1st"
    tick = line.locator(".bbase").evaluate("e => getComputedStyle(e, '::before').content")
    assert "✓" in tick
    green = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--good').trim()")
    probe = page.evaluate("c => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }", green)
    for part in (".bbase", ".bdate"):
        assert line.locator(part).evaluate("e => getComputedStyle(e).color") == probe, part
    size = lambda sel: float(line.locator(sel).evaluate("e => getComputedStyle(e).fontSize")[:-2])
    assert size(".bdate") < size(".bbase")                            # slightly smaller
    order = line.evaluate("e => [...e.querySelectorAll('.bbase, .bdate, button.info')].map(x => x.className)")
    assert order == ["bbase", "bdate", "info"]                        # name, date, then ⓘ
    sub = rent.locator(".bsub").inner_text()
    assert sub.startswith("Household") and "avg £550.00" in sub and "due" not in sub and "Paid" not in sub
    assert rent.locator(".bpaid").count() == 0
    phone = page.locator('tr.bill[data-key="Phone Co"] .bline')      # not due yet: white name, grey date, no ✓ or ⓘ
    assert "✓" not in phone.locator(".bbase").evaluate("e => getComputedStyle(e, '::before').content")
    assert phone.locator(".bbase").evaluate("e => getComputedStyle(e).color") != probe
    assert phone.locator("button.info").count() == 0
    assert page.locator("input.paidbox").count() == 0


def test_the_bell_list_scrolls(page, base):
    page.goto(base + "?today=2024-11-28")                             # 14 due days, all gone
    for i in range(14):
        post(page, 'form[action="/bill/add"]', {"amount": "10", "name": f"Bill {i}"})
        bill_menu(page, f"Bill {i}", "Due day", str(i + 1))   # v0.37: one line per day
    page.click("#bellbtn")
    m = page.locator("#bellmenu")
    b = m.bounding_box()
    assert b["y"] + b["height"] <= 844 + 1                            # fits on the screen
    assert m.evaluate("e => e.scrollHeight > e.clientHeight")
    m.evaluate("e => { e.scrollTop = 200; }")
    assert m.evaluate("e => e.scrollTop") > 0                         # and it scrolls
    assert not page.errors


def test_clear_all(page, base):
    page.goto(base + DEMO)
    assert page.locator("#bellcount").inner_text() == "4"
    page.click("#bellbtn")
    with page.expect_navigation():
        page.click("#bellclear")
    page.wait_for_load_state()
    assert page.locator("#bellcount").is_hidden() or page.locator("#bellcount").inner_text() in ("", "0")
    page.click("#bellbtn")
    assert page.locator("#bellmenu .remind").count() == 0
    assert page.locator("#bellclear").count() == 0 or page.locator("#bellclear").is_hidden()


def test_a_fuel_bill_comes_out_of_the_fuel_pot(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "50", "name": "Fuel card"})
    assert page.locator("#st-bills").inner_text() == "£1,183.73"      # not on top of the pot
    assert page.locator("#st-spare").inner_text() == "£1,159.57"   # real money: the bill comes off
    fuel = page.locator('[data-card="pots"] .pot[data-key="Fuel"]')
    assert "£110.00 of £150.00" in fuel.inner_text()
    assert "£40.00 left" in fuel.inner_text()
    assert "Fuel pot" in page.locator('tr.bill[data-key="Fuel card"] .bsub').inner_text()
    assert page.locator("#btotal").inner_text() == "£1,733.73"        # the Bills card still adds up (pot rows hold it)


def test_a_fuel_spend_takes_actual_spare_down(page, base):
    """Darren, 21 Oct evening: a spend from a pot is real money gone, so Actual spare drops by it."""
    page.goto(base + DEMO)
    before_key = page.locator("#st-key").inner_text()
    post(page, 'form[action="/add"]', {"amount": "20", "name": "Shell"})        # Fuel pot
    assert page.locator("#spare-big").inner_text() == "£1,189.57"     # 1,209.57 - 20
    assert page.locator("#st-spare").inner_text() == "£1,189.57"
    assert page.locator("#st-start").inner_text() == "£766.27"        # the plan stays
    assert page.locator("#st-potleft").inner_text() == "£470.00"
    assert "£80.00 of £150.00" in page.locator('.pot[data-key="Fuel"]').inner_text()
    assert page.locator("#st-key").inner_text() != before_key         # the ring key moves too
    assert page.locator("#mfs").inner_text() == "£1,316.27"           # Add a spend card: after bills
    assert page.locator("#typed").inner_text() == "£126.70"           # every spend
    assert page.locator("#leftnow").inner_text() == "£1,189.57"
    page.reload()
    assert page.locator("#spare-big").inner_text() == "£1,189.57"


def test_show_makes_the_item_pulse(page, base):
    """Darren, 21 Oct evening: after Show jumps to an item, it pulses so you can see where it is."""
    page.goto(base + DEMO)
    page.click("#bellbtn")
    page.locator('#bellmenu .remind[data-key="Energy Co"] .remgo').click()
    page.wait_for_timeout(700)
    rent = page.locator('tr.bill[data-key="Energy Co"]')
    assert "pulse" in rent.get_attribute("class")
    assert rent.evaluate("e => getComputedStyle(e).animationName") not in ("", "none")
    page.wait_for_timeout(3500)
    assert "pulse" not in rent.get_attribute("class")                 # stops by itself


def test_show_payday_pulses_the_panel(page, base):
    page.goto(base + "?demo=1&today=2024-11-25")
    page.click("#bellbtn")
    page.locator('#bellmenu .remind[data-kind="payday"] .remgo').click()
    page.wait_for_timeout(700)
    assert page.locator("#quick").is_visible()
    assert "pulse" in page.locator("#quick").get_attribute("class")


def test_middle_widths_keep_the_phone_rows(page, base):
    """Darren, 22 Oct: zoomed out (521-640 px) the bills turned into boxes with a gap on the right. Keep the phone rows."""
    for w in (390, 600):
        page.set_viewport_size({"width": w, "height": 900})
        page.goto(base + DEMO)
        row = page.locator('[data-card="bills"] tr.bill[data-key="Rent"]')
        assert row.evaluate("e => getComputedStyle(e).borderLeftWidth") == "0px", w      # no box round each bill
        label = row.locator("td.n").first.evaluate("e => getComputedStyle(e, '::before').content")
        assert label in ("none", "normal"), (w, label)                                   # no 'LAST MONTH' label
        more = row.locator("td.bmore").bounding_box()
        card = page.locator('[data-card="bills"]').bounding_box()
        assert card["x"] + card["width"] - (more["x"] + more["width"]) < 40, w           # ⋯ sits at the right edge


def test_new_month_asks_in_a_sheet_not_a_browser_box(page, base):
    """Darren, 22 Oct (mock B): a sheet slides up with the numbers, Yes / No, just change the pay / Cancel."""
    page.goto(base + DEMO)
    dialogs = []
    page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    months = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1')).history.length")
    page.click("#quicktab")
    page.fill("#qpay", "2600")
    page.fill("#qleft", "100")
    page.click("#payform .q-go")
    sheet = page.locator("#newmonth")
    sheet.wait_for(state="visible")
    text = sheet.inner_text()
    assert "Start a new month?" in text and "£2,600.00" in text and "£100.00" in text
    assert "Yes, start a new month" in text and "just change this month" in text and "Cancel" in text
    assert dialogs == []                                              # no browser pop-up
    page.click("#newmonth .ter")                                      # Cancel: nothing changes
    assert page.locator("#newmonth").count() == 0 or not page.locator("#newmonth").is_visible()
    s = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1'))")
    assert s["pay"] == 2500 and len(s["history"]) == months
    page.click("#payform .q-go")
    page.keyboard.press("Escape")                                     # Escape = Cancel too
    assert page.locator("#newmonth").count() == 0 or not page.locator("#newmonth").is_visible()


def test_mark_a_bill_paid_by_hand(page, base):
    """Darren, 22 Oct: ⋯ → ✅ Mark as paid (any time); it goes green with ✓, leaves the bell; ↩️ Not paid yet undoes it."""
    page.goto(base + DEMO)
    row = 'tr.bill[data-key="Phone Co"]'                              # due 18th, today 8 Nov: not due yet
    assert page.locator(f"{row} .bline.paid").count() == 0
    bill_menu(page, "Phone Co", "Mark paid")
    assert page.locator(f"{row} .bline.paid").count() == 1
    page.click(f"{row} button.info")
    assert "marked" in page.locator(".infotip").inner_text().lower()
    demo = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1'))")
    assert next(b for b in demo["bills"] if b["key"] == "Phone Co")["paid"] is True
    page.click(f"{row} button.more")
    assert page.locator('.bmenu [role=menuitem]:has-text("Mark paid")').count() == 0
    page.keyboard.press("Escape")
    bill_menu(page, "Phone Co", "Not paid yet")
    assert page.locator(f"{row} .bline.paid").count() == 0


def test_marking_a_due_bill_paid_clears_its_reminder(page, base):
    page.goto(base + DEMO)
    before = page.locator("#bellcount").inner_text()
    bill_menu(page, "Energy Co", "Mark paid")              # a lone bill on its day (v0.37)
    assert int(page.locator("#bellcount").inner_text()) == int(before) - 1


def _band_with(page, base, version):
    page.route("**/version.json*", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"version": version})))
    page.goto(base + DEMO)


def test_no_update_band_when_nothing_is_new(page, base):
    """Darren, 22 Oct (mock C2): no sticker button in the header; the band shows only when a new version is out."""
    _band_with(page, base, "0.00")
    page.wait_for_timeout(600)
    assert page.locator("#headupd").count() == 0
    assert page.locator("#updband").is_hidden()


def test_update_band_sits_on_the_bottom_edge_and_header_keeps_its_size(page, base):
    page.goto(base + DEMO)
    head_before = page.locator(".demohead").bounding_box()["height"]
    _band_with(page, base, "9.99")
    band = page.locator("#updband")
    band.wait_for(state="visible")
    page.wait_for_timeout(500)                                        # let it finish sliding up
    assert "9.99" in band.inner_text()
    b = band.bounding_box(); vh = page.viewport_size["height"]
    assert abs((b["y"] + b["height"]) - vh) < 2                       # stuck to the bottom of the screen
    assert b["width"] >= page.viewport_size["width"] - 2              # edge to edge
    assert page.evaluate("getComputedStyle(document.getElementById('updband')).position") == "fixed"
    assert page.locator(".demohead").bounding_box()["height"] == head_before


def test_update_band_tap_spins_and_reloads(page, base):
    _band_with(page, base, "9.99")
    page.locator("#updband").wait_for(state="visible")
    dialogs = []
    page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    page.evaluate("window.__before = 1")
    with page.expect_navigation(timeout=8000):
        page.click("#updgo")
        assert page.locator(".demohead .brand.spinning").count() == 1
    page.wait_for_load_state()
    assert page.evaluate("window.__before") is None
    assert dialogs == []                                              # no OK / Cancel box


# ---------- v0.28: sheets instead of the browser's boxes (mock 2a/2b/2c) ----------

def test_no_browser_boxes_left_in_the_app():
    """Every OK / Cancel box, typing box and message is a slide-up sheet now (docs/sheet.js)."""
    import re
    from pathlib import Path
    docs = Path(__file__).resolve().parent.parent / "docs" / "demo"
    for f in ["index.html", "lite.js", "lockui.js", "render.js", "lock.js", "money.js"]:
        text = (docs / f).read_text()
        hits = re.findall(r"(?<![.\w])(confirm|prompt|alert)\(", text)
        assert hits == [], (f, hits)


def test_typing_sheet_shows_the_old_value_and_escape_cancels(page, base):
    page.goto(base + DEMO)
    page.click('tr.bill[data-key="Rent"] button.more')
    page.click('.bmenu [role=menuitem]:has-text("Change name")')
    box = page.locator(".litesheet")
    box.wait_for(state="visible")
    assert box.locator(".sheetin").input_value() == "Rent"
    assert box.locator("button.ok").inner_text() == "Save"
    page.keyboard.press("Escape")
    assert box.count() == 0
    assert page.locator('tr.bill[data-key="Rent"]').count() == 1


def test_delete_sheet_is_red_and_cancel_keeps_the_bill(page, base):
    page.goto(base + DEMO)
    page.click('tr.bill[data-key="Rent"] button.more')
    page.click('.bmenu [role=menuitem]:has-text("Delete")')
    box = page.locator(".litesheet")
    box.wait_for(state="visible")
    assert "Delete Rent?" in box.inner_text()
    assert "bad" in box.locator("button.ok").get_attribute("class")
    box.locator("button.cancel").click()
    assert page.locator('tr.bill[data-key="Rent"]').count() == 1
    bill_menu(page, "Rent", "Delete", True)
    assert page.locator('tr.bill[data-key="Rent"]').count() == 0
