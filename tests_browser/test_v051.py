"""v0.51 (Darren, 25 Oct): Add a spend and Bills get an All | Categories switch
(mock https://claude.ai/artifact/BgPMi2sR3uP4WiKXXzmnd7). Categories = one line per category with its total,
tap one to see what is in it; the choice is remembered on this phone."""
from conftest import DEMO

CARDS = ['[data-card="spend"]', '[data-card="bills"]']


def test_switch_starts_on_all(page, base):
    page.goto(base + DEMO)
    for c in CARDS:
        seg = page.locator(f"{c} .catseg")
        assert [t.strip() for t in seg.locator("button").all_inner_texts()] == ["All", "Categories"]
        assert seg.locator('button[data-view="all"]').get_attribute("aria-pressed") == "true"
        assert not page.locator(f"{c} .catview").is_visible()
        assert page.locator(f"{c} table").first.is_visible()


def test_categories_show_totals_and_open(page, base):
    page.goto(base + DEMO)
    for c in CARDS:
        page.click(f'{c} .catseg button[data-view="cats"]')
        view = page.locator(f"{c} .catview")
        assert view.is_visible()
        assert not page.locator(f"{c} table").first.is_visible()
        rows = view.locator("button.catrow")
        assert rows.count() >= 2
        kids = view.locator(".catkids").first
        assert not kids.is_visible()
        rows.first.click()
        assert rows.first.get_attribute("aria-expanded") == "true" and kids.is_visible()
        assert view.locator(".cattotal").is_visible()


def test_spend_totals_add_up(page, base):
    page.goto(base + DEMO)
    page.click('[data-card="spend"] .catseg button[data-view="cats"]')
    amts = page.locator('[data-card="spend"] .catview button.catrow .catamt').all_inner_texts()
    total = sum(float(a.replace("£", "").replace(",", "")) for a in amts)
    shown = float(page.locator('[data-card="spend"] .cattotal .catamt').inner_text().replace("£", "").replace(",", ""))
    assert abs(total - shown) < 0.005


def test_bills_total_matches_the_table(page, base):
    page.goto(base + DEMO)
    page.click('[data-card="bills"] .catseg button[data-view="cats"]')
    shown = page.locator('[data-card="bills"] .cattotal .catamt').inner_text()
    assert shown == page.locator("#btotal").inner_text()


def test_choice_is_remembered(page, base):
    page.goto(base + DEMO)
    page.click('[data-card="bills"] .catseg button[data-view="cats"]')
    page.reload()
    assert page.locator('[data-card="bills"] .catview').is_visible()
    assert not page.locator('[data-card="spend"] .catview').is_visible()
    page.click('[data-card="bills"] .catseg button[data-view="all"]')
    page.reload()
    assert not page.locator('[data-card="bills"] .catview').is_visible()
