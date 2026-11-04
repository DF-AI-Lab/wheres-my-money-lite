"""v0.61 (Darren, 2 Nov): 🛂 PASSPORT ID replaces WMM's own lock. One ID + one login for all DF apps (docs/demo/passport/,
copied from DF-AI-Lab/Passport-ID v0.3.3, never edited here). passport-lock.js keeps the old names (Lock.seal/open/openWith/
adopt, LockUI.record/adopt/demo, LiteName, LiteRestore). Backups: v2 = locked so that saving needs no hidden key (fingerprint
unlock still saves), opening needs the passport passcode. Old v1 backups still open with the OLD passcode; the old master key
(mb) moves in once, wrapped by the passport's hidden key. All Drive files live in App data - DON'T DELETE / DF…… / WMM (old
ones moved there once). Sign out saves to Drive, then clears WMM on this device. A wiped device: Passport's Google sign-in,
the passcode, then the money comes back from Drive. Demo: ?lock=1 = pretend Passport (no Google, demo keys only).
Fake data only."""
import json
import re
from urllib.parse import urlparse, parse_qs, unquote

import pytest

from conftest import (_context, _page, post, sheet, stored, make_lock, open_scrambled, open_v2, unb64, wk, passport_db,
                      make_passport, PIN, CODES, KEYREC, MK, PP_EMAIL, PP_ID, PP_NAME, PP_CODES)
from test_v045 import Drive, TODAY, CONFIG, spends
from test_livedemo import site  # noqa: F401  (the whole Pages site: live at /, demo at /demo/)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
import base64

ROOT = "App data - DON'T DELETE"
FOLDER = "application/vnd.google-apps.folder"
NAME = "wheres-my-money-backup Nov 2024.json"
PP_GSI = """window.__asks = []; window.google = {accounts: {oauth2: {
  initTokenClient: cfg => ({requestAccessToken: o => {
    window.__asks.push({prompt: (o && o.prompt) === undefined ? 'full' : o.prompt, hint: (o && o.login_hint) || cfg.login_hint || '', scope: cfg.scope});
    setTimeout(() => cfg.callback({access_token: 'tok123', expires_in: 3600, scope: cfg.scope}), 10); }}),
  hasGrantedAllScopes: () => true, revoke: (t, cb) => cb && cb()}}};"""
STATE = {"v": 3, "pay": 1500, "left": 0, "bills": [], "pots": [], "cards": [], "history": [],
         "spends": [{"id": 1, "date": "2024-11-02", "amount": 4.2, "name": "OldSpend", "cat": "Unsorted"}]}


