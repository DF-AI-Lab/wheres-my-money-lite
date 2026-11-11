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
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
from playwright.sync_api import sync_playwright

DOCS = Path(__file__).resolve().parent.parent / "docs" / "demo"
CHROME = os.environ.get("LITE_CHROME", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
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
    """Open a scrambled backup file with a passcode or a backup code (None when it does not open).
    v0.61: a v2 file (Passport) opens with the passport passcode (PIN) only: the tests know its hidden key MK."""
    sc = file["scrambled"]
    if sc.get("v") == 2:
        return open_v2(sc) if secret == PIN else None
    for k in sc["keys"]:
        s = secret if k["kind"] == "pin" else secret_of(secret)
        try:
            mb = AESGCM(_key(s, unb64(k["salt"]), sc["iter"])).decrypt(unb64(k["iv"]), unb64(k["ct"]), None)
        except Exception:
            continue
        return json.loads(AESGCM(mb).decrypt(unb64(sc["iv"]), unb64(sc["data"]), None))
    return None


LOCK = make_lock()


# ---------- v0.61 🛂 Passport ID = the lock (docs/demo/passport/, made the same way passport.js makes it) ----------
PP_EMAIL = "fake.person@example.com"          # = test_v040 EMAIL: the passport's Google account is the Drive account
PP_ID = "DF123456"
PP_NAME = "Sam Test"
PP_CODES = ["1111-2345", "2222-3456", "3333-4567", "4444-5678", "5555-6789", "6666-7890", "7777-8901", "8888-9012",
            "9999-0123", "1212-3434"]
MK = os.urandom(32)                           # the passport's hidden key (Passport.key(email)) in these tests


def _pp_box(secret, mk):
    salt, iv = os.urandom(16), os.urandom(12)
    return {"salt": b64(salt), "iv": b64(iv), "ct": b64(AESGCM(_key(secret, salt)).encrypt(iv, mk, None))}


def make_passport(email=PP_EMAIL, pin=PIN, mk=None, pid=PP_ID, name=PP_NAME):
    """One passport record (passport.js v2): the hidden key locked by the passcode and by each backup code."""
    mk = mk or MK
    return {"v": 2, "id": pid, "name": name, "email": email, "pass": _pp_box("pass:" + pin, mk),
            "backup": [dict(_pp_box("backup:" + c.replace("-", ""), mk), used=False) for c in PP_CODES],
            "fails": 0, "lockUntil": 0, "fingerprints": {}, "created": "2024-11-01T09:00:00.000Z",
            "updated": 1, "dirty": False, "fileId": "pp1", "folderId": "dfdir"}


def wk(mk=None):
    """WMM's own AES key from the hidden key (wmmkey.js: HKDF-SHA256, salt 'wmm-lite', info 'backups')."""
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=b"wmm-lite", info=b"backups").derive(mk or MK)


def _b64u(n):
    return base64.urlsafe_b64encode(n.to_bytes((n.bit_length() + 7) // 8, "big")).decode().rstrip("=")


def make_keyrec(mk=None, mb=None):
    """localStorage 'lite_key_v1': a public key in the clear, its private key (+ the old mb) locked by the hidden key."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pn = key.public_key().public_numbers()
    der = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    box = lambda data: (lambda iv: {"iv": b64(iv), "ct": b64(AESGCM(wk(mk)).encrypt(iv, data, None))})(os.urandom(12))
    rec = {"v": 2, "pub": {"kty": "RSA", "n": _b64u(pn.n), "e": _b64u(pn.e), "alg": "RSA-OAEP-256", "ext": True},
           "priv": box(der), "made": "2024-11-01T09:00:00.000Z"}
    if mb:
        rec["mb"] = box(unb64(mb))
    return rec


KEYREC = make_keyrec()


def passport_db(email=PP_EMAIL, app="wmm", passport=None):
    return {"passports": {email: passport or make_passport(email)}, "apps": {app: {"email": email}} if app else {}}


def open_v2(sc, mk=None):
    """A v2 sealed backup: the private key (locked by the hidden key) opens K, K opens the data."""
    try:
        der = AESGCM(wk(mk)).decrypt(unb64(sc["priv"]["iv"]), unb64(sc["priv"]["ct"]), None)
        priv = serialization.load_der_private_key(der, password=None)
        k = priv.decrypt(unb64(sc["keys"][0]["ct"]), padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
        return json.loads(AESGCM(k).decrypt(unb64(sc["iv"]), unb64(sc["data"]), None))
    except Exception:
        return None


EMPTY_GSI = "/* no Google in the tests unless a test fakes it */"


def _context(browser, seed_lock=True, unlocked=True, old_lock=None, passport=True, **more):
    """seed_lock = a person who has set up (a passport for PP_EMAIL in 'passport-v2' + WMM's key record, Drive seen);
    unlocked = this tab is unlocked; old_lock = an OLD WMM lock record (lite_lock_v1) on this device as well."""
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True, **more)
    ctx.route("https://accounts.google.com/gsi/client*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=EMPTY_GSI))
    seed = ""
    if seed_lock and passport:
        seed += "if (!localStorage.getItem('passport-v2')) localStorage.setItem('passport-v2', %s);" % json.dumps(json.dumps(passport_db()))
        seed += "if (!localStorage.getItem('lite_key_v1')) localStorage.setItem('lite_key_v1', %s);" % json.dumps(json.dumps(KEYREC))
        seed += "if (!localStorage.getItem('lite_drive_ppseen')) localStorage.setItem('lite_drive_ppseen', %s);" % json.dumps(PP_EMAIL)
    if old_lock is not None:
        seed += "if (!localStorage.getItem('lite_lock_v1')) localStorage.setItem('lite_lock_v1', %s);" % json.dumps(json.dumps(old_lock))
    script = ""
    if seed:
        script += "if (!sessionStorage.getItem('__seeded')) { %s sessionStorage.setItem('__seeded', '1'); }" % seed
    if unlocked:
        script += "sessionStorage.setItem('lite_unlock', String(Date.now())); sessionStorage.setItem('passport-unlocked-wmm', '1');"
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
    if item in ("Mark paid", "Not paid yet"):                # v0.70: with a card the paid button opens Paid / Paid on card / Not paid yet
        btn = page.locator('.bmenu .brow [role=menuitem]').nth(1)
        if btn.inner_text().strip() == item and item == "Not paid yet":   # no card: still a simple switch
            with page.expect_navigation():
                btn.click()
        else:
            btn.click()
            pick = "✅ Paid" if item == "Mark paid" else "↩️ Not paid yet"
            box = page.locator(".litesheet").last
            box.wait_for(state="visible")
            with page.expect_navigation():
                box.locator(f'.picklist button:text-is("{pick}")').click()
        page.wait_for_load_state()
        return
    if dialog_answer is None:
        with page.expect_navigation():
            page.click(f'.bmenu [role=menuitem]:has-text("{item}")')
    else:
        page.click(f'.bmenu [role=menuitem]:has-text("{item}")')
        with page.expect_navigation():
            sheet(page, dialog_answer)
    page.wait_for_load_state()


