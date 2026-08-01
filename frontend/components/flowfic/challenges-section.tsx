"use client"

import { Button } from "@/components/ui/button"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { challengeText, challengeVisual } from "@/lib/flowfic/gamification"

import { ChallengeItem, Panel, SectionHeader, ShowAllButton } from "./dashboard-widgets"
import { useGamification } from "./gamification-context"

// The single challenge the landing preview highlights. Fixed for now (a
// per-day / featured pick can replace this later); falls back to the first
// available challenge if this id isn't in the fetched list.
const HOME_CHALLENGE_ID = "daily_600"

type Props = {
  /** Begin the new-story flow (from a challenge card's call to action). */
  onNewStory: () => void
  /** Render a trimmed card for the landing dashboard instead of the full screen. */
  preview?: boolean
  /** Open the expanded Challenges screen (preview only). */
  onShowAll?: () => void
}

export function ChallengesSection({ onNewStory, preview = false, onShowAll }: Props) {
  const t = useTranslations()
  const { status } = useAuth()
  const { challenges } = useGamification()

  const list = challenges ?? []

  function renderChallenge(c: (typeof list)[number]) {
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
  }

  if (preview) {
    const featured = list.find((c) => c.id === HOME_CHALLENGE_ID) ?? list[0]
    return (
      <Panel>
        <SectionHeader
          title={t.nav.challenges}
          action={
            onShowAll ? (
              <ShowAllButton
                label={t.nav.showAll}
                sectionName={t.nav.challenges}
                onClick={onShowAll}
              />
            ) : null
          }
        />
        {status === "anonymous" || !featured ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{t.dashboard.signInHint}</p>
        ) : (
          renderChallenge(featured)
        )}
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {status === "anonymous" ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t.dashboard.signInHint}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map(renderChallenge)}</div>
      )}
    </div>
  )
}
