"use client"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { achievementText, achievementVisual } from "@/lib/flowfic/gamification"

import { AchievementItem, Panel } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

export function AchievementsSection() {
  const t = useTranslations()
  const { status } = useAuth()
  const { achievements } = useGamification()

  if (status === "anonymous" || achievements === null) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        {t.dashboard.signInHint}
      </p>
    )
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        {t.achievements.unlockedSummary
          .replace("{count}", String(unlockedCount))
          .replace("{total}", String(achievements.length))}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {achievements.map((a) => {
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
