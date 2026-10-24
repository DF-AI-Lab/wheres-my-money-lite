"""v0.36 (Darren, 24 Oct, mocks A3 + D + H2). Phone width, fake data only.
Bills: '+ date' / '+ category' links only when the bill is missing them; a new bill glows.
Spends: Paid / Upcoming switch; upcoming = an expected date, paid by itself from that date; every row has ⓘ and ⋯."""
from conftest import DEMO, stored, post, sheet

TODAY = "?today=2024-11-08"
LATER = "?demo=1&today=2024-11-21"


# ---------- bills (A3 + D) ----------

def test_plus_date_only_on_a_bill_with_no_due_day(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "25", "name": "Gym"})
    gym = page.locator('tr.bill[data-key="Gym"]')
    assert gym.locator(".bdate .addlink").inner_text().strip() == "+ date"
    rent = page.locator('tr.bill[data-key="Rent"]')
    assert rent.locator(".addlink").count() == 0                       # Rent has its date and category: plain text
    gym.locator(".bdate .addlink").click()
    box = page.locator(".litesheet").last
    assert box.locator(".daygrid button").count() == 31
    with page.expect_navigation():
        box.locator('.daygrid button:text-is("15")').click()
    page.wait_for_load_state()
    gym = page.locator('tr.bill[data-key="Gym"]')
    assert gym.get_attribute("data-due") == "15"
    assert gym.locator(".bdate").inner_text().strip() == "· 15th"
    assert gym.locator(".bdate .addlink").count() == 0


def test_plus_category_only_when_unsorted(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "25", "name": "Gym"})
    gym = page.locator('tr.bill[data-key="Gym"]')
    assert gym.get_attribute("data-cat") == "Unsorted"
    link = gym.locator(".bsub .addlink")
    assert link.inner_text().strip() == "+ category"
    assert "Unsorted" not in gym.locator(".bsub").inner_text()
    link.click()
    box = page.locator(".litesheet").last
    with page.expect_navigation():
        box.locator('.picklist button:text-is("Subscriptions")').click()
    page.wait_for_load_state()
    gym = page.locator('tr.bill[data-key="Gym"]')
    assert gym.get_attribute("data-cat") == "Subscriptions"
    assert gym.locator(".bsub .addlink").count() == 0
    assert gym.locator(".bsub").inner_text().startswith("Subscriptions")


def test_links_are_green_and_tappable(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "25", "name": "Gym"})
    link = page.locator('tr.bill[data-key="Gym"] .bdate .addlink')
    assert link.evaluate("e => e.tagName") == "BUTTON"
    good = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
    assert good                                                          # uses the app's own colours
    assert link.evaluate("e => getComputedStyle(e).color") != page.locator('tr.bill[data-key="Gym"] .bbase').evaluate("e => getComputedStyle(e).color")


def test_a_new_bill_glows_once(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "25", "name": "Gym"})
    assert "newglow" in page.locator('tr.bill[data-key="Gym"]').get_attribute("class")
    page.goto(base + DEMO)
    assert "newglow" not in page.locator('tr.bill[data-key="Gym"]').get_attribute("class")


# ---------- spends (H2) ----------

def add_mot(page, base):
    page.goto(base + DEMO)
    page.click('[data-card="spend"] .spendseg button[data-up="1"]')
    assert page.locator('[data-card="spend"] .spenddate').is_visible()
    post(page, 'form[action="/add"]', {"amount": "54.85", "name": "Car MOT", "date": "2024-11-20"})


def test_the_switch_shows_the_date_box_only_for_upcoming(page, base):
    page.goto(base + DEMO)
    seg = page.locator('[data-card="spend"] .spendseg')
    assert seg.locator('button[data-up="0"]').get_attribute("aria-pressed") == "true"
    assert not page.locator('[data-card="spend"] .spenddate').is_visible()
    seg.locator('button[data-up="1"]').click()
    assert seg.locator('button[data-up="1"]').get_attribute("aria-pressed") == "true"
    assert page.locator('[data-card="spend"] .spenddate').is_visible()
    assert page.locator('form[action="/add"] input[name="upcoming"]').input_value() == "1"
    seg.locator('button[data-up="0"]').click()
    assert page.locator('form[action="/add"] input[name="upcoming"]').input_value() == "0"
    assert not page.locator('[data-card="spend"] .spenddate').is_visible()


