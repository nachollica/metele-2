# syntax=docker/dockerfile:1.7

# FLOWFIC backend — FastAPI served by uvicorn, dependencies managed via uv.
# Two-stage build:
#   1. builder: pull deps with `uv sync` into a pinned virtualenv, download the
#      embedding model, and precompute the per-language matrices so the first
#      request doesn't spend time downloading or encoding at runtime.
#   2. runtime: python:3.14-slim with the venv, the baked model + matrices, and
#      the app code. Runs fully offline. Listens on 8000.

# Parameters for known paths, pinned versions, etc.
ARG PYTHON_VERSION=3.14
ARG PYTHON_DOCKER_TAG=3.14-slim
ARG APP_ROOT=/src
ARG VENV_PATH=${APP_ROOT}/.venv
# Model cache + per-language matrices live here; the app reads them from
# WORD_EMBEDDINGS_DIR and HF from HF_HOME (both under this dir).
ARG WORD_EMBEDDINGS_DIR=/usr/local/share/word_embeddings
# Footprint tier / model built into the image. Override with `--build-arg`.
ARG WORD_EMBEDDINGS_SIZE=small
ARG UV_VERSION=0.11.26

# ----- Builder ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG} AS builder

ARG APP_ROOT
ARG VENV_PATH
ARG WORD_EMBEDDINGS_DIR
ARG WORD_EMBEDDINGS_SIZE

ENV UV_PYTHON_PREFERENCE=only-system \
    UV_PROJECT_ENVIRONMENT=${VENV_PATH} \
    UV_LINK_MODE=copy

# Pin uv, override with `--build-arg UV_VERSION=...`
ARG UV_VERSION
RUN pip install --no-cache-dir "uv==${UV_VERSION}"

WORKDIR ${APP_ROOT}

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Precompute the model + per-language matrices into the baked directory. This
# downloads the sentence-transformers model (HF cache under the same dir) and
# encodes each language's vocabulary. Needs the app code (word_engine + the build
# script), which is decoupled from settings/DB.
ENV WORD_EMBEDDINGS_DIR=${WORD_EMBEDDINGS_DIR} \
    WORD_EMBEDDINGS_SIZE=${WORD_EMBEDDINGS_SIZE} \
    HF_HOME=${WORD_EMBEDDINGS_DIR}/hf
COPY app ${APP_ROOT}/app
RUN "${VENV_PATH}/bin/python" -m app.scripts.build_embeddings


# ----- Runtime ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG}

ARG APP_ROOT
ARG VENV_PATH
ARG WORD_EMBEDDINGS_DIR
ARG WORD_EMBEDDINGS_SIZE

# Run as a non-root user with a home dir for any HF/torch cache writes.
RUN groupadd --system --gid 1001 flowfic \
    && useradd  --system --uid 1001 --gid flowfic --create-home --home-dir /home/flowfic flowfic

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/home/flowfic \
    WORD_EMBEDDINGS_DIR=${WORD_EMBEDDINGS_DIR} \
    WORD_EMBEDDINGS_SIZE=${WORD_EMBEDDINGS_SIZE} \
    HF_HOME=${WORD_EMBEDDINGS_DIR}/hf \
    # Never reach the network at runtime — the model is baked into the image.
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR ${APP_ROOT}

COPY --from=builder ${VENV_PATH} ${VENV_PATH}
COPY --from=builder --chown=flowfic:flowfic ${WORD_EMBEDDINGS_DIR} ${WORD_EMBEDDINGS_DIR}

COPY --chown=flowfic:flowfic app ${APP_ROOT}/app

# Writable data dir for the SQLite file in local/dev runs.
RUN install -d -o flowfic -g flowfic /data

USER flowfic

EXPOSE 8000

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