class PDrive(Drive):
    """The fake Drive, closer to the real one: q filters (name, contains, folder, parents), parents kept and moved."""
    def __init__(self):
        super().__init__()
        self.moves = []

    def add(self, name, parents=(), mime="application/json", text=""):
        self.n += 1
        fid = "f%d" % self.n
        self.files[fid] = {"name": name, "mimeType": mime, "parents": list(parents), "text": text, "modifiedTime": self.tick()}
        return fid

    def folder(self, name, parent=None):
        return self.add(name, [parent] if parent else [], FOLDER)

    def find(self, name):
        return [dict(f, id=i) for i, f in self.files.items() if f["name"] == name]

    def path(self, fid):
        """'ROOT/DF123456/WMM' for a file's folder."""
        out, p = [], (self.files[fid]["parents"] or [None])[0]
        while p:
            out.insert(0, self.files[p]["name"])
            p = (self.files[p]["parents"] or [None])[0]
        return "/".join(out)

    def attach(self, page):
        self.pages.append(page)
        page.route("https://accounts.google.com/gsi/client*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=PP_GSI))
        page.route("https://www.googleapis.com/**", self.api)

    @staticmethod
    def match(f, q):
        for part in [p.strip() for p in re.split(r"\s+and\s+", q) if p.strip()]:
            m = re.match(r"name\s*=\s*'((?:[^'\\]|\\.)*)'$", part)
            if m and f["name"] != re.sub(r"\\(.)", r"\1", m.group(1)):
                return False
            m = re.match(r"name contains '((?:[^'\\]|\\.)*)'$", part)
            if m and re.sub(r"\\(.)", r"\1", m.group(1)) not in f["name"]:
                return False
            m = re.match(r"mimeType\s*=\s*'([^']*)'$", part)
            if m and f["mimeType"] != m.group(1):
                return False
            m = re.match(r"'([^']*)' in parents$", part)
            if m and m.group(1) not in f.get("parents", []):
                return False
        return True

    def api(self, route):
        req, url = route.request, route.request.url
        u = urlparse(url)
        qs = parse_qs(u.query)
        ok = lambda body: route.fulfill(status=200, content_type="application/json", body=json.dumps(body))
        if "/oauth2/v3/userinfo" in url:
            return ok({"email": PP_EMAIL, "name": PP_NAME})
        if "/drive/v3/about" in url:
            return ok({"user": {"emailAddress": PP_EMAIL}})
        fid = u.path.split("/files/")[1].split("/")[0] if "/files/" in u.path else None
        if req.method == "GET" and fid and "alt=media" in url:
            if fid not in self.files:
                return route.fulfill(status=404, body="")
            return route.fulfill(status=200, content_type="application/json", body=self.files[fid]["text"])
        if req.method == "GET" and not fid:
            q = unquote(qs.get("q", [""])[0])
            files = sorted([dict(f, id=i) for i, f in self.files.items() if self.match(f, q)],
                           key=lambda f: f["modifiedTime"], reverse=True)
            return ok({"files": [{k: f[k] for k in ("id", "name", "mimeType", "modifiedTime", "parents")} for f in files]})
        if req.method == "PATCH" and fid and "upload/" not in url and ("addParents" in qs or "removeParents" in qs):
            f = self.files[fid]
            gone = ",".join(qs.get("removeParents", [""])).split(",")
            f["parents"] = [p for p in f["parents"] if p not in gone] + [p for p in qs.get("addParents", [""])[0].split(",") if p]
            self.moves.append((f["name"], qs.get("addParents", [""])[0]))
            return ok({"id": fid, "parents": f["parents"]})
        if req.method == "DELETE" and fid:
            self.files.pop(fid, None)
            return route.fulfill(status=204, body="")
        if req.method == "POST" and fid and u.path.endswith("/copy"):
            src = self.files[fid]
            meta = json.loads(req.post_data or "{}")
            nid = self.add(meta.get("name", src["name"]), meta.get("parents", []), src["mimeType"], src.get("text", ""))
            return ok({"id": nid, "name": self.files[nid]["name"], "trashed": False})
        if req.method in ("POST", "PATCH"):
            body = req.post_data or ""
            if "upload/" in url:
                parts = body.split("\r\n\r\n")
                meta, text = json.loads(parts[1].split("\r\n--")[0]), parts[2].split("\r\n--")[0]
            else:
                meta, text = json.loads(body or "{}"), ""
            if req.method == "POST":
                fid = self.add(meta["name"], meta.get("parents", []), meta.get("mimeType", ""), text)
            else:
                if fid not in self.files:
                    return route.fulfill(status=404, body="")
                self.files[fid].update(text=text, modifiedTime=self.tick())
                if meta.get("name"):
                    self.files[fid]["name"] = meta["name"]
            return ok({"id": fid, "trashed": False, "modifiedTime": self.files[fid]["modifiedTime"]})
        return route.fulfill(status=404, body="")

    def put_passport(self, passport=None):
        """passport.json in App data - DON'T DELETE / DF123456 (what Passport saved from another app)."""
        root = (self.find(ROOT) or [{"id": self.folder(ROOT)}])[0]["id"]
        df = [f for f in self.find(PP_ID) if root in f["parents"]]
        df = df[0]["id"] if df else self.folder(PP_ID, root)
        p = dict(passport or make_passport())
        for k in ("fingerprints", "dirty", "fileId", "folderId"):
            p.pop(k, None)
        p.pop("email", None)
        return self.add("passport.json", [df], text=json.dumps(p))


def shown(pg):
    return pg.locator("#wmmlock").is_hidden() and pg.locator(".wrap").is_visible()


def screen(pg, words=None):
    """The Passport screen showing over the app (its text); words = wait until the screen says them."""
    pg.wait_for_selector("#wmmlock:not([hidden]) #passport .ps-screen")
    if words:
        pg.wait_for_function("w => (document.querySelector('#passport .ps-screen') || {}).innerText.includes(w)", arg=words, timeout=15000)
    return pg.locator("#passport .ps-screen").inner_text()


def type_passcode(pg, pin=PIN):
    pg.wait_for_selector("#passport #pc")
    pg.fill("#passport #pc", pin)
    pg.click("#passport #go")


def phone(browser, d, **kw):
    """A set-up device on the same fake Drive (passport + key record seeded, unlocked)."""
    ctx = _context(browser, **kw)
    ctx.add_init_script(CONFIG + "window.LITE_DRIVE_WAIT = 300; window.LITE_SYNC_EVERY = 400;")
    pg = _page(ctx)
    d.attach(pg)
    return ctx, pg


def connect(pg, base):
    pg.goto(base + TODAY + "&view=drive")
    pg.click("#driveconnect")
    pg.wait_for_selector("#drivesave:not([hidden])", state="attached")


def save_now(pg):
    pg.locator("#drivesave").dispatch_event("click")
    pg.wait_for_selector("#driveok:not([hidden])")


def seal_v1(lock, state):
    """An OLD WMM backup (lock.js v1): data locked with mb, mb wrapped by the old passcode and each old code."""
    mb, iv = unb64(lock["mb"]), os.urandom(12)
    keys = [dict(lock["pin"], kind="pin")] + [{"kind": "code", "salt": c["salt"], "iv": c["iv"], "ct": c["ct"]} for c in lock["codes"]]
    return {"app": "wheres-my-money-lite", "version": "0.60", "saved": "2024-11-02",
            "scrambled": {"v": 1, "iter": lock["iter"], "iv": base64.b64encode(iv).decode(),
                          "data": base64.b64encode(AESGCM(mb).encrypt(iv, json.dumps(state).encode(), None)).decode(), "keys": keys}}


# ---------- 1. Passport is the lock ----------

def test_opening_shows_passport_and_the_passcode_opens_it(browser, base):
    ctx = _context(browser, unlocked=False)
    pg = _page(ctx)
    pg.goto(base + TODAY)
    text = screen(pg)
    assert "Welcome back, Sam" in text and "Where's My Money?" in text
    assert pg.locator(".wrap").is_hidden()                                  # no money behind it
    assert "WMM" in text and PP_ID in text                                  # Saves to Drive: … / DF123456 / WMM
    type_passcode(pg, "000000")
    pg.wait_for_selector("#passport .ps-err")
    assert "Wrong passcode" in pg.locator("#passport .ps-err").inner_text()
    type_passcode(pg)
    pg.wait_for_selector("#wmmlock", state="hidden")
    assert shown(pg)
    assert not pg.locator("#wmmlock section[data-for]").count()                # the old lock screens are gone
    assert not pg.errors
    ctx.close()


def test_the_old_lock_files_are_gone_and_passport_files_are_copied_untouched():
    from pathlib import Path
    demo = Path(__file__).resolve().parent.parent / "docs" / "demo"
    assert not (demo / "lockui.js").exists()
    master = Path("/home/user/passport-id/passport")
    for f in ["config.js", "google.js", "passport.js", "ui.js", "passport.css"]:
        assert (demo / "passport" / f).exists(), f
        if master.exists():
            assert (demo / "passport" / f).read_text() == (master / f).read_text(), f
    theme = json.loads((demo / "passport" / "theme.json").read_text())
    assert theme["drive"] == "WMM" and theme["font"] == "Manrope" and "lite-192.png" in theme["logo"]["value"]
    assert "Passport v0.3.5" in (demo / "passport" / "PASSPORT.md").read_text()
    html = (demo / "index.html").read_text()
    order = [html.index(s) for s in ['src="lite.js', 'src="passport/config.js', 'src="passport/google.js', 'src="passport/passport.js',
                                     'src="passport/ui.js', 'src="passport-lock.js']]
    assert order == sorted(order)


def test_settings_shows_the_passport_id_and_opens_passport_settings(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY)
    pg.click("#setbtn")
    btn = pg.locator("#passportbtn")
    assert btn.is_visible() and PP_ID in btn.inner_text()
    assert not pg.locator("#fingerprint").count() and not pg.locator("#newcodes").count()   # Passport has them now
    btn.click()
    text = screen(pg)
    assert PP_ID in text and "Sign out" in text and "Lock now" in text
    pg.click("#passport #back")                                              # Back to Where's My Money?
    pg.wait_for_selector("#wmmlock", state="hidden")
    assert shown(pg)
    assert not pg.errors
    ctx.close()


def test_lock_now_and_5_minutes_idle_show_the_passport_lock(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY)
    pg.click("#setbtn")
    pg.click("#locknow")
    assert "Your passcode" in screen(pg)
    type_passcode(pg)
    pg.wait_for_selector("#wmmlock", state="hidden")
    pg.evaluate("""() => { sessionStorage.setItem('lite_unlock', String(Date.now() - 6 * 60 * 1000));
        document.dispatchEvent(new Event('visibilitychange')); }""")
    assert "Your passcode" in screen(pg)
    assert not pg.errors
    ctx.close()


# ---------- 2. Darren's phone: the OLD lock moves in once ----------

def test_old_lock_moves_into_passport_once_and_old_backups_still_open(browser, base, tmp_path):
    old = make_lock()
    ctx = _context(browser, seed_lock=False, unlocked=False, old_lock=old)
    ctx.add_init_script("if (!localStorage.getItem('passport-v2')) localStorage.setItem('passport-v2', %s);"
                        "if (!localStorage.getItem('lite_state_v1')) localStorage.setItem('lite_state_v1', %s);"
                        % (json.dumps(json.dumps(passport_db(app="tasknotes"))), json.dumps(json.dumps(STATE))))
    pg = _page(ctx)
    d = PDrive()
    d.attach(pg)
    pg.goto(base + TODAY)
    assert "Continue with Google" in screen(pg, "Continue with Google")                             # WMM has not used the passport on this phone yet
    pg.click("#passport #g")
    assert "Welcome back, Sam" in screen(pg, "Welcome back, Sam")                                 # found the passport made in another app
    pg.click("#passport #go")
    type_passcode(pg)
    pg.wait_for_selector("#wmmlock", state="hidden")
    assert shown(pg) and spends(pg) == ["OldSpend"]                         # the money stayed
    assert pg.evaluate("localStorage.getItem('lite_lock_v1')") is None      # the old record (plain mb) is gone
    rec = json.loads(pg.evaluate("localStorage.getItem('lite_key_v1')"))
    assert rec["v"] == 2 and old["mb"] not in json.dumps(rec)
    mb = AESGCM(wk()).decrypt(unb64(rec["mb"]["iv"]), unb64(rec["mb"]["ct"]), None)
    assert base64.b64encode(mb).decode() == old["mb"]                        # mb kept, wrapped by the hidden key
    f = tmp_path / "old.json"
    f.write_text(json.dumps(seal_v1(old, dict(STATE, pay=999))))
    for secret in (PIN, "135790"):                                           # passport passcode, or the old one (same here)
        pg.set_input_files("#loadfile", str(f))
        sheet(pg, secret)
        with pg.expect_navigation():
            sheet(pg, True)                                                  # Replace
        pg.wait_for_load_state()
        assert stored(pg)["pay"] == 999
    assert not pg.errors
    d.close()


def test_old_backup_opens_with_the_old_passcode_when_it_differs(browser, base, tmp_path):
    old = make_lock(pin="246813")
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY + "&view=drive")
    f = tmp_path / "old.json"
    f.write_text(json.dumps(seal_v1(old, dict(STATE, pay=777))))
    pg.set_input_files("#loadfile", str(f))
    sheet(pg, "246813")                                                       # the OLD WMM passcode
    with pg.expect_navigation():
        sheet(pg, True)
    pg.wait_for_load_state()
    assert stored(pg)["pay"] == 777
    assert not pg.errors
    ctx.close()


