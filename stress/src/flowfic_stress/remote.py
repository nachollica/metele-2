"""
Shelling out to the hosts involved in a run.

Everything the harness does remotely goes through ``ssh``, using the operator's
own ``~/.ssh/config`` for user and key. That keeps credentials out of this repo
entirely: the harness can only reach what its operator can already reach.
"""

from __future__ import annotations

import shlex
import subprocess
from dataclasses import dataclass


class RemoteError(RuntimeError):
    """A remote command exited non-zero."""


@dataclass(frozen=True)
class Result:
    code: int
    stdout: str
    stderr: str


def run_local(argv: list[str], *, check: bool = True, stdin: str | None = None) -> Result:
    """Run a command here, capturing both streams."""
    proc = subprocess.run(  # noqa: S603 - argv is built by this package, never by user input
        argv,
        capture_output=True,
        text=True,
        input=stdin,
        check=False,
    )
    result = Result(proc.returncode, proc.stdout, proc.stderr)
    if check and proc.returncode != 0:
        raise RemoteError(
            f"Command failed ({proc.returncode}): {' '.join(argv)}\n{proc.stderr.strip()}"
        )
    return result


def ssh(host: str, command: str, *, check: bool = True, stdin: str | None = None) -> Result:
    """
    Run one shell command on ``host``.

    ``-T`` because none of these need a TTY and a pty would mangle the CSV the
    monitor streams back; ``BatchMode`` so a missing key fails immediately
    instead of hanging on a password prompt in the middle of a load run.
    """
    return run_local(
        [
            "ssh",
            "-T",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=10",
            host,
            command,
        ],
        check=check,
        stdin=stdin,
    )


def ssh_popen(host: str, command: str) -> subprocess.Popen[str]:
    """
    Start a long-running remote command and hand back the process.

    Used for the monitor, which streams CSV for as long as the load runs and is
    stopped by closing it down rather than by waiting on it.
    """
    return subprocess.Popen(  # noqa: S603
        [
            "ssh",
            "-T",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=10",
            host,
            command,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def scp(local_path: str, host: str, remote_path: str) -> None:
    run_local(["scp", "-q", "-o", "BatchMode=yes", local_path, f"{host}:{remote_path}"])


def psql(host: str, sql: str, *, container: str = "flowfic-db") -> str:
    """
    Run one statement against the production database and return raw rows.

    ``-t -A`` gives tuples-only, unaligned output so callers can split on the
    field separator instead of parsing a formatted table. The SQL travels on
    stdin rather than in the command line, so quoting in a LIKE pattern cannot
    be reinterpreted by the remote shell.
    """
    result = ssh(
        host,
        f"docker exec -i {shlex.quote(container)} psql -U flowfic_user -d flowfic_db -t -A -F '|'",
        stdin=sql,
    )
    return result.stdout.strip()


def docker_exec_python(host: str, container: str, script: str) -> str:
    """
    Run a Python script inside a container using its own interpreter.

    The script is piped to stdin, so nothing is written to the container's
    filesystem and the image never gains a copy of the harness — the seeding
    code stays in this repo instead of being baked into a production image.
    """
    result = ssh(
        host,
        f"docker exec -i {shlex.quote(container)} /src/.venv/bin/python -",
        stdin=script,
    )
    return result.stdout.strip()
