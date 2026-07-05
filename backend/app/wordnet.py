"""
WordNet-backed word logic, free of any HTTP/auth/DB coupling.

Given a list of "category" words (e.g. ``["animal", "fruit"]``), ``expand_related``
walks each input's WordNet graph into a flat list of related words. We descend
hyponyms (more specific concepts), and at each visited synset also harvest:

- instance hyponyms (named entities classified under the concept)
- "similar_tos" for adjectives (the hyponym graph doesn't apply to them)
- member / part / substance holonyms-and-meronyms when ``include_partonomy`` is
  set, which adds e.g. "petal" / "stem" for "flower"

The walk is breadth-first so depth means *graph distance from the input*, not
a recursion budget on a single relation.

``random_words`` instead samples an unseeded, varied pool for when the player
gives no categories at all.

This module is imported both by the ``/words`` route and by the
``app.scripts.related_words`` CLI, so it must not pull in FastAPI, settings,
the DB, or auth — keep those dependencies in ``app.routes.words``.

NLTK ships nothing by default. The ``ensure_corpora`` helper checks for the
data on disk (no-op if present) and only falls back to ``nltk.download`` when
it has to. In production the corpora are baked into the image — see the
backend Dockerfile.
"""

from __future__ import annotations

import os
import random
import re
import threading
from collections import deque
from enum import Enum

from wordfreq import available_languages, zipf_frequency

# ---- Language ----------------------------------------------------------


class Language(str, Enum):
    """
    Supported game languages. Values match the frontend ``[lang]`` segment
    (``en`` / ``es``) so the same identifier flows end-to-end.
    """

    EN = "en"
    ES = "es"

    @property
    def wordnet_code(self) -> str:
        """The 3-letter code WordNet/OMW expects."""
        return _WORDNET_CODES[self]


_WORDNET_CODES: dict[Language, str] = {
    Language.EN: "eng",
    Language.ES: "spa",
}


# ---- Commonness filter -------------------------------------------------


# Minimum wordfreq "zipf" score a word must clear to count as common enough for
# the game. The zipf scale runs ~0 (never seen) to ~8 (words like "the"); 2.5
# was tuned against the hand-curated frontend pools — it keeps every curated
# English (min 3.07) and Spanish (min 2.53) word while dropping obscure /
# scientific terms (e.g. "chordate" 1.31, "biped" 2.01, "Acaridae" 0.0).
DEFAULT_MIN_ZIPF = 2.5


def is_common(word: str, language: Language, min_zipf: float = DEFAULT_MIN_ZIPF) -> bool:
    """
    Whether ``word`` is frequent enough to be a fun, recognisable game word.

    Backed by wordfreq's zipf frequency for the language. Languages wordfreq
    doesn't cover are not filtered (returns True) so future languages degrade
    gracefully instead of yielding an empty pool.
    """
    if language.value not in available_languages():
        return True
    return zipf_frequency(word, language.value) >= min_zipf


# ---- Accept-Language parsing -------------------------------------------


_TAG_RE = re.compile(r"^\s*([A-Za-z]{2,3})(?:-[A-Za-z0-9]+)?\s*$")


def parse_accept_language(header: str | None) -> Language | None:
    """Pick the first supported language from ``Accept-Language``."""
    if not header:
        return None

    candidates: list[tuple[float, int, str]] = []
    for index, raw in enumerate(header.split(",")):
        part = raw.strip()
        if not part:
            continue
        tag, _, params = part.partition(";")
        weight = 1.0
        for raw_param in params.split(";"):
            param = raw_param.strip()
            if param.startswith("q="):
                try:
                    weight = float(param[2:])
                except ValueError:
                    weight = 0.0
                break
        if weight <= 0:
            continue
        match = _TAG_RE.match(tag)
        if not match:
            continue
        candidates.append((-weight, index, match.group(1).lower()))

    candidates.sort()
    for _, _, primary in candidates:
        try:
            return Language(primary)
        except ValueError:
            continue
    return None


# ---- WordNet bootstrap -------------------------------------------------


_corpora_lock = threading.Lock()
# One-way readiness latch. An Event (vs a plain bool) lets us flip the flag
# without a module-level ``global`` and is safe to read outside the lock.
_corpora_ready = threading.Event()