def test_upcoming_spend_sits_in_coming_up_with_its_message(page, base):
    add_mot(page, base)
    card = page.locator('[data-card="spend"]')
    heads = card.locator("tr.sgrp").all_text_contents()
    assert heads[0].startswith("Coming up") and "£54.85" in heads[0]
    assert heads[1].startswith("Paid")
    mot = card.locator('tr.drow:has-text("Car MOT")')
    assert "upcoming" in mot.get_attribute("class")
    assert "expected 20 Nov" in mot.inner_text() and "Car" in mot.inner_text()
    tip = mot.locator("button.info").get_attribute("data-tip")
    assert tip.startswith("Expected date. When this date comes it moves to Paid by itself.")


def test_upcoming_spend_is_paid_by_itself_from_its_date(page, base):
    add_mot(page, base)
    page.goto(base + LATER)
    card = page.locator('[data-card="spend"]')
    assert card.locator("tr.sgrp").count() == 0                          # nothing coming up: no group lines
    mot = card.locator('tr.drow:has-text("Car MOT")')
    assert "paid" in mot.get_attribute("class") and "upcoming" not in mot.get_attribute("class")
    assert "20 Nov 2024" in mot.inner_text()
    assert mot.locator("button.info").get_attribute("data-tip") == \
        "The expected date has gone, so it should be paid. Please check your bank app it came out."


def test_a_normal_spend_shows_its_date_with_a_message_and_dots(page, base):
    page.goto(base + DEMO)
    costa = page.locator('[data-card="spend"] tr.drow:has-text("Costa")').first
    assert costa.locator("button.info").get_attribute("data-tip") == \
        "This is the date you added it. If it went out on another day, tap ⋯ to change the date."
    assert costa.locator("button.xbtn").count() == 0                     # ✕ is now inside ⋯
    costa.locator("button.more").click()
    items = page.locator(".bmenu [role=menuitem]").all_inner_texts()
    assert any("Change date" in x for x in items) and any("Remove" in x for x in items)
    assert not any("Paid" in x for x in items)                           # already paid


def test_dots_change_date(page, base):
    page.goto(base + DEMO)
    costa = page.locator('[data-card="spend"] tr.drow:has-text("Costa")').first
    sid = costa.get_attribute("data-id")
    costa.locator("button.more").click()
    page.click('.bmenu [role=menuitem]:has-text("Change date")')
    assert page.locator(".litesheet .sheetin").get_attribute("type") == "date"
    with page.expect_navigation():
        sheet(page, "2024-11-03")
    page.wait_for_load_state()
    row = page.locator(f'[data-card="spend"] tr.drow[data-id="{sid}"]')
    assert "3 Nov 2024" in row.inner_text()
    assert row.locator("button.info").get_attribute("data-tip") == "You changed this date. Tap ⋯ to change it again."


def test_dots_paid_and_remove(page, base):
    add_mot(page, base)
    mot = page.locator('[data-card="spend"] tr.drow:has-text("Car MOT")')
    mot.locator("button.more").click()
    with page.expect_navigation():
        page.click('.bmenu [role=menuitem]:has-text("Paid")')
    page.wait_for_load_state()
    mot = page.locator('[data-card="spend"] tr.drow:has-text("Car MOT")')
    assert "upcoming" not in mot.get_attribute("class")
    assert "8 Nov 2024" in mot.inner_text()                              # paid today
    mot.locator("button.more").click()
    with page.expect_navigation():
        page.click('.bmenu [role=menuitem]:has-text("Remove")')
    page.wait_for_load_state()
    assert page.locator('[data-card="spend"] tr.drow:has-text("Car MOT")').count() == 0


def test_upcoming_with_no_date_is_an_error(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/add"]', {"amount": "5", "name": "X", "upcoming": "1", "date": ""})
    assert page.locator('[data-card="spend"] .error').count() == 1
    assert page.locator('[data-card="spend"] tr.drow:has-text("X")').count() == 0


def test_real_data_upcoming_is_saved(page, base):
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "54.85", "name": "Car MOT", "upcoming": "1", "date": "2024-11-20"})
    sp = stored(page)["spends"][-1]
    assert sp["upcoming"] is True and sp["date"] == "2024-11-20"
