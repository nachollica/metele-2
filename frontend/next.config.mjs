/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the whole app ships as plain assets behind Caddy. No Node
  // server runs in production, so nothing here may rely on server runtime.
  output: "export",
  // Surface effect/lifecycle bugs (double-invoked effects) during dev.
  reactStrictMode: true,
  // `next/image`'s default loader needs the optimization server, which a
  // static export doesn't have. Disable it so any future <Image> emits plain
  // <img>-equivalent markup instead of failing the export.
  images: { unoptimized: true },
}

export default nextConfig
