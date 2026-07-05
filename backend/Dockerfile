# syntax=docker/dockerfile:1.7

# FLOWFIC backend — FastAPI served by uvicorn, dependencies managed via uv.
# Two-stage build:
#   1. builder: pull deps with `uv sync` into a pinned virtualenv, and
#      pre-download the WordNet corpora so the first request to /words/related
#      doesn't spend ~2s on a synchronous nltk.download.
#   2. runtime: distroless-ish python:3.14-slim with only the venv, the NLTK
#      data, and the app code. Listens on 8000.

# Parameters for known paths, pinned versions, etc.
ARG PYTHON_VERSION=3.14
ARG PYTHON_DOCKER_TAG=3.14-slim
ARG APP_ROOT=/src
ARG VENV_PATH=${APP_ROOT}/.venv
ARG NLTK_DATA=/usr/local/share/nltk_data
ARG UV_VERSION=0.11.26

# ----- Builder ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG} AS builder

ARG APP_ROOT
ARG VENV_PATH
ARG NLTK_DATA
ARG UV_VERSION

ENV UV_PYTHON_PREFERENCE=only-system \
    UV_PROJECT_ENVIRONMENT=${VENV_PATH} \
    UV_LINK_MODE=copy

# Pin uv, override with `--build-arg UV_VERSION=...`
RUN pip install --no-cache-dir "uv==${UV_VERSION}"

WORKDIR ${APP_ROOT}

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Pre-fetch NLTK corpora into a stable, image-baked location.
ENV NLTK_DATA=${NLTK_DATA}
RUN "${VENV_PATH}/bin/python" -c "import nltk, os; \
    os.makedirs(os.environ['NLTK_DATA'], exist_ok=True); \
    nltk.download('wordnet', download_dir=os.environ['NLTK_DATA'], quiet=True); \
    nltk.download('omw-1.4', download_dir=os.environ['NLTK_DATA'], quiet=True)"


# ----- Runtime ---------------------------------------------------------------
FROM python:${PYTHON_DOCKER_TAG}

ARG APP_ROOT
ARG VENV_PATH
ARG NLTK_DATA

# Run as a non-root user. Create a home dir for NLTK to write into ~/nltk_data
RUN groupadd --system --gid 1001 flowfic \
    && useradd  --system --uid 1001 --gid flowfic --create-home --home-dir /home/flowfic flowfic

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/home/flowfic \
    NLTK_DATA=${NLTK_DATA} \
    PATH="${VENV_PATH}/bin:${PATH}"

WORKDIR ${APP_ROOT}

COPY --from=builder ${VENV_PATH} ${VENV_PATH}
COPY --from=builder --chown=flowfic:flowfic ${NLTK_DATA} ${NLTK_DATA}

COPY --chown=flowfic:flowfic app ${APP_ROOT}/app

# Writable data dir for the SQLite file in local/dev runs.
RUN install -d -o flowfic -g flowfic /data

USER flowfic

EXPOSE 8000

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
