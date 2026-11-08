"""v0.30 (Darren, 22 Oct): after a save the page stays where you were (no jump back to the top), for every form.
The thing you tapped (a form, a bill row, else its card) is back at the same height on the screen. Fake data only."""
from conftest import DEMO, post, bill_menu


def _top(page, sel):
    return page.evaluate("s => document.querySelector(s).getBoundingClientRect().top", sel)


def _settle(page):
    page.wait_for_function("() => document.readyState === 'complete'")
    page.wait_for_timeout(300)


def test_add_a_bill_keeps_the_add_form_where_it_was(page, base):
    page.goto(base + DEMO)
    f = 'form[action="/bill/add"]'
    page.evaluate("s => document.querySelector(s).scrollIntoView({block: 'center'})", f)
    before = _top(page, f)
    assert page.evaluate("scrollY") > 300                           # well down the page
    page.evaluate("""s => { const f = document.querySelector(s); f.elements.amount.value = '12.99'; f.elements.name.value = 'Netflix'; }""", f)
    with page.expect_navigation():
        page.click(f + " button[type=submit]")
    _settle(page)
    assert page.locator('tr.bill[data-key="Netflix"]').count() == 1
    assert abs(_top(page, f) - before) < 4


def test_add_a_spend_stays_put_too(page, base):
    page.goto(base + DEMO)
    f = 'form[action="/add"]'
    page.evaluate("window.scrollTo(0, 200)")
    before = _top(page, f)
    post(page, f, {"amount": "3", "name": "Coffee"})               # sent with no tap: the form itself is the place
    _settle(page)
    assert abs(_top(page, f) - before) < 4


def test_bill_menu_change_keeps_the_row_in_place(page, base):
    page.goto(base + DEMO)
    row = 'tr.bill[data-key="Gym Club"]'
    page.evaluate("s => document.querySelector(s).scrollIntoView({block: 'center'})", row)
    before = _top(page, row)
    bill_menu(page, "Gym Club", "Change name", "PureGym")
    _settle(page)
    assert page.locator(row + " .bbase").inner_text() == "PureGym"
    assert abs(_top(page, row) - before) < 4


def test_deleting_a_bill_keeps_you_on_the_bills_card(page, base):
    page.goto(base + DEMO)
    page.evaluate("""() => document.querySelector('tr.bill[data-key="Gym Club"]').scrollIntoView({block: 'center'})""")
    before = _top(page, '.card[data-id="bills"]')
    bill_menu(page, "Gym Club", "Delete", "")
    _settle(page)
    assert page.locator('tr.bill[data-key="Gym Club"]').count() == 0
    assert abs(_top(page, '.card[data-id="bills"]') - before) < 4


def test_a_normal_visit_still_opens_at_the_top(page, base):
    page.goto(base + DEMO)
    page.evaluate("window.scrollTo(0, 500)")
    page.goto(base + DEMO)
    _settle(page)
    assert page.evaluate("scrollY") == 0
