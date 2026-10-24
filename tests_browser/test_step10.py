"""PLAN.md step 10: Darren's 21 Oct feedback (9 changes). Phone width (390 px), fake data only."""
from conftest import DEMO, stored, post, bill_menu, sheet

TODAY = "?today=2024-11-08"


def box(page, sel):
    b = page.locator(sel).bounding_box()
    assert b, sel
    return b


# ---------- 1. ⬅️ Back at the top of Settings ----------

def test_back_is_the_first_thing_in_settings_and_closes_it(page, base):
    page.goto(base + DEMO)
    page.click("#setbtn")
    assert page.locator("#setmenu").is_visible()
    assert page.locator("#setmenu button, #setmenu a").first.get_attribute("id") == "setback"
    assert "Back" in page.locator("#setback").inner_text()
    page.click("#setback")
    assert page.locator("#setmenu").is_hidden()
    assert page.get_attribute("#setbtn", "aria-expanded") == "false"
    assert not page.errors


def test_back_also_leaves_move_and_rename(page, base):
    page.goto(base + DEMO)
    page.click("#setbtn")
    page.click("#editbtn")
    assert page.evaluate("document.body.classList.contains('editing')")
    page.click("#setback")
    assert not page.evaluate("document.body.classList.contains('editing')")
    assert page.locator("#setmenu").is_hidden()
    assert "Move" in page.locator("#editbtn").inner_text()


# ---------- 2. 🟠 pots in Bills, counted once ----------

def test_every_pot_is_a_row_in_bills(page, base):
    page.goto(base + DEMO)
    rows = page.locator('[data-card="bills"] tr.potbill')
    assert rows.count() == 3
    assert rows.evaluate_all("els => els.map(e => e.dataset.pot)") == ["Shopping", "Fuel", "Going out"]
    shop = page.locator('tr.potbill[data-pot="Shopping"]')
    text = shop.inner_text()
    assert "Shopping" in text and "Pots" in text and "£400.00" in text
    assert page.locator('tr.potbill[data-pot="Going out"]').locator("button.link").inner_text() == "Add"
    assert page.locator('tr.bill[data-key="Shopping"]').count() == 0     # not a real bill


def test_pots_are_counted_once(page, base):
    page.goto(base + DEMO)
    assert page.locator("#btotal").inner_text() == "£1,733.73"        # bills 1,183.73 + pots 550 (the card adds up)
    assert page.locator("#st-bills").inner_text() == "£1,183.73"      # the top card: bills alone
    assert page.locator("#st-pots").count() == 0                      # one pot line only: Pots left (22 Oct)
    assert page.locator("#spare-big").inner_text() == "£1,209.57"     # real money left: not taken off twice


def test_typing_a_bill_keeps_the_pots_in_the_total(page, base):
    page.goto(base + DEMO)
    row = 'tr.bill[data-key="Rent"]'
    page.click(f"{row} button.link")
    page.fill(f"{row} input.billbox", "600")
    page.wait_for_timeout(100)
    assert page.locator("#btotal").inner_text() == "£1,783.73"
    assert page.locator("#st-start").inner_text() == "£716.27"
    assert page.locator("#st-spare").inner_text() == "£1,159.57"


def test_a_pot_row_amount_changes_the_pot(page, base):
    page.goto(base + TODAY)
    page.click('tr.potbill[data-pot="Shopping"] button.link')
    with page.expect_navigation():
        sheet(page, "450")
    page.wait_for_load_state()
    pot = [p for p in stored(page)["pots"] if p["key"] == "Shopping"][0]
    assert pot["amount"] == 450


# ---------- 3. 💰 Starting spare and Actual spare ----------

def test_top_card_shows_starting_and_actual_spare(page, base):
    page.goto(base + DEMO)
    rows = page.locator(".st-rows").inner_text()
    assert "Starting spare" in rows and "Actual spare" in rows
    assert page.locator("#st-start").inner_text() == "£766.27"        # 2,500 - 1,183.73 - 550
    tot = page.locator(".st-rows .r.tot").inner_text()
    assert "Actual spare" in tot and "£1,209.57" in tot
    assert page.locator("#st-potleft").inner_text() == "£490.00"         # pot money not spent yet (400 + 90)
    assert page.locator("#st-over").count() == 0                      # no pot over


