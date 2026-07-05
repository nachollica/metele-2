"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { fetchPing, type PingInfo } from "./ping"

export type BackendStatus = "unknown" | "reachable" | "unreachable"

export type BackendStatusValue = {
  // "unknown" until the first /ping resolves — callers treat it as loading.
  status: BackendStatus
  info: PingInfo | null
  // True only when reachable AND the backend reports the dev backdoor on.
  devUserEnabled: boolean
  // Force an immediate re-check.
  refresh: () => void
}

const BackendStatusContext = createContext<BackendStatusValue | null>(null)

// Re-check cadence while the tab is visible. Paused when hidden so backgrounded
// tabs never poll; a focus/online event triggers an immediate check instead.
const POLL_INTERVAL_MS = 30_000

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>("unknown")
  const [info, setInfo] = useState<PingInfo | null>(null)

  // Refs so the single mount effect can run checks without re-subscribing, and
  // so a late response after unmount is dropped.
  const inFlight = useRef<AbortController | null>(null)
  const mounted = useRef(true)

  const check = useCallback(async () => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const result = await fetchPing(controller.signal)
    if (!mounted.current || controller.signal.aborted) return
    if (result) {
      setInfo(result)
      setStatus("reachable")
    } else {
      setInfo(null)
      setStatus("unreachable")
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void check()

    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    const onOnline = () => void check()
    // Going offline is instant and free — flip without spending a request.
    const onOffline = () => {
      if (!mounted.current) return
      setInfo(null)
      setStatus("unreachable")
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void check()
    }, POLL_INTERVAL_MS)

    return () => {
      mounted.current = false
      inFlight.current?.abort()
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.clearInterval(interval)
    }
  }, [check])

  const value = useMemo<BackendStatusValue>(
    () => ({
      status,
      info,
      devUserEnabled: status === "reachable" && (info?.devUserEnabled ?? false),
      refresh: () => void check(),
    }),
    [status, info, check],
  )

  return <BackendStatusContext value={value}>{children}</BackendStatusContext>
}

// Returns the live backend status. When no provider is mounted (e.g. an
// isolated component test) it reports an inert "unknown", which callers already
// treat as "still loading" — so consumers never crash for lack of a provider.
export function useBackendStatus(): BackendStatusValue {
  const ctx = useContext(BackendStatusContext)
  if (ctx === null) {
    return { status: "unknown", info: null, devUserEnabled: false, refresh: () => {} }
  }
  return ctx
}
