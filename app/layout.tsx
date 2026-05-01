// Root layout is a simple pass-through. The real HTML shell lives in
// app/[lang]/layout.tsx which has access to the locale parameter.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
