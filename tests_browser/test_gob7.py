"""Go B step 7 (PLAN.md): Move & rename, 🔄 Update, 💡 Ideas & feedback, 📱 Invite (QR code). Phone width, fake data."""
import json

from conftest import DEMO, stored, post, sheet

TODAY = "?today=2024-11-08"
LINK = "https://df-ai-lab.github.io/wheres-my-money-lite/"


def card_ids(page):
    return page.eval_on_selector_all("#cards > .card[data-id]", "els => els.map(e => e.dataset.id)")


# ---------- ✏️ Move & rename ----------

def test_move_a_card_with_the_arrow_keys_and_it_stays_moved(page, base):
    page.goto(base + TODAY)
    before = card_ids(page)
    page.click("#setbtn")
    page.click("#editbtn")
    assert page.evaluate("document.body.classList.contains('editing')")
    page.click('#cards > .card[data-id="pots"] h2 .handle')
    page.keyboard.press("ArrowUp")
    page.wait_for_timeout(200)
    moved = card_ids(page)
    assert moved.index("pots") == before.index("pots") - 1
    assert stored(page)["layout"]["cards"] == moved
    page.reload()
    assert card_ids(page) == moved                                    # kept for good
    assert not page.errors


def test_put_the_order_back(page, base):
    page.goto(base + TODAY)
    before = card_ids(page)
    page.click("#setbtn"); page.click("#editbtn")
    page.click('#cards > .card[data-id="pots"] h2 .handle')
    page.keyboard.press("ArrowUp")
    page.wait_for_timeout(200)
    page.click("#editreset")                       # v0.46: Reset lives in the editing pill, asks first
    with page.expect_navigation():
        sheet(page)
    page.wait_for_load_state()
    assert card_ids(page) == before
    assert "layout" not in stored(page)


def test_bill_rows_keep_a_moved_order(page, base):
    page.goto(base + DEMO)
    keys = page.eval_on_selector_all("tr.bill", "els => els.map(e => e.dataset.key)")
    page.click("#setbtn"); page.click("#editbtn")
    page.click(f'tr.bill[data-key="{keys[1]}"] .handle')
    page.keyboard.press("ArrowUp")
    page.wait_for_timeout(200)
    page.reload()
    now = page.eval_on_selector_all("tr.bill", "els => els.map(e => e.dataset.key)")
    assert now[:2] == [keys[1], keys[0]]


def test_rename_a_bill_by_clicking_its_name_while_editing(page, base):
    page.goto(base + DEMO)
    page.click("#setbtn"); page.click("#editbtn")
    name = page.locator('tr.bill[data-key="Rent"] .rname')
    assert name.is_visible()
    name.click()
    page.keyboard.press("Control+A")
    page.keyboard.type("Flat rent")
    page.keyboard.press("Enter")
    page.wait_for_timeout(200)
    s = page.evaluate("JSON.parse(sessionStorage.getItem('lite_demo_v1'))")
    assert next(b for b in s["bills"] if b["key"] == "Rent")["name"] == "Flat rent"


# ---------- 🔄 Update ----------

def _version(page):
    return page.locator(".appver").inner_text().lstrip("v")


def test_settings_has_no_update_button_now(page, base):
    """Darren, 22 Oct (v0.28): the ✨ band on the bottom edge does updates, so Settings has no 🔄 Update."""
    page.goto(base + TODAY)
    page.click("#setbtn")
    assert page.locator("#updbtn").count() == 0
    assert "Update" not in page.locator("#setmenu").inner_text()


def test_version_json_matches_the_page(page, base):
    page.goto(base + TODAY)
    v = page.evaluate("fetch('version.json', {cache: 'no-store'}).then(r => r.json()).then(j => j.version)")
    assert v == _version(page)


# ---------- 💡 Ideas & feedback ----------

def test_ideas_add_done_copy_and_delete(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    with page.expect_navigation():
        page.click("#setmenu a:has-text('Ideas')")
    page.wait_for_load_state()
    assert page.locator("#ideas").is_visible() and page.locator("#cards").is_hidden()
    assert "Ideas & feedback" in page.locator("#ideas h1").inner_text()
    post(page, '#ideas form.new', {"text": "Show pots first"})
    page.click('#ideas label[for="tag-odd"]')
    page.fill("#ideas textarea[name=text]", "Odd sum on payday")
    with page.expect_navigation():
        page.click("#ideas form.new button.go")
    page.wait_for_load_state()
    notes = page.locator("#ideas .note .txt").all_inner_texts()
    assert len(notes) == 2 and "Odd sum on payday" in notes[0]       # newest first, like live
    assert "Something odd" in notes[0]
    assert [(n["text"], n["tag"]) for n in stored(page)["ideas"]] == [("Show pots first", "idea"), ("Odd sum on payday", "odd")]
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.click("#copybtn")
    page.wait_for_selector("#copied:not([hidden])")
    text = page.evaluate("navigator.clipboard.readText()")
    assert text.startswith("Where's My Money? Lite ideas & feedback (v") and "- 💡 Idea" in text
    with page.expect_navigation():
        page.locator('#ideas .note:has-text("Show pots first") button:has-text("Done")').click()
    page.wait_for_load_state()
    assert stored(page)["ideas"][0]["done"] is True
    page.locator('#ideas .note:has-text("Odd sum") button[aria-label="Delete"]').click()
    with page.expect_navigation():
        sheet(page)
    page.wait_for_load_state()
    assert [n["text"] for n in stored(page)["ideas"]] == ["Show pots first"]
    with page.expect_navigation():
        page.click("#ideas a.back")
    page.wait_for_load_state()
    assert page.locator("#cards").is_visible() and page.locator("#ideas").is_hidden()
    assert not page.errors


# ---------- 📱 Invite ----------

def test_invite_shows_a_qr_code_of_the_lite_link_only(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    with page.expect_navigation():
        page.click("#setmenu a:has-text('Invite')")
    page.wait_for_load_state()
    box = page.locator("#invite")
    assert box.is_visible() and page.locator("#cards").is_hidden()
    img = box.locator("img.qr")
    assert img.count() == 1 and img.get_attribute("src") == "invite-qr.svg"
    assert page.evaluate("document.querySelector('#invite img.qr').naturalWidth") > 0
    assert LINK in box.inner_text()
    assert box.locator("#sharebtn").count() == 1 and box.locator("#copylink").count() == 1
    assert "never" in box.inner_text().lower()                         # holds the link only, never any data
    page.context.grant_permissions(["clipboard-read", "clipboard-write"])
    page.evaluate("navigator.share = undefined")
    page.click("#sharebtn")                                            # no share sheet: copies the link instead
    page.wait_for_timeout(200)
    assert page.evaluate("navigator.clipboard.readText()") == LINK


def test_the_qr_file_holds_the_link(base):
    from pathlib import Path
    svg = (Path(__file__).resolve().parent.parent / "docs" / "demo" / "invite-qr.svg").read_text()
    assert svg.lstrip().startswith("<?xml") or svg.lstrip().startswith("<svg")
    assert "wheres-my-money-lite" in svg                                # the link is written in the file's title too


def test_settings_menu_has_the_step_7_items(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    text = page.locator("#setmenu").inner_text()
    for want in ("Move & rename", "Ideas & feedback", "Invite", "Cards open at once"):
        assert want in text, text
