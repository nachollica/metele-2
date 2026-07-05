"use client"

import { apiUrl } from "@/lib/auth/client"

// Shape of GET /ping (see backend app/routes/ping.py PingResponse). Only the
// fields the frontend actually consumes are typed here.
export type PingInfo = {
  status: "ok"
  version: string
  environment: string
  devUserEnabled: boolean
  utcStartedAt: string
}

// Liveness check. Always hits the network (cache: "no-store") so a cached 200
// can never mask a backend that just went down. Resolves to null on any
// failure — network error, abort, or non-2xx — which callers read as
// "unreachable".
export async function fetchPing(signal?: AbortSignal): Promise<PingInfo | null> {
  try {
    const res = await fetch(apiUrl("/ping"), { cache: "no-store", signal })
    if (!res.ok) return null
    return (await res.json()) as PingInfo
  } catch {
    return null
  }
}
