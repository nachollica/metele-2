"use client"

// Weekly words chart — one series (words per day) over the rolling last 7 days.
// Following the dataviz method: single brand hue (no legend needed for one
// series), recessive grid/axes in muted ink, a themed hover tooltip, and a
// visually-hidden table so the data is never color- or vision-dependent.

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts"

import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/i18n"
import { formatCount, type ChartPoint } from "@/lib/flowfic/gamification"

type Props = {
  data: ChartPoint[]
  /** Localized word for the tooltip/table ("palabras" / "words"). */
  wordsLabel: string
  /** Accessible caption describing what the chart shows. */
  caption: string
  /** Take the parent's height instead of the default fixed one — the landing's
   *  timeline card splits a fixed pane, so its plot has to shrink with it. */
  fill?: boolean
}

type Row = { label: string; words: number; iso: string }

function weekdayLabel(iso: string, locale: string): string {
  // Parse the ISO date as local midnight so the weekday isn't shifted by tz.
  const [y, m, d] = iso.split("-").map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    weekday: "short",
  }).format(date)
}

export function WeeklyChart({ data, wordsLabel, caption, fill = false }: Props) {
  const locale = useLocale()
  const rows: Row[] = data.map((p) => ({
    label: weekdayLabel(p.date, locale),
    words: p.words,
    iso: p.date,
  }))

  return (
    <figure className={cn("m-0", fill && "flex min-h-0 flex-1 flex-col")}>
      {/* Its own near-black panel, in BOTH themes, so the plot reads as a plot
          instead of dissolving into the card it shares with the week's figures.
          Everything drawn inside therefore uses the fixed `--plot-*` ink rather
          than the theme's `--border` / `--muted-foreground`, which flip while
          this surface does not. The brand green — not `--primary` — because the
          line is a drawn accent and the deeper button green goes muddy here. */}
      <div
        className={cn(
          "bg-plot w-full overflow-hidden rounded-lg px-1 py-2",
          fill ? "min-h-0 flex-1" : "h-40",
        )}
        aria-hidden="true"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="weeklyWordsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-green)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--brand-green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--plot-grid)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--plot-ink)", fontSize: 11 }}
              dy={4}
            />
            {/* Headroom over the best day, so its peak is a peak rather than a
                line clipped flat against the top edge. Invisible while the panel
                was transparent; obvious once it got a border. */}
            <YAxis hide domain={[0, (max: number) => Math.max(10, Math.ceil(max * 1.15))]} />
            <Tooltip
              cursor={{ stroke: "var(--plot-grid)", strokeWidth: 1 }}
              content={<ChartTooltip wordsLabel={wordsLabel} />}
            />
            <Area
              type="monotone"
              dataKey="words"
              stroke="var(--brand-green)"
              strokeWidth={2}
              fill="url(#weeklyWordsFill)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--brand-green)", stroke: "var(--plot)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible, non-visual equivalent of the plot. The table is WRAPPED in
          the `sr-only` box rather than wearing the class itself: a table box
          grows to its own min-content width whatever width is set on it, so the
          hidden table escaped the 1px clip and gave the page a horizontal
          scrollbar at phone width. Clipping it from a plain div holds. */}
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {rows.map((r) => (
                <th key={r.iso} scope="col">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {rows.map((r) => (
                <td key={r.iso}>
                  {r.words} {wordsLabel}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function ChartTooltip({
  active,
  payload,
  wordsLabel,
}: TooltipProps<number, string> & { wordsLabel: string }) {
  const locale = useLocale()
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload as Row | undefined
  if (!row) return null
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <div className="text-muted-foreground">{row.label}</div>
      <div className="font-semibold tabular-nums">
        {formatCount(row.words, locale)} {wordsLabel}
      </div>
    </div>
  )
}
