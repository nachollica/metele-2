"use client"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { challengeText, challengeVisual } from "@/lib/flowfic/gamification"

import { ChallengeItem, EmptyHint } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

/**
 * Every challenge with its live progress. One of the two subsections under the
 * "My Progress" detail screen (see `progress-section.tsx`), alongside
 * `AchievementsSection` — it used to nest that one inside itself, which made a
 * component named for challenges quietly own the achievements grid too.
 */
export function ChallengesSection() {
  const t = useTranslations()
  const { status } = useAuth()
  const { challenges } = useGamification()

  // The sign-in prompt is for anonymous users only. A signed-in user with no
  // data yet just renders nothing until it loads (never the prompt).
  const isAnonymous = status === "anonymous"
  const list = challenges ?? []

  // Reached only when signed in (the progress links are disabled for anonymous
  // users), but the guard keeps it safe if that ever changes.
  if (isAnonymous) {
    return <EmptyHint>{t.dashboard.signInHint}</EmptyHint>
  }

  return (
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
          />
        )
      })}
    </div>
  )
}
