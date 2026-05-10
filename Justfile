# set shell := ["bash", "-c"]
# set dotenv-load := true

[doc("Print available commands.")]
help:
    @just --list

[doc("Setup for local development.")]
init:
    @pnpm i

[doc("Compile frontend static assets.")]
build:
    pnpm build

[doc("Start local dev server.")]
[group("development")]
dev:
    pnpm dev

[doc("Run ESLint.")]
[group("development")]
lint:
    pnpm lint

[doc("Code autoformatting and linting.")]
[group("development")]
lint-fix:
    pnpm lint --fix

[doc("Static type checking.")]
[group("development")]
tsc:
    pnpm typecheck

[doc("Run test suite.")]
[group("development")]
test:
    pnpm test

[doc("Run all code checks.")]
[group("development")]
cc: lint-fix tsc test

[doc("Build assets and deploy to SSH server.")]
[group("deploy")]
deploy: build
    tar --exclude='backend/.venv' -zcf metele.gz out backend docker-compose.yaml conf
    scp metele.gz utonium:.0/code/metele
    ssh utonium 'cd .0/code/metele/ && tar zxf metele.gz && rm metele.gz && docker compose build'
    # ssh utonium 'cd .0/code/metele/ && docker compose down && rm -rf out/ && tar zxf metele.gz && rm metele.gz && docker compose up -d'
    # sudo find . -name "._*" -delete
    rm metele.gz
