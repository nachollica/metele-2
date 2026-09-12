# stress — load-testing the production stack

A harness for pointing controlled, realistic load at the deployed Flowfic stack and measuring what the server does about it. It drives everything over ssh using your own `~/.ssh/config`, so it can only reach hosts you can already reach, and it ships nothing into any production image.

**This targets production.** Read [Safety](#safety) before the first run.

## The machines

| role | host | what it is |
|---|---|---|
| system under test | `misty` | Oracle `VM.Standard.E2.1.Micro` — 1 OCPU (2 vCPU), 954 MB RAM, 0.48 Gbps, region `iad`. Runs caddy + api + db. |
| load generator | `mario` | Identical micro instance, same region. ~1 ms to misty. |
| browser canary | `luigi` | Identical micro instance. Kept separate so Chromium never competes with the generator for its single OCPU. |

Generating load from a laptop measures your ISP more than the server — the round trip is ~180 ms against mario's ~1 ms, and that difference dominates every number. `--load-host` and `--target-ip` exist so this moves: a future VM inside misty's VCN just passes the private address, and the traffic never touches the public internet or Cloudflare at all.

```bash
# Today, from mario over the public IP:
just stress::run --run-id my-run

# A future same-VCN generator:
just stress::run --run-id my-run --load-host newvm --target-ip 10.0.0.28
```

That VM will need `:443` open from its subnet in misty's security list. The VNIC cap of 0.48 Gbps still applies.

## Setup

```bash
just stress::init              # python deps
just stress::provision-load    # k6 on mario           (one-time)
just stress::provision-canary  # k6 + Chrome on luigi  (one-time)
```

Provisioning fetches the pinned k6 release tarball rather than adding an apt repo — the Oracle images ship no `dirmngr`, so the keyserver path fails — and installs Google's own Chrome deb, because Ubuntu 24.04's `chromium-browser` is only a snap shim.

## A full run

```bash
just stress::status                                    # what is deployed right now
just stress::devlogin on                               # open the window  ⚠️ see Safety
just stress::seed --run-id r1 --seed 40,5 --seed 8,80 --seed 2,300
just stress::canary --run-id r1 --label baseline       # idle browser timings
just stress::run --run-id r1 --profile load --rate 8   # load + host sampling + report
just stress::canary --run-id r1 --label loaded         # browser timings under load
just stress::clean --run-id r1                         # remove every synthetic row
just stress::devlogin off                              # close the window
```

Artifacts land in `stress/runs/<run-id>/` (gitignored): `report.md`, `k6-summary.json`, `monitor.csv`, `config.json`, and the canary summaries.

## Parameters

### How much data exists — `--seed USERS,STORIES`

Repeatable, and the tiers compose into a population:

```bash
--seed 40,5 --seed 8,80 --seed 2,300     # a realistic long tail
--seed 50,50                             # flat, easier to reason about
--seed 20,0                              # accounts with no history at all
```

This matters more than it looks. `GET /stats/overview`, `/achievements` and `/challenges` each scan **every** story the caller owns, and the landing screen fires all three in parallel. Against users with no stories they are nearly free and the run measures nothing; the heavy tier is what exercises the scan.

### What the traffic looks like — `--mix JOURNEY=WEIGHT`

Repeatable; unnamed journeys keep their default weight. Weights are relative, not percentages — `--rate` sets the volume.

| journey | default | what one iteration does |
|---|--:|---|
| `anon` | 60 | Shell, the discovered chunk graph, match map, inspiration catalog, `/ping` |
| `landing` | 20 | The above plus `/auth/me` and the three parallel `/stats/*` scans |
| `sprint` | 10 | `POST /words/related` or `/words/random` — the CPU-expensive call |
| `stories` | 7 | `/stories?limit=100`, `/stories/count`, one detail |
| `finish` | 3 | `POST /stories`, then the three `/stats/*` again |

The defaults are read-heavy on purpose: a sprint runs 5–45 minutes making **no backend calls at all**, so page loads vastly outnumber starts, and every save trails a start that happened minutes earlier.

### How hard — `--profile` and `--rate`

`--rate` is the baseline arrivals per second; the profile's stages scale it. The model is open (k6's `ramping-arrival-rate`), so arrivals hold at the target no matter how slow the server gets — a fixed pool of virtual users would throttle itself as latency rose and report a healthy box.

| profile | shape |
|---|---|
| `smoke` | 40s at 0.2x. Proves the chain works; not a measurement. |
| `load` | Expected steady traffic, held long enough for memory to settle. |
| `stress` | 1x → 2x → 3x, to find where latency and errors turn. |
| `spike` | A sudden 6x crowd, then back down. Recovery matters as much as peak. |
| `soak` | An hour flat. Leaks and swap creep only appear over time. |
| `breakpoint` | Climbs to 10x until the error budget breaks. |

