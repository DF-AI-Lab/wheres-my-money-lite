"""Shared fixtures and helpers for the browser tests (docs/ served as static files, phone width, fake data)."""
import base64
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from playwright.sync_api import sync_playwright

DOCS = Path(__file__).resolve().parent.parent / "docs" / "demo"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
DEMO = "?demo=1&today=2024-11-08"


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def base():
    port = _free_port()
    p = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"], cwd=DOCS,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                break
        time.sleep(0.1)
    yield f"http://127.0.0.1:{port}/index.html"
    p.terminate()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=CHROME)
        yield b
        b.close()


# ---------- the lock (step 6), made the same way docs/lock.js makes it, so tests can start unlocked ----------
PIN = "135790"
CODES = ["abcd-2345", "efgh-6789", "jkmn-pqrs", "tuvw-xyz2", "a2b3-c4d5", "e6f7-g8h9", "jjkk-mmnn", "pppq-qqrr",
         "ssst-ttuu", "vvvw-wwxx"]
ITER = 100_000
b64 = lambda b: base64.b64encode(b).decode()
unb64 = base64.b64decode


def secret_of(text):
    """A passcode is used as typed; a backup code without case, spaces or dashes ('ABCD 2345' = 'abcd2345')."""
    t = "".join(ch for ch in text.lower() if ch.isalnum())
    return t


def _key(secret, salt, iterations=ITER):
    return PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations).derive(secret.encode())


def _wrap(secret, mb):
    salt, iv = os.urandom(16), os.urandom(12)
    return {"salt": b64(salt), "iv": b64(iv), "ct": b64(AESGCM(_key(secret, salt)).encrypt(iv, mb, None))}


def make_lock(pin=PIN, codes=CODES):
    """localStorage 'lite_lock_v1': a random master key (mb) wrapped by the passcode and by each backup code."""
    mb = os.urandom(32)
    return {"v": 1, "iter": ITER, "mb": b64(mb), "pin": _wrap(pin, mb),
            "codes": [dict(_wrap(secret_of(c), mb), used=False) for c in codes], "passkeys": [],
            "fails": {"count": 0, "until": 0}}


def open_scrambled(file, secret):
    """Open a scrambled backup file with a passcode or a backup code (None when it does not open)."""
    sc = file["scrambled"]
    for k in sc["keys"]:
        s = secret if k["kind"] == "pin" else secret_of(secret)
        try:
            mb = AESGCM(_key(s, unb64(k["salt"]), sc["iter"])).decrypt(unb64(k["iv"]), unb64(k["ct"]), None)
        except Exception:
            continue
        return json.loads(AESGCM(mb).decrypt(unb64(sc["iv"]), unb64(sc["data"]), None))
    return None


LOCK = make_lock()


def _context(browser, seed_lock=True, unlocked=True):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
    script = ""
    if seed_lock:
        script += "if (!localStorage.getItem('lite_lock_v1')) localStorage.setItem('lite_lock_v1', %s);" % json.dumps(json.dumps(LOCK))
    if unlocked:
        script += "sessionStorage.setItem('lite_unlock', String(Date.now()));"
    if script:
        ctx.add_init_script("try { %s } catch (e) {}" % script)
    return ctx


def _page(ctx):
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.errors = errors
    return pg


@pytest.fixture
def page(browser):
    """A person who has set up the lock (passcode PIN, backup codes CODES) and is unlocked in this tab."""
    ctx = _context(browser)
    yield _page(ctx)
    ctx.close()


@pytest.fixture
def locked(browser):
    """The same person opening the app: the lock is set up, this tab is not unlocked yet."""
    ctx = _context(browser, unlocked=False)
    yield _page(ctx)
    ctx.close()


@pytest.fixture
def fresh(browser):
    """A brand new person: nothing saved at all."""
    ctx = _context(browser, seed_lock=False, unlocked=False)
    yield _page(ctx)
    ctx.close()


def stored(page):
    raw = page.evaluate("localStorage.getItem('lite_state_v1')")
    return json.loads(raw) if raw else None


def post(page, selector, fields, button=None):
    """Fill a form (shown or hidden boxes) and send it the way a tap would."""
    page.evaluate("""([sel, fields]) => { const f = document.querySelector(sel);
        for (const [k, v] of Object.entries(fields)) f.elements[k].value = v; }""", [selector, fields])
    with page.expect_navigation():
        if button:
            page.click(f"{selector} {button}")
        else:
            page.evaluate("sel => document.querySelector(sel).requestSubmit()", selector)
    page.wait_for_load_state()


def sheet(page, answer=True):
    """Answer the slide-up sheet (docs/sheet.js): True = the main button, a text = type it then Save, None/False = Cancel."""
    box = page.locator(".litesheet").last
    box.wait_for(state="visible")
    if answer is None or answer is False:
        box.locator("button.cancel").click()
        return
    if isinstance(answer, str) and box.locator(".sheetin").count():
        box.locator(".sheetin").fill(answer)
    box.locator("button.ok").click()


def bill_menu(page, key, item, dialog_answer=None):
    """Open a bill's ⋯ menu and tap one item; answer the sheet it shows (a text, or True for yes)."""
    page.click(f'tr.bill[data-key="{key}"] button.more')
    if dialog_answer is None:
        with page.expect_navigation():
            page.click(f'.bmenu [role=menuitem]:has-text("{item}")')
    else:
        page.click(f'.bmenu [role=menuitem]:has-text("{item}")')
        with page.expect_navigation():
            sheet(page, dialog_answer)
    page.wait_for_load_state()


