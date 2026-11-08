"""v0.49 (Darren, 25 Oct). Phone width, fake data only.
1. The category pick list scrolls when it is taller than the screen (the top was cut off).
2. A spend's ⋯ has ✏️ Change amount and ✏️ Change name."""
import json

from conftest import DEMO, sheet


def stored(page):
    return json.loads(page.evaluate("sessionStorage.getItem('lite_demo_v1')"))


def spend_menu(page, name, item):
    page.click(f'[data-card="spend"] tr.drow[data-name="{name}"] button.more')
    page.click(f'.bmenu [role=menuitem]:has-text("{item}")')


def test_long_pick_list_scrolls_and_the_top_is_reachable(page, base):
    page.set_viewport_size({"width": 390, "height": 500})
    page.goto(base + DEMO)
    page.evaluate("void Sheet.pick('🏷 Test', Array.from({length: 20}, (_, i) => 'Cat ' + i), '')")
    box = page.locator(".litesheet .sheet").last
    box.wait_for(state="visible")
    page.wait_for_timeout(400)                                                  # the slide-up is done
    top = box.bounding_box()
    assert top["y"] >= 0 and top["y"] + top["height"] <= 500 + 1, top          # fits the screen
    assert box.evaluate("e => e.scrollHeight > e.clientHeight + 10")             # and scrolls inside
    assert box.evaluate("e => getComputedStyle(e).overflowY") in ("auto", "scroll")
    page.locator('.litesheet .picklist button:text-is("Cat 0")').scroll_into_view_if_needed()
    page.locator('.litesheet .picklist button:text-is("Cat 0")').click()


def test_spend_change_amount(page, base):
    page.goto(base + DEMO)
    spend_menu(page, "Costa", "Change amount")
    with page.expect_navigation():
        sheet(page, "7.25")
    page.wait_for_load_state()
    assert [x["amount"] for x in stored(page)["spends"] if x["name"] == "Costa"] == [7.25]


def test_spend_change_name(page, base):
    page.goto(base + DEMO)
    spend_menu(page, "Costa", "Change name")
    box = page.locator(".litesheet").last
    assert box.locator(".sheetin").input_value() == "Costa"
    with page.expect_navigation():
        sheet(page, "Costa Coffee")
    page.wait_for_load_state()
    names = [x["name"] for x in stored(page)["spends"]]
    assert "Costa Coffee" in names and "Costa" not in names


def test_spend_menu_order(page, base):
    page.goto(base + DEMO)
    page.click('[data-card="spend"] tr.drow[data-name="Costa"] button.more')
    items = [t.strip() for t in page.locator(".bmenu [role=menuitem]").all_inner_texts()]
    assert items[:2] == ["✏️ Change amount", "✏️ Change name"] and items[-1] == "🗑 Remove"