# ---------- 3. saving with no hidden key open (= after a fingerprint) ----------

def test_a_backup_saved_without_the_passcode_this_visit_is_v2_and_opens_with_it(browser, base, tmp_path):
    ctx = _context(browser)                                                  # unlocked, but no passcode typed: no hidden key
    pg = _page(ctx)
    pg.goto(base + TODAY)
    post(pg, 'form[action="/add"]', {"amount": "3.10", "name": "Fingerprinted"})
    pg.click("#setbtn")
    with pg.expect_download() as dl:
        pg.click("#savebackup")
    path = tmp_path / "b.json"
    dl.value.save_as(path)
    file = json.loads(path.read_text())
    assert file["scrambled"]["v"] == 2 and "Fingerprinted" not in path.read_text()
    assert [s["name"] for s in open_v2(file["scrambled"])["spends"]] == ["Fingerprinted"]
    pg.set_input_files("#loadfile", str(path))                               # opening = the passport passcode
    sheet(pg, "000000")
    pg.locator(".litesheet").last.wait_for(state="visible")
    assert "didn't open" in pg.locator(".litesheet").last.inner_text()
    sheet(pg, True)
    pg.set_input_files("#loadfile", str(path))
    sheet(pg, PIN)
    with pg.expect_navigation():
        sheet(pg, True)
    pg.wait_for_load_state()
    assert spends(pg) == ["Fingerprinted"]
    assert not pg.errors
    ctx.close()


