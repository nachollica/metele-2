"""
Literature Dataset Downloader.

Dependencies:
    pip install datasets requests tqdm
"""

import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import requests
from tqdm import tqdm

try:
    from datasets import load_dataset
except ImportError:
    print("Please install datasets: pip install datasets")
    sys.exit(1)


def sanitize_filename(name: Any) -> str:
    """Removes invalid characters for directory and file names."""
    if not name or not isinstance(name, str):
        return "Unknown"
    keepcharacters = (" ", ".", "_", "-")
    return "".join(c for c in name if c.isalnum() or c in keepcharacters).strip()


def download_hf_gutenberg(base_dir: Path) -> None:
    """Downloads Project Gutenberg corpus via Hugging Face."""
    source_name = "hf_gutenberg"
    print(f"Starting download for {source_name}...")

    dataset = load_dataset("Fhrozen/gutenberg8k", split="train", streaming=True)
    max_books = 100

    with tqdm(total=max_books, desc=source_name, unit="book") as pbar:
        for i, record in enumerate(dataset):
            if i >= max_books:
                break

            author_raw = record.get("Author") or record.get("author")
            title_raw = record.get("Title") or record.get("title")
            text_raw = record.get("Text") or record.get("text")

            author = sanitize_filename(author_raw)
            title = sanitize_filename(title_raw) if title_raw else f"Document_{i}"
            text = str(text_raw) if text_raw else ""

            if not text:
                continue

            book_dir = base_dir / source_name / author / title
            book_dir.mkdir(parents=True, exist_ok=True)

            file_path = book_dir / "content.txt"
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(text)

            pbar.update(1)


def download_direct_requests(base_dir: Path) -> None:
    """Downloads specific classics directly using the requests library."""
    source_name = "direct_requests"
    print(f"Starting download for {source_name}...")

    books_to_download = [
        {"id": "1342", "author": "Jane Austen", "title": "Pride and Prejudice"},
        {"id": "84", "author": "Mary Shelley", "title": "Frankenstein"},
        {"id": "11", "author": "Lewis Carroll", "title": "Alice in Wonderland"},
        {
            "id": "1661",
            "author": "Arthur Conan Doyle",
            "title": "The Adventures of Sherlock Holmes",
        },
    ]

    with tqdm(total=len(books_to_download), desc=source_name, unit="book") as pbar:
        for book in books_to_download:
            url = f"https://www.gutenberg.org/files/{book['id']}/{book['id']}-0.txt"
            try:
                response = requests.get(url, timeout=15)
                response.raise_for_status()
                text = response.text

                author = sanitize_filename(book["author"])
                title = sanitize_filename(book["title"])

                book_dir = base_dir / source_name / author / title
                book_dir.mkdir(parents=True, exist_ok=True)

                file_path = book_dir / "content.txt"
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(text)
            except requests.RequestException as e:
                print(f"\nFailed to download {url}: {e}")

            pbar.update(1)


def main() -> None:
    sources_map: dict[str, Callable[[Path], None]] = {
        "hf_gutenberg": download_hf_gutenberg,
        "direct_requests": download_direct_requests,
    }

    args = sys.argv[1:]
    if not args:
        target_sources = list(sources_map.keys())
    else:
        target_sources = [arg for arg in args if arg in sources_map]
        invalid_sources = [arg for arg in args if arg not in sources_map]
        if invalid_sources:
            print(f"Warning: Ignoring unknown sources: {', '.join(invalid_sources)}")
            print(f"Available sources: {', '.join(sources_map.keys())}")

    if not target_sources:
        print("No valid sources selected. Exiting.")
        sys.exit(1)

    base_output_dir = Path("nlp_literature_datasets")
    base_output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Output directory: {base_output_dir.resolve()}")
    print(f"Sources to process: {', '.join(target_sources)}\n")

    for source in target_sources:
        handler = sources_map[source]
        handler(base_output_dir)

    print("\nAll requested downloads completed.")


if __name__ == "__main__":
    main()
