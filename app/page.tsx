import { DEFAULT_LOCALE } from "@/lib/i18n/config"

const TARGET = `/${DEFAULT_LOCALE}`

// Static-export root: redirect to the default locale. Inline script runs
// before paint so the user lands on /<lang> without waiting on a meta
// refresh. The game is JS-only, so a noscript fallback link is enough.
export default function RootPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `location.replace(${JSON.stringify(TARGET)})`,
        }}
      />
      <noscript>
        Redirecting to <a href={TARGET}>{TARGET}</a>…
      </noscript>
    </>
  )
}
