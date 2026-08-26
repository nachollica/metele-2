# Root justfile — deployment + cross-cutting commands.
# Per-project commands live in `frontend/justfile` and `backend/justfile`.
#
# Tip: `just frontend::dev`, `just backend::test`, etc., delegate to the
# inner justfiles via the imports below.

mod backend
mod frontend
# Build-time generator for the word artifacts (vector pools + match maps) that
# feed the backend and frontend. Its heavy NLP deps live only here.
mod word-assets

[doc("Print available commands.")]
help:
    @just --list

[doc("Print available commands and subcommands.")]
help-all:
    @just --list --list-submodules

# ----- Local stack (docker compose) -------------------------------------

[group("compose")]
[doc("Build all compose images locally.")]
build:
    docker compose build

[group("compose")]
[doc("Start the full stack (caddy + api + db) in the background.")]
up:
    docker compose up -d

[group("compose")]
[doc("Stop the full stack but keep volumes.")]
down:
    docker compose down

[group("compose")]
[doc("Tail logs from all services.")]
logs:
    docker compose logs -f --tail=200

[group("compose")]
[doc("Rebuild and restart only the API service.")]
api-restart:
    docker compose up -d --build api

# ----- Local development ----------------------------------------------

[group("development")]
[doc("Start the dockerized API + frontend dev server for local development.")]
dev: up
    just frontend::dev

# ----- Code checks --------------------------------------------

[group("checks")]
[doc("Run all checks across frontend, backend, and the word-assets tool.")]
cc:
    just frontend::cc
    just backend::cc
    just word-assets::cc

[group("checks")]
[doc("Verify the generated word artifacts are present (pools + match maps).")]
check-assets:
    just word-assets::check

# ----- Build-time assets ----------------------------------------------

[group("assets")]
[doc("Parse local film-grab image-sitemap*.xml files into the inspiration \
catalog JSONL (frontend/public/inspiration, gitignored). Download the sitemaps \
into INPUT_DIR (default: repo root) first; the output is JSON Lines so you can \
slice it with shell tools. Usage: just inspiration [INPUT_DIR]")]
inspiration INPUT_DIR=".":
    uv run --project word-assets python word-assets/src/build_inspiration.py "{{INPUT_DIR}}"

# ----- Deploy ----------------------------------------------------------

# Host this deploys to (must be defined in `~/.ssh/config`).
deploy_host := "misty"
# Path on the remote server where the project lives.
deploy_path := ".0/flowfic"
# CPU architecture of the deploy host. The build machine is arm64, the server
# amd64, so the backend image must be cross-built or Docker refuses to run it.
deploy_platform := "linux/amd64"

[group("deploy")]
[doc("Sync prod files to the SSH server.")]
[confirm("Are you sure? [y/N]")]
prod-update:
    scp -r prod/* {{deploy_host}}:{{deploy_path}}/

[group("deploy")]
[doc("Start services in SSH server.")]
prod-up:
    ssh {{deploy_host}} 'cd {{deploy_path}} && docker compose up -d'

[group("deploy")]
[doc("Stop services in SSH server.")]
[confirm("Are you sure? [y/N]")]
prod-down:
    ssh {{deploy_host}} 'cd {{deploy_path}} && docker compose down'

[group("deploy")]
[doc("Restart API container.")]
[confirm("Are you sure? [y/N]")]
prod-restart-api:
    ssh {{deploy_host}} 'cd {{deploy_path}} && docker compose up -d --force-recreate --no-deps api'

[group("deploy")]
[doc("Build the backend image, ship it via SSH, and load it on the server.")]
deploy-backend:
    # docker compose build api
    docker build --platform {{deploy_platform}} -t flowfic-api:latest ./backend
    docker save flowfic-api:latest | gzip > flowfic-api.tar.gz
    scp flowfic-api.tar.gz {{deploy_host}}:{{deploy_path}}/
    # `docker rmi` is tolerant (`|| true`): it fails when the image doesn't
    # exist yet (first deploy) or is still used by a running container — in
    # both cases `docker load` retags and the old image is left dangling.
    ssh {{deploy_host}} 'cd {{deploy_path}} && (docker rmi flowfic-api:latest || true) && gunzip -c flowfic-api.tar.gz | docker load'
    rm flowfic-api.tar.gz

[group("deploy")]
[doc("Build the frontend static assets and replace the remote out/ directory.")]
deploy-frontend:
    just frontend::build
    tar -C frontend -zcf out.tar.gz out
    scp out.tar.gz {{deploy_host}}:{{deploy_path}}/
    ssh {{deploy_host}} 'cd {{deploy_path}} && rm -rf out && tar zxf out.tar.gz'
    rm out.tar.gz

[group("deploy")]
[doc("Run full deployment. Builds and ships both artifacts first, so the stack is only down for the restart itself.")]
deploy: deploy-backend deploy-frontend prod-down prod-up

[group("prod-db")]
[doc("Open SSH tunnel for Prod DB.")]
db-tunnel:
    ssh -nNT -L 5432:127.0.0.1:5432 {{deploy_host}}

[group("prod-db")]
[doc("Connect to the remote Prod DB.")]
db:
    PGPASSWORD=flowfic_pw psql -h 127.0.0.1 -p 5432 -U flowfic_user -d flowfic_db
