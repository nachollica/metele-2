"""
Turning a run's raw artifacts into a report.

Two sources are merged: k6's summary (what the clients saw) and the monitor CSV
(what the host did). The headline the report exists to produce is the per
container resource split — how much of this machine Postgres actually costs
next to the two uvicorn workers, which is the number that decides whether
moving the database off it is worth doing.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from typing import Any

# Containers in the order they are reported, with the column prefix the monitor
# writes for each.
CONTAINERS = (("api", "uvicorn workers"), ("db", "postgres"), ("caddy", "caddy"))

MB = 1024 * 1024


@dataclass(frozen=True)
class ContainerUsage:
    """One container's resource cost across a run."""

    name: str
    label: str
    cpu_seconds: float
    peak_anon_mb: float
    peak_swap_mb: float
    peak_file_mb: float
    peak_total_mb: float

    def cpu_percent_of_host(self, wall_seconds: float, cores: int = 2) -> float:
        """CPU seconds as a share of the whole machine's available CPU time."""
        if wall_seconds <= 0:
            return 0.0
        return 100.0 * self.cpu_seconds / (wall_seconds * cores)


@dataclass(frozen=True)
class HostUsage:
    wall_seconds: float
    samples: int
    min_mem_available_mb: float
    min_swap_free_mb: float
    swap_in_pages: int
    swap_out_pages: int
    peak_load1: float
    peak_pg_connections: int


def _rows(csv_text: str) -> list[dict[str, str]]:
    return [row for row in csv.DictReader(StringIO(csv_text)) if row.get("ts")]


def _ints(rows: list[dict[str, str]], column: str) -> list[int]:
    out = []
    for row in rows:
        try:
            out.append(int(row[column]))
        except KeyError, TypeError, ValueError:
            out.append(0)
    return out


def parse_monitor(csv_text: str) -> tuple[list[ContainerUsage], HostUsage]:
    """Reduce the sample series to per-container and whole-host figures."""
    rows = _rows(csv_text)
    if len(rows) < 2:
        raise ValueError("Monitor produced fewer than two samples — nothing to compare.")

    wall = int(rows[-1]["ts"]) - int(rows[0]["ts"])

    containers = []
    for name, label in CONTAINERS:
        cpu = _ints(rows, f"{name}_cpu_usec")
        # cpu.stat is cumulative since the container started, so the run's cost
        # is the difference across the window, not any single reading.
        cpu_seconds = max(0.0, (cpu[-1] - cpu[0]) / 1_000_000)
        containers.append(
            ContainerUsage(
                name=name,
                label=label,
                cpu_seconds=cpu_seconds,
                peak_anon_mb=max(_ints(rows, f"{name}_anon")) / MB,
                peak_swap_mb=max(_ints(rows, f"{name}_swap")) / MB,
                peak_file_mb=max(_ints(rows, f"{name}_file")) / MB,
                peak_total_mb=max(_ints(rows, f"{name}_mem")) / MB,
            )
        )

    loads = []
    for row in rows:
        try:
            loads.append(float(row["load1"]))
        except KeyError, TypeError, ValueError:
            loads.append(0.0)

    pswpin = _ints(rows, "pswpin")
    pswpout = _ints(rows, "pswpout")
    host = HostUsage(
        wall_seconds=float(wall),
        samples=len(rows),
        min_mem_available_mb=min(_ints(rows, "mem_available_kb")) / 1024,
        min_swap_free_mb=min(_ints(rows, "swap_free_kb")) / 1024,
        swap_in_pages=max(0, pswpin[-1] - pswpin[0]),
        swap_out_pages=max(0, pswpout[-1] - pswpout[0]),
        peak_load1=max(loads),
        peak_pg_connections=max(_ints(rows, "pg_connections")),
    )
    return containers, host


# ---- k6 summary --------------------------------------------------------


def _metric(summary: dict[str, Any], name: str) -> dict[str, Any]:
    metrics = summary.get("metrics", {})
    value = metrics.get(name)
    return value if isinstance(value, dict) else {}


def endpoint_rows(summary: dict[str, Any]) -> list[tuple[str, float, float, float, float]]:
    """
    Per-endpoint latency, keyed off the `name` tag each request carries.

    Reads whatever the journeys tagged rather than a list maintained here. Note
    there is deliberately no request count: k6's summary export carries only the
    aggregates on a trend sub-metric, never an observation count, so a count
    column here could only ever be a fabricated zero.

    Sorted worst p95 first — the point of the table is to name the slow call.
    """
    rows = []
    for key, value in summary.get("metrics", {}).items():
        if not key.startswith("http_req_duration{name:"):
            continue
        if not isinstance(value, dict):
            continue
        name = key[len("http_req_duration{name:") : -1]
        rows.append(
            (
                name,
                float(value.get("avg", 0) or 0),
                float(value.get("med", 0) or 0),
                float(value.get("p(95)", 0) or 0),
                float(value.get("max", 0) or 0),
            )
        )
    return sorted(rows, key=lambda r: -r[3])


