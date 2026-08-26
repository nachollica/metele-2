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

from flowfic_stress import devlogin, seeding
from flowfic_stress.config import (
    DEFAULT_SUT_HOST,
    DEFAULT_SUT_PATH,
    DEFAULT_TARGET_IP,
    PUBLIC_HOST,
    Target,
    new_run_id,
    parse_cohorts,
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
