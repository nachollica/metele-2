"""FLOWFIC backend package."""

from __future__ import annotations

# Keep in sync with [project].version in pyproject.toml. We can't source it from
# package metadata at runtime: the project runs in uv "app" mode (no
# [build-system], so it isn't installed as a distribution) and the production
# image doesn't ship pyproject.toml — both importlib.metadata and reading the
# TOML would fail. A literal is the only thing guaranteed present everywhere.
__version__ = "0.1.0"

__all__ = ["__version__"]