# ---------- 4. every Drive file in App data - DON'T DELETE / DF123456 / WMM ----------

def test_drive_saves_go_in_the_passport_folder(browser, base):
    d = PDrive()
    ctx, pg = phone(browser, d)
    pg.goto(base + TODAY)
    post(pg, 'form[action="/add"]', {"amount": "2", "name": "InFolder"})
    connect(pg, base)
    save_now(pg)
    f = d.find(NAME)[0]
    assert d.path(f["id"]) == ROOT + "/" + PP_ID + "/WMM"
    assert d.path(d.find("wmm-summary.json")[0]["id"]) == ROOT + "/" + PP_ID + "/WMM"
    assert open_v2(json.loads(f["text"])["scrambled"])["spends"][0]["name"] == "InFolder"
    assert not d.find("Where's My Money Lite")                                # no old-style folder made
    assert not pg.errors
    d.close()


def test_old_drive_files_move_into_the_wmm_folder_once(browser, base):
    d = PDrive()
    old = d.folder("Where's My Money Lite")
    safe = d.folder("Safety copies", old)
    d.add(NAME, [old], text=json.dumps({"app": "wheres-my-money-lite", "saved": "2024-11-01", "state": STATE}))
    d.add("wheres-my-money-backup Oct 2024.json", [old], text="{}")
    d.add("wmm-lite-safety 2024-11-07.json", [safe], text="{}")
    d.add("wmm-summary.json", [], text="{}")
    d.add("wmm-lite-pair.json", [], text="{}")
    ctx, pg = phone(browser, d)
    pg.goto(base + TODAY)
    connect(pg, base)
    f = max(d.find(NAME) + d.find("wheres-my-money-backup Oct 2024.json"), key=lambda x: x["modifiedTime"])   # v0.64: seen here
    pg.evaluate("s => localStorage.setItem('lite_drive_synced', s)", f["id"] + "@" + f["modifiedTime"])
    save_now(pg)
    wmm = ROOT + "/" + PP_ID + "/WMM"
    for name in (NAME, "wheres-my-money-backup Oct 2024.json", "wmm-summary.json", "wmm-lite-pair.json"):
        assert len(d.find(name)) == 1 and d.path(d.find(name)[0]["id"]) == wmm, name
    assert d.path(d.find("wmm-lite-safety 2024-11-07.json")[0]["id"]) == wmm + "/Safety copies"
    assert pg.evaluate("localStorage.getItem('lite_drive_moved')") == PP_ID
    n = len(d.moves)
    save_now(pg)
    assert len(d.moves) == n                                                  # once only
    assert not pg.errors
    d.close()


