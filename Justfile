# set shell := ["bash", "-c"]
# set dotenv-load := true

[doc("Print available commands.")]
help:
    @just --list

[doc("Setup for local development.")]
init:
    @pnpm i

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
deploy: cc
    pnpm build
    tar zcf metele.gz out
    scp metele.gz ash:.0/code/metele
    ssh ash 'rm -rf .0/code/metele/out/'
    ssh ash 'cd .0/code/metele/ && tar zxf metele.gz && find . -name "._*" -delete && docker compose down && docker compose up -d'
