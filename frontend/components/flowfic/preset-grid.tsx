"use client"

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

type Props = {
  /** Current settings, used to highlight the matching preset and to snapshot
   *  the preset-covered subset when saving a new custom preset. */
  settings: GameSettings
  /** Called with the preset-covered subset when the user picks a preset; the
   *  parent merges it into the full settings object. */
  onApply: (preset: PresetSettings) => void
}

type Mode = "system" | "custom"

/**
 * The preset picker shown at the top of the settings screen: the 5 system
 * presets plus a 6th slot that flips into "custom modes" — the signed-in
 * user's saved presets with create/rename/delete flows against
 * `/profile/me/presets`.
 */
export function PresetGrid({ settings, onApply }: Props) {
  const t = useTranslations()
  const { user, getAccessToken, applyLocalUser } = useAuth()
  const customPresets: CustomPreset[] = useMemo(
    () => user?.customPresets ?? [],
    [user?.customPresets],
  )
  const isAuthenticated = user !== null

  const [mode, setMode] = useState<Mode>("system")
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

  // Delete confirmation dialog (same AlertDialog pattern as the stories
  // sidebar). `confirmDeleteId` selects the preset; errors render inline in
  // the dialog so the user can retry or cancel.
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

  // Index of the FIRST empty custom-preset slot, when in custom mode.
  // That slot renders the "+" create-preset action; later empty slots
  // render disabled placeholders so the user always edits the next free
  // slot rather than randomly anywhere in the grid.
  const firstEmptyCustomSlot =
    customPresets.length < MAX_CUSTOM_PRESETS ? customPresets.length : null

  return (
    <TooltipProvider delayDuration={150}>
      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {mode === "system"
            ? t.settings.presetsLabel
            : t.settings.customModesLabel}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
      </section>

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
    </TooltipProvider>
  )

  // ---- Render helpers ---------------------------------------------------

  function renderSystemPresets() {
    return (
      <>
        {PRESETS.map((preset) => {
          const isActive = activeSystemPresetId === preset.id
          const meta = t.presets[preset.id]
          return (
            <PresetButton
              key={preset.id}
              title={meta.name}
              subtitle={meta.description}
              active={isActive}
              onClick={() => applySystemPreset(preset.id)}
            />
          )
        })}
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleSlotButton
              title={t.settings.customModesLabel}
              subtitle={
                isAuthenticated
                  ? t.settings.customModesDescription
                  : t.settings.signInForCustomModes
              }
              onClick={() => {
                if (isAuthenticated) setMode("custom")
              }}
              disabled={!isAuthenticated}
            />
          </TooltipTrigger>
          <TooltipContent>
            {isAuthenticated
              ? t.settings.customModesTooltip
              : t.settings.signInForCustomModes}
          </TooltipContent>
        </Tooltip>
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
      // Empty slot.
      const isFirstEmpty = i === firstEmptyCustomSlot
      if (!isFirstEmpty || !isAuthenticated) {
        slots.push(<EmptySlot key={`empty-${i}`} />)
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
          <Tooltip key={`add-${i}`}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => startCreatingAt(i)}
                aria-label={t.settings.createPresetLabel}
                className={cn(
                  CARD_SIZE,
                  "border-border hover:bg-accent/20 focus-visible:ring-ring flex items-center justify-center rounded-md border border-dashed p-3 text-center transition-colors",
                  "focus-visible:ring-2 focus-visible:outline-none",
                )}
              >
                <Plus
                  className="text-muted-foreground size-7"
                  strokeWidth={3}
                  aria-hidden
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t.settings.createPresetTooltip}</TooltipContent>
          </Tooltip>,
        )
      }
    }

    // Final cell: back-to-presets toggle (replaces the 6th slot).
    slots.push(
      <ToggleSlotButton
        key="back"
        title={t.settings.backToPresetsLabel}
        subtitle={t.settings.backToPresetsDescription}
        onClick={() => {
          cancelCreating()
          setMode("system")
        }}
      />,
    )

    return slots
  }
}

// ---- Subcomponents ----------------------------------------------------

// Fixed size for every preset cell so the grid doesn't reflow when the
// content per cell changes (system → custom toggle, "+" slot, dotted empty
// slot, naming form). Tall enough for ~20-char title + 2 lines of small
// description text.
const CARD_SIZE = "h-24 min-h-24"

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
        CARD_SIZE,
        "border-highlight bg-highlight/20 ring-highlight/30 flex flex-col justify-between gap-2 rounded-md border p-3 ring-1",
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
        className="h-7 text-sm"
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
        CARD_SIZE,
        "flex flex-col items-center justify-center gap-1 overflow-hidden rounded-md border p-3 text-center transition-colors",
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

function ToggleSlotButton({
  title,
  subtitle,
  onClick,
  disabled = false,
}: {
  title: string
  subtitle: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        CARD_SIZE,
        "border-border bg-card flex flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed p-3 text-center transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        disabled ? "cursor-not-allowed opacity-60" : "hover:bg-accent/20",
      )}
    >
      <span className="text-foreground line-clamp-1 w-full text-center text-sm font-semibold">
        {title}
      </span>
      <span className="text-muted-foreground line-clamp-2 w-full text-center text-xs leading-snug">
        {subtitle}
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
        CARD_SIZE,
        "group relative flex cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md border p-3 text-center transition-colors",
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

function EmptySlot() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        CARD_SIZE,
        "border-border/60 rounded-md border border-dashed",
      )}
    />
  )
}
