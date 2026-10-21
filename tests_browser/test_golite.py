"""Go A (PLAN.md steps 1-4) in a real browser at phone width: docs/ served as static files.

Run:  python3 -m pytest -q tests_browser
Needs: pytest playwright (Chromium is at /opt/pw-browsers). Fake data only.
Normal page = the person's own data in localStorage ('lite_state_v1'), starting from the template.
?demo=1 = the fake data, kept for the tab only (sessionStorage), never touches localStorage.
"""
import json

from conftest import DEMO, PIN, stored, post, bill_menu, open_scrambled


# ---------- step 1: saving + backup file ----------

def test_new_person_gets_the_template_and_it_is_saved(page, base):
    page.goto(base + "?today=2024-11-08")
    names = page.locator("tr.bill .bbase").all_inner_texts()
    assert names[:8] == ["Rent / Mortgage", "Council tax", "Gas & electric", "Water", "Phone", "Broadband",
                         "TV licence", "Car insurance"]
    assert "Costa" not in page.content()                         # no fake data for a real person
    s = stored(page)
    assert s and s["v"] == 3 and s["pay"] == 0
    assert not page.errors


def test_a_spend_is_still_there_after_closing_and_opening(page, base):
    page.goto(base + "?today=2024-11-08")
    post(page, 'form[action="/add"]', {"amount": "9.99", "name": "Greggs"})
    page.goto(base + "?today=2024-11-08")                         # like opening the app again
    assert page.locator('[data-card="spend"] tr.drow:has-text("Greggs")').count() == 1
    assert [x["name"] for x in stored(page)["spends"]] == ["Greggs"]


def test_demo_never_touches_the_real_data(page, base):
    page.goto(base + "?today=2024-11-08")
    post(page, 'form[action="/add"]', {"amount": "1", "name": "Mine"})
    page.goto(base + DEMO)
    assert page.locator('[data-card="spend"]:has-text("Costa")').count() == 1
    post(page, 'form[action="/add"]', {"amount": "2", "name": "DemoOnly"})
    assert page.locator('[data-card="spend"]:has-text("DemoOnly")').count() == 1   # the demo stays on demo
    assert [x["name"] for x in stored(page)["spends"]] == ["Mine"]
    page.goto(base + "?today=2024-11-08")
    assert page.locator('[data-card="spend"]:has-text("Mine")').count() == 1


def test_save_backup_downloads_a_file_and_load_backup_brings_it_back(page, base, tmp_path):
    page.goto(base + "?today=2024-11-08")
    post(page, 'form[action="/add"]', {"amount": "5", "name": "Before"})
    page.click("#setbtn")
    with page.expect_download() as dl:
        page.click("#savebackup")
    d = dl.value
    assert d.suggested_filename == "wheres-my-money-backup-2024-11-08.json"
    path = tmp_path / d.suggested_filename
    d.save_as(path)
    data = json.loads(path.read_text())
    assert data["app"] == "wheres-my-money-lite"                  # step 6: scrambled, opens with the passcode
    assert open_scrambled(data, PIN)["spends"][0]["name"] == "Before"

    post(page, 'form[action="/remove"]', {"id": "1"})
    assert stored(page)["spends"] == []
    page.click("#setbtn")
    page.on("dialog", lambda dlg: dlg.accept(PIN) if dlg.type == "prompt" else dlg.accept())   # passcode, then "Replace ...?"
    with page.expect_navigation():
        page.set_input_files("#loadfile", str(path))
    page.wait_for_load_state()
    assert [x["name"] for x in stored(page)["spends"]] == ["Before"]


def test_load_backup_refuses_a_wrong_file(page, base, tmp_path):
    page.goto(base + "?today=2024-11-08")
    bad = tmp_path / "bad.json"
    bad.write_text('{"hello": 1}')
    msgs = []
    page.on("dialog", lambda d: (msgs.append(d.message), d.accept()))
    page.click("#setbtn")
    page.set_input_files("#loadfile", str(bad))
    page.wait_for_timeout(500)
    assert any("backup" in m.lower() for m in msgs)
    assert stored(page)["pay"] == 0


