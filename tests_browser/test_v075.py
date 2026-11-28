"""v0.75 (Darren, 28 Nov): changing Pay or Left keeps 'This month' open; it shuts only by hand or on a new month."""
from conftest import DEMO


def _edit(page, btn, value, ok):
    page.click(btn)
    page.locator(".litesheet input").last.fill(value)
    with page.expect_navigation():
        page.locator(ok).last.click()
    page.wait_for_load_state()


def test_pay_edits_keep_the_box_open_again_and_again(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    _edit(page, "#nmpayedit", "2700", ".litesheet button.ok")
    assert page.locator("#quick").is_visible()
    assert page.locator("#quicktab").get_attribute("aria-expanded") == "true"
    _edit(page, "#nmleftedit", "12.34", ".litesheet button.pri")   # no reopening needed
    assert page.locator("#quick").is_visible()
    assert page.locator("#nm-pay").inner_text().strip() == "£2,700.00"
    page.click("#quicktab")                                          # shut by hand
    page.wait_for_timeout(500)
    assert page.locator("#quick").is_hidden()
    page.reload()
    assert page.locator("#quick").is_hidden()                        # a plain reload starts shut
    assert not page.errors


def test_a_new_month_shuts_the_box(page, base):
    page.goto(base + DEMO)
    page.click("#quicktab")
    page.click("#nmstart")
    page.fill("#qpay", "2600")
    page.locator("#payform button[type=submit]").click()
    with page.expect_navigation():
        page.locator("#newmonth .pri").click()
    page.wait_for_load_state()
    assert page.locator("#quick").is_hidden()
    assert not page.errors
