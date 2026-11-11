"""v0.70 (Darren, 11 Nov; mock https://claude.ai/artifact/9TV6jdTmuRTFTF5KinGxnT): Money in card under Add a spend,
bill ⋯ = wider, the paid button gives Paid / Paid on <card> / Not paid yet, and Skip this month. Phone width, fake data only."""
from conftest import DEMO, post, bill_menu


def demo_state(page):
    return page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1'))")


def test_money_in_card_sits_under_add_a_spend_folded_and_adds_to_spare(page, base):
    page.goto(base + DEMO)
    ids = page.eval_on_selector_all("#cards > .card", "els => els.map(e => e.dataset.id)")
    assert ids[ids.index("spend") + 1] == "moneyin"
    card = page.locator('[data-card="moneyin"]')
    assert "folded" in card.get_attribute("class")                      # empty = folded
    assert not page.locator(".st-rows .r.moneyin").count()               # no money in = no top line
    spare = page.locator("#st-spare").text_content()
    post(page, 'form[action="/in/add"]', {"amount": "40", "name": "Birthday money"})
    card = page.locator('[data-card="moneyin"]')
    assert "folded" not in card.get_attribute("class")
    assert "+£40.00" in card.locator("h2 .intotal").text_content()
    assert card.locator('tr.inrow:has-text("Birthday money")').count() == 1
    assert page.locator("#st-in").text_content() == "£40.00"
    to_n = lambda t: float(t.replace("£", "").replace(",", ""))
    assert abs(to_n(page.locator("#st-spare").text_content()) - to_n(spare) - 40) < 0.005
    assert not page.errors


def test_money_in_remove(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/in/add"]', {"amount": "12", "name": "Refund"})
    page.click('[data-card="moneyin"] tr.inrow button.more')
    page.click('.bmenu [role=menuitem]:has-text("Remove")')
    with page.expect_navigation():
        page.locator(".litesheet button.ok").last.click()
    page.wait_for_load_state()
    assert demo_state(page)["moneyIn"] == []


def test_money_in_bad_amount_shows_the_error_in_the_card(page, base):
    page.goto(base + DEMO)
    post(page, 'form[action="/in/add"]', {"amount": "", "name": "Mum"})
    assert page.locator('[data-card="moneyin"] .error').is_visible()


def test_bill_menu_b_one_card_goes_straight_on_and_bill_is_0_this_month(page, base):
    """v0.71 menu B: Amount | Mark paid, then 💳 Paid on credit card + ⏭ Skip this month. 1 card = no question."""
    page.goto(base + DEMO)
    total = page.locator("#btotal").text_content()
    page.click('tr.bill[data-key="Gym Club"] button.more')
    m = page.locator(".bmenu")
    assert m.bounding_box()["width"] >= 288
    assert m.locator('.brow button:text-is("Mark paid")').bounding_box()["height"] < 60
    assert m.locator(".bsep").count() == 1
    with page.expect_navigation():
        m.locator('button:has-text("Paid on credit card")').click()
    page.wait_for_load_state()
    row = page.locator('tr.bill[data-key="Gym Club"]')
    assert row.get_attribute("data-oncard") == "Zopa"
    assert "Paid on Zopa" in row.locator(".bchip.oncard").text_content()
    assert "paid" in row.locator(".bline").get_attribute("class")
    assert row.locator(".bwas").text_content() == "£50.00"               # crossed out, £0 this month
    assert "£0.00" in row.locator("td.bamt button.link").text_content()
    to_n = lambda t: float(t.replace("£", "").replace(",", ""))
    assert abs(to_n(total) - to_n(page.locator("#btotal").text_content()) - 50) < 0.005
    card = [c for c in demo_state(page)["cards"] if c["key"] == "Zopa"][0]
    assert any(i["name"] == "Gym Club" and i["amount"] == 50 for i in card["items"])
    # undo: Not paid yet takes it off the card
    page.click('tr.bill[data-key="Gym Club"] button.more')
    with page.expect_navigation():
        page.click('.bmenu .brow button:text-is("Not paid yet")')
    page.wait_for_load_state()
    assert page.locator('tr.bill[data-key="Gym Club"]').get_attribute("data-oncard") == ""
    assert page.locator("#btotal").text_content() == total
    card = [c for c in demo_state(page)["cards"] if c["key"] == "Zopa"][0]
    assert not any(i["name"] == "Gym Club" for i in card["items"])
    assert not page.errors


def test_two_cards_asks_which_card_with_used_and_after(page, base):
    page.goto(base + DEMO)
    page.evaluate("""() => { const s = JSON.parse(sessionStorage.getItem('lite_demo_v1'));
        Money.addCreditCard(s, 'Amex', '1000'); sessionStorage.setItem('lite_demo_v1', JSON.stringify(s)); }""")
    page.reload()
    page.click('tr.bill[data-key="Gym Club"] button.more')
    page.click('.bmenu button:has-text("Paid on credit card")')
    box = page.locator(".litesheet").last
    box.wait_for(state="visible")
    assert "which card?" in box.locator("h3").text_content()
    opts = box.locator(".cardopt")
    assert opts.count() == 2
    amex = box.locator('.cardopt:has-text("Amex")')
    assert "£0 used" in amex.text_content() and "→ £50 used" in amex.text_content()
    with page.expect_navigation():
        amex.click()
    page.wait_for_load_state()
    row = page.locator('tr.bill[data-key="Gym Club"]')
    assert "Paid on Amex" in row.locator(".bchip.oncard").text_content()
    assert not page.errors


def test_skip_this_month_and_count_it_again(page, base):
    page.goto(base + DEMO)
    total = page.locator("#btotal").text_content()
    bill_menu(page, "Gym Club", "Skip this month")
    row = page.locator('tr.bill[data-key="Gym Club"]')
    assert row.get_attribute("data-skip") == "1"
    assert "back next month" in row.locator(".bchip.skip").text_content()
    assert row.locator(".bwas").text_content() == "£50.00"
    to_n = lambda t: float(t.replace("£", "").replace(",", ""))
    assert abs(to_n(total) - to_n(page.locator("#btotal").text_content()) - 50) < 0.005
    bill_menu(page, "Gym Club", "Count it this month")
    assert page.locator('tr.bill[data-key="Gym Club"]').get_attribute("data-skip") == "0"
    assert page.locator("#btotal").text_content() == total
    assert not page.errors
