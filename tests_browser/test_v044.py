"""v0.44 (Darren, 25 Oct): the backup codes screen copies all 10 codes in one paste. v0.61 (on purpose): the codes are
🛂 Passport's now (Settings → Passport → Make new backup codes; Passport's own 'Copy' button). Fake data only."""
from conftest import PIN
from test_gob6 import step

TODAY = "?today=2024-11-08"
GRAB = "window.__copied = null; navigator.clipboard.writeText = t => { window.__copied = t; return Promise.resolve(); };"


def test_copy_all_backup_codes(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn"); page.click("#passportbtn")
    step(page, "Make new backup codes")
    page.click("#passport #nb")
    page.fill("#passport #pc", PIN)
    page.click("#passport #go")
    page.wait_for_selector("#passport .ps-codes")
    page.evaluate(GRAB)
    page.click("#passport #cp")
    page.wait_for_function("window.__copied !== null")
    codes = page.locator("#passport .ps-codes code").all_inner_texts()
    text = page.evaluate("window.__copied")
    assert len(codes) == 10 and all(c in text for c in codes)
    assert "backup codes" in text.splitlines()[0]
    assert "Copied" in page.locator("#passport #cp").inner_text()
    assert not page.errors
