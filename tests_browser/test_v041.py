"""v0.41 (Darren, 24 Oct): after '+ category' the page flickered: it showed the top until 'load' (Google fonts, the
Google sign-in script), then jumped back. Now it goes back as soon as the cards are drawn, hidden until then."""
from conftest import post

TODAY = "?today=2024-11-08"


def test_back_in_place_before_load_and_shown(page, base):
    page.goto(base + TODAY)
    post(page, 'form[action="/bill/add"]', {"amount": "12", "name": "Zeta Test"})
    row = page.locator('.dbills tr.bill[data-key="Zeta Test"]')
    row.scroll_into_view_if_needed()
    page.evaluate("scrollBy(0, -150)")
    top = row.evaluate("r => r.getBoundingClientRect().top")
    page.route("**/lite-192.png", lambda r: (page.wait_for_timeout(1000), r.continue_()))   # a slow image holds back 'load'
    page.add_init_script("""document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
        window.__early = document.querySelector('.dbills tr.bill[data-key="Zeta Test"]').getBoundingClientRect().top; }, 50));""")
    row.locator('.addlink[data-add="cat"]').click()
    with page.expect_navigation():
        page.locator(".sheetback .picklist button[data-v]").first.click()
    page.wait_for_load_state("domcontentloaded")
    assert abs(page.evaluate("window.__early") - top) < 3                 # in place before the slow image loaded
    page.wait_for_load_state("load")
    assert page.locator(".demohead").evaluate("e => getComputedStyle(e).visibility") == "visible"
    assert abs(row.evaluate("r => r.getBoundingClientRect().top") - top) < 3