### Other knobs

- `--lang es|en` — picks which match map the static journeys fetch: **2.9 MB** for `es` against **800 KB** for `en`. A real difference in bytes and in Caddy's compression cost.
- `--via-cdn` — go through Cloudflare instead of straight at the origin. Off by default, because the edge caches every static asset (so misty would barely see the run) and a high rate from one IP is what CF's rate rules exist to stop.
- `--sample-interval` — seconds between host samples, default 1.
- `--target-ip`, `--load-host`, `--canary-host`, `--sut-host` — see [The machines](#the-machines).

### Pass/fail

Thresholds are **availability-only**: error rate and timeouts, overall and per journey. Latency is measured and reported but never fails a run — this hardware has no established baseline, so a p95 target would be a guess that either never fires or fires constantly. On a 954 MB box, falling over is the real risk and errors capture it unambiguously.

## Reading the report

`report.md` leads with where the machine went — per container CPU seconds, share of host CPU, and peak memory split into **anonymous**, **swap**, and **page cache**. That split is the point:

- **anon + swap** is what a process genuinely needs. On a host that has already paged most of itself out, resident size alone understates badly.
- **page cache** is reclaimable and follows the data, not the process, so it is reported separately rather than folded in.

Two caveats the report restates: the monitor samples `pg_stat_activity` through `docker exec` and that query's cost lands on the database container (at low load it can be most of the row), and `shared_buffers` is 128 MB but only counts once touched, so a short run understates a busy database.

Swap-in is a first-class signal here. This host idles with **~450 MB already in swap**, almost all of it the two uvicorn workers' word-vector pools, so thrash shows up as `pswpin` climbing long before CPU saturates.

### The canary

Compare a `baseline` label against a `loaded` one. The **delta** is the signal; the absolute figure carries the canary host's distance to the origin. Headed versus headless makes no difference to the server — both drive the same network stack and emit identical HTTP — so it always runs headless, which is strictly cheaper on the client.

## Safety

### The dev-login window

The backend refuses to enable its dev-user backdoor while `ENVIRONMENT=production`, so authenticated load needs the server moved to `development` for the duration. `just stress::devlogin on` does that by writing a **git-ignored `docker-compose.override.yaml` on the server** — never by editing the tracked `prod/docker-compose.yaml`, so this repository never carries a config that would weaken production if deployed by accident.

While the window is open:

- **`/api/docs` and `/api/openapi.json` are publicly reachable.**
- **`POST /auth/dev-login` will mint a token for any existing user row** — including real Auth0 accounts — for whoever holds the token. The token is generated fresh per window and written to `stress/runs/<run>/token` with mode 600.

Keep it short and close it from the same session that opened it. `devlogin off` removes the override, restarts, and then *verifies* against `/ping` that `environment` is back to `production` and `devUserEnabled` is false, rather than assuming it from a restart exiting zero. It also checks `/api/docs` is hidden again and exits non-zero if not.

If a run dies partway, close the window by hand:

```bash
ssh misty 'cd .0/flowfic && rm -f docker-compose.override.yaml && docker compose up -d --no-deps --force-recreate api'
just stress::status   # must report environment=production, dev login closed
```

### Synthetic data

Every row the harness writes is a user id prefixed `lt_<run-id>_<n>`, with its stories hanging off it. Cleanup is a filter on that prefix, escaped for `LIKE` and re-checked at the point of deletion, and the run id is validated against `[a-z0-9-]` before it ever reaches a pattern. Real accounts are Auth0 subs (`google-oauth2|…`) and cannot collide.

`clean --run-id RUN` scopes to one run; `clean --all` removes every load-test row from every run. Both verify zero rows remain afterwards and raise if not.

Seeding runs *inside* the API container from a script piped to its interpreter, so the production image never gains test tooling and the harness holds no database credentials of its own.

## Layout

```
stress/
  justfile              recipes; forwards flags verbatim to the CLI
  src/flowfic_stress/
    config.py           cohorts, mix, profiles, target routing (all pure, all tested)
    seeding.py          create and remove the synthetic population
    devlogin.py         open/close and verify the window
    runner.py           drive k6 on the generator and the canary host
    monitor.py          ship and run the host sampler
    report.py           merge k6 + host samples into report.md
    remote.py           ssh/scp/psql plumbing
  k6/
    load.js             protocol scenarios
    canary.js           the headless browser probe
    lib/                config, journeys, payloads
  scripts/monitor.sh    the sampler that runs on the SUT
```

`just stress::cc` runs the checks. The tests cover the pure configuration and the report reduction — the parts that decide how much load lands on production, which rows cleanup deletes, and whether the resource numbers mean what they say. Everything else talks to real servers and is exercised by a smoke run instead.
