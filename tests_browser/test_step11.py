"""Darren's 21 Oct evening feedback (v0.16): green Paid ⓘ, the bell list scrolls + Clear all, bills paid from a pot.
Phone width, fake data only."""
from conftest import DEMO, stored, post, bill_menu

TODAY = "?today=2024-11-08"


def test_due_bill_shows_green_paid_then_info(page, base):
    page.goto(base + DEMO)                                            # 8 Nov: Rent (due 1st) has gone
    sub = page.locator('tr.bill[data-key="Rent"] .bsub')
    paid = sub.locator(".bpaid")
    assert paid.inner_text().strip() == "Paid"
    green = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--good').trim()")
    color = paid.evaluate("e => getComputedStyle(e).color")
    probe = page.evaluate("c => { const d = document.createElement('i'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; }", green)
    assert color == probe                                             # the live green
    order = sub.evaluate("e => [...e.querySelectorAll('.bpaid, button.info')].map(x => x.className.includes('bpaid') ? 'paid' : 'info')")
    assert order == ["paid", "info"]                                  # Paid, then ⓘ
    assert page.locator('tr.bill[data-key="Phone Co"] .bpaid').count() == 0   # not due yet
    assert page.locator("input.paidbox").count() == 0


def test_the_bell_list_scrolls(page, base):
    page.goto(base + TODAY)
    for i in range(14):
        post(page, 'form[action="/bill/add"]', {"amount": "10", "name": f"Bill {i}"})
        bill_menu(page, f"Bill {i}", "Due day", "1")
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
    assert page.locator("#bellcount").inner_text() == "5"
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
