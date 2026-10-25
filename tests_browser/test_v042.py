"""v0.42 (Darren, 25 Oct, mock B + A's grey lines): the Settings menu says where things go.
Headings 'On this phone' (Save / Load backup), 'Cloud' (Google Drive: On + the Gmail, or Off), 'Lock' (Set up fingerprint
/ Fingerprint on, backup codes, Lock now); a small grey line under each; Install at the bottom. Fake data only."""
import json

from conftest import _context, _page
from test_livedemo import site  # noqa: F401  (the whole docs/ site: live at /, demo at /demo/)

TODAY = "?today=2024-11-08"


def menu(page, base):
    page.goto(base + TODAY)
    page.click("#setbtn")
    return page.locator("#setmenu")


def visible_heads(m):
    return [h.text_content().strip() for h in m.locator(".sethead").all() if h.is_visible()]


def test_headings_and_grey_lines(page, base):
    m = menu(page, base)
    assert visible_heads(m) == ["Account", "On this phone", "Cloud", "Lock"]   # v0.43: Account first
    assert "this phone" in m.locator("#savebackup .sub").inner_text()
    assert "this phone" in m.locator("#loadbackup .sub").inner_text()
    assert m.locator("#newcodes .sub").inner_text().strip()
    order = page.evaluate("""() => ['savebackup', 'loadbackup', 'drivelink', 'fingerprint', 'newcodes', 'locknow', 'installbtn']
        .map(id => document.getElementById(id)).map((el, i, all) => i === 0 ||
        !!(all[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))""")
    assert all(order), order
    assert not page.errors


def test_drive_line_off_then_on_with_the_gmail(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    m = menu(pg, base)
    assert "Off" in m.locator("#drivelink .sub").inner_text()
    ctx.add_init_script("localStorage.setItem('lite_drive_on', '1'); localStorage.setItem('lite_drive_email', 'fake.person@example.com');")
    m = menu(pg, base)
    sub = m.locator("#drivelink .sub").inner_text()
    assert "On" in sub and "fake.person@example.com" in sub, sub
    assert "backup" in m.locator("#drivelink").inner_text().lower()
    ctx.close()


def test_fingerprint_says_set_up_then_on(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    m = menu(pg, base)
    assert "Set up fingerprint" in m.locator("#fingerprint").inner_text()
    ctx.add_init_script("""try { const r = JSON.parse(localStorage.getItem('lite_lock_v1'));
        r.passkeys = [{id: 'AAAA', at: '2024-11-01T00:00:00Z'}]; localStorage.setItem('lite_lock_v1', JSON.stringify(r)); } catch (e) {}""")
    m = menu(pg, base)
    text = m.locator("#fingerprint").inner_text()
    assert "Set up" not in text and "Fingerprint" in text and "On" in text, text
    ctx.close()


def test_demo_has_no_lock_heading(browser, site):  # noqa: F811
    ctx = _context(browser, seed_lock=False, unlocked=False)
    pg = _page(ctx)
    m = menu(pg, site + "demo/")
    heads = visible_heads(m)
    assert "Lock" not in heads and "On this phone" in heads, heads
    assert not pg.errors
    ctx.close()
