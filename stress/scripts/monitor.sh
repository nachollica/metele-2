#!/usr/bin/env bash
# Sample the host under test while load runs, emitting CSV on stdout.
#
# Reads cgroup v2 and /proc files directly rather than shelling out to
# `docker stats`, which costs a daemon round-trip per container per sample —
# real overhead on a box with one OCPU that we are trying not to perturb while
# measuring it.
#
# Usage: monitor.sh [INTERVAL_SECONDS] [DURATION_SECONDS]
#   Runs until DURATION elapses, or forever when it is 0 (the caller stops it).

set -uo pipefail

INTERVAL="${1:-1}"
DURATION="${2:-0}"

CONTAINERS=(flowfic-api flowfic-db flowfic-caddy)

# Resolve each container's cgroup path once. The scope directory is named after
# the full container id, so this survives restarts only for the current run —
# which is fine, a restart mid-run invalidates the sample series anyway.
declare -A CGROUP
for name in "${CONTAINERS[@]}"; do
    id="$(docker inspect -f '{{.Id}}' "$name" 2>/dev/null)" || continue
    path="/sys/fs/cgroup/system.slice/docker-${id}.scope"
    [ -d "$path" ] && CGROUP[$name]="$path"
done

# Read one key from a flat "key value" file (memory.stat, /proc/vmstat, ...).
field() { awk -v k="$2" '$1==k {print $2; exit}' "$1" 2>/dev/null || echo 0; }
value() { cat "$1" 2>/dev/null || echo 0; }

header="ts"
for name in "${CONTAINERS[@]}"; do
    short="${name#flowfic-}"
    # cpu_usec is cumulative; the analyser differentiates it into a rate. anon
    # is the container's own memory, file is page cache it is charged for —
    # they answer different questions and are kept apart deliberately.
    header="${header},${short}_cpu_usec,${short}_anon,${short}_file,${short}_swap,${short}_mem"
done
# pswpin/pswpout are the numbers that matter most here: this host runs with
# ~450MB already in swap at idle, so thrash shows up as these climbing long
# before CPU saturates.
header="${header},mem_available_kb,swap_free_kb,pswpin,pswpout,load1,pg_connections"
echo "$header"

started="$(date +%s)"
pg_conns=0
pg_counter=0

while true; do
    now="$(date +%s)"
    [ "$DURATION" -gt 0 ] && [ $((now - started)) -ge "$DURATION" ] && break

    row="$now"
    for name in "${CONTAINERS[@]}"; do
        path="${CGROUP[$name]:-}"
        if [ -z "$path" ]; then
            row="${row},0,0,0,0,0"
            continue
        fi
        cpu="$(field "$path/cpu.stat" usage_usec)"
        anon="$(field "$path/memory.stat" anon)"
        file="$(field "$path/memory.stat" file)"
        swap="$(value "$path/memory.swap.current")"
        mem="$(value "$path/memory.current")"
        row="${row},${cpu:-0},${anon:-0},${file:-0},${swap:-0},${mem:-0}"
    done

    mem_avail="$(field /proc/meminfo MemAvailable:)"
    swap_free="$(field /proc/meminfo SwapFree:)"
    pswpin="$(field /proc/vmstat pswpin)"
    pswpout="$(field /proc/vmstat pswpout)"
    load1="$(awk '{print $1}' /proc/loadavg)"

    # Postgres connection count, sampled every fifth tick: it needs an exec into
    # the container, which is far more expensive than the file reads above and
    # changes much more slowly than they do.
    if [ $((pg_counter % 5)) -eq 0 ]; then
        pg_conns="$(docker exec flowfic-db psql -U flowfic_user -d flowfic_db -t -A \
            -c 'select count(*) from pg_stat_activity;' 2>/dev/null | tr -d '[:space:]')"
        [ -z "$pg_conns" ] && pg_conns=0
    fi
    pg_counter=$((pg_counter + 1))

    echo "${row},${mem_avail:-0},${swap_free:-0},${pswpin:-0},${pswpout:-0},${load1:-0},${pg_conns}"
    sleep "$INTERVAL"
done
