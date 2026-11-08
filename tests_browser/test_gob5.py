"""Go B step 5 (PLAN.md): several credit cards + the Zopa question, in a real browser at phone width. Fake data only."""
from conftest import DEMO, stored, post, bill_menu, sheet

TODAY = "?today=2024-11-08"
CC = '#cards > [data-card="card"]'


def card_menu(page, key, item, answers=()):
    """Open a credit card's ⋯ menu and tap one item; answer the prompts / confirm it shows, in order."""
    answers = list(answers) or [True]
    page.click(f'{CC}[data-key="{key}"] .cardmore button.more')
    page.click(f'.bmenu [role=menuitem]:has-text("{item}")')
    for a in answers[:-1]:
        sheet(page, a)
    with page.expect_navigation():
        sheet(page, answers[-1])
    page.wait_for_load_state()


def add_card(page, name, limit):
    first = page.locator(CC).first.get_attribute("data-key")
    card_menu(page, first, "Add another card", [name, limit])


def test_demo_keeps_the_one_zopa_card_like_live(page, base):
    page.goto(base + DEMO)
    assert page.locator(".st-side .zcard").count() == 1
    assert page.locator(".st-side .zcard .label").text_content() == "Zopa credit card"
    assert page.locator(CC).count() == 1
    assert page.locator("#ccused").inner_text() == "£45.00"
    assert not page.errors


def test_template_has_one_card_and_you_can_add_more(page, base):
    page.goto(base + TODAY)
    assert page.locator(CC).count() == 1 and page.locator(".st-side .zcard").count() == 1
    assert page.locator(".st-side .zcard .label").text_content() == "Credit card"
    add_card(page, "Barclaycard", "1200")
    assert page.locator(CC).count() == 2
    tiles = page.locator(".st-side .zcard .label").all_text_contents()
    assert tiles == ["Credit card", "Barclaycard credit card"]                  # one top tile per card
    assert "Limit £1,200.00" in page.locator(".st-side .zcard").nth(1).inner_text()
    assert [c["name"] for c in stored(page)["cards"]] == ["Credit card", "Barclaycard"]
    assert not page.errors


def test_a_spend_goes_on_the_card_it_was_typed_in(page, base):
    page.goto(base + TODAY)
    add_card(page, "Barclaycard", "1200")
    post(page, f'{CC}[data-key="Barclaycard"] form[action="/card/add"]', {"amount": "40", "name": "Shell"})
    bc = page.locator(f'{CC}[data-key="Barclaycard"]')
    assert bc.locator("tr.drow:has-text('Shell')").count() == 1
    assert page.locator(f"{CC}").first.locator("tr.drow").count() == 0
    s = stored(page)
    assert [i["name"] for i in s["cards"][1]["items"]] == ["Shell"] and s["cards"][0]["items"] == []
    assert "£40.00" in page.locator(".st-side .zcard").nth(1).inner_text()
    # Paid off and the limit box work on that card too
    post(page, f'{CC}[data-key="Barclaycard"] form[action="/card/limit"]', {"amount": "900"})
    assert stored(page)["cards"][1]["limit"] == 900 and stored(page)["cards"][0]["limit"] == 500


def test_rename_and_remove_a_card(page, base):
    page.goto(base + TODAY)
    add_card(page, "Barclaycard", "1200")
    card_menu(page, "Barclaycard", "Change name", ["Barclays"])
    assert "Barclays credit card" in page.locator(".st-side").text_content()
    card_menu(page, "Barclaycard", "Remove card")
    assert page.locator(CC).count() == 1
    assert [c["name"] for c in stored(page)["cards"]] == ["Credit card"]


def test_no_cards_left_shows_an_add_a_card_box(page, base):
    page.goto(base + TODAY)
    card_menu(page, page.locator(CC).first.get_attribute("data-key"), "Remove card")
    assert stored(page)["cards"] == []
    assert page.locator(".st-side .zcard").count() == 0
    box = page.locator('#cards > [data-card="card"]')
    assert box.count() == 1 and box.locator('form[action="/card/new"]').count() == 1
    post(page, 'form[action="/card/new"]', {"name": "Zopa", "limit": "500"})
    assert [c["name"] for c in stored(page)["cards"]] == ["Zopa"]
    assert page.locator(".st-side .zcard .label").text_content() == "Zopa credit card"


def zopa_setup(page, base, due):
    """The first card renamed Zopa (its key stays "Credit card") and a Zopa bill of £100 with a due day.
    The person's own data, today = 8 Nov 2024 (no payday yet, so the month started 1 Nov)."""
    page.goto(base + TODAY)
    card_menu(page, page.locator(CC).first.get_attribute("data-key"), "Change name", ["Zopa"])
    post(page, 'form[action="/bill/add"]', {"amount": "100", "name": "Zopa"})
    bill_menu(page, "Zopa", "Due day", str(due))


def test_zopa_question_after_the_due_day_yes_takes_it_off_the_card(page, base):
    zopa_setup(page, base, 1)                                           # due 1 Nov, today 8 Nov: gone
    ask = page.locator(f'{CC}[data-key="Credit card"] .cardask')
    assert ask.count() == 1
    text = ask.inner_text()
    assert "Take £100.00 off the card?" in text and "Zopa" in text
    assert "pays Zopa" in page.locator('tr.bill[data-key="Zopa"] .bsub').inner_text()   # linked by its name
    with page.expect_navigation():
        ask.locator("button:has-text('Yes')").click()
    page.wait_for_load_state()
    assert page.locator(".cardask").count() == 0
    items = stored(page)["cards"][0]["items"]
    assert [(i["amount"], i["name"]) for i in items] == [(-100, "Paid off")]
    assert page.locator(f'{CC} tr.drow:has-text("Paid off")').count() == 1


def test_zopa_question_other_amount_and_no(page, base):
    zopa_setup(page, base, 1)
    page.click(".cardask button:has-text('Other amount')")
    with page.expect_navigation():
        sheet(page, "60")
    page.wait_for_load_state()
    assert [i["amount"] for i in stored(page)["cards"][0]["items"]] == [-60]
    assert page.locator(".cardask").count() == 0


def test_zopa_question_no_changes_nothing(page, base):
    zopa_setup(page, base, 1)
    with page.expect_navigation():
        page.click(".cardask button:has-text('No')")
    page.wait_for_load_state()
    assert stored(page)["cards"][0]["items"] == [] and page.locator(".cardask").count() == 0


def test_no_zopa_question_before_the_due_day(page, base):
    zopa_setup(page, base, 20)                                          # due 20 Nov: not yet
    assert page.locator(".cardask").count() == 0


def test_a_bill_can_be_told_which_card_it_pays(page, base):
    zopa_setup(page, base, 20)
    post(page, 'form[action="/bill/add"]', {"amount": "30", "name": "Card DD"})
    bill_menu(page, "Card DD", "Pays a credit card", "zopa")
    assert stored(page)["bills"][-1]["card"] == "Credit card"            # the card's key
    assert "pays Zopa" in page.locator('tr.bill[data-key="Card DD"] .bsub').inner_text()
