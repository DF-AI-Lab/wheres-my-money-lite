"""v0.59 (Darren, 28 Oct, mock https://claude.ai/artifact/XbW57xUDPGfMqHwbKiLnSa). Phone width, fake data only.
Spends: Upcoming shows 'No date yet | Pick a date' to the right; still to come = slanted with a Paid? button;
bottom box = Paid so far / Still to come. Bills: due day sheet = Set day | Varies on one line."""
from conftest import DEMO, post


def test_upcoming_shows_when_options_and_date_box_only_for_pick(page, base):
    page.goto(base + DEMO)
    card = page.locator('[data-card="spend"]')
    when = card.locator(".whenseg")
    assert not when.is_visible()
    card.locator('.spendseg button[data-up="1"]').click()
    assert when.is_visible()
    top = card.locator(".spendtop").bounding_box()
    assert when.bounding_box()["y"] < top["y"] + 10                     # on the same line as Paid | Upcoming
    assert when.locator('button[data-when="none"]').get_attribute("aria-pressed") == "true"
    assert not card.locator(".spenddate").is_visible()
    when.locator('button[data-when="date"]').click()
    assert card.locator(".spenddate").is_visible()
    when.locator('button[data-when="none"]').click()
    assert not card.locator(".spenddate").is_visible()
    card.locator('.spendseg button[data-up="0"]').click()
    assert not when.is_visible()


def add_xmas(page, base):
    page.goto(base + DEMO)
    page.click('[data-card="spend"] .spendseg button[data-up="1"]')
    post(page, 'form[action="/add"]', {"amount": "500", "name": "KT Xmas"})


def test_no_date_spend_is_still_to_come_slanted_with_paid_button(page, base):
    add_xmas(page, base)
    card = page.locator('[data-card="spend"]')
    assert card.locator("tr.sgrp").first.text_content().startswith("Still to come")
    row = card.locator('tr.drow:has-text("KT Xmas")')
    assert "upcoming" in row.get_attribute("class")
    assert "no date yet" in row.inner_text()
    assert row.locator("td b").evaluate("e => getComputedStyle(e).fontStyle") == "italic"
    assert row.locator(".paidq").is_visible()
    sums = card.locator(".sum").inner_text()
    assert "Paid so far" in sums and "Still to come" in sums and "£500.00" in sums


def test_paid_button_moves_it_to_paid(page, base):
    add_xmas(page, base)
    row = page.locator('[data-card="spend"] tr.drow:has-text("KT Xmas")')
    with page.expect_navigation():
        row.locator(".paidq").click()
    page.wait_for_load_state()
    row = page.locator('[data-card="spend"] tr.drow:has-text("KT Xmas")')
    assert "upcoming" not in row.get_attribute("class")
    assert row.locator(".paidq").count() == 0
    assert page.locator('[data-card="spend"] #tocome').inner_text().strip() == "£0.00"


def test_bill_due_day_varies(page, base):
    page.goto(base + DEMO)
    row = page.locator("tr.bill").first
    key = row.get_attribute("data-key")
    row.locator("button.more").click()
    page.click('.bmenu [role=menuitem]:has-text("Due day")')
    box = page.locator(".litesheet").last
    seg = box.locator(".dueseg")
    assert box.locator(".dueday").is_visible() and not box.locator(".duevar").is_visible()
    sb = seg.bounding_box()
    assert box.locator(".dueday").bounding_box()["x"] > sb["x"] + sb["width"]                    # one line: to the right
    seg.locator('button[data-m="varies"]').click()
    assert box.locator(".duevar").is_visible() and not box.locator(".dueday").is_visible()
    with page.expect_navigation():
        box.locator("button.ok").click()
    page.wait_for_load_state()
    row = page.locator(f'tr.bill[data-key="{key}"]')
    assert row.get_attribute("data-due") == "varies"
    assert row.locator(".bdate").inner_text().strip() == "· varies"
    row.locator("button.more").click()
    page.click('.bmenu [role=menuitem]:has-text("Due day")')
    box = page.locator(".litesheet").last
    assert box.locator('.dueseg button[data-m="varies"]').get_attribute("aria-pressed") == "true"
    box.locator('.dueseg button[data-m="day"]').click()
    box.locator(".sheetin").fill("20")
    with page.expect_navigation():
        box.locator("button.ok").click()
    page.wait_for_load_state()
    assert page.locator(f'tr.bill[data-key="{key}"]').get_attribute("data-due") == "20"


def test_plus_date_grid_has_varies(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "25", "name": "Gym"})
    page.locator('tr.bill[data-key="Gym"] .bdate .addlink').click()
    with page.expect_navigation():
        page.locator(".litesheet .dayvaries").click()
    page.wait_for_load_state()
    assert page.locator('tr.bill[data-key="Gym"] .bdate').inner_text().strip() == "· varies"
