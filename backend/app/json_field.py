"""Cross-dialect JSON column type.

SQLite has no native JSON column, so we serialize to TEXT on that dialect and
deserialize on read. Postgres handles JSONB natively — when we point
``DATABASE_URL`` at Postgres later this column type transparently switches.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class JSONField(TypeDecorator):  # type: ignore[type-arg]
    """JSON column that maps to JSONB on Postgres and TEXT on SQLite.

    Always exchanges native Python dicts/lists with the application — callers
    never see the serialized form.
    """

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):  # type: ignore[no-untyped-def]
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect):  # type: ignore[no-untyped-def]
        if value is None:
            return None
        if dialect.name == "postgresql":
            # JSONB driver handles dict ↔ json itself.
            return value
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

    def process_result_value(self, value: Any, dialect):  # type: ignore[no-untyped-def]
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value
        return json.loads(value)