def _have_corpora() -> bool:
    """
    Cheap probe to skip the download path entirely on prepared images.

    ``nltk.data.find`` raises ``LookupError`` when the resource isn't present,
    so a successful return means we have everything we need.
    """
    import nltk

    try:
        nltk.data.find("corpora/wordnet")
        nltk.data.find("corpora/omw-1.4")
    except LookupError:
        return False
    return True


def ensure_corpora() -> None:
    """
    Make WordNet + OMW available, idempotently and without touching HOME.

    In production the corpora are baked into the image under ``$NLTK_DATA``
    and this is a one-shot in-memory flag flip. If we *do* need to download
    (fresh dev box), we force ``download_dir`` to ``$NLTK_DATA`` so we never
    write to ``~/`` — the container user has no home and that path is the
    historical source of permission-denied tracebacks on startup.
    """
    if _corpora_ready.is_set():
        return
    with _corpora_lock:
        if _corpora_ready.is_set():
            return
        if _have_corpora():
            _corpora_ready.set()
            return

        import nltk

        # Pick a writable target. We prefer NLTK_DATA so a download survives a
        # container restart on a mounted volume.
        target = os.environ.get("NLTK_DATA") or os.path.join(os.path.expanduser("~"), "nltk_data")
        os.makedirs(target, exist_ok=True)
        nltk.download("wordnet", download_dir=target, quiet=True)
        nltk.download("omw-1.4", download_dir=target, quiet=True)
        _corpora_ready.set()


# ---- Word expansion ----------------------------------------------------


def _clean_lemma(name: str) -> str:
    """
    OMW lemmas are underscore-joined for multi-word entries — turn them
    back into normal phrases. Also strip any whitespace.
    """
    return name.replace("_", " ").strip()


def _is_usable_word(word: str) -> bool:
    """
    Whether ``word`` is usable as a required word.

    - ``isalpha`` drops multi-word lemmas ("fire engine"), hyphenated /
      apostrophed entries, and anything with digits ("mp3", "75th") — the
      frontend's match check only looks at the last finished token, so those
      are unreachable or unattractive.
    - The lowercase check drops proper nouns (WordNet keeps common nouns
      lowercase and named entities like "Algiers" capitalized), which make
      poor, place-name-y game words.
    """
    return word.isalpha() and word == word.lower()


def _neighbours(synset, *, include_partonomy: bool):
    """
    Yield related synsets to descend into next.

    Hyponyms are the backbone of the walk; the other relations widen the net
    so we get more candidate lemmas at a given depth instead of relying on
    cranking ``depth`` up (which is exponential).
    """
    yield from synset.hyponyms()
    yield from synset.instance_hyponyms()
    # ``similar_tos`` only fires on adjectives; harmless no-op on nouns/verbs.
    yield from synset.similar_tos()
    if include_partonomy:
        yield from synset.member_holonyms()
        yield from synset.part_holonyms()
        yield from synset.substance_holonyms()
        yield from synset.member_meronyms()
        yield from synset.part_meronyms()
        yield from synset.substance_meronyms()


def expand_related(
    words: list[str],
    language: Language,
    *,
    depth: int,
    limit: int,
    include_partonomy: bool = True,
    min_zipf: float = DEFAULT_MIN_ZIPF,
) -> list[str]:
    """
    Collect related words via a bounded BFS over the WordNet graph.

    - Each input word seeds the frontier at depth 0 (all its synsets).
    - We descend up to ``depth`` edges along the relations in ``_neighbours``.
    - Lemmas of every visited synset (including the seeds' own hyponyms etc.)
      get added to the candidate set, minus the inputs themselves, any
      non-single-token entries, and anything below the commonness threshold.
    - The result is a random sample of ``limit`` words from that set (a shuffle
      when the set is smaller than ``limit``). Sampling, rather than an
      alphabetical head, keeps the pool varied across a session.
    """
    ensure_corpora()
    from nltk.corpus import wordnet as wn

    excluded = {w.strip().casefold() for w in words if w.strip()}
    code = language.wordnet_code

    collected: set[str] = set()
    seen: set = set()
    frontier: deque = deque()

    for raw in words:
        word = raw.strip()
        if not word:
            continue
        for synset in wn.synsets(word, lang=code):
            if synset in seen:
                continue
            seen.add(synset)
            frontier.append((synset, 0))

    while frontier:
        synset, dist = frontier.popleft()
        # Harvest this synset's lemmas (in the requested language), unless it is
        # a proper-noun instance (a named entity like a city or person), which
        # makes a poor game word.
        is_instance = synset.pos() == "n" and synset.instance_hypernyms()
        for lemma in () if is_instance else synset.lemma_names(code):
            cleaned = _clean_lemma(lemma)
            if not cleaned or cleaned.casefold() in excluded:
                continue
            if not _is_usable_word(cleaned):
                continue
            if not is_common(cleaned, language, min_zipf):
                continue
            collected.add(cleaned)
        if dist >= depth:
            continue
        for neighbour in _neighbours(synset, include_partonomy=include_partonomy):
            if neighbour in seen:
                continue
            seen.add(neighbour)
            frontier.append((neighbour, dist + 1))

    pool = list(collected)
    if len(pool) > limit:
        return random.sample(pool, limit)
    random.shuffle(pool)
    return pool