def render(summary: dict[str, Any], csv_text: str, config: dict[str, Any]) -> str:
    """Build the markdown report for one run."""
    containers, host = parse_monitor(csv_text)

    reqs = _metric(summary, "http_reqs")
    failed = _metric(summary, "http_req_failed")
    duration = _metric(summary, "http_req_duration")
    total_requests = int(reqs.get("count", 0) or 0)
    fail_rate = float(failed.get("value", failed.get("rate", 0)) or 0)

    lines: list[str] = []
    add = lines.append

    add(f"# Stress run {config.get('runId', '?')}")
    add("")
    add(
        f"`{config.get('baseUrl')}` via "
        f"{'the CDN' if not config.get('hosts') else next(iter(config['hosts'].values()))}"
        f" · lang `{config.get('lang')}` · baseline {config.get('rate')}/s"
    )
    add(f"mix `{config.get('mix')}` · {config.get('userCount')} seeded users")
    add("")

    # ---- The question this run exists to answer ------------------------
    add("## Where the machine went")
    add("")
    add("| container | CPU s | % of host CPU | peak anon | peak swap | peak page cache |")
    add("|---|--:|--:|--:|--:|--:|")
    for usage in containers:
        add(
            f"| {usage.label} | {usage.cpu_seconds:.1f} | "
            f"{usage.cpu_percent_of_host(host.wall_seconds):.1f}% | "
            f"{usage.peak_anon_mb:.0f} MB | {usage.peak_swap_mb:.0f} MB | "
            f"{usage.peak_file_mb:.0f} MB |"
        )
    add("")

    by_name = {usage.name: usage for usage in containers}
    api, db = by_name.get("api"), by_name.get("db")
    if api and db:
        # Anon plus swap is the honest figure for "memory this process needs":
        # RSS alone understates badly on a host that has already paged out most
        # of what it holds. Page cache is excluded because it is reclaimable and
        # would follow the data, not the process.
        db_footprint = db.peak_anon_mb + db.peak_swap_mb
        api_footprint = api.peak_anon_mb + api.peak_swap_mb
        add("### Moving Postgres off this host")
        add("")
        add(
            f"Postgres held **{db_footprint:.0f} MB** of anonymous memory "
            f"(resident + swapped) against the workers' **{api_footprint:.0f} MB**, "
            f"and spent **{db.cpu_seconds:.1f}s** of CPU against their "
            f"**{api.cpu_seconds:.1f}s**."
        )
        add("")
        if api_footprint > 0:
            share = 100.0 * db_footprint / (db_footprint + api_footprint)
            add(
                f"So the database is roughly **{share:.0f}%** of the two processes' "
                f"combined memory demand. Its {db.peak_file_mb:.0f} MB of page cache "
                "would leave with it too, but that is reclaimable and does not count "
                "as pressure the same way."
            )
        add("")
        add(
            "> Two caveats on the Postgres figures. The monitor samples "
            "`pg_stat_activity` through `docker exec`, and that query's cost is "
            "charged to this container — at low load it can be most of what the "
            "row shows. And `shared_buffers` is 128 MB but only counts once it is "
            "touched, so a short run understates what a busy database would hold."
        )
        add("")

    # ---- Host health ---------------------------------------------------
    add("## Host under load")
    add("")
    add(f"- Window: {host.wall_seconds:.0f}s across {host.samples} samples")
    add(f"- Lowest available memory: **{host.min_mem_available_mb:.0f} MB**")
    add(f"- Lowest free swap: {host.min_swap_free_mb:.0f} MB")
    add(
        f"- Swap traffic during the run: **{host.swap_in_pages} pages in, "
        f"{host.swap_out_pages} pages out**"
    )
    add(f"- Peak 1-minute load average: {host.peak_load1:.2f} (2 vCPU)")
    add(f"- Peak Postgres connections: {host.peak_pg_connections}")
    add("")
    if host.swap_in_pages > 10_000:
        add(
            "> Sustained swap-in during the run: the box was fetching paged-out "
            "memory back under load, which shows up as latency unrelated to "
            "request concurrency."
        )
        add("")

    # ---- What clients saw ----------------------------------------------
    add("## What clients saw")
    add("")
    add(f"- {total_requests} requests, {fail_rate * 100:.2f}% failed")
    if duration:
        add(
            f"- Overall: median {float(duration.get('med', 0) or 0):.0f}ms, "
            f"p95 {float(duration.get('p(95)', 0) or 0):.0f}ms, "
            f"max {float(duration.get('max', 0) or 0):.0f}ms"
        )
    add("")
    rows = endpoint_rows(summary)
    if rows:
        add("| endpoint | avg | median | p95 | max |")
        add("|---|--:|--:|--:|--:|")
        for name, avg, med, p95, mx in rows:
            add(f"| `{name}` | {avg:.0f}ms | {med:.0f}ms | {p95:.0f}ms | {mx:.0f}ms |")
        add("")
    add(
        "_Latency is reported, not enforced: this run's thresholds are "
        "availability-only, so a slow response never fails a run on its own._"
    )
    add("")
    return "\n".join(lines)


def build(run_dir: Path) -> Path:
    """Render a run directory's artifacts into report.md beside them."""
    summary_path = run_dir / "k6-summary.json"
    monitor_path = run_dir / "monitor.csv"
    config_path = run_dir / "config.json"
    for path in (summary_path, monitor_path, config_path):
        if not path.exists():
            raise FileNotFoundError(f"Missing {path.name} in {run_dir} — was the run completed?")

    report = render(
        json.loads(summary_path.read_text()),
        monitor_path.read_text(),
        json.loads(config_path.read_text()),
    )
    out = run_dir / "report.md"
    out.write_text(report)
    return out
