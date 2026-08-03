"""
Tests for the film-grab sitemap parser (film-page filter + parse/merge).

The XML shape mirrors film-grab's ``image-sitemap-N.xml`` (default sitemap
namespace + Google's image extension); synthetic fixtures pin the behaviour
without touching the network.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from build_inspiration import collect, is_film_page, parse_sitemap

_SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
 <url>
  <loc>https://film-grab.com/2014/12/12/and-the-ship-sails-on/</loc>
  <image:image>
   <image:loc>https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg</image:loc>
  </image:image>
 </url>
 <url>
  <loc>https://film-grab.com/2024/04/15/stopmotion/</loc>
  <image:image>
   <image:loc>https://film-grab.com/wp-content/uploads/Stopmotion-18.jpg</image:loc>
  </image:image>
 </url>
 <url>
  <loc>https://film-grab.com/013-2/</loc>
  <image:image>
   <image:loc>https://film-grab.com/wp-content/uploads/junk-013.jpg</image:loc>
  </image:image>
 </url>
 <url>
  <loc>https://film-grab.com/2024/04/15/no-image/</loc>
 </url>
</urlset>
"""


class TestIsFilmPage:
    def test_accepts_a_dated_permalink(self) -> None:
        assert is_film_page("https://film-grab.com/2014/12/12/and-the-ship-sails-on/")

    def test_rejects_a_junk_slug(self) -> None:
        # e.g. https://film-grab.com/013-2/ — five segments, not eight.
        assert not is_film_page("https://film-grab.com/013-2/")

    def test_rejects_a_permalink_without_trailing_slash(self) -> None:
        # film-grab's sitemap always emits the trailing slash; a bare permalink
        # is seven segments and is not treated as a film page.
        assert not is_film_page("https://film-grab.com/2024/04/15/stopmotion")


class TestParseSitemap:
    def test_extracts_pairs_and_skips_junk_and_imageless_entries(self, tmp_path: Path) -> None:
        path = tmp_path / "image-sitemap-1.xml"
        path.write_text(_SITEMAP, encoding="utf-8")
        records = parse_sitemap(str(path))
        assert records == [
            {
                "loc": "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
                "img": "https://film-grab.com/wp-content/uploads/And-The-Ship-01.jpg",
            },
            {
                "loc": "https://film-grab.com/2024/04/15/stopmotion/",
                "img": "https://film-grab.com/wp-content/uploads/Stopmotion-18.jpg",
            },
        ]


class TestCollect:
    def test_merges_files_deduping_by_loc(self, tmp_path: Path) -> None:
        (tmp_path / "image-sitemap-1.xml").write_text(_SITEMAP, encoding="utf-8")
        # A second file repeats one page and adds none new → deduped away.
        (tmp_path / "image-sitemap-2.xml").write_text(_SITEMAP, encoding="utf-8")
        records = collect(str(tmp_path))
        locs = [r["loc"] for r in records]
        assert locs == [
            "https://film-grab.com/2014/12/12/and-the-ship-sails-on/",
            "https://film-grab.com/2024/04/15/stopmotion/",
        ]

    def test_raises_when_no_sitemaps_present(self, tmp_path: Path) -> None:
        with pytest.raises(SystemExit):
            collect(str(tmp_path))