def test_one_pots_left_line_and_starting_spare_under_the_line(page, base):
    """Darren, 22 Oct: one pot line 'Pots left'; Starting spare under the line, just above Actual spare."""
    page.goto(base + DEMO)
    rows = page.locator(".st-rows .r")
    texts = [rows.nth(i).inner_text() for i in range(rows.count())]
    assert sum("Pot" in t for t in texts) == 1, texts
    assert "Pots left" in texts[-3]
    assert "Starting spare" in texts[-2] and "Actual spare" in texts[-1]
    line = page.locator(".st-rows .r.start").evaluate("e => getComputedStyle(e).borderTopWidth")
    assert line == "2px"                                              # the line sits above Starting spare
    assert page.locator(".st-rows .r.tot").evaluate("e => getComputedStyle(e).borderTopWidth") == "0px"


def test_a_pot_going_over_shows_in_the_pots_left_line(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/add"]', {"amount": "100", "name": "Shell"})   # Fuel pot 160 of 150
    assert page.locator("#st-start").inner_text() == "£766.27"
    assert page.locator("#st-over").count() == 0                      # still one pot line
    assert page.locator("#st-potleft").inner_text() == "£390.00"        # 400 left - 10 over
    assert "£10.00 over" in page.locator(".st-rows .r.pots").inner_text()
    assert page.locator("#st-spare").inner_text() == "£1,109.57"
    assert page.locator("#spare-big").inner_text() == "£1,109.57"


# ---------- 4. 📅 payday date (mock B) ----------

def test_payday_panel_has_the_payday_box_and_the_pill(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    assert page.locator("#qday").is_visible()
    assert page.locator("#qday").input_value() == "25th"
    assert page.locator("#paypill").inner_text().strip() == "📅 25 Nov · in 17 days"
    title, pill = box(page, ".q-title"), box(page, "#paypill")
    assert abs((title["y"] + title["height"] / 2) - (pill["y"] + pill["height"] / 2)) < 12   # same line
    assert pill["x"] > title["x"] + title["width"]
    assert pill["x"] + pill["width"] <= 390


def test_change_the_payday_saves_it_and_moves_the_pill(page, base):
    page.goto(base + TODAY)
    page.click("#quicktab")
    assert page.locator("#paypill").is_hidden()                        # none set yet
    page.fill("#qday", "23")
    page.press("#qday", "Tab")
    page.wait_for_timeout(200)
    assert stored(page)["payDay"] == 23
    assert "22 Nov" in page.locator("#paypill").inner_text()          # Sat 23 -> Fri 22
    page.reload()
    page.click("#quicktab")
    assert page.locator("#qday").input_value() == "23rd"


def test_a_bad_payday_is_not_saved(page, base):
    page.goto(base + TODAY)
    page.click("#quicktab")
    page.fill("#qday", "40")
    page.press("#qday", "Tab")
    page.wait_for_timeout(200)
    assert "badval" in page.get_attribute("#qday", "class")
    assert stored(page).get("payDay") is None


# ---------- 5. 🔔 reminders ----------

def test_the_bell_sits_by_settings_with_a_count_and_never_covers_the_name(page, base):
    page.goto(base + DEMO)
    bell, cog, name = box(page, "#bellbtn"), box(page, "#setbtn"), box(page, ".brand h1")
    assert bell["x"] + bell["width"] <= cog["x"] + cog["width"] + 1   # under Settings (no room beside the name)
    assert bell["y"] >= cog["y"] + cog["height"] - 1
    assert bell["x"] >= name["x"] + name["width"] or bell["y"] >= name["y"] + name["height"]   # no overlap
    assert bell["x"] + bell["width"] <= 390
    assert page.locator("#bellcount").inner_text() == "4"             # Tv Licence, the 1st (Rent + Council Tax), Bills, Energy Co (v0.37: one line per day)


def test_tap_the_bell_for_the_list_and_an_item_jumps_to_its_place(page, base):
    page.goto(base + DEMO)
    page.click("#bellbtn")
    items = page.locator("#bellmenu .remind")
    assert page.locator("#bellmenu").is_visible() and items.count() == 4
    rent = page.locator('#bellmenu .remind[data-key="Energy Co"]')
    assert "Energy Co" in rent.inner_text()
    rent.locator(".remgo").click()
    page.wait_for_timeout(800)
    assert page.locator("#bellmenu").is_hidden()
    r = box(page, 'tr.bill[data-key="Energy Co"]')
    assert 0 <= r["y"] <= 844


def test_tick_a_bill_reminder_once_checked(page, base):
    page.goto(base + TODAY)
    post(page, 'form[action="/bill/add"]', {"amount": "500", "name": "Rent"})
    bill_menu(page, "Rent", "Due day", "1")
    assert page.locator("#bellcount").inner_text() == "1"
    page.click("#bellbtn")
    with page.expect_navigation():
        page.click('#bellmenu .remind[data-key="Rent"] .remdone')
    page.wait_for_load_state()
    assert [b for b in stored(page)["bills"] if b["key"] == "Rent"][0]["paid"] is True
    assert page.locator("#bellcount").is_hidden() or page.locator("#bellcount").inner_text() in ("", "0")


def test_payday_reminder_opens_the_panel(page, base):
    page.goto(base + "?demo=1&today=2024-11-25")
    page.click("#bellbtn")
    p = page.locator('#bellmenu .remind[data-kind="payday"]')
    assert p.count() == 1
    p.locator(".remgo").click()
    page.wait_for_timeout(600)
    assert page.locator("#quick").is_visible()


def test_card_and_backup_reminders(page, base):
    page.goto(base + "?demo=1&today=2024-12-10")                     # 37 days since the last backup
    page.click("#bellbtn")
    assert page.locator('#bellmenu .remind[data-kind="backup"]').count() == 1
    page.click("#bellbtn")
    post(page, 'form[action="/bill/add"]', {"amount": "100", "name": "Zopa Credit Cards"})
    bill_menu(page, "Zopa Credit Cards", "Due day", "2")
    page.click("#bellbtn")
    assert page.locator('#bellmenu .remind[data-kind="card"]').count() == 1
    assert not page.errors


def test_nothing_waiting(page, base):
    page.goto(base + TODAY)
    page.click("#bellbtn")
    assert page.locator("#bellmenu .remind").count() == 0
    assert "Nothing" in page.locator("#bellmenu").inner_text()


# ---------- 6. 👆 tap anywhere on a card's top row to fold it ----------

def test_tap_the_heading_folds_and_opens(page, base):
    page.goto(base + DEMO)
    card = page.locator('#cards > [data-card="bills"]')
    was = "folded" in card.get_attribute("class")
    page.locator('#cards > [data-card="bills"] h2').scroll_into_view_if_needed()
    h = box(page, '#cards > [data-card="bills"] h2')
    page.mouse.click(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)   # the middle, not the arrow
    page.wait_for_timeout(500)
    assert ("folded" in card.get_attribute("class")) != was
    page.locator('#cards > [data-card="bills"] h2').scroll_into_view_if_needed()
    h = box(page, '#cards > [data-card="bills"] h2')
    page.mouse.click(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
    page.wait_for_timeout(500)
    assert ("folded" in card.get_attribute("class")) == was


def test_heading_tap_does_not_fold_while_moving(page, base):
    page.goto(base + DEMO)
    card = page.locator('#cards > [data-card="pots"]')
    was = "folded" in card.get_attribute("class")
    page.click("#setbtn"); page.click("#editbtn")
    page.locator('#cards > [data-card="pots"] h2').scroll_into_view_if_needed()
    h = box(page, '#cards > [data-card="pots"] h2')
    page.mouse.click(h["x"] + h["width"] / 2, h["y"] + h["height"] / 2)
    page.wait_for_timeout(400)
    assert ("folded" in card.get_attribute("class")) == was


# ---------- 7. 🏷 category = a pick list + ＋ New category ----------

def _cat_menu(page, key):
    page.click(f'tr.bill[data-key="{key}"] button.more')
    page.click(".bmenu [role=menuitem]:has-text('Category')")
    return page.locator(".bmenu.catmenu [role=menuitem]")


def test_category_is_a_pick_list(page, base):
    page.goto(base + DEMO)
    items = _cat_menu(page, "Gym Club").all_inner_texts()
    for want in ("Household", "Car", "Subscriptions", "Unsorted"):
        assert any(want in t for t in items), items
    assert "New category" in items[-1]
    with page.expect_navigation():
        page.click(".bmenu.catmenu [role=menuitem]:has-text('Car')")
    page.wait_for_load_state()
    assert page.locator('tr.bill[data-key="Gym Club"] .bsub').inner_text().startswith("Car")


def test_new_category_joins_the_list_for_good(page, base):
    page.goto(base + TODAY)
    post(page, 'form[action="/bill/add"]', {"amount": "20", "name": "Vet plan"})
    _cat_menu(page, "Vet plan")
    page.click(".bmenu.catmenu [role=menuitem]:has-text('New category')")
    with page.expect_navigation():
        sheet(page, "Pets")
    page.wait_for_load_state()
    s = stored(page)
    assert [b for b in s["bills"] if b["key"] == "Vet plan"][0]["cat"] == "Pets"
    assert s["cats"] == ["Pets"]
    items = _cat_menu(page, "Rent / Mortgage").all_inner_texts()
    assert any("Pets" in t for t in items)


# ---------- 8. 💾 backup in the payday panel (mock B) ----------

def test_payday_panel_backup_button_and_last_saved(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    assert "Save a backup" in page.locator("#qsave").inner_text()
    assert page.locator("#lastsaved").inner_text().strip() == "Last saved 3 Nov · 5 days ago"
    q, s = box(page, "#quick"), box(page, "#qsave")
    assert s["width"] > q["width"] * 0.7                              # the big button
    go = box(page, "#quick .q-go")
    assert s["y"] > go["y"]                                           # under Work it out


def test_saving_a_backup_remembers_the_day(page, base):
    page.goto(base + TODAY)
    page.click("#quicktab")
    assert page.locator("#lastsaved").inner_text().strip() == "Not saved yet"
    with page.expect_download():
        page.click("#qsave")
    page.wait_for_timeout(300)
    assert stored(page)["lastBackup"] == "2024-11-08"
    assert page.locator("#lastsaved").inner_text().strip() == "Last saved 8 Nov · today"
    page.reload()
    page.click("#quicktab")
    assert page.locator("#lastsaved").inner_text().strip() == "Last saved 8 Nov · today"


def test_settings_save_backup_also_remembers_the_day(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    with page.expect_download():
        page.click("#savebackup")
    page.wait_for_timeout(300)
    assert stored(page)["lastBackup"] == "2024-11-08"


# ---------- 9. ⓘ bubbles float and any tap closes them ----------

def test_info_bubble_floats_and_takes_no_space(page, base):
    page.goto(base + DEMO)
    before = box(page, '#cards > [data-card="bills"]')["height"]
    page.click('tr.bill[data-key="Rent"] button.info')
    tip = page.locator(".infotip")
    assert tip.is_visible() and "bank" in tip.inner_text().lower()
    assert tip.evaluate("e => getComputedStyle(e).position") in ("absolute", "fixed")
    assert box(page, '#cards > [data-card="bills"]')["height"] == before
    t = box(page, ".infotip")
    assert t["x"] >= 0 and t["x"] + t["width"] <= 390


def test_any_tap_closes_the_bubble(page, base):
    page.goto(base + DEMO)
    page.click('tr.bill[data-key="Rent"] button.info')
    page.click(".infotip")                                            # a tap on the bubble itself
    assert page.locator(".infotip").count() == 0
    page.click('tr.bill[data-key="Rent"] button.info')
    page.mouse.click(20, 400)                                         # anywhere else
    assert page.locator(".infotip").count() == 0
    assert not page.errors


def test_spends_and_pots_left_explain_themselves_with_info(page, base):
    """Darren, 22 Oct: no '(not in a pot)' words; an ⓘ on Spends and on Pots left says what each is."""
    page.goto(base + DEMO)
    assert "not in a pot" not in page.locator(".st-rows").inner_text()
    spends = page.locator(".st-rows .r.spends button.info")
    assert "pot" in spends.get_attribute("data-tip").lower()
    spends.click()
    assert "pot" in page.locator(".infotip").inner_text().lower()
    pots = page.locator(".st-rows .r.pots button.info")
    assert "left" in pots.get_attribute("data-tip").lower()