def test_orbit_job_files_are_still_found_wherever_they_are(browser, base):
    d = PDrive()
    d.add("wmm-job-20241108-090000-aa11.json", [d.folder("Where's My Money Lite")],
          text=json.dumps({"v": 1, "kind": "add_spend", "id": "j1", "amount": 5.1, "name": "Tesco", "date": "2024-11-08"}))
    ctx, pg = phone(browser, d)
    pg.goto(base + TODAY)
    connect(pg, base)
    pg.goto(base + TODAY)
    pg.wait_for_function("(JSON.parse(localStorage.getItem('lite_state_v1')).spends || []).some(s => s.name === 'Tesco')", timeout=8000)
    assert not d.find("wmm-job-20241108-090000-aa11.json")                    # read and removed, like before
    d.close()


# ---------- 5. Sign out: save to Drive, then clear WMM on this device ----------

def test_sign_out_saves_to_drive_then_clears_this_device(browser, base):
    d = PDrive()
    ctx, pg = phone(browser, d)
    pg.goto(base + TODAY)
    connect(pg, base)
    pg.goto(base + TODAY)
    pg.evaluate("localStorage.setItem('lite_demo_name', 'DemoKeep')")
    post(pg, 'form[action="/add"]', {"amount": "8", "name": "LastOne"})
    assert pg.evaluate("localStorage.getItem('lite_drive_dirty')")             # not sent yet
    pg.click("#setbtn")
    pg.click("#passportbtn")
    screen(pg)
    pg.click("#passport #out")
    assert "Continue with Google" in screen(pg, "Continue with Google")
    names = [s["name"] for s in open_v2(json.loads(d.find(NAME)[0]["text"])["scrambled"])["spends"]]
    assert "LastOne" in names                                                # saved first
    left = pg.evaluate("Object.keys(localStorage).filter(k => k.startsWith('lite_'))")
    assert left == ["lite_demo_name"]                                        # WMM's own keys gone; the demo's untouched
    assert not pg.evaluate("Object.keys(sessionStorage).filter(k => k.startsWith('lite_'))")
    assert json.loads(pg.evaluate("localStorage.getItem('passport-v2')"))["apps"].get("wmm") is None
    assert pg.locator(".wrap").is_hidden()
    assert not pg.errors
    d.close()