# ---- Random pool -------------------------------------------------------


# POS tags we accept for random words. WordNet uses 'a' (adjective) and 's'
# (adjective satellite) for adjectives, 'n' nouns, 'v' verbs. Adverbs ('r') and
# anything else are dropped — they make for poor evocative "required words".
_ALLOWED_POS: frozenset[str] = frozenset({"n", "a", "s", "v"})

# Cache the full lemma-name list per language. ``all_lemma_names`` materialises
# a large list (~147k entries for English); building it is cheap and we reuse it
# across requests.
_lemma_names_cache: dict[str, list[str]] = {}

# Multiplier on ``limit`` for the candidate batch we sample. Most lemmas fail the
# commonness / POS / proper-noun filters, so we oversample to still reach
# ``limit`` survivors in a single pass without scanning the whole corpus.
_RANDOM_OVERSAMPLE = 15


def _lemma_names_for(code: str) -> list[str]:
    """Return (and memoise) the full list of WordNet lemma names for ``code``."""
    cached = _lemma_names_cache.get(code)
    if cached is not None:
        return cached
    ensure_corpora()
    from nltk.corpus import wordnet as wn

    with _corpora_lock:
        cached = _lemma_names_cache.get(code)
        if cached is None:
            cached = list(wn.all_lemma_names(lang=code))
            _lemma_names_cache[code] = cached
    return cached


def _has_game_worthy_sense(word: str, code: str) -> bool:
    """
    Whether ``word`` has a noun/adjective/verb sense that isn't a proper noun.

    Instance synsets (cities, people — e.g. "atlanta", "bismarck", which OMW
    returns lowercased so the case filter misses them) are skipped: a word
    qualifies only if some allowed-POS sense is a generic concept, not a named
    entity.
    """
    from nltk.corpus import wordnet as wn

    for synset in wn.synsets(word, lang=code):
        if synset.pos() not in _ALLOWED_POS:
            continue
        if synset.pos() == "n" and synset.instance_hypernyms():
            continue
        return True
    return False


def random_words(
    language: Language,
    *,
    limit: int,
    min_zipf: float = DEFAULT_MIN_ZIPF,
) -> list[str]:
    """
    Sample a pool of random words for ``language``.

    Draws from the language's common, single-token, noun/adjective/verb
    vocabulary: a candidate batch is sampled up front, the cheap filters
    (usable form, commonness) run first, and the costlier WordNet sense check
    only runs on the survivors. Order is random — unlike ``expand_related``
    there is no meaningful sort, the whole point is variety.
    """
    code = language.wordnet_code
    names = _lemma_names_for(code)
    if not names:
        return []

    batch_size = min(len(names), max(limit * _RANDOM_OVERSAMPLE, limit))
    batch = random.sample(names, batch_size)

    collected: list[str] = []
    seen: set[str] = set()
    for raw in batch:
        if len(collected) >= limit:
            break
        cleaned = _clean_lemma(raw)
        if not cleaned or not _is_usable_word(cleaned):
            continue
        folded = cleaned.casefold()
        if folded in seen:
            continue
        if not is_common(cleaned, language, min_zipf):
            continue
        if not _has_game_worthy_sense(cleaned, code):
            continue
        seen.add(folded)
        collected.append(cleaned)

    return collected


# ---- Morphological variants -------------------------------------------


