"""
Tests for the run analysis.

The monitor's raw columns are cumulative counters and byte counts; getting the
reduction wrong would produce a confident, wrong answer to the question the
whole exercise exists to settle. The sample rows below are shaped exactly like
the ones `scripts/monitor.sh` emits.
"""

from __future__ import annotations

from typing import Any

import pytest

from flowfic_stress.report import endpoint_rows, parse_monitor, render

MB = 1024 * 1024

HEADER = (
    "ts,"
    "api_cpu_usec,api_anon,api_file,api_swap,api_mem,"
    "db_cpu_usec,db_anon,db_file,db_swap,db_mem,"
    "caddy_cpu_usec,caddy_anon,caddy_file,caddy_swap,caddy_mem,"
    "mem_available_kb,swap_free_kb,pswpin,pswpout,load1,pg_connections"
)


def row(
    ts: int,
    *,
    api_cpu: int,
    db_cpu: int,
    api_anon_mb: int = 60,
    api_swap_mb: int = 300,
    db_anon_mb: int = 10,
    db_swap_mb: int = 18,
    mem_avail_kb: int = 400_000,
    pswpin: int = 1000,
    pswpout: int = 2000,
    load1: str = "0.5",
    pg: int = 12,
) -> str:
    return ",".join(
        str(v)
        for v in (
            ts,
            api_cpu,
            api_anon_mb * MB,
            50 * MB,
            api_swap_mb * MB,
            150 * MB,
            db_cpu,
            db_anon_mb * MB,
            22 * MB,
            db_swap_mb * MB,
            35 * MB,
            1_000_000,
            12 * MB,
            47 * MB,
            0,
            63 * MB,
            mem_avail_kb,
            3_600_000,
            pswpin,
            pswpout,
            load1,
            pg,
        )
    )


def csv_of(*rows: str) -> str:
    return "\n".join([HEADER, *rows]) + "\n"


class TestParseMonitor:
    def test_differentiates_cumulative_cpu(self) -> None:
        # cpu.stat counts microseconds since the container started, so the run's
        # cost is the delta across the window. Reading the last value directly
        # would report the container's entire lifetime as this run's CPU.
        text = csv_of(
            row(1000, api_cpu=5_000_000, db_cpu=1_000_000),
            row(1010, api_cpu=9_000_000, db_cpu=1_500_000),
        )
        containers, _ = parse_monitor(text)
        by_name = {c.name: c for c in containers}
        assert by_name["api"].cpu_seconds == pytest.approx(4.0)
        assert by_name["db"].cpu_seconds == pytest.approx(0.5)

    def test_cpu_share_is_against_every_core(self) -> None:
        # 4 CPU-seconds over a 10s window on 2 cores is 20% of the machine, not
        # 40% — the denominator is wall time times cores.
        text = csv_of(
            row(1000, api_cpu=0, db_cpu=0),
            row(1010, api_cpu=4_000_000, db_cpu=0),
        )
        containers, host = parse_monitor(text)
        api = next(c for c in containers if c.name == "api")
        assert api.cpu_percent_of_host(host.wall_seconds, cores=2) == pytest.approx(20.0)

    def test_reports_peak_not_final_memory(self) -> None:
        text = csv_of(
            row(1000, api_cpu=0, db_cpu=0, api_anon_mb=60),
            row(1005, api_cpu=1, db_cpu=1, api_anon_mb=200),
            row(1010, api_cpu=2, db_cpu=2, api_anon_mb=70),
        )
        containers, _ = parse_monitor(text)
        api = next(c for c in containers if c.name == "api")
        assert api.peak_anon_mb == pytest.approx(200)

    def test_keeps_anon_and_page_cache_apart(self) -> None:
        # They answer different questions: anon is memory the process needs,
        # file is reclaimable cache. Summing them would overstate what moving a
        # container elsewhere actually frees.
        containers, _ = parse_monitor(
            csv_of(row(1000, api_cpu=0, db_cpu=0), row(1010, api_cpu=1, db_cpu=1))
        )
        api = next(c for c in containers if c.name == "api")
        assert api.peak_anon_mb == pytest.approx(60)
        assert api.peak_file_mb == pytest.approx(50)

    def test_swap_traffic_is_a_delta(self) -> None:
        text = csv_of(
            row(1000, api_cpu=0, db_cpu=0, pswpin=1000, pswpout=2000),
            row(1010, api_cpu=1, db_cpu=1, pswpin=4500, pswpout=2000),
        )
        _, host = parse_monitor(text)
        assert host.swap_in_pages == 3500
        assert host.swap_out_pages == 0

    def test_reports_the_worst_memory_moment(self) -> None:
        text = csv_of(
            row(1000, api_cpu=0, db_cpu=0, mem_avail_kb=400_000),
            row(1010, api_cpu=1, db_cpu=1, mem_avail_kb=90_000),
        )
        _, host = parse_monitor(text)
        assert host.min_mem_available_mb == pytest.approx(90_000 / 1024)

    def test_rejects_a_series_too_short_to_differentiate(self) -> None:
        with pytest.raises(ValueError, match="fewer than two samples"):
            parse_monitor(csv_of(row(1000, api_cpu=0, db_cpu=0)))

    def test_survives_a_truncated_final_row(self) -> None:
        # The sampler is killed mid-write when the load ends, so the last line
        # is routinely incomplete. That must not lose the whole run.
        text = csv_of(row(1000, api_cpu=0, db_cpu=0), row(1010, api_cpu=1, db_cpu=1)) + "1787,99"
        containers, host = parse_monitor(text)
        assert host.samples == 3
        assert all(c.cpu_seconds >= 0 for c in containers)


