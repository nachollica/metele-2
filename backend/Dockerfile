# syntax=docker/dockerfile:1.7

# FLOWFIC backend — FastAPI served by uvicorn, dependencies managed via uv.
# Two-stage build:
#   1. builder: pull the runtime deps with `uv sync --no-dev` into a pinned
#      virtualenv. `--no-dev` excludes both the dev and the build dependency
#      groups, so the heavy build-only tooling (spaCy, wordfreq) never lands
#      here. The per-language word artifacts are precomputed offline and
#      committed under `data/`, so there is nothing to download or encode.
#   2. runtime: python:3.14-slim with the venv, the app code, and the committed
#      word artifacts. Runs fully offline. Listens on 8000.

ARG PYTHON_DOCKER_TAG=3.14-slim
ARG APP_ROOT=/src
ARG VENV_PATH=${APP_ROOT}/.venv
ARG UV_VERSION=0.11.26

# ----- Builder ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG} AS builder

ARG APP_ROOT
ARG VENV_PATH

ENV UV_PYTHON_PREFERENCE=only-system \
    UV_PROJECT_ENVIRONMENT=${VENV_PATH} \
    UV_LINK_MODE=copy

# Pin uv, override with `--build-arg UV_VERSION=...`
ARG UV_VERSION
RUN pip install --no-cache-dir "uv==${UV_VERSION}"

WORKDIR ${APP_ROOT}

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen


# ----- Runtime ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG}

ARG APP_ROOT
ARG VENV_PATH

# Run as a non-root user with a home dir.
RUN groupadd --system --gid 1001 flowfic \
    && useradd  --system --uid 1001 --gid flowfic --create-home --home-dir /home/flowfic flowfic

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/home/flowfic \
    PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR ${APP_ROOT}

COPY --from=builder ${VENV_PATH} ${VENV_PATH}

# App code plus the per-language vector pools (data/word_pool/*.npz).
# `default_data_dir()` resolves to ${APP_ROOT}/data. The pools are built by the
# top-level word-assets tool and are gitignored, so guard against building an
# image without them (fail loudly rather than shipping degraded word features).
COPY --chown=flowfic:flowfic app ${APP_ROOT}/app
COPY --chown=flowfic:flowfic data ${APP_ROOT}/data
RUN test -f data/word_pool/en.v1.npz && test -f data/word_pool/es.v1.npz \
    || (echo "ERROR: missing data/word_pool/*.npz — run 'just word-assets::vectors' first" >&2; exit 1)

# Writable data dir for the SQLite file in local/dev runs.
RUN install -d -o flowfic -g flowfic /data

USER flowfic

EXPOSE 8000

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