# Cheap suffix-stripping heuristics. WordNet's own ``morphy`` covers the
# common English inflections (plurals, verb tenses), and these tables match
# its behaviour in reverse so we can *generate* candidate inflections from a
# lemma. They're conservative — false positives are fine here because we
# follow up with a wordnet membership check.
_EN_SUFFIXES_TO_LEMMA = [
    ("s", ""),
    ("ses", "s"),
    ("xes", "x"),
    ("zes", "z"),
    ("ches", "ch"),
    ("shes", "sh"),
    ("ies", "y"),
    ("ves", "f"),
    ("ves", "fe"),
    ("ed", ""),
    ("ed", "e"),
    ("ied", "y"),
    ("ing", ""),
    ("ing", "e"),
    ("ying", "ie"),
]

_ES_SUFFIXES_TO_LEMMA = [
    ("s", ""),
    ("es", ""),
    ("ces", "z"),
    # Verb forms (extremely partial — gerunds + common conjugations).
    ("ando", "ar"),
    ("iendo", "er"),
    ("iendo", "ir"),
    ("ado", "ar"),
    ("ido", "er"),
    ("ido", "ir"),
]


def _candidate_stems(word: str, language: Language) -> set[str]:
    """
    Heuristic inverse-morphology — produce possible lemmas of ``word``.

    Used as a quick filter; the caller should still verify against WordNet.
    """
    table = _EN_SUFFIXES_TO_LEMMA if language is Language.EN else _ES_SUFFIXES_TO_LEMMA
    stems: set[str] = {word}
    lowered = word.lower()
    for suffix, replacement in table:
        if lowered.endswith(suffix) and len(lowered) > len(suffix):
            stems.add(lowered[: -len(suffix)] + replacement)
    return stems


def is_morphological_variant(
    candidate: str,
    target: str,
    language: Language = Language.EN,
) -> bool:
    """
    Whether ``candidate`` is an inflected form of ``target`` (or vice versa).

    Examples (EN):
        is_morphological_variant("loving", "love")   → True
        is_morphological_variant("lovers", "love")   → True
        is_morphological_variant("romance", "love")  → False  # synonym, not variant
        is_morphological_variant("passion", "love")  → False

    Strategy: collapse both words to their WordNet lemma forms (``wn.morphy``
    over every POS, plus heuristic suffix-stripping for ES where OMW lacks a
    morphy implementation). If any pair of resulting stems overlaps, we call
    it a variant. This is intentionally permissive — the goal is "accept the
    word the player wrote because it's the same root", not lexicographic
    purity. Not wired into any endpoint yet; will be integrated by the
    required-word matcher later.
    """
    ensure_corpora()
    from nltk.corpus import wordnet as wn

    if not candidate or not target:
        return False

    a = candidate.strip().lower()
    b = target.strip().lower()
    if not a or not b:
        return False
    if a == b:
        return True

    code = language.wordnet_code

    def _lemma_forms(word: str) -> set[str]:
        forms: set[str] = {word}
        # wn.morphy handles English natively. For Spanish OMW it tends to
        # return None, so we lean on the heuristic table there.
        for pos in (wn.NOUN, wn.VERB, wn.ADJ, wn.ADV):
            # Best-effort: morphy can raise assorted internal errors on odd
            # inputs, and a miss just means "no variant from this POS".
            try:
                morphed = wn.morphy(word, pos)
            except Exception:  # noqa: BLE001
                morphed = None
            if morphed:
                forms.add(morphed)
        forms |= _candidate_stems(word, language)
        # Also consider the surface forms that share a WordNet lemma in the
        # caller's language. This catches irregular plurals etc.
        for synset in wn.synsets(word, lang=code):
            for lemma in synset.lemma_names(code):
                lower = lemma.lower()
                # Only count lemma names that share a meaningful prefix —
                # otherwise "love" → "passion" via the synset graph would
                # leak in and that's *not* a morphological variant.
                if _shares_prefix(lower, word):
                    forms.add(lower)
        return forms

    return bool(_lemma_forms(a) & _lemma_forms(b))


def _shares_prefix(a: str, b: str, *, min_overlap: int = 3) -> bool:
    """A and B look related at the orthographic level."""
    limit = min(len(a), len(b), max(min_overlap, min(len(a), len(b)) - 2))
    if limit < min_overlap:
        return a == b
    return a[:limit] == b[:limit]
