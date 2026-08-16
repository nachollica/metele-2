"use client"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { challengeText, challengeVisual } from "@/lib/flowfic/gamification"

import { AchievementsSection } from "./achievements-section"
import { ChallengeItem, EmptyHint } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

/**
 * Challenges + achievements, grouped under their own sub-headings. Rendered
 * inside the "My Progress" screen (see `progress-section.tsx`); the landing
 * shows a single "challenge of the day" from within that section's preview.
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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.challenges.dailyGroup}</h2>
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
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.nav.achievements}</h2>
        <AchievementsSection />
      </section>
    </div>
  )
}
