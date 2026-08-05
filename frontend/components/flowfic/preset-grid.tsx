"use client"

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react"
import { Check, Pencil, Plus, Trash2, Trophy, X } from "lucide-react"

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
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { useAuth, MAX_CUSTOM_PRESETS, type CustomPreset } from "@/lib/auth"
import {
  createCustomPreset,
  deleteCustomPreset,
  updateCustomPreset,
} from "@/lib/flowfic/presets-api"
import {
  PRESETS,
  extractPresetSettings,
  findMatchingCustomPreset,
  findMatchingPreset,
  type GameSettings,
  type PresetId,
  type PresetSettings,
} from "@/lib/flowfic/types"

export type GridMode = "system" | "custom"

type Props = {
  /** Current settings, used to highlight the matching mode and to snapshot the
   *  preset-covered subset when saving a new custom mode. */
  settings: GameSettings
  /** Which face the grid shows. Owned by the launcher's "Custom modes" button. */
  mode: GridMode
  /** Called with the preset-covered subset when the user picks a mode; the
   *  parent merges it into the full settings object. */
  onApply: (preset: PresetSettings) => void
  /** Start the challenge of the day (applies its settings and plays). */
  onStartChallenge: () => void
}

// Every cell keeps the 4:2 proportion the home layout is drawn to, so the grid
// never reflows as a cell's content changes (mode card → "+" slot → dotted
// placeholder → naming form). Single-column phone layouts drop the ratio — a
// 4:2 box at full phone width would be absurdly tall — and use a fixed height.
const CARD_SHAPE = "h-24 sm:h-auto sm:aspect-[4/2] sm:min-h-20"

/**
 * The 2x2 mode grid in the home screen's session launcher: three system modes
 * plus the highlighted challenge of the day, or — when flipped — the signed-in
 * user's custom modes with create/rename/delete flows against
 * `/profile/me/presets`.
 */