def test_sign_out_with_drive_off_downloads_a_backup_first(browser, base):
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY)
    post(pg, 'form[action="/add"]', {"amount": "8", "name": "KeepMe"})
    pg.click("#setbtn")
    pg.click("#passportbtn")
    screen(pg)
    with pg.expect_download() as dl:
        pg.click("#passport #out")
    file = json.loads(open(dl.value.path()).read())
    assert [s["name"] for s in open_v2(file["scrambled"])["spends"]] == ["KeepMe"]
    screen(pg)
    assert stored(pg) is None
    assert not pg.errors
    ctx.close()


# ---------- 6. a wiped device: Passport's Google sign-in, then the money from Drive ----------

def wiped(browser, d):
    ctx = _context(browser, seed_lock=False, unlocked=False)
    ctx.add_init_script(CONFIG + "window.LITE_DRIVE_WAIT = 300;")
    pg = _page(ctx)
    d.attach(pg)
    return ctx, pg


def sign_in(pg, base):
    pg.goto(base + TODAY)
    assert "Continue with Google" in screen(pg, "Continue with Google")
    pg.click("#passport #g")
    assert "Welcome back, Sam" in screen(pg, "Welcome back, Sam")
    pg.click("#passport #go")
    type_passcode(pg)


def test_a_wiped_device_gets_its_money_back_after_the_passcode(browser, base):
    d = PDrive()
    ctx, ph = phone(browser, d)
    ph.goto(base + TODAY)
    post(ph, 'form[action="/add"]', {"amount": "7.50", "name": "PhoneSpend"})
    connect(ph, base)
    save_now(ph)
    d.put_passport()
    ctx2, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector("#wmmlock", state="hidden", timeout=15000)
    pg.wait_for_load_state()
    assert shown(pg) and spends(pg) == ["PhoneSpend"]
    assert pg.evaluate("localStorage.getItem('lite_drive_on')") == "1"
    assert pg.evaluate("localStorage.getItem('lite_drive_email')") == PP_EMAIL
    assert json.loads(pg.evaluate("localStorage.getItem('lite_drive_file')"))["id"] == d.find(NAME)[0]["id"]
    assert not pg.evaluate("localStorage.getItem('lite_drive_dirty')")      # nothing written over the copy
    assert json.loads(pg.evaluate("localStorage.getItem('lite_key_v1')"))["v"] == 2
    assert not pg.errors
    d.close()


