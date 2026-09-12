"use client"

import { useEffect, useId, useState } from "react"
import { Check, Copy, Trash2, User as UserIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { useLocale, useTranslations } from "@/lib/i18n"
import { useConnections } from "@/lib/flowfic/use-connections"
import type { Connection } from "@/lib/flowfic/connections-api"
import { formatCount } from "@/lib/flowfic/gamification"
import { HINT } from "@/lib/text-styles"
import { cn } from "@/lib/utils"

import { CardSubtitle, EmptyHint, Panel, SectionHeader, Spinner, panelVariants } from "./dashboard-widgets"

function inviteUrl(token: string): string {
  if (typeof window === "undefined") return token
  return `${window.location.origin}/connect/${token}`
}

/**
 * Profile screen's connections card: the caller's own invite link (create /
 * regenerate / disable, plus copy-to-clipboard) and the connections it has
 * produced. There is no user search anywhere in the app — a link generated
 * here and shared out-of-band is the only way two accounts connect.
 */
export function ConnectionsPanel() {
  const t = useTranslations()
  const locale = useLocale()
  const headingId = useId()
  const inviteHeadingId = useId()
  const listHeadingId = useId()
  const {
    inviteToken,
    inviteLoading,
    inviteBusy,
    connections,
    error,
    createOrRegenerate,
    revoke,
    remove,
  } = useConnections()

  const [createError, setCreateError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false)
  const [disableError, setDisableError] = useState(false)

  // "Copied." reverts on its own after a few seconds — an inline confirmation
  // beside the button that raised it, not a toast: it never covers content,
  // so there is nothing that needs dismissing.
  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  async function handleCreateOrRegenerate() {
    setCreateError(false)
    const ok = await createOrRegenerate()
    if (!ok) setCreateError(true)
  }

  async function handleCopy() {
    if (inviteToken === null) return
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(inviteUrl(inviteToken))
      setCopied(true)
    } catch {
      setCopyError(true)
    }
  }

  async function handleDisable() {
    setDisableError(false)
    const ok = await revoke()
    if (!ok) {
      setDisableError(true)
      return
    }
    setDisableConfirmOpen(false)
  }

  return (
    <section
      aria-labelledby={headingId}
      className={cn(panelVariants({ padding: "lg" }), "flex w-full flex-col gap-6")}
    >
      <SectionHeader id={headingId} title={t.connections.title} description={t.connections.description} />

      <div className="flex flex-col gap-3">
        <CardSubtitle id={inviteHeadingId}>{t.connections.inviteLabel}</CardSubtitle>
        <InviteLinkControl
          inviteToken={inviteToken}
          inviteLoading={inviteLoading}
          inviteBusy={inviteBusy}
          createError={createError}
          copied={copied}
          copyError={copyError}
          onCreateOrRegenerate={() => void handleCreateOrRegenerate()}
          onCopy={() => void handleCopy()}
          onRequestDisable={() => setDisableConfirmOpen(true)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <CardSubtitle id={listHeadingId}>
          {connections !== null && connections.length > 0
            ? t.connections.connectionsCount.replace(
                "{count}",
                formatCount(connections.length, locale),
              )
            : t.connections.connectionsTitle}
        </CardSubtitle>
        <ConnectionsList connections={connections} error={error} onRemove={remove} />
      </div>

      <AlertDialog open={disableConfirmOpen} onOpenChange={setDisableConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.connections.disableConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.connections.disableConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {disableError ? (
            <p className="text-destructive text-sm" role="alert">
              {t.connections.disableFailed}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inviteBusy}>
              {t.connections.disableCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleDisable()
              }}
              disabled={inviteBusy}
              variant="destructive"
            >
              {t.connections.disableConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function InviteLinkControl({
  inviteToken,
  inviteLoading,
  inviteBusy,
  createError,
  copied,
  copyError,
  onCreateOrRegenerate,
  onCopy,
  onRequestDisable,
}: {
  inviteToken: string | null
  inviteLoading: boolean
  inviteBusy: boolean
  createError: boolean
  copied: boolean
  copyError: boolean
  onCreateOrRegenerate: () => void
  onCopy: () => void
  onRequestDisable: () => void
}) {
  const t = useTranslations()

  if (inviteLoading) {
    return <Spinner size="inline" />
  }

  if (inviteToken === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button type="button" onClick={onCreateOrRegenerate} disabled={inviteBusy}>
          {inviteBusy ? <Spinner size="inline" className="text-current" /> : null}
          {inviteBusy ? t.connections.creatingInvite : t.connections.createInvite}
        </Button>
        {createError ? (
          <p className="text-destructive text-sm" role="alert">
            {t.connections.createFailed}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={inviteUrl(inviteToken)}
          aria-label={t.connections.inviteLabel}
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs sm:text-sm"
        />
        <Button
          type="button"
          variant="outline"
          onClick={onCopy}
          className="gap-2 whitespace-nowrap"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {t.connections.copyLink}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={onCreateOrRegenerate} disabled={inviteBusy}>
          {inviteBusy ? <Spinner size="inline" /> : null}
          {inviteBusy ? t.connections.regeneratingInvite : t.connections.regenerateInvite}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onRequestDisable}
          disabled={inviteBusy}
        >
          {t.connections.disableInvite}
        </Button>
        {copied ? (
          <span className={HINT} role="status">
            {t.connections.linkCopied}
          </span>
        ) : null}
        {copyError ? (
          <span className="text-destructive text-sm" role="alert">
            {t.connections.copyFailed}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ConnectionsList({
  connections,
  error,
  onRemove,
}: {
  connections: Connection[] | null
  error: boolean
  onRemove: (userId: string) => Promise<boolean>
}) {
  const t = useTranslations()

  if (connections === null) {
    return <Spinner size="inline" />
  }
  if (error) {
    return <EmptyHint className="py-6">{t.connections.loadFailed}</EmptyHint>
  }
  if (connections.length === 0) {
    return <EmptyHint className="py-6">{t.connections.emptyConnections}</EmptyHint>
  }

  return (
    <div className="flex flex-col gap-2">
      {connections.map((c) => (
        <ConnectionRow key={c.user.id} connection={c} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ConnectionRow({
  connection,
  onRemove,
}: {
  connection: Connection
  onRemove: (userId: string) => Promise<boolean>
}) {
  const t = useTranslations()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    setError(false)
    const ok = await onRemove(connection.user.id)
    setBusy(false)
    if (!ok) {
      setError(true)
      return
    }
    setConfirmOpen(false)
  }

  const initials = connection.user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <Panel padding="sm" className="flex items-center gap-3">
      <Avatar className="size-9">
        {connection.user.avatarUrl ? <AvatarImage src={connection.user.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xs">
          {initials || <UserIcon className="size-4" aria-hidden />}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{connection.user.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${t.connections.removeConnection} ${connection.user.name}`}
        onClick={() => {
          setError(false)
          setConfirmOpen(true)
        }}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.connections.removeConnectionConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.connections.removeConnectionConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {t.connections.removeConnectionFailed}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t.connections.removeConnectionCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirm()
              }}
              disabled={busy}
              variant="destructive"
            >
              {t.connections.removeConnectionConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}
