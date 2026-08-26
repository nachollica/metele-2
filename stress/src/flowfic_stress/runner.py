"""
Driving k6 on the load-generator host.

The scenario files are shipped to the generator on every run rather than
installed there, so editing a journey needs no provisioning step and the
generator holds no stale copy of a script.
"""

from __future__ import annotations

import json
import shlex
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path

from flowfic_stress.config import RunConfig
from flowfic_stress.remote import RemoteError, run_local, ssh

K6_DIR = Path(__file__).resolve().parents[2] / "k6"

# Where the scripts land on the generator. Under the login user's home so no
# elevated permission is ever needed to run a load test.
REMOTE_DIR = "flowfic-stress"


@dataclass(frozen=True)
class RunArtifacts:
    summary_path: Path
    exit_code: int

    @property
    def passed(self) -> bool:
        """
        k6 exits 99 when a threshold is breached and 0 when everything held.

        A breach is a *result*, not a harness failure — the run completed and
        its numbers are worth keeping either way.
        """
        return self.exit_code == 0


def ensure_k6(host: str) -> str:
    """
    Confirm k6 is installed on the generator, returning its version.

    Deliberately does not install it: provisioning a host is a decision, not a
    side effect of asking for a load test.
    """
    result = ssh(host, "k6 version", check=False)
    if result.code != 0:
        raise RuntimeError(
            f"k6 is not installed on {host!r}. Install it with `just stress::provision-load`."
        )
    return result.stdout.strip().splitlines()[0]


def push_scripts(host: str) -> None:
    """Copy the k6 directory to the generator, replacing whatever was there."""
    with tempfile.TemporaryDirectory() as tmp:
        archive = Path(tmp) / "k6.tar.gz"
        with tarfile.open(archive, "w:gz") as tar:
            tar.add(K6_DIR, arcname="k6")
        ssh(host, f"rm -rf {shlex.quote(REMOTE_DIR)} && mkdir -p {shlex.quote(REMOTE_DIR)}")
        run_local(
            ["scp", "-q", "-o", "BatchMode=yes", str(archive), f"{host}:{REMOTE_DIR}/k6.tar.gz"]
        )
        ssh(host, f"cd {shlex.quote(REMOTE_DIR)} && tar zxf k6.tar.gz && rm k6.tar.gz")


def run_load(
    config: RunConfig,
    *,
    dev_token: str,
    user_count: int,
    run_dir: Path,
    stream: bool = True,
) -> RunArtifacts:
    """
    Execute the load run and bring back k6's machine-readable summary.

    The generator writes the summary to its own disk first and it is fetched
    afterwards, so a dropped ssh session mid-run costs the live output but not
    the results.
    """
    run_dir.mkdir(parents=True, exist_ok=True)
    env_blob = config.k6_env(dev_token=dev_token, user_count=user_count)
    remote_summary = f"{REMOTE_DIR}/summary-{config.run_id}.json"

    # `-e` rather than exporting into the shell: k6 only folds the ambient
    # environment into __ENV for some subcommands, and being explicit means the
    # command that runs is the same one `k6 inspect` can be handed verbatim.
    command = (
        f"cd {shlex.quote(REMOTE_DIR)} && "
        f"k6 run -e FLOWFIC_CONFIG={shlex.quote(env_blob)} "
        f"--summary-export={shlex.quote(f'summary-{config.run_id}.json')} "
        f"--no-usage-report k6/load.js"
    )

    exit_code = (
        _run_streaming(config.load_host, command)
        if stream
        else _run_quiet(config.load_host, command)
    )

    summary_path = run_dir / "k6-summary.json"
    try:
        raw = ssh(config.load_host, f"cat {shlex.quote(remote_summary)}").stdout
    except RemoteError as exc:
        raise RuntimeError(
            f"k6 produced no summary on {config.load_host} (exit {exit_code}). "
            "The run likely failed before starting; check the output above."
        ) from exc
    summary_path.write_text(raw)
    ssh(config.load_host, f"rm -f {shlex.quote(remote_summary)}", check=False)

    (run_dir / "config.json").write_text(json.dumps(json.loads(env_blob), indent=2))
    return RunArtifacts(summary_path=summary_path, exit_code=exit_code)


def _run_streaming(host: str, command: str) -> int:
    """Run k6 with its output going straight to the terminal, as it happens."""
    proc = subprocess.Popen(  # noqa: S603
        ["ssh", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, command],
    )
    proc.communicate()
    return proc.returncode


def _run_quiet(host: str, command: str) -> int:
    return ssh(host, command, check=False).code
