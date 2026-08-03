"""
HTRC Extracted Features Downloader.

Dependencies:
    pip install htrc-feature-reader pandas tqdm
"""

import sys
from pathlib import Path
from typing import Any

from htrc_features import Volume
from tqdm import tqdm


def sanitize_filename(name: Any) -> str:
    """Removes invalid characters for directory and file names."""
    if not name or not isinstance(name, str):
        return "Unknown"
    keepcharacters = (' ', '.', '_', '-')
    return "".join(c for c in name if c.isalnum() or c in keepcharacters).strip()


def parse_author(author_list: Any) -> str:
    """Extracts a clean author name from HTRC metadata."""
    if not author_list:
        return "Unknown_Author"
    if isinstance(author_list, list):
        author = str(author_list[0])
    else:
        author = str(author_list)

    # Cleans up dates often appended to author names in library metadata
    clean_author = author.split("1")[0].split("2")[0].strip()
    clean_author = clean_author.replace(",", "")
    return sanitize_filename(clean_author)


def download_htrc_features(htids: list[str], base_dir: Path) -> None:
    """Downloads token frequencies and metadata using HTRC Feature Reader."""
    source_name = "hathitrust_extracted_features"
    print(f"Starting download for {source_name}...")

    with tqdm(total=len(htids), desc=source_name, unit="vol") as pbar:
        for htid in htids:
            try:
                # Initializes the volume and downloads the feature dataset temporarily
                vol = Volume(htid)

                author = parse_author(vol.author)
                title = sanitize_filename(vol.title) if vol.title else f"Volume_{htid}"
                year = sanitize_filename(str(vol.year)) if vol.year else "UnknownYear"
                lang = sanitize_filename(vol.language) if vol.language else "unknown_lang"

                # Creates structure: <source>/<author>/<lang>/<year-title>/
                folder_name = f"{year}-{title}"
                vol_dir = base_dir / source_name / author / lang / folder_name
                vol_dir.mkdir(parents=True, exist_ok=True)

                # Extracts word frequencies across the entire volume
                df_tokens = vol.tokenlist(pages=False)

                if df_tokens is not None and not df_tokens.empty:
                    csv_path = vol_dir / "word_frequencies.csv"
                    df_tokens.to_csv(csv_path)

                    # Saves supporting metadata in the same directory
                    meta_path = vol_dir / "metadata.txt"
                    with open(meta_path, "w", encoding="utf-8") as f:
                        f.write(f"HTID: {htid}\n")
                        f.write(f"Author: {author}\n")
                        f.write(f"Title: {vol.title}\n")
                        f.write(f"Year: {year}\n")
                        f.write(f"Language: {lang}\n")
                        f.write(f"URL: {vol.handle_url}\n")

            # Best-effort batch: any single volume may fail (network, missing
            # features, API quirks); swallow it and continue with the rest.
            except Exception as e:  # noqa: BLE001
                print(f"\nFailed to process {htid}: {e}")

            pbar.update(1)


def main() -> None:
    # A curated list of example HTIDs covering different languages and authors.
    # To process all authors at scale, you would parse the Hathifiles database
    # to extract millions of HTIDs and pass them to this script.
    default_htids = [
        "hvd.32044013656053",  # Jane Austen, Pride and prejudice v.1 (eng)
        "hvd.32044013656061",  # Jane Austen, Pride and prejudice v.2 (eng)
        "uc1.b3623910",        # Miguel de Cervantes, Don Quijote (spa)
        "mdp.39015004735257"   # Arthur Conan Doyle, Adventures of Sherlock Holmes (eng)
    ]

    args = sys.argv[1:]
    htids_to_process = args if args else default_htids

    base_output_dir = Path("nlp_literature_datasets")
    base_output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Output directory: {base_output_dir.resolve()}")
    print(f"Volumes to process: {len(htids_to_process)}\n")

    download_htrc_features(htids_to_process, base_output_dir)
    print("\nAll requested features downloaded.")


if __name__ == "__main__":
    main()
