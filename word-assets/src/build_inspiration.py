"""
CLI: parse film-grab image sitemaps into the inspiration catalog JSONL.

film-grab.com publishes ``image-sitemap-N.xml`` files (linked from its
``image-sitemap-index-1.xml``); each ``<url>`` pairs a page ``<loc>`` with an
``<image:loc>``. This reads whatever ``image-sitemap*.xml`` files are already
present in an input directory (download them yourself — robots.txt allows it)
and merges them, de-duplicated by page URL, into one JSON-Lines file:

    {"loc": "2014/12/12/and-the-ship-sails-on/",
     "img": "wp-content/uploads/.../And-The-Ship-...jpg"}

Every entry lives under ``https://film-grab.com/``, so that prefix is stripped
before writing (it would otherwise be repeated on all ~4000 lines) and is
reconstructed by the frontend loader at read time — see ``FILM_GRAB_PREFIX`` in
``inspiration.ts``. An ``<image:loc>`` that is NOT hosted on film-grab.com (a
handful of sitemap entries point off-site) has nothing to strip and is dropped.

Only real film pages are kept: film-grab's per-film permalinks look like
``https://film-grab.com/yyyy/mm/dd/slug/`` — eight segments when split on ``/``
(scheme, empty, host, year, month, day, slug, trailing empty). Everything else
in the sitemaps (numeric/junk slugs, archive pages) has a different segment
count and is dropped. The display title is NOT stored: the frontend derives it
from the ``loc`` slug at render time (the card title is upper-cased in CSS, so a
plain hyphens-to-spaces conversion is enough) — see ``inspiration.ts``.

JSON Lines so the output can be sliced with plain shell tools (``shuf``,
``head``, ``grep``) to curate which films ship; the frontend loads the result
and renders the image directly (see the Words/inspiration notes in ``README.md``).

    python build_inspiration.py             # read ./ , write the catalog
    python build_inspiration.py ~/sitemaps  # read a specific input directory
"""

from __future__ import annotations

import argparse
import glob
import json
import os
from xml.etree import ElementTree as ET

from contract import inspiration_path

# Sitemap XML namespaces (default sitemap schema + Google's image extension).
_NS = {
    "s": "http://www.sitemaps.org/schemas/sitemap/0.9",
    "image": "http://www.google.com/schemas/sitemap-image/1.1",
}

# A film-grab film permalink splits into exactly this many ``/``-segments:
# ``https://film-grab.com/2014/12/12/and-the-ship-sails-on/`` ->
# ['https:', '', 'film-grab.com', '2014', '12', '12', 'and-the-ship-sails-on', '']
_FILM_PAGE_SEGMENTS = 8

# Common host every ``loc``/``img`` lives under; stripped from the stored value
# (see module docstring). Mirror of ``FILM_GRAB_PREFIX`` in
# ``frontend/lib/flowfic/inspiration.ts``.
_PREFIX = "https://film-grab.com/"


def is_film_page(loc: str) -> bool:
    """True for a ``/yyyy/mm/dd/slug/`` film permalink, False for junk/archive."""
    return len(loc.split("/")) == _FILM_PAGE_SEGMENTS


def parse_sitemap(path: str) -> list[dict[str, str]]:
    """Parse one sitemap file into ``{loc, img}`` records, ``_PREFIX`` stripped.

    Skips ``<url>`` entries that lack a page loc or an image loc, whose page loc
    is not a film permalink (see :func:`is_film_page`), or whose image is not
    hosted on film-grab.com (nothing to strip, so it can't round-trip through
    ``FILM_GRAB_PREFIX`` on the frontend).
    """
    records: list[dict[str, str]] = []
    root = ET.parse(path).getroot()
    for url in root.findall("s:url", _NS):
        loc_el = url.find("s:loc", _NS)
        img_el = url.find("image:image/image:loc", _NS)
        if loc_el is None or img_el is None:
            continue
        loc = (loc_el.text or "").strip()
        img = (img_el.text or "").strip()
        if not loc or not img or not is_film_page(loc):
            continue
        if not loc.startswith(_PREFIX) or not img.startswith(_PREFIX):
            continue
        records.append({"loc": loc[len(_PREFIX) :], "img": img[len(_PREFIX) :]})
    return records


def collect(input_dir: str) -> list[dict[str, str]]:
    """Merge every ``image-sitemap*.xml`` under ``input_dir``, de-duped by loc.

    First occurrence of a page URL wins; input files are processed in sorted
    (stable) order so the output is deterministic.
    """
    by_loc: dict[str, dict[str, str]] = {}
    paths = sorted(glob.glob(os.path.join(input_dir, "image-sitemap*.xml")))
    if not paths:
        raise SystemExit(f"no image-sitemap*.xml files found in {os.path.abspath(input_dir)!r}")
    for path in paths:
        for record in parse_sitemap(path):
            by_loc.setdefault(record["loc"], record)
    return list(by_loc.values())


def main() -> None:
    parser = argparse.ArgumentParser(prog="build_inspiration")
    parser.add_argument(
        "input_dir",
        nargs="?",
        default=".",
        help="Directory holding image-sitemap*.xml files (default: current dir).",
    )
    args = parser.parse_args()

    records = collect(args.input_dir)
    out_path = inspiration_path()
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"{len(records)} films -> {out_path}")


if __name__ == "__main__":
    main()
