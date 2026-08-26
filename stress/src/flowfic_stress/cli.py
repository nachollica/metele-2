"""
The harness command line.

Invoked through the justfile (``just stress::seed --seed 40,5``), which passes
arguments straight through, so every flag documented here is usable verbatim
from the repository root.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from flowfic_stress import devlogin, monitor, report, runner, seeding
from flowfic_stress.config import (
    DEFAULT_CANARY_HOST,
    DEFAULT_LOAD_HOST,
    DEFAULT_PROFILE,
    DEFAULT_SUT_HOST,
    DEFAULT_SUT_PATH,
    DEFAULT_TARGET_IP,
    JOURNEYS,
    PROFILES,
    PUBLIC_HOST,
    RunConfig,
    Target,
    new_run_id,
    parse_cohorts,
    parse_mix,
    validate_run_id,
)

RUNS_DIR = Path(__file__).resolve().parents[2] / "runs"


# ---- Shared arguments --------------------------------------------------


def _add_target_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--target-ip",
        default=DEFAULT_TARGET_IP,
        help=(
            "IP the public hostname is routed to, bypassing DNS and the CDN. "
            "Point this at a private address when generating load from inside "
            "the server's own VCN (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--via-cdn",
        action="store_true",
        help=(
            "Resolve normally and go through Cloudflare instead of straight at "
            "the origin. Measures the edge, not the server: static assets are "
            "served from cache and a high rate from one IP may be rate-limited."
        ),
    )
    parser.add_argument(
        "--sut-host",
        default=DEFAULT_SUT_HOST,
        help="SSH host running the stack under test (default: %(default)s).",
    )
    parser.add_argument(
        "--sut-path",
        default=DEFAULT_SUT_PATH,
        help="Path to the compose project on the SUT (default: %(default)s).",
    )


def _target_from(args: argparse.Namespace) -> Target:
    return Target(host=PUBLIC_HOST, ip=args.target_ip, via_cdn=args.via_cdn)


def _add_run_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--run-id",
        default=None,
        help="Identifier tagging every row and artifact (default: a UTC timestamp).",
    )
    parser.add_argument(
        "--profile",
        default=DEFAULT_PROFILE,
        choices=sorted(PROFILES),
        help="Load shape (default: %(default)s).",
    )
    parser.add_argument(
        "--rate",
        type=float,
        default=5.0,
        help=(
            "Baseline arrivals per second the profile's stages scale. Open model: "
            "arrivals do not slow down when the server does (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--lang",
        default="es",
        choices=["es", "en"],
        help=(
            "Locale the journeys use. Decides which match map is fetched — 2.9MB "
            "for es against 800KB for en (default: %(default)s)."
        ),
    )
    parser.add_argument(
        "--mix",
        action="append",
        default=[],
        metavar="JOURNEY=WEIGHT",
        help=(
            "Relative weight of one journey; repeatable. Unnamed journeys keep "
            f"their default. Journeys: {', '.join(JOURNEYS)}."
        ),
    )
    parser.add_argument(
        "--load-host",
        default=DEFAULT_LOAD_HOST,
        help="SSH host generating the load (default: %(default)s).",
    )
    parser.add_argument(
        "--canary-host",
        default=DEFAULT_CANARY_HOST,
        help="SSH host running the browser canary (default: %(default)s).",
    )


def _config_from(args: argparse.Namespace) -> RunConfig:
    run_id = validate_run_id(args.run_id) if args.run_id else new_run_id()
    return RunConfig(
        run_id=run_id,
        profile=args.profile,
        rate=args.rate,
        lang=args.lang,
        mix=parse_mix(args.mix),
        target=_target_from(args),
        load_host=args.load_host,
        canary_host=args.canary_host,
        sut_host=args.sut_host,
        sut_path=args.sut_path,
    )


# ---- Commands ----------------------------------------------------------


def cmd_status(args: argparse.Namespace) -> int:
    """Report what the deployed server currently is."""
    target = _target_from(args)
    info = devlogin.fetch_ping(target.base_url)
    workers = devlogin.sample_workers(target.base_url)

    print(f"target        {target.base_url} -> {'CDN' if target.via_cdn else target.ip}")
    print(f"version       {info.version}")
    print(f"environment   {info.environment}")
    print(f"dev login     {'OPEN' if info.dev_user_enabled else 'closed'}")
    if not info.reports_worker_detail:
        # Everything below comes from the /ping fields added for load testing.
        print("database      (not reported by this build)")
        print("word pools    (not reported by this build)")
        print("workers seen  (not reported by this build)")
        print("\nDeploy the current backend (`just deploy-backend`) for worker detail.")
        return 0

    print(f"database      {info.db_dialect}")
    print(f"word pools    {info.word_pools or 'NONE LOADED'}")
    print(f"workers seen  {len(workers)} distinct pids {sorted(workers)}")
    if len(workers) < 2:
        # Not a fault. These probes are sequential, and Caddy reuses one
        # upstream keep-alive connection for them, which pins them to whichever
        # worker accepted it. Concurrent traffic does reach the others.
        print("              (sequential probes ride one upstream connection)")
    if not info.pools_loaded:
        print("\nWARNING: no word pools resident — /words/* would return empty results.")
    return 0


def cmd_devlogin(args: argparse.Namespace) -> int:
    target = _target_from(args)
    run_dir = RUNS_DIR / (args.run_id or "current")
    token_path = run_dir / "token"

    if args.state == "on":
        print(f"Opening the dev-login window on {args.sut_host}...")
        token = devlogin.open_window(args.sut_host, args.sut_path, target.base_url)
        run_dir.mkdir(parents=True, exist_ok=True)
        token_path.write_text(token)
        token_path.chmod(0o600)
        print(f"Window OPEN. Token written to {token_path}")
        print("  /api/docs is now public and dev-login can mint a token for any")
        print("  existing user row. Close it with `just stress::devlogin off`.")
        return 0

    print(f"Closing the dev-login window on {args.sut_host}...")
    info = devlogin.close_window(args.sut_host, args.sut_path, target.base_url)
    token_path.unlink(missing_ok=True)
    exposed = devlogin.docs_exposed(target.base_url)
    print(f"Window closed. environment={info.environment} devUserEnabled={info.dev_user_enabled}")
    print(f"/api/docs exposed: {exposed}")
    if exposed:
        print("WARNING: docs still reachable — investigate before leaving this.")
        return 1
    return 0


def cmd_seed(args: argparse.Namespace) -> int:
    cohorts = parse_cohorts(args.seed)
    run_id = validate_run_id(args.run_id) if args.run_id else new_run_id()
    print(f"run id     {run_id}")
    print(f"seeding    {seeding.describe(cohorts)}")
    summary = seeding.seed(args.sut_host, run_id, cohorts)
    print(f"created    {summary.users_created} users, {summary.stories_created} stories")

    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "cohorts.json").write_text(
        json.dumps([{"users": c.users, "stories": c.stories} for c in cohorts], indent=2)
    )
    print(f"\nClean up with: just stress::clean --run-id {run_id}")
    return 0


def cmd_clean(args: argparse.Namespace) -> int:
    if args.run_id is None and not args.all:
        print("Refusing to run: pass --run-id RUN, or --all to remove every load-test row.")
        return 2
    run_id = validate_run_id(args.run_id) if args.run_id else None
    scope = f"run {run_id}" if run_id else "ALL load-test runs"
    users, stories = seeding.count_rows(args.sut_host, run_id)
    if users == 0 and stories == 0:
        print(f"Nothing to clean for {scope}.")
        return 0
    print(f"Deleting {users} users and {stories} stories ({scope})...")
    seeding.clean(args.sut_host, run_id)
    print("Done. Verified zero rows remaining.")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    config = _config_from(args)
    target = config.target
    run_dir = RUNS_DIR / config.run_id

    # Refuse to start unless the server is actually in a state these journeys
    # can authenticate against. Without this the run would "succeed" with every
    # authenticated request 401ing, which reads as a fast, healthy server.
    info = devlogin.fetch_ping(target.base_url)
    if not info.dev_user_enabled:
        print(
            "error: dev-login is closed on the target, so no journey could "
            "authenticate.\n       Open it first: just stress::devlogin on",
            file=sys.stderr,
        )
        return 2

    token_path = _find_token(config.run_id)
    if token_path is None:
        print(
            "error: no dev-login token found. Re-open the window with `just stress::devlogin on`.",
            file=sys.stderr,
        )
        return 2
    dev_token = token_path.read_text().strip()

    user_count = _seeded_user_count(args.sut_host, config.run_id)
    if user_count == 0:
        print(
            f"error: run {config.run_id} has no seeded users. "
            f"Seed first: just stress::seed --run-id {config.run_id} --seed 20,10",
            file=sys.stderr,
        )
        return 2

    print(f"k6            {runner.ensure_k6(config.load_host)} on {config.load_host}")
    print(f"target        {target.base_url} -> {'CDN' if target.via_cdn else target.ip}")
    print(f"profile       {config.profile} at {config.rate}/s baseline, lang={config.lang}")
    print(f"mix           {config.mix}")
    print(f"population    {user_count} seeded users (run {config.run_id})")
    print()

    runner.push_scripts(config.load_host)

    # Sampling brackets the load, so the series always covers the whole run.
    # The context manager stops it on the way out, which means a run that fails
    # partway still leaves usable host data behind.
    monitor_path = run_dir / "monitor.csv"
    with monitor.Monitor(config.sut_host, monitor_path, interval=args.sample_interval):
        artifacts = runner.run_load(
            config,
            dev_token=dev_token,
            user_count=user_count,
            run_dir=run_dir,
        )

    print(f"\nSummary  {artifacts.summary_path}")
    print(f"Samples  {monitor_path}")
    if not artifacts.passed:
        # A breached threshold is a finding, not a broken harness — say so
        # rather than reporting it as a crash.
        print("Thresholds were breached (k6 exit 99); the measurements still stand.")

    try:
        report_path = report.build(run_dir)
    except (ValueError, FileNotFoundError) as exc:
        print(f"Report not rendered: {exc}")
        return 0
    print(f"Report   {report_path}")
    return 0


def cmd_canary(args: argparse.Namespace) -> int:
    """Drive a real headless browser through the landing page."""
    config = _config_from(args)
    run_dir = RUNS_DIR / config.run_id

    print(f"chrome        {runner.ensure_chrome(config.canary_host)} on {config.canary_host}")
    print(f"k6            {runner.ensure_k6(config.canary_host)}")
    destination = "CDN" if config.target.via_cdn else config.target.ip
    print(f"target        {config.target.base_url} -> {destination}")
    print(f"label         {args.label} ({args.iterations} iterations)")
    print()

    runner.push_scripts(config.canary_host)
    path = runner.run_canary(
        config,
        iterations=args.iterations,
        run_dir=run_dir,
        label=args.label,
    )
    print(f"\nCanary summary {path}")
    print(
        "Compare a `baseline` label against a `loaded` one — the delta is the "
        "signal, while the absolute number carries the canary host's distance "
        "to the origin."
    )
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    """Re-render a completed run's report from its stored artifacts."""
    run_dir = RUNS_DIR / validate_run_id(args.run_id)
    if not run_dir.exists():
        print(f"error: no run directory at {run_dir}", file=sys.stderr)
        return 1
    print(f"Report   {report.build(run_dir)}")
    return 0