export function PresetGrid({ settings, mode, onApply, onStartChallenge }: Props) {
  const t = useTranslations()
  const { user, getAccessToken, applyLocalUser } = useAuth()
  const customPresets: CustomPreset[] = useMemo(
    () => user?.customPresets ?? [],
    [user?.customPresets],
  )
  const isAuthenticated = user !== null

  // Index (0..MAX_CUSTOM_PRESETS-1) of the slot the user is currently
  // naming. `null` means no slot is in name-input mode.
  const [namingSlotIndex, setNamingSlotIndex] = useState<number | null>(null)
  const [draftName, setDraftName] = useState("")
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Inline rename state for an existing custom preset (the pencil icon on
  // each custom card). Only one preset can be in edit mode at a time.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editBusyId, setEditBusyId] = useState<string | null>(null)
  const [presetMutationError, setPresetMutationError] = useState<string | null>(
    null,
  )

  // Delete confirmation dialog. `confirmDeleteId` selects the preset; errors
  // render inline in the dialog so the user can retry or cancel.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  const activeSystemPresetId = useMemo<PresetId | null>(
    () => findMatchingPreset(settings),
    [settings],
  )
  const activeCustomPresetId = useMemo<string | null>(
    () => findMatchingCustomPreset(settings, customPresets),
    [settings, customPresets],
  )

  function applySystemPreset(id: PresetId) {
    const preset = PRESETS.find((p) => p.id === id)
    if (preset) onApply(preset.settings)
  }

  function startCreatingAt(slotIndex: number) {
    setCreateError(null)
    setDraftName("")
    setNamingSlotIndex(slotIndex)
  }

  function cancelCreating() {
    setNamingSlotIndex(null)
    setDraftName("")
    setCreateError(null)
  }

  async function submitCreate() {
    const name = draftName.trim()
    if (name.length === 0) return
    setCreating(true)
    setCreateError(null)
    const token = await getAccessToken()
    if (token === null) {
      setCreateError(t.settings.signInForCustomModes)
      setCreating(false)
      return
    }
    const result = await createCustomPreset(
      token,
      name,
      extractPresetSettings(settings),
    )
    setCreating(false)
    if (!result.ok) {
      setCreateError(
        result.error === "limit"
          ? t.settings.customLimitReached.replace(
              "{max}",
              String(MAX_CUSTOM_PRESETS),
            )
          : t.settings.customSaveFailed,
      )
      return
    }
    applyLocalUser(result.user)
    cancelCreating()
  }

  function startEditing(preset: CustomPreset) {
    setEditingId(preset.id)
    setEditingName(preset.name)
    setPresetMutationError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingName("")
  }

  async function submitEditing(id: string) {
    const name = editingName.trim()
    if (name.length === 0) return
    setEditBusyId(id)
    setPresetMutationError(null)
    const token = await getAccessToken()
    if (token === null) {
      setEditBusyId(null)
      setPresetMutationError(t.profile.customPresetRenameFailed)
      return
    }
    const result = await updateCustomPreset(token, id, { name })
    setEditBusyId(null)
    if (!result.ok) {
      setPresetMutationError(t.profile.customPresetRenameFailed)
      return
    }
    applyLocalUser(result.user)
    cancelEditing()
  }

  function requestDelete(id: string) {
    setDeleteError(false)
    setConfirmDeleteId(id)
  }

  async function confirmDelete() {
    if (confirmDeleteId === null) return
    setDeleteBusy(true)
    setDeleteError(false)
    const token = await getAccessToken()
    if (token === null) {
      setDeleteBusy(false)
      setDeleteError(true)
      return
    }
    const result = await deleteCustomPreset(token, confirmDeleteId)
    setDeleteBusy(false)
    if (!result.ok) {
      setDeleteError(true)
      return
    }
    applyLocalUser(result.user)
    if (editingId === confirmDeleteId) cancelEditing()
    setConfirmDeleteId(null)
  }

  // Index of the FIRST empty custom-preset slot. That slot renders the "+"
  // create action; later empty slots render disabled placeholders so the user
  // always fills the next free slot rather than randomly anywhere in the grid.
  const firstEmptyCustomSlot =
    customPresets.length < MAX_CUSTOM_PRESETS ? customPresets.length : null

  return (
    <>
      <div
        className="grid h-full grid-cols-1 gap-3 sm:grid-cols-2"
        role="group"
        aria-label={mode === "system" ? t.settings.presetsLabel : t.settings.customModesLabel}
      >
        {mode === "system" ? renderSystemPresets() : renderCustomPresets()}
      </div>
      {createError ? (
        <p role="alert" className="text-destructive text-xs">
          {createError}
        </p>
      ) : null}
      {presetMutationError ? (
        <p role="alert" className="text-destructive text-xs">
          {presetMutationError}
        </p>
      ) : null}

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.profile.customPresetDeleteConfirm}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.profile.customPresetDeleteConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-destructive text-sm" role="alert">
              {t.profile.customPresetDeleteFailed}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>
              {t.profile.customPresetCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleteBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t.profile.customPresetDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  // ---- Render helpers ---------------------------------------------------

  function renderSystemPresets() {
    return (
      <>
        {PRESETS.map((preset) => {
          const meta = t.presets[preset.id]
          return (
            <PresetButton
              key={preset.id}
              title={meta.name}
              subtitle={meta.description}
              active={activeSystemPresetId === preset.id}
              onClick={() => applySystemPreset(preset.id)}
            />
          )
        })}
        <ChallengeCard onStart={onStartChallenge} />
      </>
    )
  }

  function renderCustomPresets(): ReactNode {
    const slots: ReactNode[] = []
    for (let i = 0; i < MAX_CUSTOM_PRESETS; i++) {
      const preset = customPresets[i]
      if (preset) {
        slots.push(
          <CustomPresetCard
            key={preset.id}
            preset={preset}
            active={activeCustomPresetId === preset.id}
            editing={editingId === preset.id}
            busy={editBusyId === preset.id}
            draft={editingId === preset.id ? editingName : ""}
            onApply={() => onApply(preset.settings)}
            onStartEdit={() => startEditing(preset)}
            onChangeDraft={setEditingName}
            onSubmitEdit={() => void submitEditing(preset.id)}
            onCancelEdit={cancelEditing}
            onDelete={() => requestDelete(preset.id)}
          />,
        )
        continue
      }
      // Empty slot. Anonymous users get the sign-in explanation once, in the
      // first cell, rather than repeated across every placeholder.
      const isFirstEmpty = i === firstEmptyCustomSlot
      if (!isFirstEmpty || !isAuthenticated) {
        slots.push(
          <EmptySlot
            key={`empty-${i}`}
            hint={!isAuthenticated && i === 0 ? t.settings.signInForCustomModes : null}
          />,
        )
        continue
      }

      // First empty slot: either the "+ create" action OR the inline naming
      // form when the user clicked it.
      if (namingSlotIndex === i) {
        slots.push(
          <InlineNameForm
            key={`naming-${i}`}
            value={draftName}
            onChange={setDraftName}
            onSubmit={() => void submitCreate()}
            onCancel={cancelCreating}
            busy={creating}
            placeholder={t.settings.customNamePlaceholder}
            inputLabel={t.settings.customNamePlaceholder}
            saveLabel={t.settings.customNameSave}
            cancelLabel={t.settings.customNameCancel}
          />,
        )
      } else {
        slots.push(
          <button
            key={`add-${i}`}
            type="button"
            onClick={() => startCreatingAt(i)}
            aria-label={t.settings.createPresetLabel}
            title={t.settings.createPresetTooltip}
            className={cn(
              CARD_SHAPE,
              "border-border hover:bg-accent/20 focus-visible:ring-ring flex items-center justify-center rounded-xl border border-dashed p-3 text-center transition-colors",
              "focus-visible:ring-2 focus-visible:outline-none",
            )}
          >
            <Plus className="text-muted-foreground size-7" strokeWidth={3} aria-hidden />
          </button>,
        )
      }
    }

    return slots
  }
}

// ---- Subcomponents ----------------------------------------------------

/**
 * Inline name editor card, shared by the create-preset flow (naming a new
 * slot) and the rename flow on an existing custom preset: an autofocused
 * input plus cancel/save icon buttons. Enter submits, Escape cancels.
 */
function InlineNameForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  busy,
  placeholder,
  inputLabel,
  saveLabel,
  cancelLabel,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  busy: boolean
  placeholder: string
  inputLabel: string
  saveLabel: string
  cancelLabel: string
}) {
  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      onSubmit()
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div
      className={cn(
        CARD_SHAPE,
        "border-highlight bg-highlight/20 ring-highlight/30 flex flex-col justify-center gap-2 rounded-xl border p-3 ring-1",
      )}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        maxLength={40}
        aria-label={inputLabel}
        className="h-8 text-sm"
        disabled={busy}
      />
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          aria-label={cancelLabel}
          className="hover:bg-accent text-muted-foreground inline-flex size-6 items-center justify-center rounded-md"
          disabled={busy}
        >
          <X className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onSubmit}
          aria-label={saveLabel}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-6 items-center justify-center rounded-md disabled:opacity-50"
          disabled={busy || value.trim().length === 0}
        >
          <Check className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function PresetButton({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string
  subtitle?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        CARD_SHAPE,
        "flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-3 text-center transition-colors",
        "hover:bg-accent/20 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-highlight bg-highlight/20 ring-highlight/30 ring-1"
          : "border-border bg-card",
      )}
    >
      <span className="text-foreground line-clamp-1 w-full text-center text-sm font-semibold">
        {title}
      </span>
      {subtitle ? (
        <span className="text-muted-foreground line-clamp-2 w-full text-center text-xs leading-snug">
          {subtitle}
        </span>
      ) : null}
    </button>
  )
}

