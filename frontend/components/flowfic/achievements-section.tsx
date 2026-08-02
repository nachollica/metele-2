"use client"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { achievementText, achievementVisual } from "@/lib/flowfic/gamification"

import { AchievementItem, EmptyHint, Panel } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

/**
 * Achievements grid. No longer a standalone landing card or detail screen — it
 * renders inside the expanded Challenges screen (the two sections were merged).
 */
export function AchievementsSection() {
  const t = useTranslations()
  const { status } = useAuth()
  const { achievements } = useGamification()

  // The sign-in prompt is for anonymous users only. A signed-in user with no
  // data yet just renders an empty list until it loads (never the prompt).
  const isAnonymous = status === "anonymous"
  const list = achievements ?? []

  if (isAnonymous) {
    return <EmptyHint>{t.dashboard.signInHint}</EmptyHint>
  }

  const unlockedCount = list.filter((a) => a.unlocked).length

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        {t.achievements.unlockedSummary
          .replace("{count}", String(unlockedCount))
          .replace("{total}", String(list.length))}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((a) => {
          const v = achievementVisual(a.id)
          const text = achievementText(t, a.id)
          return (
            <Panel key={a.id} className="p-4">
              <AchievementItem
                icon={v.icon}
                tone={v.tone}
                name={text.name}
                description={text.description}
                unlocked={a.unlocked}
                current={a.current}
                target={a.target}
                progress={a.progress}
                showProgress
              />
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