def _find_token(run_id: str) -> Path | None:
    """The token written when the window opened, under its run or the default."""
    for candidate in (RUNS_DIR / run_id / "token", RUNS_DIR / "current" / "token"):
        if candidate.exists():
            return candidate
    return None


def _seeded_user_count(sut_host: str, run_id: str) -> int:
    users, _ = seeding.count_rows(sut_host, run_id)
    return users


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="flowfic-stress",
        description="Load-test harness for the Flowfic production stack.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    status = sub.add_parser("status", help="Report the deployed server's current state.")
    _add_target_args(status)
    status.set_defaults(func=cmd_status)

    dev = sub.add_parser("devlogin", help="Open or close the dev-login window on the server.")
    dev.add_argument("state", choices=["on", "off"])
    dev.add_argument("--run-id", default=None, help="Run whose token file to write or remove.")
    _add_target_args(dev)
    dev.set_defaults(func=cmd_devlogin)

    seed = sub.add_parser("seed", help="Create the synthetic population for a run.")
    seed.add_argument(
        "--seed",
        action="append",
        default=[],
        required=True,
        metavar="USERS,STORIES",
        help=(
            "A cohort of USERS accounts holding STORIES stories each; repeatable. "
            "e.g. --seed 40,5 --seed 8,80 --seed 2,300 for a realistic long tail."
        ),
    )
    seed.add_argument("--run-id", default=None, help="Run id (default: a UTC timestamp).")
    _add_target_args(seed)
    seed.set_defaults(func=cmd_seed)

    run = sub.add_parser("run", help="Generate load against the target.")
    _add_run_args(run)
    _add_target_args(run)
    run.add_argument(
        "--sample-interval",
        type=int,
        default=1,
        help="Seconds between host samples (default: %(default)s).",
    )
    run.set_defaults(func=cmd_run)

    canary = sub.add_parser("canary", help="Run the headless browser probe.")
    _add_run_args(canary)
    _add_target_args(canary)
    canary.add_argument(
        "--label",
        default="baseline",
        help="Names this sample, e.g. baseline or loaded (default: %(default)s).",
    )
    canary.add_argument(
        "--iterations",
        type=int,
        default=5,
        help="Page loads to perform (default: %(default)s).",
    )
    canary.set_defaults(func=cmd_canary)

    rep = sub.add_parser("report", help="Re-render a completed run's report.")
    rep.add_argument("--run-id", required=True, help="Run to render.")
    rep.set_defaults(func=cmd_report)

    clean = sub.add_parser("clean", help="Delete synthetic rows created by a run.")
    clean.add_argument("--run-id", default=None, help="Run to clean.")
    clean.add_argument("--all", action="store_true", help="Clean every load-test run.")
    _add_target_args(clean)
    clean.set_defaults(func=cmd_clean)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result: int = args.func(args)
    except (ValueError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return result


if __name__ == "__main__":
    raise SystemExit(main())
