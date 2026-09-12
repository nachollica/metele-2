"use client"

import { useEffect, useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoginModal } from "@/components/auth/login-modal"

import { useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { acceptInvite, fetchInvitePreview, type PublicUser } from "@/lib/flowfic/connections-api"
import { writePendingInvite } from "@/lib/flowfic/pending-invite"
import { ITEM_TITLE } from "@/lib/text-styles"

import { Spinner } from "./dashboard-widgets"

type Props = {
  token: string
  onBackHome: () => void
  onOpenProfile: () => void
}

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

function InviterAvatar({ user }: { user: PublicUser }) {
  return (
    <Avatar className="size-16">
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
      <AvatarFallback className="text-xl">{initialsFor(user.name)}</AvatarFallback>
    </Avatar>
  )
}

function ConnectMessage({
  title,
  body,
  onBackHome,
}: {
  title: string
  body: string
  onBackHome: () => void
}) {
  const t = useTranslations()
  return (
    <div className="flex flex-col items-start gap-4 py-8">
      <p className={ITEM_TITLE}>{title}</p>
      <p className="text-muted-foreground">{body}</p>
      <Button type="button" variant="outline" onClick={onBackHome}>
        {t.connect.backHome}
      </Button>
    </div>
  )
}

/**
 * `/connect/:token` — the destination of someone else's invite link. There is
 * no user search anywhere in the app; this screen and the profile's own
 * connections card are the only way two accounts connect.
 *
 * Six shapes, decided in order: the preview is still loading, the token
 * doesn't resolve to anyone, the link is the caller's own, the caller is
 * anonymous (offer sign-in, which round-trips through `pending-invite.ts`),
 * ready to connect, or already connected (accepting again is idempotent
 * server-side, so this is also what a second visit shows).
 */
export function ConnectScreen({ token, onBackHome, onOpenProfile }: Props) {
  const t = useTranslations()
  const { status, user, getAccessToken } = useAuth()
  // undefined = preview still loading; null = the token doesn't resolve.
  const [inviter, setInviter] = useState<PublicUser | null | undefined>(undefined)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchInvitePreview(token).then((result) => {
      if (!cancelled) setInviter(result)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleConnect() {
    setConnecting(true)
    setFailed(false)
    const accessToken = await getAccessToken()
    if (accessToken === null) {
      setConnecting(false)
      setFailed(true)
      return
    }
    const result = await acceptInvite(accessToken, token)
    setConnecting(false)
    if (result === null) {
      setFailed(true)
      return
    }
    setConnected(true)
  }

  if (status === "loading" || inviter === undefined) {
    return (
      <div role="status" aria-live="polite" className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  if (inviter === null) {
    return (
      <ConnectMessage
        title={t.connect.invalidTitle}
        body={t.connect.invalidBody}
        onBackHome={onBackHome}
      />
    )
  }

  if (user?.id === inviter.id) {
    return (
      <ConnectMessage
        title={t.connect.ownLinkTitle}
        body={t.connect.ownLinkBody}
        onBackHome={onBackHome}
      />
    )
  }

  if (connected) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <InviterAvatar user={inviter} />
        <p className={ITEM_TITLE}>{t.connect.connectedWith.replace("{name}", inviter.name)}</p>
        <Button type="button" onClick={onOpenProfile}>
          {t.connect.goToConnections}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <InviterAvatar user={inviter} />
      <p className={ITEM_TITLE}>{t.connect.invitedBy.replace("{name}", inviter.name)}</p>

      {status === "anonymous" ? (
        <>
          <Button type="button" onClick={() => setLoginOpen(true)}>
            {t.connect.signInToConnect}
          </Button>
          <LoginModal
            open={loginOpen}
            onOpenChange={setLoginOpen}
            title={t.connect.signInTitle}
            description={t.connect.signInDescription.replace("{name}", inviter.name)}
            onBeforeLogin={() => writePendingInvite(token)}
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Button type="button" onClick={() => void handleConnect()} disabled={connecting}>
            {connecting ? <Spinner size="inline" className="text-current" /> : null}
            {connecting
              ? t.connect.connecting
              : t.connect.connectWith.replace("{name}", inviter.name)}
          </Button>
          {failed ? (
            <p className="text-destructive text-sm" role="alert">
              {t.connect.connectFailed}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
