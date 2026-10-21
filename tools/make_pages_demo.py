import sys, re
sys.path.insert(0, "/home/user/wheres-my-money-lite")
from datetime import date
from pathlib import Path
import web
from fintrack.home import home_data
from fintrack.billchange import set_due
from fintrack.store import open_db
S = Path(sys.argv[1]); out = Path(sys.argv[2])
db = S/"tracker.db"
c = open_db(db)
for b, day in zip(home_data(c, wage_payer="ACME MOTORS PLC", today=date(2024,10,25))["pay"]["bills"][:3], (1, 5, 22)):
    set_due(c, b["key"], day)
app = web.create_app(db, wage_payer="ACME MOTORS PLC", today=date(2024,10,25))
cl = app.test_client()
r = cl.get("/demo"); html = r.get_data(as_text=True); print(r.status_code, len(html))
refs = set(re.findall(r'(?:src|href)="([^"]+)"', html)); print(refs)
out.mkdir(parents=True, exist_ok=True); html=html.replace("?v=0.03","")
for ref in refs:
    if ref.startswith("/") and not ref.startswith("//"):
        rr = cl.get(ref)
        if rr.status_code == 200 and "." in ref.split("/")[-1]:
            p = out / ref.lstrip("/").split("?")[0]; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(rr.data)
            html = html.replace('"'+ref+'"', '"'+ref.lstrip("/")+'"')
        else: print("skip", ref, rr.status_code)
(out/"index.html").write_text(html)
