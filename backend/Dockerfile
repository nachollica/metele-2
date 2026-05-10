# syntax=docker/dockerfile:1.7
#
# METELE backend — FastAPI served by uvicorn, dependencies managed via uv.
#
# Two-stage build:
#   1. builder: pull deps with `uv sync` into a pinned virtualenv, and
#      pre-download the WordNet corpora so the first request to /words/related
#      doesn't spend ~2s on a synchronous nltk.download.
#   2. runtime: distroless-ish python:3.11-slim with only the venv, the NLTK
#      data, and the app code. Listens on 8000.

# ----- Builder ---------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# `uv` is the project's package manager (pyproject.toml + uv.lock locally).
RUN pip install --no-cache-dir "uv>=0.5"

WORKDIR /app

# Copy only metadata first so the heavy `uv sync` layer caches across code
# changes. If a uv.lock is present in the build context it is honored;
# otherwise uv resolves from pyproject.toml.
COPY pyproject.toml ./
COPY uv.loc[k] ./

RUN uv sync --no-dev --frozen 2>/dev/null \
    || uv sync --no-dev

# Pre-fetch NLTK corpora into a stable, image-baked location so the runtime
# stage doesn't need network access. NLTK searches NLTK_DATA first.
ENV NLTK_DATA=/usr/local/share/nltk_data
RUN /app/.venv/bin/python -c "import nltk, os; \
    os.makedirs(os.environ['NLTK_DATA'], exist_ok=True); \
    nltk.download('wordnet', download_dir=os.environ['NLTK_DATA'], quiet=True); \
    nltk.download('omw-1.4', download_dir=os.environ['NLTK_DATA'], quiet=True)"


# ----- Runtime ---------------------------------------------------------------
FROM python:3.11-slim

# Run as a non-root user. We don't need a home dir, just an account uvicorn
# can drop privileges to once the venv is in place.
RUN groupadd --system --gid 1001 metele \
 && useradd  --system --uid 1001 --gid metele --no-create-home metele

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NLTK_DATA=/usr/local/share/nltk_data \
    PATH="/app/.venv/bin:${PATH}"

WORKDIR /app

# Bring across the prepared venv and corpora.
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /usr/local/share/nltk_data /usr/local/share/nltk_data

# Application source. Owned by the runtime user so the SQLite file written
# next to the app at runtime is writable without further chowning.
COPY --chown=metele:metele app /app/app

# SQLite default lives next to the app; mount a volume here in production
# (or set DATABASE_URL to point at Postgres) to persist between deploys.
ENV DATABASE_URL=sqlite:////app/data/metele.db
# RUN mkdir -p /app/data && chown metele:metele /app/data

USER metele

EXPOSE 8000

# `--proxy-headers` is required because Caddy terminates TLS in front of us
# and we want the real client IP / scheme to make it through to access logs.
# CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
