"""Bill due day (Darren, 21 Oct 2026, ticket #25): each bill can have a day of the month it is due. Kept for good
(kv "bill_due", {bill key: 1-31}), shown under the bill's name as "due 5th", set from the bill's ⋯ menu (POST /due).
It never changes any amount. Fake data only."""
import shutil
from datetime import date

import pytest

import run
from fintrack.billchange import get_due, set_due
from fintrack.store import open_db
from tests.conftest import DATA

ACME = "ACME MOTORS PLC"


def test_set_get_and_clear(tmp_path):
    conn = open_db(tmp_path / "t.db")
    assert get_due(conn) == {}
    set_due(conn, "DD|SKY|", 5)
    set_due(conn, "DD|GAS|", 31)
    assert get_due(conn) == {"DD|SKY|": 5, "DD|GAS|": 31}
    set_due(conn, "DD|SKY|", None)                                     # None = no due day any more
    assert get_due(conn) == {"DD|GAS|": 31}


@pytest.mark.parametrize("bad", [0, 32, -1, "x", 2.5, True])
def test_bad_days_are_refused_and_change_nothing(tmp_path, bad):
    conn = open_db(tmp_path / "t.db")
    set_due(conn, "DD|SKY|", 5)
    with pytest.raises(ValueError):
        set_due(conn, "DD|SKY|", bad)
    assert get_due(conn) == {"DD|SKY|": 5}


def test_a_text_number_is_fine(tmp_path):
    conn = open_db(tmp_path / "t.db")
    set_due(conn, "DD|SKY|", "12")
    assert get_due(conn) == {"DD|SKY|": 12}


# ---- on the page ---------------------------------------------------------------------------------

flask = pytest.importorskip("flask")
import web  # noqa: E402
from fintrack.home import home_data  # noqa: E402


@pytest.fixture
def db(tmp_path):
    inbox = tmp_path / "statements"
    inbox.mkdir()
    for n in ("statement_2024_08.pdf", "statement_2024_09.pdf", "statement_2024_10.pdf"):
        shutil.copy(DATA / n, inbox / n)
    run.main(in_dir=inbox, out_dir=tmp_path / "output", ask=lambda p: "2500", wage_payer=ACME, ask_items=lambda p: "")
    return tmp_path / "tracker.db"


def client_for(db):
    app = web.create_app(db, wage_payer=ACME, today=date(2024, 10, 25))
    app.testing = True
    return app.test_client()


def first_key(db):
    return home_data(open_db(db), wage_payer=ACME, today=date(2024, 10, 25))["pay"]["bills"][0]["key"]


def bills(db):
    return home_data(open_db(db), wage_payer=ACME, today=date(2024, 10, 25))["pay"]["bills"]


def test_every_bill_has_a_due_field_empty_to_start(db):
    assert all(b["due"] is None for b in bills(db))


def test_post_due_sets_it_and_the_page_shows_it(db):
    key, c = first_key(db), client_for(db)
    r = c.post("/due", data={"key": key, "day": "5"})
    assert r.status_code == 303
    assert get_due(open_db(db)) == {key: 5}
    assert next(b for b in bills(db) if b["key"] == key)["due"] == 5
    assert "due 5th" in c.get("/").data.decode()


def test_post_due_blank_clears_it(db):
    key, c = first_key(db), client_for(db)
    c.post("/due", data={"key": key, "day": "5"})
    c.post("/due", data={"key": key, "day": ""})
    assert get_due(open_db(db)) == {}
    assert "due 5th" not in c.get("/").data.decode()


@pytest.mark.parametrize("day", ["0", "32", "abc", "-3", "2.5"])
def test_post_due_ignores_bad_days(db, day):
    key, c = first_key(db), client_for(db)
    c.post("/due", data={"key": key, "day": "7"})
    r = c.post("/due", data={"key": key, "day": day})
    assert r.status_code == 303
    assert get_due(open_db(db)) == {key: 7}


def test_post_due_ignores_a_bill_that_is_not_there(db):
    r = client_for(db).post("/due", data={"key": "DD|NOT A BILL|", "day": "5"})
    assert r.status_code == 303 and get_due(open_db(db)) == {}


def test_due_day_changes_no_amounts(db):
    before = home_data(open_db(db), wage_payer=ACME, today=date(2024, 10, 25))["pay"]
    client_for(db).post("/due", data={"key": first_key(db), "day": "5"})
    after = home_data(open_db(db), wage_payer=ACME, today=date(2024, 10, 25))["pay"]
    assert (after["bills_last"], after["bills_avg"]) == (before["bills_last"], before["bills_avg"])


def test_the_menu_has_a_due_day_choice(db):
    assert "Due day" in client_for(db).get("/").data.decode()


@pytest.mark.parametrize("n,text", [(1, "1st"), (2, "2nd"), (3, "3rd"), (4, "4th"), (11, "11th"), (12, "12th"),
                                    (13, "13th"), (21, "21st"), (22, "22nd"), (23, "23rd"), (30, "30th"), (31, "31st")])
def test_ordinal_filter(n, text):
    f = web.create_app(":memory:").jinja_env.filters["ordinal"]
    assert f(n) == text