/**
 * "Challenge of the day" cell — the one card in the grid that is a direct
 * action rather than a selection: it applies the challenge's settings and
 * starts the sprint straight away. Wears the primary colour so it reads as the
 * grid's featured cell. The challenge itself is still a placeholder; the real
 * per-day rules land with the challenge game flow.
 */
function ChallengeCard({ onStart }: { onStart: () => void }) {
  const t = useTranslations()
  return (
    <button
      type="button"
      onClick={onStart}
      className={cn(
        CARD_SHAPE,
        "bg-primary text-primary-foreground relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl p-3 text-center shadow-sm transition-colors",
        "hover:bg-primary/90 focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      )}
    >
      <Trophy
        className="pointer-events-none absolute -top-2 -right-2 size-16 opacity-15"
        aria-hidden
      />
      <span className="relative flex items-center gap-1.5 text-sm font-semibold">
        <Trophy className="size-4" aria-hidden />
        {t.dashboard.challengeOfDay}
      </span>
      <span className="relative line-clamp-2 text-xs leading-snug opacity-90">
        {t.dashboard.challengeOfDayHint}
      </span>
    </button>
  )
}

function CustomPresetCard({
  preset,
  active,
  editing,
  busy,
  draft,
  onApply,
  onStartEdit,
  onChangeDraft,
  onSubmitEdit,
  onCancelEdit,
  onDelete,
}: {
  preset: CustomPreset
  active: boolean
  editing: boolean
  busy: boolean
  draft: string
  onApply: () => void
  onStartEdit: () => void
  onChangeDraft: (v: string) => void
  onSubmitEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  const t = useTranslations()

  if (editing) {
    return (
      <InlineNameForm
        value={draft}
        onChange={onChangeDraft}
        onSubmit={onSubmitEdit}
        onCancel={onCancelEdit}
        busy={busy}
        placeholder={t.settings.customNamePlaceholder}
        inputLabel={t.profile.customPresetEdit}
        saveLabel={t.profile.customPresetSave}
        cancelLabel={t.profile.customPresetCancel}
      />
    )
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onApply()
    }
  }

  // Outer is a div (not a button) so the inner pencil/trash can be real
  // buttons — nesting <button> inside <button> is invalid HTML. Outer
  // surfaces role/tabindex so the apply-on-click behavior stays keyboard
  // and screen-reader accessible.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={handleKey}
      aria-pressed={active}
      className={cn(
        CARD_SHAPE,
        "group relative flex cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border p-3 text-center transition-colors",
        "hover:bg-accent/20 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-highlight bg-highlight/20 ring-highlight/30 ring-1"
          : "border-border bg-card",
      )}
    >
      <span className="text-foreground line-clamp-2 w-full text-center text-sm font-semibold">
        {preset.name}
      </span>
      {/* Action chips. Visible on hover/focus-within so the unhovered card
          stays clean. Keyboard users tab through them after the card. */}
      <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onStartEdit()
          }}
          aria-label={t.profile.customPresetEdit}
          disabled={busy}
          className="hover:bg-accent text-muted-foreground inline-flex size-6 items-center justify-center rounded-md"
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label={t.profile.customPresetDelete}
          disabled={busy}
          className="hover:bg-destructive/10 text-destructive inline-flex size-6 items-center justify-center rounded-md"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Dotted placeholder for a not-yet-fillable slot. Anonymous users get the
 *  sign-in hint in the first cell so the empty grid explains itself. */
function EmptySlot({ hint }: { hint: string | null }) {
  return (
    <div
      aria-hidden={hint === null ? "true" : undefined}
      className={cn(
        CARD_SHAPE,
        "border-border/60 text-muted-foreground flex items-center justify-center rounded-xl border border-dashed p-3 text-center text-xs",
      )}
    >
      {hint}
    </div>
  )
}
