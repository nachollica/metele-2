"""
CLI: parse film-grab image sitemaps into the inspiration catalog JSONL.

film-grab.com publishes ``image-sitemap-N.xml`` files (linked from its
``image-sitemap-index-1.xml``); each ``<url>`` pairs a page ``<loc>`` with an
``<image:loc>``. This reads whatever ``image-sitemap*.xml`` files are already
present in an input directory (download them yourself — robots.txt allows it)
and merges them, de-duplicated by page URL, into one JSON-Lines file:

    {"title": "And The Ship Sails On",
     "page": "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
     "image": "https://film-grab.com/wp-content/uploads/.../And-The-Ship-...jpg"}

The title is derived from the page slug (last path segment: hyphens to spaces,
each word capitalized). JSON Lines so the output can be sliced with plain shell
tools (``shuf``, ``head``, ``grep``) to curate which films ship; the frontend
loads the result and renders the image directly (see the Words/inspiration notes
in ``README.md``).

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


def derive_title(page_url: str) -> str:
    """Film title from a film-grab page URL's last path segment.

    ``.../and-the-ship-sails-on/`` -> ``And The Ship Sails On``.
    """
    slug = page_url.rstrip("/").rsplit("/", 1)[-1]
    return " ".join(word.capitalize() for word in slug.split("-") if word)


def parse_sitemap(path: str) -> list[dict[str, str]]:
    """Parse one sitemap file into ``{title, page, image}`` records.

    Skips ``<url>`` entries that lack a page loc or an image loc.
    """
    records: list[dict[str, str]] = []
    root = ET.parse(path).getroot()
    for url in root.findall("s:url", _NS):
        page_el = url.find("s:loc", _NS)
        image_el = url.find("image:image/image:loc", _NS)
        if page_el is None or image_el is None:
            continue
        page = (page_el.text or "").strip()
        image = (image_el.text or "").strip()
        if not page or not image:
            continue
        records.append({"title": derive_title(page), "page": page, "image": image})
    return records


def collect(input_dir: str) -> list[dict[str, str]]:
    """Merge every ``image-sitemap*.xml`` under ``input_dir``, de-duped by page.

    First occurrence of a page URL wins; input files are processed in sorted
    (stable) order so the output is deterministic.
    """
    by_page: dict[str, dict[str, str]] = {}
    paths = sorted(glob.glob(os.path.join(input_dir, "image-sitemap*.xml")))
    if not paths:
        raise SystemExit(f"no image-sitemap*.xml files found in {os.path.abspath(input_dir)!r}")
    for path in paths:
        for record in parse_sitemap(path):
            by_page.setdefault(record["page"], record)
    return list(by_page.values())


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