def test_a_wiped_device_opened_twice_before_signing_in_still_gets_its_money(browser, base):
    """The empty starter money saved on the first open is NOT money: it must never go over the Drive copy."""
    d = PDrive()
    ctx, ph = phone(browser, d)
    ph.goto(base + TODAY)
    post(ph, 'form[action="/add"]', {"amount": "7.50", "name": "PhoneSpend"})
    connect(ph, base)
    save_now(ph)
    d.put_passport()
    ctx2, pg = wiped(browser, d)
    pg.goto(base + TODAY)
    screen(pg, "Continue with Google")
    pg.reload()                                                               # opened again before signing in
    sign_in(pg, base)
    pg.wait_for_selector("#wmmlock", state="hidden", timeout=15000)
    pg.wait_for_load_state()
    assert spends(pg) == ["PhoneSpend"]
    assert not pg.errors
    d.close()


def test_a_wiped_device_with_only_an_old_backup_asks_the_old_passcode(browser, base):
    d = PDrive()
    old = make_lock(pin="246813")
    d.add(NAME, [], text=json.dumps(seal_v1(old, STATE)))
    d.put_passport()
    ctx, pg = wiped(browser, d)
    sign_in(pg, base)
    pg.wait_for_selector("#passport #wmmold")
    assert "old" in screen(pg).lower()
    pg.fill("#passport #wmmold", "111111")
    pg.click("#passport #wmmoldgo")
    pg.wait_for_selector("#passport .ps-err")
    pg.fill("#passport #wmmold", "246813")
    with pg.expect_navigation():
        pg.click("#passport #wmmoldgo")
    pg.wait_for_load_state()
    pg.wait_for_selector("#wmmlock", state="hidden")
    assert spends(pg) == ["OldSpend"]
    rec = json.loads(pg.evaluate("localStorage.getItem('lite_key_v1')"))
    assert base64.b64encode(AESGCM(wk()).decrypt(unb64(rec["mb"]["iv"]), unb64(rec["mb"]["ct"]), None)).decode() == old["mb"]
    assert not pg.errors
    d.close()


def test_a_new_person_signs_up_and_starts_with_drive_on(browser, base):
    d = PDrive()
    ctx, pg = wiped(browser, d)
    pg.goto(base + TODAY)
    pg.click("#passport #g")
    screen(pg)
    pg.fill("#passport #nm", "Sam Test")
    pg.fill("#passport #pc", PIN)
    pg.fill("#passport #pc2", PIN)
    pg.click("#passport button[type=submit]")
    pg.wait_for_selector("#passport .ps-codes")
    pg.click("#passport #ok")
    pg.wait_for_selector("#wmmlock", state="hidden", timeout=15000)
    assert shown(pg)
    assert pg.evaluate("localStorage.getItem('lite_drive_on')") == "1"
    assert json.loads(pg.evaluate("localStorage.getItem('lite_key_v1')"))["v"] == 2
    assert d.find("passport.json")                                            # Passport saved itself to Drive
    assert not pg.errors
    d.close()


