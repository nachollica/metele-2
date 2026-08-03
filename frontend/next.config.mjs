// `next/constants`' PHASE_DEVELOPMENT_SERVER, inlined to avoid an ESM
// extension-resolution quirk when importing it into this .mjs config.
const PHASE_DEVELOPMENT_SERVER = "phase-development-server"

// Phase-aware config. The app is a single static route whose stable screens are
// addressable by URL via client-side History API routing (see
// components/flowfic/navigation.ts). In production Caddy serves the exported
// index.html for every app path (prod/conf/Caddyfile). `next dev` has no Caddy,
// so a hard refresh / deep link at e.g. /stories would 404 against the dev
// server — the dev-only catch-all rewrite below serves the shell instead,
// matching prod. Rewrites are unsupported under `output: "export"`, so we only
// attach them in the dev phase (and only set the export output for the build).
export default function config(phase) {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // Static export: the whole app ships as plain assets behind Caddy. No Node
    // server runs in production, so nothing here may rely on server runtime.
    output: isDev ? undefined : "export",
    // Surface effect/lifecycle bugs (double-invoked effects) during dev.
    reactStrictMode: true,
    // `next/image`'s default loader needs the optimization server, which a
    // static export doesn't have. Disable it so any future <Image> emits plain
    // <img>-equivalent markup instead of failing the export.
    images: { unoptimized: true },
  }

  if (isDev) {
    // `afterFiles` runs only after real routes and static files miss, so this
    // never shadows /_next/*, /auth/callback, or public/ assets — just the
    // client-addressable app paths (and unknown ones, which the client renders
    // as not-found, exactly like the prod Caddy fallback).
    nextConfig.rewrites = async () => ({
      afterFiles: [{ source: "/:path*", destination: "/" }],
    })
  }

  return nextConfig
}
