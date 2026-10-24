"""v0.39 (Darren, 24 Oct): he binned the old Drive files, then 'Saved to your Drive' put the copy INTO the bin
(Drive lets you save over a binned file). A binned file or folder = gone: make a new one where he can see it."""
from test_v038 import drive, connect, FOLDER


def visible(d):
    return [f for i, f in d["files"].items() if f["mimeType"] != FOLDER and not f.get("trashed")
            and not any(d["files"].get(p, {}).get("trashed") for p in f.get("parents", []))]


def save(page):
    page.locator("#driveok").evaluate("e => e.hidden = true")
    page.click("#drivesave")
    page.wait_for_selector("#driveok:not([hidden])")


def test_a_binned_file_gets_a_new_one(page, base):
    d = drive(page)
    connect(page, base)
    save(page)
    for f in d["files"].values():
        if f["mimeType"] != FOLDER:
            f["trashed"] = True                                          # Darren bins the backup in Drive
    save(page)
    assert len(visible(d)) == 1


def test_a_binned_folder_gets_a_new_one(page, base):
    d = drive(page)
    connect(page, base)
    save(page)
    for i in list(d["files"]):
        d["files"][i]["trashed"] = True                                  # the folder and the file binned
    save(page)
    assert len(visible(d)) == 1
    live = [f for f in d["files"].values() if f["mimeType"] == FOLDER and not f.get("trashed")]
    assert len(live) == 1 and visible(d)[0]["parents"] != []
