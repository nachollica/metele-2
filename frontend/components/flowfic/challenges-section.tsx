"use client"

import { Button } from "@/components/ui/button"

import { useAuth } from "@/lib/auth"
import { useLocale, useTranslations } from "@/lib/i18n"
import { DAILY_PROMPTS } from "@/lib/flowfic/prompts"
import { challengeText, challengeVisual, dailyPromptIndex } from "@/lib/flowfic/gamification"

import { ChallengeItem, Panel, SectionHeader } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

type Props = {
  /** Start a sprint (from a challenge or the daily prompt). */
  onNewStory: () => void
}

export function ChallengesSection({ onNewStory }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const { status } = useAuth()
  const { challenges } = useGamification()

  const prompt = DAILY_PROMPTS[locale][dailyPromptIndex(DAILY_PROMPTS[locale].length)]
  const list = challenges ?? []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      {/* Prompt of the day */}
      <Panel>
        <SectionHeader title={t.dashboard.promptOfDay} />
        <p className="text-muted-foreground text-base italic">&ldquo;{prompt}&rdquo;</p>
        <Button className="mt-4" onClick={onNewStory}>
          {t.dashboard.writeNow}
        </Button>
      </Panel>

      {status === "anonymous" ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t.dashboard.signInHint}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const v = challengeVisual(c.id)
            const text = challengeText(t, c.id)
            return (
              <ChallengeItem
                key={c.id}
                icon={v.icon}
                tone={v.tone}
                name={text.name}
                description={text.description}
                progress={c.progress}
                completed={c.completed}
                progressLabel={`${c.current}/${c.target}`}
                completedLabel={t.challenges.completed}
                action={
                  <Button size="sm" className="w-full" onClick={onNewStory}>
                    {t.dashboard.writeNow}
                  </Button>
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
