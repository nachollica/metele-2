"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react"
import {
  BookOpen,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useAuth, type CustomPreset } from "@/lib/auth"
import { useTranslations } from "@/lib/i18n"
import { fetchStoryCount, updateProfile } from "@/lib/metele/profile-api"
import {
  deleteCustomPreset,
  updateCustomPreset,
} from "@/lib/metele/presets-api"

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

  async function handleSave() {
    if (!user) return
    setStatus("saving")
    const token = await getAccessToken()
    if (token === null) {
      setStatus("error")
      return
    }
    const patch: { name?: string; email?: string | null; picture?: string | null } = {}
    const trimmedName = name.trim()
    if (trimmedName.length > 0 && trimmedName !== user.name) patch.name = trimmedName
    const normalizedEmail = email.trim().length === 0 ? null : email.trim()
    if (normalizedEmail !== user.email) patch.email = normalizedEmail
    if (picture !== user.avatarUrl) patch.picture = picture

    if (Object.keys(patch).length === 0) {
      setStatus("saved")
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
      className="bg-card text-card-foreground flex flex-col gap-6 rounded-lg border p-6 shadow-sm"
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
          />
        </div>
      </div>

      <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3 text-sm">
        <BookOpen className="text-muted-foreground size-4" aria-hidden />
        <span className="font-medium">{t.profile.storyCountLabel}</span>
        <span className="text-muted-foreground ml-auto tabular-nums">
          {storyCount === null ? "…" : storyCount}
        </span>
      </div>

      <CustomPresetsSection />

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
        <Button onClick={() => void handleSave()} disabled={status === "saving"}>
          {status === "saving" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {t.profile.save}
        </Button>
      </div>
    </section>
  )
}

// ---- Custom presets section ---------------------------------------------

function CustomPresetsSection() {
  const t = useTranslations()
  const { user, getAccessToken, applyLocalUser } = useAuth()
  const presets: CustomPreset[] = user?.customPresets ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [error, setError] = useState<string | null>(null)
  // Disabled state per-row while a network call is in flight.
  const [busyId, setBusyId] = useState<string | null>(null)

  function startEdit(p: CustomPreset) {
    setEditingId(p.id)
    setDraftName(p.name)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraftName("")
    setError(null)
  }

  async function saveRename(id: string) {
    const name = draftName.trim()
    if (name.length === 0) return
    setBusyId(id)
    setError(null)
    const token = await getAccessToken()
    if (token === null) {
      setBusyId(null)
      setError(t.profile.customPresetRenameFailed)
      return
    }
    const result = await updateCustomPreset(token, id, { name })
    setBusyId(null)
    if (!result.ok) {
      setError(t.profile.customPresetRenameFailed)
      return
    }
    applyLocalUser(result.user)
    cancelEdit()
  }

  async function handleDelete(id: string) {
    if (typeof window !== "undefined") {
      if (!window.confirm(t.profile.customPresetDeleteConfirm)) return
    }
    setBusyId(id)
    setError(null)
    const token = await getAccessToken()
    if (token === null) {
      setBusyId(null)
      setError(t.profile.customPresetDeleteFailed)
      return
    }
    const result = await deleteCustomPreset(token, id)
    setBusyId(null)
    if (!result.ok) {
      setError(t.profile.customPresetDeleteFailed)
      return
    }
    applyLocalUser(result.user)
    if (editingId === id) cancelEdit()
  }

  function handleRenameKey(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault()
      void saveRename(id)
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <section
      aria-labelledby="custom-presets-heading"
      className="flex flex-col gap-3"
    >
      <header>
        <h3
          id="custom-presets-heading"
          className="text-sm font-semibold tracking-tight"
        >
          {t.profile.customPresetsTitle}
        </h3>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {t.profile.customPresetsDescription}
        </p>
      </header>

      {presets.length === 0 ? (
        <p className="text-muted-foreground bg-muted/40 rounded-md border p-3 text-sm">
          {t.profile.customPresetsEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {presets.map((p) => {
            const editing = editingId === p.id
            const busy = busyId === p.id
            return (
              <li
                key={p.id}
                className="bg-muted/40 flex items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                {editing ? (
                  <>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => handleRenameKey(e, p.id)}
                      maxLength={40}
                      autoFocus
                      aria-label={t.profile.customPresetEdit}
                      className="h-8 text-sm"
                      disabled={busy}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveRename(p.id)}
                      disabled={busy || draftName.trim().length === 0}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : null}
                      {t.profile.customPresetSave}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      aria-label={t.profile.customPresetCancel}
                      disabled={busy}
                    >
                      <X className="size-4" aria-hidden />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate font-medium">{p.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(p)}
                      aria-label={t.profile.customPresetEdit}
                      disabled={busy}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleDelete(p.id)}
                      aria-label={t.profile.customPresetDelete}
                      disabled={busy}
                      className="text-destructive hover:text-destructive"
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-4" aria-hidden />
                      )}
                    </Button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
