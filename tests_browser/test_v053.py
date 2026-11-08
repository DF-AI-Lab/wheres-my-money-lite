"""v0.53 (Darren, 25 Oct, mock https://claude.ai/artifact/WaG2BrPssY63gawGKpx83j): an ⓘ on Spare cash left
('a guide, check your bank') that floats (never pushes the card), and 'Pots over' + its amount in red with a minus,
the dot stays orange, the ⓘ stays on the same line."""
from conftest import DEMO, post

TIP_ROW = ".st-rows .r.pots"


def _all_pots_tiny(page):
    page.evaluate("""() => { const k = 'lite_demo_v1'; const s = JSON.parse(sessionStorage.getItem(k));
        s.pots.forEach(p => { if (p.amount) p.amount = 1; }); sessionStorage.setItem(k, JSON.stringify(s)); }""")
    page.reload()


def test_spare_info_floats_over_the_card(page, base):
    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(base + DEMO)
    btn = page.locator(".st-head .label button.info")
    tip = btn.get_attribute("data-tip")
    assert "guide" in tip and "bank" in tip
    card = page.locator(".card.st-sum")
    h = card.bounding_box()["height"]
    btn.click()
    note = page.locator(".infotip")
    assert note.is_visible() and "bank" in note.inner_text()
    assert note.evaluate("e => getComputedStyle(e).position") == "absolute"
    assert abs(card.bounding_box()["height"] - h) < 1                 # nothing pushed
    btn.click()
    assert page.locator(".infotip").count() == 0


def test_pots_over_is_red_with_a_minus(page, base):
    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(base + DEMO)
    row = page.locator(TIP_ROW)
    dot = row.locator(".dot.pot").evaluate("e => getComputedStyle(e).backgroundColor")
    plain = row.locator(".potword").evaluate("e => getComputedStyle(e).color")
    plain_h = page.locator(".st-rows .r.spends").bounding_box()["height"]
    _all_pots_tiny(page)
    row = page.locator(TIP_ROW)
    assert "over" in row.get_attribute("class")
    assert row.locator(".potword").inner_text() == "Pots over"
    amt = page.locator("#st-potleft")
    assert amt.inner_text().startswith("−£")
    red = row.locator(".potword").evaluate("e => getComputedStyle(e).color")
    assert red != plain and amt.evaluate("e => getComputedStyle(e).color") == red
    assert row.locator(".dot.pot").evaluate("e => getComputedStyle(e).backgroundColor") == dot   # dot stays orange
    assert row.locator(".labels").count() == 0                        # no extra '(£X over)' line
    assert row.bounding_box()["height"] <= plain_h + 2                # ⓘ on the same line


def test_pots_left_with_one_over_stays_one_line(page, base):
    page.set_viewport_size({"width": 390, "height": 800})
    page.goto(base + DEMO)
    post(page, 'form[action="/add"]', {"amount": "100", "name": "Shell"})   # Fuel pot 160 of 150
    row = page.locator(TIP_ROW)
    assert "£10.00 over" in row.inner_text() and "over" not in (row.get_attribute("class") or "").split()
    assert page.locator("#st-potleft").inner_text() == "£390.00"
    plain_h = page.locator(".st-rows .r.spends").bounding_box()["height"]
    assert row.bounding_box()["height"] <= plain_h + 2
