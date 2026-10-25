"""v0.44 (Darren, 25 Oct): the backup codes screen has a '📋 Copy all codes' button, so all 10 go into the phone's
notes in one paste. Fake data only."""
from conftest import sheet

TODAY = "?today=2024-11-08"
GRAB = "window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };"


def test_copy_all_backup_codes(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn"); page.click("#newcodes")
    sheet(page)
    page.wait_for_selector('#lock[data-step="codes"]')
    assert page.locator("#copycodes").is_visible()
    assert page.locator("#codescopied").is_hidden()
    page.evaluate(GRAB)
    page.click("#copycodes")
    page.wait_for_function("window.__copied !== null")
    codes = page.locator("#lock ul.codes li").all_inner_texts()
    text = page.evaluate("window.__copied")
    assert len(codes) == 10 and all(c in text for c in codes)
    assert "Where's My Money" in text.splitlines()[0]
    assert page.locator("#codescopied").is_visible()
    assert not page.errors


def test_copied_note_resets_for_new_codes(page, base):
    page.goto(base + TODAY)
    page.evaluate(GRAB)
    for _ in range(2):
        page.click("#setbtn"); page.click("#newcodes")
        sheet(page)
        page.wait_for_selector('#lock[data-step="codes"]')
        assert page.locator("#codescopied").is_hidden()
        page.click("#copycodes")
        page.click("#codesdone")
        page.wait_for_selector("#lock", state="hidden")
