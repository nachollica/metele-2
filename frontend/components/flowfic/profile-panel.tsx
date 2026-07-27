"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import { BookOpen, Loader2, Upload, User as UserIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { isValidEmail, useAuth } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { fetchStoryCount, updateProfile } from "@/lib/flowfic/profile-api"

// Cap on the picture file size we'll accept, in bytes. Pictures end up as a
// data: URL stored verbatim in the users table (`picture` column), so the
// row size is bounded by this. 256KB is generous for a square avatar at
// reasonable JPEG/PNG quality.
const MAX_PICTURE_BYTES = 256 * 1024

type Status = "idle" | "saving" | "saved" | "error"

type Props = {
  /** Bumped after a successful PATCH so callers can refresh upstream caches
   *  (e.g. nothing right now — but reserved for a future avatar refresh). */
  onProfileUpdated?: () => void
}

export function ProfilePanel({ onProfileUpdated }: Props) {
  const t = useTranslations()
  const { user, getAccessToken, applyLocalUser } = useAuth()
  const nameId = useId()
  const emailId = useId()
  const fileId = useId()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Local form state. Seeded from the auth user; updates only commit to the
  // backend on Save, so a user can edit and abandon without consequence.
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [picture, setPicture] = useState<string | null>(user?.avatarUrl ?? null)
  const [storyCount, setStoryCount] = useState<number | null>(null)
  const [pictureError, setPictureError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>("idle")

  // Re-seed the form when the upstream auth user changes (e.g. after a
  // successful save round-trips the new value). This also handles the
  // initial render before `user` is populated.
  useEffect(() => {
    setName(user?.name ?? "")
    setEmail(user?.email ?? "")
    setPicture(user?.avatarUrl ?? null)
  }, [user])

  // Pull the story count once the user is known.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const token = await getAccessToken()
      if (token === null || cancelled) return
      const c = await fetchStoryCount(token)
      if (!cancelled) setStoryCount(c)
    })()
    return () => {
      cancelled = true
    }
  }, [getAccessToken])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_PICTURE_BYTES) {
      setPictureError(t.profile.pictureTooLarge)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        setPicture(result)
        setPictureError(null)
      }
    }
    reader.onerror = () => setPictureError(t.profile.pictureReadFailed)
    reader.readAsDataURL(file)
  }

  // Empty input is treated as a clear (-> null). A non-empty input that
  // fails the shape check produces a sentinel so callers can disable Save
  // without trying to PATCH something the server will reject anyway.
  const trimmedEmail = email.trim()
  const emailShapeValid = trimmedEmail.length === 0 || isValidEmail(trimmedEmail)

  function buildPatch() {
    if (!user) return null
    const patch: { name?: string; email?: string | null; picture?: string | null } = {}
    const trimmedName = name.trim()
    if (trimmedName.length > 0 && trimmedName !== user.name) patch.name = trimmedName
    const normalizedEmail = trimmedEmail.length === 0 ? null : trimmedEmail
    if (normalizedEmail !== user.email) patch.email = normalizedEmail
    if (picture !== user.avatarUrl) patch.picture = picture
    return patch
  }

  async function handleSave() {
    const patch = buildPatch()
    if (patch === null || Object.keys(patch).length === 0) return
    if (!emailShapeValid) {
      setStatus("error")
      return
    }
    setStatus("saving")
    const token = await getAccessToken()
    if (token === null) {
      setStatus("error")
      return
    }
    const updated = await updateProfile(token, patch)
    if (updated === null) {
      setStatus("error")
      return
    }
    applyLocalUser(updated)
    setStatus("saved")
    onProfileUpdated?.()
  }

  if (!user) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />
      </section>
    )
  }

  const hasChanges = Object.keys(buildPatch() ?? {}).length > 0

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <section
      aria-labelledby="profile-heading"
      className="bg-card text-card-foreground mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-lg border p-6 shadow-sm"
    >
      <header>
        <h2
          id="profile-heading"
          className="font-serif text-2xl font-semibold tracking-tight"
        >
          {t.profile.title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t.profile.description}
        </p>
      </header>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Avatar className="size-24">
          {picture ? <AvatarImage src={picture} alt="" /> : null}
          <AvatarFallback className="text-2xl">
            {initials || <UserIcon className="size-8" aria-hidden />}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fileId} className="sr-only">
            {t.profile.uploadPicture}
          </Label>
          <Input
            ref={fileInputRef}
            id={fileId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="size-4" aria-hidden />
            {t.profile.uploadPicture}
          </Button>
          {picture ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPicture(null)}
            >
              {t.profile.removePicture}
            </Button>
          ) : null}
          {pictureError ? (
            <p className="text-destructive text-xs" role="alert">
              {pictureError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nameId}>{t.profile.nameLabel}</Label>
          <Input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={emailId}>{t.profile.emailLabel}</Label>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={320}
            autoComplete="email"
            aria-invalid={!emailShapeValid}
            aria-describedby={!emailShapeValid ? `${emailId}-error` : undefined}
          />
          {!emailShapeValid ? (
            <p
              id={`${emailId}-error`}
              className="text-destructive text-xs"
              role="alert"
            >
              {t.profile.emailInvalid}
            </p>
          ) : null}
        </div>
      </div>

      <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3 text-sm">
        <BookOpen className="text-muted-foreground size-4" aria-hidden />
        <span className="font-medium">{t.profile.storyCountLabel}</span>
        <span className="text-muted-foreground ml-auto tabular-nums">
          {storyCount === null ? "…" : storyCount}
        </span>
      </div>

      <div className="flex items-center justify-end gap-3">
        {status === "error" ? (
          <span className="text-destructive text-sm" role="alert">
            {t.profile.saveFailed}
          </span>
        ) : null}
        {status === "saved" ? (
          <span className="text-muted-foreground text-sm" role="status">
            {t.profile.saved}
          </span>
        ) : null}
        <Button
          onClick={() => void handleSave()}
          disabled={status === "saving" || !hasChanges || !emailShapeValid}
        >
          {status === "saving" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {t.profile.save}
        </Button>
      </div>
    </section>
  )
}

