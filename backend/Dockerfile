# syntax=docker/dockerfile:1.7

# FLOWFIC backend — FastAPI served by uvicorn, dependencies managed via uv.
# Three-stage build:
#   1. lock: turn uv.lock into a requirements file. Runs on the build machine's
#      own architecture (see the stage's comment).
#   2. builder: install those pinned deps into a virtualenv for the *target*
#      architecture. `--no-dev` at export time excludes both the dev and the
#      build dependency groups, so the heavy build-only tooling (spaCy,
#      wordfreq) never lands here. The per-language word artifacts are
#      precomputed offline and committed under `data/`, so there is nothing to
#      download or encode.
#   3. runtime: python:3.14-slim with the venv, the app code, and the committed
#      word artifacts. Runs fully offline. Listens on 8000.

ARG PYTHON_DOCKER_TAG=3.14-slim
ARG APP_ROOT=/src
ARG VENV_PATH=${APP_ROOT}/.venv
ARG UV_VERSION=0.11.26

# ----- Lock export -----------------------------------------------------------
# Pinned to the *build* machine's architecture: uv's binary segfaults under
# QEMU, so an arm64 laptop cross-building for the amd64 server cannot run it in
# an emulated stage. All it does here is flatten the lock into a requirements
# file, which is architecture-independent (it carries every platform's wheel
# hashes and environment markers), so running it natively changes nothing about
# the result.
FROM --platform=${BUILDPLATFORM} python:${PYTHON_DOCKER_TAG} AS lock

# Pin uv, override with `--build-arg UV_VERSION=...`
ARG UV_VERSION
RUN pip install --no-cache-dir "uv==${UV_VERSION}"

WORKDIR /lock

COPY pyproject.toml uv.lock ./
# The project itself is virtual (no build-system), so `--no-emit-project`
# exports exactly the set `uv sync --no-dev` would have installed.
RUN uv export --frozen --no-dev --no-emit-project -o requirements.txt


# ----- Builder ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG} AS builder

ARG VENV_PATH

COPY --from=lock /lock/requirements.txt /tmp/requirements.txt
# Every dependency resolves to a wheel on both architectures, so this unpacks
# archives and compiles nothing — the one thing QEMU emulation does reliably.
# pip enforces the hashes the export carries.
RUN python -m venv ${VENV_PATH} \
    && ${VENV_PATH}/bin/pip install --no-cache-dir -r /tmp/requirements.txt


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
