"use client"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { achievementText, achievementVisual } from "@/lib/flowfic/gamification"

import { AchievementItem, Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

// How many achievements the landing preview card shows before "Show all".
const PREVIEW_COUNT = 3

type Props = {
  /** Render a trimmed card for the landing dashboard instead of the full screen. */
  preview?: boolean
  /** Open the expanded Achievements screen (preview only). */
  onShowAll?: () => void
}

export function AchievementsSection({ preview = false, onShowAll }: Props) {
  const t = useTranslations()
  const { status } = useAuth()
  const { achievements } = useGamification()

  const signedOut = status === "anonymous" || achievements === null

  if (preview) {
    return (
      <Panel>
        <SectionHeader
          title={t.nav.achievements}
          action={
            onShowAll ? (
              <ShowAllButton
                label={t.nav.showAll}
                sectionName={t.nav.achievements}
                onClick={onShowAll}
              />
            ) : null
          }
        />
        {signedOut ? (
          <p className="text-muted-foreground py-4 text-center text-sm">{t.dashboard.signInHint}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {achievements.slice(0, PREVIEW_COUNT).map((a) => {
              const v = achievementVisual(a.id)
              const text = achievementText(t, a.id)
              return (
                <AchievementItem
                  key={a.id}
                  icon={v.icon}
                  tone={v.tone}
                  name={text.name}
                  description={text.description}
                  unlocked={a.unlocked}
                  current={a.current}
                  target={a.target}
                  progress={a.progress}
                />
              )
            })}
          </div>
        )}
      </Panel>
    )
  }

  if (signedOut) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">{t.dashboard.signInHint}</p>
    )
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <div className="flex flex-col gap-5">
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
