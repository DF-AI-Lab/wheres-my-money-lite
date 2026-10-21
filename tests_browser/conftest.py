"""Shared fixtures and helpers for the browser tests (docs/ served as static files, phone width, fake data)."""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

DOCS = Path(__file__).resolve().parent.parent / "docs"
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


@pytest.fixture
def page(browser):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.errors = errors
    yield pg
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


def bill_menu(page, key, item, dialog_answer=None):
    """Open a bill's ⋯ menu and tap one item; answer the prompt/confirm it shows."""
    if dialog_answer is not None:
        page.once("dialog", lambda d: d.accept(dialog_answer) if d.type == "prompt" else d.accept())
    page.click(f'tr.bill[data-key="{key}"] button.more')
    with page.expect_navigation():
        page.click(f'.bmenu [role=menuitem]:has-text("{item}")')
    page.wait_for_load_state()


