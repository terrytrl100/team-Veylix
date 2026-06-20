"""
engine/build.py — inline the canonical sources into the standalone index.html.

Veylix ships as a single offline HTML file, which means the sim and the data are
*embedded* in index.html. To avoid drift, those embeds are GENERATED, never edited
by hand: the model lives in web/veylix-sim.js and the parameters in data/, and this
script regenerates the marked regions of index.html from them.

Run after engine/calibrate.py (new data) or any change to web/veylix-sim.js:

    python engine/build.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
INDEX = REPO / "index.html"
SIM = REPO / "web" / "veylix-sim.js"
CALIBRATION = REPO / "data" / "calibration.json"
PORTFOLIOS = REPO / "data" / "portfolios"


def replace_region(html: str, name: str, body: str) -> str:
    """Replace text between /* BUILD:<name>:START ... */ and /* BUILD:<name>:END */."""
    pat = re.compile(
        r"(/\* BUILD:%s:START[^\n]*?\*/).*?(/\* BUILD:%s:END \*/)" % (name, name),
        re.S,
    )
    if not pat.search(html):
        raise SystemExit(f"marker BUILD:{name} not found in index.html")
    return pat.sub(lambda m: m.group(1) + "\n" + body + "\n" + m.group(2), html)


def main() -> None:
    html = INDEX.read_text()

    cal = json.loads(CALIBRATION.read_text())
    calib_body = "const CALIB = " + json.dumps(cal, indent=2) + ";"

    books = {p.stem: json.loads(p.read_text()) for p in sorted(PORTFOLIOS.glob("*.json"))}
    books_body = "const BOOKS = " + json.dumps(books, indent=2) + ";"

    sim_body = SIM.read_text().strip()

    html = replace_region(html, "CALIB", calib_body)
    html = replace_region(html, "BOOKS", books_body)
    html = replace_region(html, "SIM", sim_body)

    INDEX.write_text(html)

    print("Inlined into index.html:")
    print(f"  CALIB  <- data/calibration.json (model_version {cal['model_version']}, as_of {cal['as_of']})")
    print(f"  BOOKS  <- {len(books)} portfolio(s): {', '.join(books)}")
    print(f"  SIM    <- web/veylix-sim.js ({len(sim_body.splitlines())} lines)")


if __name__ == "__main__":
    main()
