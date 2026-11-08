"""v0.50 (Darren, 25 Oct): bill ⋯ = mock B (https://claude.ai/artifact/DD2QGgR38yKwvGBS95FmT8).
Top: two big buttons Amount + Mark paid; then Change name / Due day / Category / Pays a credit card; bottom: Pause + Delete."""
from conftest import DEMO


def open_menu(page, base, key="Phone Co"):
    page.goto(base + DEMO)
    page.click(f'tr.bill[data-key="{key}"] button.more')
    return page.locator(".bmenu")


def test_bill_menu_layout(page, base):
    m = open_menu(page, base)
    top = m.locator(".brow").first.locator("button")
    assert [t.strip() for t in top.all_inner_texts()] == ["Amount", "Mark paid"]
    assert "pri" in top.nth(1).get_attribute("class")
    mid = [t.strip() for t in m.locator(":scope > button").all_inner_texts()]
    assert mid == ["Change name", "Due day", "Category", "Pays a credit card"]
    bottom = m.locator(".brow").last.locator("button")
    assert [t.strip() for t in bottom.all_inner_texts()] == ["Pause", "Delete"]
    assert "stop" in bottom.nth(1).get_attribute("class")
    # every button is still a menu item (one Tab order, keyboard works)
    assert m.locator("[role=menuitem]").count() == 8


def test_amount_opens_the_amount_box(page, base):
    m = open_menu(page, base)
    m.locator('.brow button:text-is("Amount")').click()
    box = page.locator('tr.bill[data-key="Phone Co"] input.billbox')
    assert box.is_visible() and box.evaluate("e => e === document.activeElement")
    assert page.locator(".bmenu").count() == 0


def test_mark_paid_then_not_paid(page, base):
    m = open_menu(page, base)
    with page.expect_navigation():
        m.locator('.brow button:text-is("Mark paid")').click()
    page.wait_for_load_state()
    page.click('tr.bill[data-key="Phone Co"] button.more')
    assert page.locator('.bmenu .brow button').first.inner_text().strip() == "Amount"
    assert page.locator('.bmenu .brow button').nth(1).inner_text().strip() == "Not paid yet"


def test_pot_category_link_and_takes_line(page, base):
    """Darren: a 'takeaway' pot did not take the 'Takeaways' spends. ⋯ → 🏷 Category it takes links one."""
    page.goto(base + DEMO)
    pot = page.locator('[data-card="pots"] .pot[data-key="Going out"]')
    pot.locator("button.more").click()
    page.click('.bmenu [role=menuitem]:has-text("Category it takes")')
    box = page.locator(".litesheet").last
    with page.expect_navigation():
        box.locator('.picklist button:text-is("Takeaways")').click()
    page.wait_for_load_state()
    pot = page.locator('[data-card="pots"] .pot[data-key="Going out"]')
    assert pot.get_attribute("data-cat") == "Takeaways"
    assert "takes Takeaways" in pot.inner_text()


def test_bill_category_dropdown_scrolls(page, base):
    page.set_viewport_size({"width": 390, "height": 560})
    page.goto(base + DEMO)
    page.click('tr.bill[data-key="Gym Club"] button.more')
    page.click(".bmenu [role=menuitem]:has-text('Category')")
    m = page.locator(".bmenu.catmenu")
    assert m.evaluate("e => getComputedStyle(e).overflowY") == "auto"
