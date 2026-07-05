"""
Cross-dialect JSON column type.

SQLite has no native JSON column, so we serialize to TEXT on that dialect and
deserialize on read. Postgres handles JSONB natively — when we point
``DATABASE_URL`` at Postgres later this column type transparently switches.

A column may optionally bind a Pydantic type (``value_type``): when set, the
field validates and serializes through a :class:`pydantic.TypeAdapter`, so the
attribute round-trips as a typed model (or list of models) instead of a raw
dict. Left unset, it exchanges plain dicts/lists as before.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import TypeAdapter
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class JSONField(TypeDecorator):  # type: ignore[type-arg]
    """
    JSON column that maps to JSONB on Postgres and TEXT on SQLite.

    Always exchanges native Python objects with the application — callers never
    see the serialized form. When constructed with ``value_type`` the exchanged
    objects are validated Pydantic models; otherwise they are plain dicts/lists.
    """

    impl = Text
    cache_ok = True

    def __init__(self, value_type: Any = None, **kwargs: Any) -> None:
        # ``value_type`` is named (not underscore-prefixed) so SQLAlchemy's
        # ``_static_cache_key`` includes it — distinct bound types must not
        # share a compiled-statement cache entry.
        super().__init__(**kwargs)
        self.value_type = value_type
        self._adapter = TypeAdapter(value_type) if value_type is not None else None

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if self._adapter is not None:
            # Validate-then-dump: coerces a dict or model instance into the
            # bound type and rejects anything that doesn't fit, so the schema
            # is enforced at the storage boundary too.
            value = self._adapter.dump_python(self._adapter.validate_python(value), mode="json")
        if dialect.name == "postgresql":
            # JSONB driver handles dict ↔ json itself.
            return value
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        raw = value if dialect.name == "postgresql" else json.loads(value)
        if self._adapter is not None:
            return self._adapter.validate_python(raw)
        return raw