# ---------- 7. the demo: no lock, or ?lock=1 = pretend Passport (never live's keys) ----------

def test_demo_has_no_lock(browser, site):  # noqa: F811
    ctx = _context(browser, seed_lock=False, unlocked=False)
    pg = _page(ctx)
    pg.goto(site + "demo/" + TODAY)
    assert shown(pg)
    pg.click("#setbtn")
    assert pg.locator("#passportbtn").is_hidden() and pg.locator("#locknow").is_hidden()
    assert not pg.errors
    ctx.close()


def test_demo_lock_1_is_pretend_passport_with_its_own_keys(browser, site):  # noqa: F811
    ctx = _context(browser, seed_lock=False, unlocked=False)
    pg = _page(ctx)
    pg.goto(site + "demo/" + TODAY + "&lock=1")
    assert "Continue with Google" in screen(pg, "Continue with Google")
    pg.click("#passport #g")
    assert "Demo only" in screen(pg, "Demo only")                                           # no real Google
    pg.fill("#passport #em", "try@example.com")
    pg.click("#passport button[type=submit]")
    pg.fill("#passport #nm", "Try Person")
    pg.fill("#passport #pc", PIN)
    pg.fill("#passport #pc2", PIN)
    pg.click("#passport button[type=submit]")
    pg.wait_for_selector("#passport .ps-codes")
    pg.click("#passport #ok")
    pg.wait_for_selector("#wmmlock", state="hidden", timeout=15000)
    assert shown(pg)
    keys = pg.evaluate("Object.keys(localStorage)")
    assert "passport-demo-v2" in keys and "passport-v2" not in keys
    assert "lite_demo_key_v1" in keys and "lite_key_v1" not in keys and "lite_state_v1" not in keys
    db = json.loads(pg.evaluate("localStorage.getItem('passport-demo-v2')"))
    assert db["apps"]["wmm-demo"]["email"] == "try@example.com"
    pg.goto(site + "demo/" + TODAY + "&lock=0")
    assert shown(pg)
    assert not pg.errors
    ctx.close()


# ---------- 8. 'move to live' copies the passport folder too ----------

def test_move_to_live_copies_the_passport_folder(tmp_path):
    from pathlib import Path
    tool = Path(__file__).resolve().parent.parent / "tools" / "move_to_live.py"
    src = tool.read_text()                                                     # (running it would move the real docs)
    assert "def move(" in src and "__main__" in src
    docs = tmp_path / "docs"
    (docs / "demo" / "passport").mkdir(parents=True)
    (docs / "demo" / "index.html").write_text("x")
    (docs / "demo" / "version.json").write_text('{"version": "0.61"}')
    (docs / "demo" / "manifest.json").write_text('{"id": "/wheres-my-money-lite/demo/"}')
    (docs / "demo" / "passport" / "ui.js").write_text("ui")
    (docs / "lockui.js").write_text("old")
    ns = {"__file__": str(tool)}
    exec(compile(src.replace('if __name__ == "__main__"', "if False"), str(tool), "exec"), ns)
    ns["move"](docs)
    assert (docs / "passport" / "ui.js").read_text() == "ui"
    assert not (docs / "lockui.js").exists()
    assert '"/wheres-my-money-lite/"' in (docs / "manifest.json").read_text()


def test_the_bell_still_says_not_backed_up_while_drive_is_off(browser, base):
    """(was v0.58) Drive off = one clearing away from losing it all: the bell says so, until Drive is on."""
    ctx = _context(browser)
    pg = _page(ctx)
    pg.goto(base + TODAY)
    pg.click("#bellbtn")
    assert "Not backed up" in pg.locator("#bellmenu").inner_text()
    ctx.close()
