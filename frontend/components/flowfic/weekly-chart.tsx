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

import { useLocale } from "@/lib/i18n"
import { formatCount, type ChartPoint } from "@/lib/flowfic/gamification"

type Props = {
  data: ChartPoint[]
  /** Localized word for the tooltip/table ("palabras" / "words"). */
  wordsLabel: string
  /** Accessible caption describing what the chart shows. */
  caption: string
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

export function WeeklyChart({ data, wordsLabel, caption }: Props) {
  const locale = useLocale()
  const rows: Row[] = data.map((p) => ({
    label: weekdayLabel(p.date, locale),
    words: p.words,
    iso: p.date,
  }))

  return (
    <figure className="m-0">
      <div className="h-40 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="weeklyWordsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              dy={4}
            />
            <YAxis hide domain={[0, (max: number) => Math.max(10, max)]} />
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={<ChartTooltip wordsLabel={wordsLabel} />}
            />
            <Area
              type="monotone"
              dataKey="words"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#weeklyWordsFill)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible, non-visual equivalent of the plot. */}
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
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
