"""Go B step 9 (PLAN.md): an optional ☁️ Google Drive copy of the scrambled backup, in the person's own Drive.
Google is faked here (no network): the sign-in script and the Drive API are answered by the test. Fake data only."""
import json
from pathlib import Path

from conftest import PIN, stored, post, open_scrambled, sheet

TODAY = "?today=2024-11-08"
GSI = "https://accounts.google.com/gsi/client"
FAKE_GSI = """window.google = {accounts: {oauth2: {initTokenClient: cfg => ({requestAccessToken: () => {
    window.__scope = cfg.scope; window.__client = cfg.client_id;
    setTimeout(() => cfg.callback({access_token: 'tok123', expires_in: 3600}), 10); }})}}};"""


def drive_view(page, base, client_id="test-client.apps.googleusercontent.com", spend=None):
    if client_id is not None:                                          # "" = test the app with no client id
        page.add_init_script("window.LITE_CONFIG = {googleClientId: %s};" % json.dumps(client_id))
    page.goto(base + TODAY)
    if spend:
        post(page, 'form[action="/add"]', {"amount": "3", "name": spend})
    page.click("#setbtn")
    with page.expect_navigation():
        page.click("#setmenu a:has-text('Google Drive')")
    page.wait_for_load_state()
    assert page.locator("#drive").is_visible() and page.locator("#cards").is_hidden()


def fake_google(page, files):
    """files: {id: text}. Uploads are recorded in files['_uploads']."""
    page.route(GSI + "*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=FAKE_GSI))
    uploads = files.setdefault("_uploads", [])

    def api(route):
        req = route.request
        assert req.headers.get("authorization") == "Bearer tok123"
        if "upload/drive/v3/files" in req.url:
            uploads.append({"method": req.method, "url": req.url, "body": req.post_data or ""})
            fid = "file1"
            files[fid] = req.post_data
            return route.fulfill(status=200, content_type="application/json", body=json.dumps({"id": fid}))
        if "alt=media" in req.url:
            fid = req.url.split("/files/")[1].split("?")[0]
            return route.fulfill(status=200, content_type="application/json", body=files["backup"])
        if "/drive/v3/files" in req.url and req.method == "GET":
            return route.fulfill(status=200, content_type="application/json",
                                 body=json.dumps({"files": [{"id": "backup", "name": "wheres-my-money-backup.json",
                                                             "modifiedTime": "2024-11-08T10:00:00Z"}]}))
        return route.fulfill(status=404, body="")
    page.route("https://www.googleapis.com/**", api)


def test_without_a_google_client_id_drive_says_it_is_not_set_up(page, base):
    drive_view(page, base, client_id="")
    text = page.locator("#drive").inner_text().lower()
    assert "not set up" in text
    assert page.locator("#driveconnect").count() == 0
    assert not page.errors


def test_save_a_scrambled_copy_to_drive(page, base):
    files = {}
    fake_google(page, files)
    drive_view(page, base, spend="PlainCheck")
    page.click("#driveconnect")
    page.wait_for_selector("#drivesave:not([hidden])")
    assert page.evaluate("window.__scope") == "https://www.googleapis.com/auth/drive.file"   # only files this app made
    page.click("#drivesave")
    page.wait_for_selector("#driveok:not([hidden])")
    up = files["_uploads"][-1]
    assert "PlainCheck" not in up["body"] and "scrambled" in up["body"]     # never plain data in Drive
    body = up["body"]
    sealed = json.loads(body[body.index("{\"app\""):body.rindex("}") + 1])
    assert open_scrambled(sealed, PIN)["spends"][0]["name"] == "PlainCheck"
    assert "wheres-my-money-backup Nov 2024.json" in body             # v0.37: one file per pay month, the same name all month
    # saving again updates the same file (PATCH), it does not make a new one each time
    page.click("#drivesave")
    page.wait_for_timeout(500)
    assert files["_uploads"][-1]["method"] == "PATCH" and "/files/file1" in files["_uploads"][-1]["url"]


def test_load_the_copy_back_from_drive(page, base, tmp_path):
    # make a scrambled file with a spend in it, the normal way (Save backup)
    page.goto(base + TODAY)
    post(page, 'form[action="/add"]', {"amount": "7", "name": "FromDrive"})
    page.click("#setbtn")
    with page.expect_download() as dl:
        page.click("#savebackup")
    path = tmp_path / "b.json"
    dl.value.save_as(path)
    post(page, 'form[action="/remove"]', {"id": "1"})
    files = {"backup": path.read_text()}
    fake_google(page, files)
    drive_view(page, base)
    page.click("#driveconnect")
    page.wait_for_selector("#driveload:not([hidden])")
    page.click("#driveload")
    sheet(page, PIN)
    with page.expect_navigation():
        sheet(page)
    page.wait_for_load_state()
    assert [x["name"] for x in stored(page)["spends"]] == ["FromDrive"]


def test_drive_setup_notes_for_darren_exist():
    notes = (Path(__file__).resolve().parent.parent / "DRIVE_SETUP.md").read_text()
    assert "drive.file" in notes and "config.js" in notes