class TestEndpointRows:
    def test_extracts_tagged_endpoints_worst_first(self) -> None:
        summary = {
            "metrics": {
                "http_req_duration": {"med": 10, "p(95)": 20, "max": 30},
                "http_req_duration{name:ping}": {"count": 5, "med": 5, "p(95)": 9, "max": 12},
                "http_req_duration{name:match-map}": {
                    "count": 3,
                    "med": 300,
                    "p(95)": 800,
                    "max": 1200,
                },
                "http_reqs": {"count": 8},
            }
        }
        rows = endpoint_rows(summary)
        assert [r[0] for r in rows] == ["match-map", "ping"]
        assert rows[0][3] == 800

    def test_ignores_untagged_and_unrelated_metrics(self) -> None:
        assert endpoint_rows({"metrics": {"vus": {"value": 3}}}) == []


class TestRender:
    def _summary(self) -> dict[str, Any]:
        return {
            "metrics": {
                "http_reqs": {"count": 100},
                "http_req_failed": {"value": 0.0},
                "http_req_duration": {"med": 20, "p(95)": 80, "max": 400},
            }
        }

    def _config(self) -> dict[str, Any]:
        return {
            "runId": "20260826-2200",
            "baseUrl": "https://flowfic.app",
            "hosts": {"flowfic.app:443": "129.153.7.91:443"},
            "lang": "es",
            "rate": 5,
            "mix": {"anon": 60},
            "userCount": 10,
        }

    def _text(self) -> str:
        return csv_of(
            row(1000, api_cpu=0, db_cpu=0),
            row(1060, api_cpu=30_000_000, db_cpu=3_000_000),
        )

    def test_leads_with_the_container_split(self) -> None:
        out = render(self._summary(), self._text(), self._config())
        assert "Where the machine went" in out
        assert "uvicorn workers" in out
        assert "postgres" in out

    def test_answers_the_move_the_database_question(self) -> None:
        out = render(self._summary(), self._text(), self._config())
        assert "Moving Postgres off this host" in out
        # 10+18 MB against 60+300 MB is a small share, and the report should say
        # so in a number rather than leaving it to be eyeballed off the table.
        assert "%** of the two processes" in out

    def test_states_the_postgres_measurement_caveats(self) -> None:
        out = render(self._summary(), self._text(), self._config())
        assert "pg_stat_activity" in out
        assert "shared_buffers" in out

    def test_flags_sustained_swap_in(self) -> None:
        text = csv_of(
            row(1000, api_cpu=0, db_cpu=0, pswpin=0),
            row(1060, api_cpu=1, db_cpu=1, pswpin=500_000),
        )
        assert "paged-out" in render(self._summary(), text, self._config())

    def test_stays_quiet_when_swap_is_calm(self) -> None:
        assert "paged-out" not in render(self._summary(), self._text(), self._config())

    def test_says_latency_is_not_enforced(self) -> None:
        # Thresholds are availability-only, and a reader scanning p95 numbers
        # should not assume the run would have failed on them.
        assert "not enforced" in render(self._summary(), self._text(), self._config())
