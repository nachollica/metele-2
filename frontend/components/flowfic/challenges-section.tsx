"use client"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { challengeText, challengeVisual, dailyIndex } from "@/lib/flowfic/gamification"

import { AchievementsSection } from "./achievements-section"
import {
  ChallengeItem,
  EmptyHint,
  FeaturedChallenge,
  Panel,
  SectionHeader,
  ShowAllButton,
} from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

type Props = {
  /** Begin the new-story flow (from a challenge card's call to action). */
  onNewStory: () => void
  /** Render a trimmed card for the landing dashboard instead of the full screen. */
  preview?: boolean
  /** Open the expanded Challenges screen (preview only). */
  onShowAll?: () => void
}

/**
 * Challenges. The landing preview shows a single, colorful "challenge of the day"
 * (rotating daily through the live set). The expanded screen groups the full
 * challenge set with the achievements — the two were merged into one section.
 */
export function ChallengesSection({ onNewStory, preview = false, onShowAll }: Props) {
  const t = useTranslations()
  const { status } = useAuth()
  const { challenges } = useGamification()

  // The sign-in prompt is for anonymous users only. A signed-in user with no
  // data yet just renders nothing until it loads (never the prompt).
  const isAnonymous = status === "anonymous"
  const list = challenges ?? []

  if (preview) {
    // "Challenge of the day": rotate through the live set so it changes daily.
    const featured = list.length > 0 ? list[dailyIndex(list.length)] : null
    return (
      <Panel>
        <SectionHeader
          title={t.dashboard.challengeOfDay}
          action={
            onShowAll ? (
              <ShowAllButton
                label={t.nav.showAll}
                sectionName={t.nav.challenges}
                onClick={onShowAll}
                disabled={isAnonymous}
              />
            ) : null
          }
        />
        {isAnonymous ? (
          <EmptyHint className="py-6">{t.dashboard.signInHint}</EmptyHint>
        ) : featured ? (
          (() => {
            const v = challengeVisual(featured.id)
            const text = challengeText(t, featured.id)
            return (
              <FeaturedChallenge
                icon={v.icon}
                name={text.name}
                description={text.description}
                progress={featured.progress}
                completed={featured.completed}
                progressLabel={`${featured.current}/${featured.target}`}
                completedLabel={t.challenges.completed}
                ctaLabel={t.dashboard.writeNow}
                onCta={onNewStory}
              />
            )
          })()
        ) : null}
      </Panel>
    )
  }

  // Expanded screen: the merged section — challenges then achievements, each
  // under its own sub-heading. Reached only when signed in (Show all is disabled
  // for anonymous users), but the guard keeps it safe if that ever changes.
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