def test_the_payday_panel_offers_a_backup_not_a_pdf_drop(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    assert page.locator("#dropbar").count() == 0
    assert page.locator("#quick #qsave").is_visible()
    assert "Save a backup" in page.locator("#quick").inner_text()   # step 10: mock B


# ---------- step 2: bills ----------

def test_add_a_bill_at_the_bottom_of_bills(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/bill/add"]', {"amount": "12.99", "name": "Netflix"})
    row = page.locator('tr.bill[data-key="Netflix"]')
    assert row.count() == 1 and "£12.99" in row.inner_text()


def test_bill_menu_has_the_agreed_items_and_no_replaces(page, base):
    page.goto(base + DEMO)
    page.click('tr.bill[data-key="Rent"] button.more')
    items = page.locator(".bmenu [role=menuitem]").all_inner_texts()
    text = " | ".join(items)
    for want in ("Change amount", "Change name", "Due day", "Stop counting", "Delete"):
        assert want in text, text
    assert "Replaces" not in text


def test_change_name_due_day_and_delete(page, base):
    page.goto(base + DEMO)
    bill_menu(page, "Gym Club", "Change name", "PureGym")
    assert page.locator('tr.bill[data-key="Gym Club"] .bbase').inner_text() == "PureGym"
    bill_menu(page, "Gym Club", "Due day", "12")
    assert "due 12th" in page.locator('tr.bill[data-key="Gym Club"] .bsub').inner_text()
    bill_menu(page, "Gym Club", "Delete", "")
    assert page.locator('tr.bill[data-key="Gym Club"]').count() == 0


def test_grey_line_shows_avg_and_due_day(page, base):
    page.goto(base + DEMO)
    sub = page.locator('tr.bill[data-key="Gym Club"] .bsub').inner_text()
    assert "avg £" in sub and "due " in sub


def test_due_day_gone_shows_info_not_a_tick_box(page, base):
    page.goto(base + DEMO)                                        # 8 Nov: Rent (due 1st) has gone
    rent = 'tr.bill[data-key="Rent"]'
    assert page.locator("input.paidbox").count() == 0             # no tick boxes at all
    page.click(f"{rent} button.info")                             # ⓘ = check your bank app
    assert "bank" in page.locator(".infotip").inner_text().lower()
    assert page.locator('tr.bill[data-key="Phone Co"] button.info').count() == 0   # not due yet


def test_bill_shows_and_changes_its_category(page, base):
    page.goto(base + DEMO)
    gym = 'tr.bill[data-key="Gym Club"]'
    assert page.locator(f"{gym} .bsub").inner_text().startswith("Subscriptions")
    page.click(f"{gym} .more")
    page.click(".bmenu [role=menuitem]:has-text('Category')")          # step 10: a pick list
    with page.expect_navigation():
        page.click(".bmenu.catmenu [role=menuitem]:has-text('Car')")
    page.wait_for_load_state()
    assert page.locator(f"{gym} .bsub").inner_text().startswith("Car")


def test_last_month_rows_have_avg_diff_and_shops(page, base):
    page.goto(base + DEMO)
    card = '[data-card="lastmonth"]'
    assert "avg £" in page.locator(f"{card} tr.lbills .bsub").inner_text()
    food = page.locator(f'{card} tr[data-id="cat:Food shopping"]')
    assert "avg £" in food.locator(".bsub").inner_text()
    assert food.locator("td.diff").inner_text().strip() != ""
    items = page.locator(f'{card} tr.item[data-cat="cat:Food shopping"]')
    assert items.count() == 2 and not items.first.is_visible()
    food.locator(".chev").click()
    assert items.first.is_visible()
    with page.expect_navigation():                                # → Bill makes it a bill
        items.first.locator("button.tobill").click()
    page.wait_for_load_state()
    assert page.locator('tr.bill[data-key="Tesco"]').count() == 1

def test_stop_counting_greys_it_and_takes_it_off_the_total(page, base):
    page.goto(base + DEMO)
    before = page.locator("#btotal").inner_text()
    bill_menu(page, "Gym Club", "Stop counting")
    row = page.locator('tr.bill[data-key="Gym Club"]')
    assert "stopped" in row.get_attribute("class")
    assert "Stopped" in row.inner_text() and row.locator("button.info").count() == 1
    assert page.locator("#btotal").inner_text() != before
    bill_menu(page, "Gym Club", "Count it again")
    assert page.locator("#btotal").inner_text() == before


# ---------- step 3: payday + history ----------

def test_new_payday_saves_the_month_and_fills_in_left(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    left = page.locator("#qleft").input_value()
    assert left and float(left) > 0                               # last month's spare, filled in
    assert "please check this each month" in page.locator("#quick").inner_text().lower()
    months = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1')).history.length")
    page.fill("#qpay", "2600")
    page.once("dialog", lambda d: d.accept())                     # "Start a new month? ..."
    with page.expect_navigation():
        page.click("#payform .q-go")
    page.wait_for_load_state()
    s = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1'))")
    assert len(s["history"]) == months + 1
    assert s["pay"] == 2600 and s["spends"] == [] and abs(s["left"] - float(left)) < 0.005
    assert "£2,600.00" in page.locator(".st-rows").inner_text()


def test_cancel_just_changes_the_pay(page, base):
    page.goto(base + DEMO)
    months = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1')).history.length")
    page.click("#quicktab")
    page.fill("#qpay", "2550")
    page.once("dialog", lambda d: d.dismiss())
    with page.expect_navigation():
        page.click("#payform .q-go")
    page.wait_for_load_state()
    s = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1'))")
    assert len(s["history"]) == months and s["pay"] == 2550 and len(s["spends"]) > 0


def test_history_cards_come_from_saved_months(page, base):
    page.goto(base + DEMO)
    for card in ("lastmonth", "cats", "periods"):
        assert page.locator(f'[data-card="{card}"]').count() == 1, card
    for gone in ("where", "subs"):
        assert page.locator(f'[data-card="{gone}"]').count() == 0, gone
    assert "Food shopping" in page.locator('[data-card="lastmonth"]').inner_text()


def test_history_cards_wait_for_the_first_payday(page, base):
    page.goto(base + "?today=2024-11-08")
    assert "first payday" in page.locator('[data-card="lastmonth"]').inner_text().lower()


# ---------- step 4: pots ----------

def test_pots_card_and_top_card(page, base):
    page.goto(base + DEMO)
    card = page.locator('[data-card="pots"]')
    assert "Monthly pots" in card.inner_text()
    assert card.locator(".pot").count() >= 3
    assert card.locator(".pot .potbar > i").count() >= 1
    rows = page.locator(".st-rows").inner_text()
    assert "− Pots" in rows and "not in a pot" in rows
    assert page.locator("#ring .seg-pot").count() == 1
    assert "Pots" in page.locator("#st-key").inner_text()


def test_add_a_pot_and_spends_fill_it(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/pot/add"]', {"amount": "60", "name": "Takeaways"})
    pot = page.locator('[data-card="pots"] .pot[data-key="Takeaways"]')
    assert "£60.00 left" in pot.inner_text()
    post(page, 'form[action="/add"]', {"amount": "70", "name": "Dominos"})
    pot = page.locator('[data-card="pots"] .pot[data-key="Takeaways"]')
    assert "£10.00 over" in pot.inner_text()


def test_change_and_delete_a_pot(page, base):
    page.goto(base + DEMO)
    page.once("dialog", lambda d: d.accept("123"))
    page.click('[data-card="pots"] .pot[data-key="Shopping"] button.more')
    with page.expect_navigation():
        page.click('.bmenu [role=menuitem]:has-text("Change amount")')
    page.wait_for_load_state()
    assert "of £123.00" in page.locator('.pot[data-key="Shopping"]').inner_text()
    page.once("dialog", lambda d: d.accept())
    page.click('[data-card="pots"] .pot[data-key="Shopping"] button.more')
    with page.expect_navigation():
        page.click('.bmenu [role=menuitem]:has-text("Delete")')
    page.wait_for_load_state()
    assert page.locator('.pot[data-key="Shopping"]').count() == 0


def test_no_script_errors_on_any_page(page, base):
    for q in ("?today=2024-11-08", DEMO):
        page.goto(base + q)
        page.wait_for_timeout(300)
    assert not page.errors, page.errors
