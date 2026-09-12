"""
Opening and closing the dev-login window on the production server.

The backend refuses to enable its dev-user backdoor while ``ENVIRONMENT`` is
``production`` (``Settings._enforce_environment_invariants``), so an
authenticated load test needs the server moved to ``development`` for the
duration. That flip is real exposure and is treated as such here:

- it is applied through a git-ignored ``docker-compose.override.yaml`` written
  on the server, never by editing the tracked ``prod/docker-compose.yaml``, so
  the repository never carries a configuration that would weaken production if
  deployed by accident;
- the token is generated fresh per window and never committed;
- closing the window is verified against ``/ping``, not assumed from a restart
  exiting zero.

While the window is open, ``/api/docs`` and ``/api/openapi.json`` are publicly
reachable, and ``POST /auth/dev-login`` will mint a token for *any* existing
user row — including real Auth0 accounts — to whoever holds the token. Keep it
short, and close it from the same session that opened it.
"""

from __future__ import annotations

import json
import secrets
import shlex
import urllib.error
import urllib.request
from dataclasses import dataclass

from flowfic_stress.remote import ssh

OVERRIDE_NAME = "docker-compose.override.yaml"

# Cloudflare answers 403 to the default ``Python-urllib/3.x`` agent, so these
# probes would fail before reaching the origin at all. Identify the harness
# explicitly rather than impersonating a browser — it also makes the harness's
# own traffic easy to pick out of an access log.
_USER_AGENT = "flowfic-stress/0.1 (+load-test harness)"

_OVERRIDE_TEMPLATE = """\
# Written by `just stress::devlogin on` — NOT part of the deployed config.
# Opens the dev-login backdoor for a load-test window. Remove this file and
# recreate the api container to restore production behaviour.
services:
  api:
    environment:
      ENVIRONMENT: development
      DEV_USER_ENABLED: "true"
      DEV_USER_TOKEN: "{token}"
"""


@dataclass(frozen=True)
class PingInfo:
    """
    The subset of ``GET /ping`` the harness makes decisions on.

    The last three fields are ``None`` when the *deployed* build predates them,
    which is deliberately different from a field that is present and empty: a
    server too old to report its word pools is not the same problem as a worker
    whose pools failed to load, and only the second one should raise an alarm.
    """

    environment: str
    dev_user_enabled: bool
    version: str
    pid: int | None
    db_dialect: str | None
    word_pools: dict[str, int] | None

    @property
    def reports_worker_detail(self) -> bool:
        """Whether the deployed build carries the ops fields at all."""
        return self.word_pools is not None

    @property
    def pools_loaded(self) -> bool:
        """True only when pools are reported *and* non-empty."""
        pools = self.word_pools
        if not pools:
            return False
        return all(n > 0 for n in pools.values())


def fetch_ping(base_url: str, *, timeout: float = 10.0) -> PingInfo:
    """
    Read ``/ping`` over the public hostname.

    Deliberately not routed past the origin override: this is the check that
    the *deployed* server is in the expected state, and it should see exactly
    what any other client would.
    """
    request = urllib.request.Request(  # noqa: S310 - fixed https scheme, operator-supplied host
        f"{base_url}/api/ping",
        headers={"Cache-Control": "no-store", "User-Agent": _USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            payload = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Could not reach {base_url}/api/ping: {exc}") from exc
    return PingInfo(
        environment=payload["environment"],
        dev_user_enabled=payload["devUserEnabled"],
        version=payload["version"],
        pid=payload.get("pid"),
        db_dialect=payload.get("dbDialect"),
        word_pools=payload.get("wordPools"),
    )


def sample_workers(base_url: str, samples: int = 12) -> set[int]:
    """
    Call ``/ping`` repeatedly and collect the pids that answer.

    How many distinct workers appear is the cheapest available check that the
    process model is what the compose file claims, and that load will actually
    spread rather than pile onto one worker. Empty against a build that does
    not report pids.
    """
    seen = {fetch_ping(base_url).pid for _ in range(samples)}
    return {pid for pid in seen if pid is not None}


def _recreate_api(host: str, path: str) -> None:
    ssh(host, f"cd {shlex.quote(path)} && docker compose up -d --no-deps --force-recreate api")


def open_window(host: str, path: str, base_url: str) -> str:
    """
    Enable dev-login on the server and return the freshly minted token.

    Raises if ``/ping`` does not confirm the window actually opened — a
    container that failed its settings validation restarts into the old
    configuration, and the restart command still exits zero.
    """
    token = secrets.token_urlsafe(36)
    override = _OVERRIDE_TEMPLATE.format(token=token)
    ssh(
        host,
        f"cat > {shlex.quote(f'{path}/{OVERRIDE_NAME}')}",
        stdin=override,
    )
    _recreate_api(host, path)

    info = _await_state(base_url, dev_user_enabled=True)
    if not info.dev_user_enabled:
        raise RuntimeError(
            "Dev-login window did not open: /ping still reports devUserEnabled=false. "
            "Check `docker logs flowfic-api` for a settings validation failure."
        )
    return token


def close_window(host: str, path: str, base_url: str) -> PingInfo:
    """
    Remove the override, restart, and *verify* production behaviour is back.

    The verification is the point of this function. A window left open is the
    worst outcome of the whole exercise, so a failure here is loud.
    """
    ssh(host, f"rm -f {shlex.quote(f'{path}/{OVERRIDE_NAME}')}")
    _recreate_api(host, path)

    info = _await_state(base_url, dev_user_enabled=False)
    if info.dev_user_enabled or info.environment != "production":
        raise RuntimeError(
            f"Dev-login window is STILL OPEN (environment={info.environment}, "
            f"devUserEnabled={info.dev_user_enabled}). Fix this before walking away: "
            f"remove {path}/{OVERRIDE_NAME} on {host} and recreate the api container."
        )
    return info


def _await_state(base_url: str, *, dev_user_enabled: bool, attempts: int = 20) -> PingInfo:
    """
    Poll ``/ping`` until the expected state appears or the attempts run out.

    A recreated container takes a few seconds to pass its healthcheck and start
    answering through Caddy; polling avoids racing that with a fixed sleep.
    """
    last: PingInfo | None = None
    for attempt in range(attempts):
        try:
            last = fetch_ping(base_url)
        except RuntimeError:
            last = None
        else:
            if last.dev_user_enabled == dev_user_enabled:
                return last
        _backoff(attempt)
    if last is None:
        raise RuntimeError(f"{base_url}/api/ping never came back after the restart.")
    return last


def _backoff(attempt: int) -> None:
    import time

    time.sleep(min(1.0 + attempt * 0.5, 5.0))


def docs_exposed(base_url: str) -> bool:
    """
    Whether the interactive docs are reachable.

    Used as the closing assertion: production hides them, so a 200 here after
    the window is closed means the flip did not actually revert.
    """
    try:
        request = urllib.request.Request(  # noqa: S310
            f"{base_url}/api/docs", headers={"User-Agent": _USER_AGENT}
        )
        with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310
            return bool(200 <= response.status < 300)
    except urllib.error.HTTPError as exc:
        return bool(200 <= exc.code < 300)
    except urllib.error.URLError, TimeoutError:
        return False
