"""v0.38 (Darren, 24 Oct). Fake Google only. Drive backups go in one folder 'Where's My Money Lite';
two saves at once (Save tapped, then the app hidden) make ONE file; a lost file id finds this month's file by name."""
import json

from conftest import post
from test_gob9 import GSI
from test_v037 import FAKE_GSI, hide

TODAY = "?today=2024-11-08"
FOLDER = "application/vnd.google-apps.folder"


def drive(page):
    """A small Drive that remembers files: {id: {name, mimeType, parents, modifiedTime}}. Uploads are slow (300 ms)."""
    d = {"files": {}, "posts": [], "n": 0}
    page.route(GSI + "*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=FAKE_GSI))

    def meta(body):
        return json.loads(body[body.index("{"):body.index("}") + 1])

    def gone(fid):                                                     # in the bin, or inside a binned folder
        f = d["files"].get(fid, {})
        return f.get("trashed") or any(gone(p) for p in f.get("parents", []) if p in d["files"])   # (v0.56: any level up)

    def api(route):
        req, url = route.request, route.request.url
        if req.method == "GET" and "/drive/v3/files" in url and "/files/" not in url:
            files = [dict(f, id=i) for i, f in d["files"].items() if not gone(i)]
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"files": files}))
        if req.method == "POST":
            d["n"] += 1
            fid = "f%d" % d["n"]
            m = meta(req.post_data) if "upload/" in url else json.loads(req.post_data)
            d["files"][fid] = {"name": m["name"], "mimeType": m.get("mimeType", ""), "parents": m.get("parents", []),
                               "modifiedTime": "2024-11-08T10:%02d:00Z" % d["n"]}
            d["posts"].append(m)
            if "upload/" in url:
                page.wait_for_timeout(300)
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": fid, "trashed": bool(gone(fid))}))
        if req.method == "PATCH":
            fid = url.split("/files/")[1].split("?")[0]
            if fid not in d["files"]:
                return route.fulfill(status=404, body="")
            d["patches"] = d.get("patches", 0) + 1
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": fid, "trashed": bool(gone(fid))}))
        if req.method == "DELETE":
            d["files"].pop(url.split("/files/")[1].split("?")[0], None)
            return route.fulfill(status=204, body="")
        return route.fulfill(status=404, body="")
    page.route("https://www.googleapis.com/**", api)
    return d


def connect(page, base):
    page.add_init_script("window.LITE_CONFIG = {googleClientId: 'test-client.apps.googleusercontent.com'};")
    page.goto(base + TODAY + "&view=drive")
    page.click("#driveconnect")
    page.wait_for_selector("#drivesave:not([hidden])", state="attached")


def backups(d):
    return [f for f in d["files"].values() if f["mimeType"] != FOLDER
            and not f["name"].startswith("wmm-lite-safety")]          # v0.56: the daily safety copy is its own thing


def test_backups_go_in_one_folder(page, base):
    d = drive(page)
    connect(page, base)
    page.locator("#drivesave").dispatch_event("click")
    page.wait_for_selector("#driveok:not([hidden])")
    folders = [(i, f) for i, f in d["files"].items() if f["mimeType"] == FOLDER]
    assert [f["name"] for _, f in folders] == ["Where's My Money Lite"]
    assert [f["parents"] for f in backups(d)] == [[folders[0][0]]]
    page.evaluate("localStorage.removeItem('lite_drive_file')")     # a new month later: the folder is found again
    page.evaluate("localStorage.removeItem('lite_drive_folder')")
    page.evaluate("s => { const x = JSON.parse(localStorage.getItem('lite_state_v1')); x.payday = '2024-12-25';"
                  " localStorage.setItem('lite_state_v1', JSON.stringify(x)); }", None)
    page.reload()
    page.locator("#drivesave").dispatch_event("click")
    page.wait_for_selector("#driveok:not([hidden])")
    assert len([f for f in d["files"].values() if f["mimeType"] == FOLDER]) == 1


def test_save_then_hide_at_once_makes_one_file(page, base):
    d = drive(page)
    connect(page, base)
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "3", "name": "Twice"})
    page.goto(base + TODAY + "&view=drive")
    page.locator("#drivesave").dispatch_event("click")
    hide(page)
    page.wait_for_timeout(800)
    assert len(backups(d)) == 1, d["files"]


def test_a_lost_file_id_finds_this_months_file(page, base):
    d = drive(page)
    connect(page, base)
    page.locator("#drivesave").dispatch_event("click")
    page.wait_for_selector("#driveok:not([hidden])")
    page.evaluate("localStorage.removeItem('lite_drive_file')")      # e.g. a new phone, or site data cleared
    page.locator("#drivesave").dispatch_event("click")
    page.wait_for_timeout(800)
    assert len(backups(d)) == 1
