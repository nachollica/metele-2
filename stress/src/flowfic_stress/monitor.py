"""
Sampling the host under test while load runs.

The sampler itself is a shell script executed on the server (``scripts/monitor.sh``);
this module ships it, starts it, and collects its CSV. Keeping the sampler in
shell means it depends on nothing but coreutils and the kernel's own files,
which matters on a host with under a gigabyte of memory: a Python sampler would
be a meaningful fraction of what we are trying to measure.
"""

from __future__ import annotations

import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path

from flowfic_stress.remote import run_local, ssh, ssh_popen

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "monitor.sh"
REMOTE_SCRIPT = "/tmp/flowfic-monitor.sh"  # noqa: S108 - a remote path, not a local temp file


@dataclass
class Monitor:
    """A running sampler. Use as a context manager around the load."""

    host: str
    output_path: Path
    interval: int = 1
    _process: subprocess.Popen[str] | None = None

    def __enter__(self) -> Monitor:
        self.start()
        return self

    def __exit__(self, *_exc: object) -> None:
        self.stop()

    def start(self) -> None:
        run_local(["scp", "-q", "-o", "BatchMode=yes", str(SCRIPT), f"{self.host}:{REMOTE_SCRIPT}"])
        ssh(self.host, f"chmod +x {shlex.quote(REMOTE_SCRIPT)}")
        # Duration 0 means "until stopped"; the caller ends it when the load
        # finishes rather than guessing the run's length up front.
        self._process = ssh_popen(self.host, f"{shlex.quote(REMOTE_SCRIPT)} {self.interval} 0")

    def stop(self) -> None:
        """Stop sampling and write everything collected so far."""
        if self._process is None:
            return
        self._process.terminate()
        try:
            stdout, _ = self._process.communicate(timeout=15)
        except subprocess.TimeoutExpired:
            self._process.kill()
            stdout, _ = self._process.communicate()
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(stdout or "")
        self._process = None
        ssh(self.host, f"rm -f {shlex.quote(REMOTE_SCRIPT)}", check=False)


def sample_once(host: str) -> str:
    """One row of the same metrics, for a before/after snapshot."""
    run_local(["scp", "-q", "-o", "BatchMode=yes", str(SCRIPT), f"{host}:{REMOTE_SCRIPT}"])
    ssh(host, f"chmod +x {shlex.quote(REMOTE_SCRIPT)}")
    return ssh(host, f"{shlex.quote(REMOTE_SCRIPT)} 1 1").stdout
