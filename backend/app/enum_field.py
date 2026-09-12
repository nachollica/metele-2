"""
Cross-dialect string-backed enum column type.

Postgres native enums require an ``ALTER TYPE`` migration to add a value and
cannot be expressed as a plain additive column, so schema evolution here
stays deliberately dumb: every enum column is a ``VARCHAR`` on both dialects,
and this type is what keeps the Python attribute a real ``Enum`` member
instead of a bare string. Consistency of the *set* of allowed values is
enforced only on the Python side (by this type on read/write, and by
Pydantic at the API boundary) — the database has no CHECK constraint.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


class EnumString(TypeDecorator):  # type: ignore[type-arg]
    """
    Enum column that stores its member's ``.value`` as plain text.

    Always exchanges the bound ``Enum`` type with the application — a bad
    value already sitting in the column (a hand-edited row, a rollback)
    raises ``ValueError`` on read rather than handing back an unchecked
    string.
    """

    impl = String
    cache_ok = True

    def __init__(self, enum_type: type, **kwargs: Any) -> None:
        # Named (not underscore-prefixed) so SQLAlchemy's `_static_cache_key`
        # includes it — distinct bound enums must not share a compiled
        # statement cache entry.
        super().__init__(**kwargs)
        self.enum_type = enum_type

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return self.enum_type(value).value

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        return self.enum_type(value)
