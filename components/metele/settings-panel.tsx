"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react"
import { Bell, Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n"
import { formatSeconds } from "@/lib/metele/format"
import { useAuth, MAX_CUSTOM_PRESETS, type CustomPreset } from "@/lib/auth"
import {
  createCustomPreset,
  deleteCustomPreset,
  updateCustomPreset,
} from "@/lib/metele/presets-api"
import {
  PRESETS,
  extractPresetSettings,
  findMatchingCustomPreset,
  findMatchingPreset,
  type GameSettings,
  type PresetId,
  type PresetSettings,
} from "@/lib/metele/types"

type Props = {
  settings: GameSettings
  onChange: (settings: GameSettings) => void
}

type Mode = "system" | "custom"

export function SettingsPanel({ settings, onChange }: Props) {
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
  const draftInputRef = useRef<HTMLInputElement | null>(null)

  // Inline rename state for an existing custom preset (the pencil icon on
  // each custom card). Only one preset can be in edit mode at a time.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [editBusyId, setEditBusyId] = useState<string | null>(null)
  const [presetMutationError, setPresetMutationError] = useState<string | null>(
    null,
  )

  // Auto-focus the inline name field when it appears.
  useEffect(() => {
    if (namingSlotIndex !== null) {
      draftInputRef.current?.focus()
    }
  }, [namingSlotIndex])

  const activeSystemPresetId = useMemo<PresetId | null>(
    () => findMatchingPreset(settings),
    [settings],
  )
  const activeCustomPresetId = useMemo<string | null>(
    () => findMatchingCustomPreset(settings, customPresets),
    [settings, customPresets],
  )

  function update<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  function applyPresetSettings(preset: PresetSettings) {
    // Merge: only overwrite preset-covered keys, preserving personal settings.
    onChange({ ...settings, ...preset })
  }

  function applySystemPreset(id: PresetId) {
    const preset = PRESETS.find((p) => p.id === id)
    if (preset) applyPresetSettings(preset.settings)
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

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void submitCreate()
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelCreating()
    }
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

  function handleEditKey(e: KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault()
      void submitEditing(id)
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelEditing()
    }
  }

  async function handleDelete(id: string) {
    if (typeof window !== "undefined") {
      if (!window.confirm(t.profile.customPresetDeleteConfirm)) return
    }
    setEditBusyId(id)
    setPresetMutationError(null)
    const token = await getAccessToken()
    if (token === null) {
      setEditBusyId(null)
      setPresetMutationError(t.profile.customPresetDeleteFailed)
      return
    }
    const result = await deleteCustomPreset(token, id)
    setEditBusyId(null)
    if (!result.ok) {
      setPresetMutationError(t.profile.customPresetDeleteFailed)
      return
    }
    applyLocalUser(result.user)
    if (editingId === id) cancelEditing()
  }

  const fmtSeconds = (v: number) => formatSeconds(v, t.units)
  const fmtMinutes = (v: number) => `${v}${t.units.minutes}`

  const requiredWordsOn = settings.requiredWordIntervalEnabled

  // Index of the FIRST empty custom-preset slot, when in custom mode.
  // That slot renders the "+" create-preset action; later empty slots
  // render disabled placeholders so the user always edits the next free
  // slot rather than randomly anywhere in the grid.
  const firstEmptyCustomSlot =
    customPresets.length < MAX_CUSTOM_PRESETS ? customPresets.length : null

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-labelledby="settings-title"
        className="bg-card text-card-foreground flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto rounded-lg border p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="settings-title" className="text-2xl font-semibold">
            {t.settings.title}
          </h2>
          <p className="text-muted-foreground text-sm">{t.settings.description}</p>
        </div>

        {/* Presets ---------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            {mode === "system"
              ? t.settings.presetsLabel
              : t.settings.customModesLabel}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {mode === "system"
              ? renderSystemPresets()
              : renderCustomPresets()}
          </div>
          {createError ? (
            <p
              role="alert"
              className="text-destructive text-xs"
            >
              {createError}
            </p>
          ) : null}
          {presetMutationError ? (
            <p role="alert" className="text-destructive text-xs">
              {presetMutationError}
            </p>
          ) : null}
        </section>

        <Separator />

        {/* Detailed settings shown on every breakpoint. Help-text under each
            row collapses on `<sm` so the rows stay one-line on small phones;
            otherwise the full description is shown. */}
        <div className="flex flex-col">
          <SettingRow
            id="main-timer"
            label={t.settings.mainTimerLabel}
            description={t.settings.mainTimerHelp}
            control={
              <ValueSlider
                id="main-timer"
                value={settings.mainTimerSeconds}
                min={1}
                max={60}
                onChange={(v) => update("mainTimerSeconds", v)}
                format={fmtSeconds}
              />
            }
          />

          <SettingRow
            id="global-timer"
            label={t.settings.globalTimerLabel}
            description={t.settings.globalTimerHelp}
            toggleId="global-timer-toggle"
            toggle={
              <Switch
                id="global-timer-toggle"
                checked={settings.globalTimerEnabled}
                onCheckedChange={(v) => update("globalTimerEnabled", v)}
                aria-label={t.settings.globalTimerEnable}
              />
            }
            control={
              <ValueSlider
                id="global-timer"
                value={Math.round(settings.globalTimerSeconds / 60)}
                min={1}
                max={30}
                disabled={!settings.globalTimerEnabled}
                onChange={(v) => update("globalTimerSeconds", v * 60)}
                format={fmtMinutes}
              />
            }
          />

          <SettingRow
            id="word-interval"
            label={t.settings.requiredWordIntervalLabel}
            description={t.settings.requiredWordIntervalHelp}
            toggleId="word-interval-toggle"
            toggle={
              <Switch
                id="word-interval-toggle"
                checked={requiredWordsOn}
                onCheckedChange={(v) => update("requiredWordIntervalEnabled", v)}
                aria-label={t.settings.requiredWordIntervalEnable}
              />
            }
            control={
              <ValueSlider
                id="word-interval"
                value={settings.requiredWordIntervalSeconds}
                min={5}
                max={120}
                disabled={!requiredWordsOn}
                onChange={(v) => update("requiredWordIntervalSeconds", v)}
                format={fmtSeconds}
              />
            }
          />

          {/* Required-word sub-settings: hidden entirely when the master toggle
              is off, so the panel collapses instead of showing dimmed rows. */}
          {requiredWordsOn ? (
            <>
              <SettingRow
                id="use-timer"
                label={t.settings.requiredWordUseTimerLabel}
                description={t.settings.requiredWordUseTimerHelp}
                toggleId="use-toggle"
                toggle={
                  <Switch
                    id="use-toggle"
                    checked={settings.requiredWordUseTimerEnabled}
                    onCheckedChange={(v) => update("requiredWordUseTimerEnabled", v)}
                    aria-label={t.settings.requiredWordUseTimerEnable}
                  />
                }
                control={
                  <ValueSlider
                    id="use-timer"
                    value={settings.requiredWordUseTimerSeconds}
                    min={5}
                    max={120}
                    disabled={!settings.requiredWordUseTimerEnabled}
                    onChange={(v) => update("requiredWordUseTimerSeconds", v)}
                    format={fmtSeconds}
                  />
                }
              />

              <SettingRow
                id="category-words"
                label={
                  <span className="flex items-center gap-2">
                    <Tags className="size-4" aria-hidden />
                    {t.settings.categoryWordsLabel}
                  </span>
                }
                description={t.settings.categoryWordsHelp}
                toggleId="category-words-toggle"
                toggle={
                  <Switch
                    id="category-words-toggle"
                    checked={settings.categoryWordsEnabled}
                    onCheckedChange={(v) => update("categoryWordsEnabled", v)}
                    aria-label={t.settings.categoryWordsEnable}
                  />
                }
                control={
                  <Input
                    id="category-words"
                    type="text"
                    value={settings.categoryWordsInput}
                    onChange={(e) => update("categoryWordsInput", e.target.value)}
                    placeholder={t.settings.categoryWordsPlaceholder}
                    disabled={!settings.categoryWordsEnabled}
                    aria-label={t.settings.categoryWordsLabel}
                    className="text-sm"
                  />
                }
              />

              <SettingRow
                id="bell-toggle"
                label={
                  <span className="flex items-center gap-2">
                    <Bell className="size-4" aria-hidden />
                    {t.settings.bellLabel}
                  </span>
                }
                toggleId="bell-toggle"
                toggle={
                  <Switch
                    id="bell-toggle"
                    checked={settings.bellEnabled}
                    onCheckedChange={(v) => update("bellEnabled", v)}
                    aria-label={t.settings.bellLabel}
                  />
                }
              />
            </>
          ) : null}
        </div>
      </section>
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
        const isActive = activeCustomPresetId === preset.id
        const isEditing = editingId === preset.id
        slots.push(
          <CustomPresetCard
            key={preset.id}
            preset={preset}
            active={isActive}
            editing={isEditing}
            busy={editBusyId === preset.id}
            draft={isEditing ? editingName : ""}
            onApply={() => applyPresetSettings(preset.settings)}
            onStartEdit={() => startEditing(preset)}
            onChangeDraft={setEditingName}
            onSubmitEdit={() => void submitEditing(preset.id)}
            onCancelEdit={cancelEditing}
            onKeyDown={(e) => handleEditKey(e, preset.id)}
            onDelete={() => void handleDelete(preset.id)}
            t={{
              edit: t.profile.customPresetEdit,
              del: t.profile.customPresetDelete,
              save: t.profile.customPresetSave,
              cancel: t.profile.customPresetCancel,
              namePlaceholder: t.settings.customNamePlaceholder,
            }}
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

      // First empty slot: either the "+ create" action OR the inline rename
      // form when the user clicked it.
      if (namingSlotIndex === i) {
        slots.push(
          <div
            key={`naming-${i}`}
            className={cn(
              CARD_SIZE,
              "border-primary bg-primary/5 ring-primary/30 flex flex-col justify-between gap-2 rounded-md border p-3 ring-1",
            )}
          >
            <Input
              ref={draftInputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={handleNameKey}
              placeholder={t.settings.customNamePlaceholder}
              maxLength={40}
              aria-label={t.settings.customNamePlaceholder}
              className="h-7 text-sm"
              disabled={creating}
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={cancelCreating}
                aria-label={t.settings.customNameCancel}
                className="hover:bg-accent text-muted-foreground inline-flex size-6 items-center justify-center rounded-md"
                disabled={creating}
              >
                <X className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                aria-label={t.settings.customNameSave}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-6 items-center justify-center rounded-md disabled:opacity-50"
                disabled={creating || draftName.trim().length === 0}
              >
                <Check className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>,
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
                  "border-border hover:bg-accent/30 focus-visible:ring-ring flex items-center justify-center rounded-md border border-dashed p-3 text-center transition-colors",
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
        "hover:bg-accent/30 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-primary bg-primary/5 ring-primary/30 ring-1"
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
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:bg-accent/30",
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
  onKeyDown,
  onDelete,
  t,
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
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onDelete: () => void
  t: {
    edit: string
    del: string
    save: string
    cancel: string
    namePlaceholder: string
  }
}) {
  // Outer is a div (not a button) so the inner pencil/trash can be real
  // buttons — nesting <button> inside <button> is invalid HTML. Outer
  // surfaces role/tabindex so the apply-on-click behavior stays keyboard
  // and screen-reader accessible.
  if (editing) {
    return (
      <div
        className={cn(
          CARD_SIZE,
          "border-primary bg-primary/5 ring-primary/30 group relative flex flex-col justify-between gap-2 rounded-md border p-3 ring-1",
        )}
      >
        <Input
          autoFocus
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={40}
          placeholder={t.namePlaceholder}
          aria-label={t.edit}
          className="h-7 text-sm"
          disabled={busy}
        />
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onCancelEdit}
            aria-label={t.cancel}
            className="hover:bg-accent text-muted-foreground inline-flex size-6 items-center justify-center rounded-md"
            disabled={busy}
          >
            <X className="size-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onSubmitEdit}
            aria-label={t.save}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex size-6 items-center justify-center rounded-md disabled:opacity-50"
            disabled={busy || draft.trim().length === 0}
          >
            <Check className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  function handleKey(e: ReactKeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onApply()
    }
  }

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
        "hover:bg-accent/30 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-primary bg-primary/5 ring-primary/30 ring-1"
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
          aria-label={t.edit}
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
          aria-label={t.del}
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

function SettingRow({
  id,
  label,
  description,
  toggle,
  toggleId,
  control,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  toggle?: ReactNode
  toggleId?: string
  control?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      {/* Top row for toggle+name on small screens, left half on wide screens */}
      <div className="flex w-full items-center gap-3 sm:w-1/2">
        <label
          htmlFor={toggleId}
          className={cn(
            "flex size-11 shrink-0 cursor-pointer items-center justify-center",
            !toggle && "cursor-default",
          )}
        >
          {toggle}
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Label htmlFor={id} className="text-foreground text-sm font-semibold">
            {label}
          </Label>
          {description ? (
            <span className="text-muted-foreground hidden text-xs leading-snug sm:inline">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      {/* Bottom row for input/slider on small screens, right half on wide screens */}
      {control ? (
        <div className="w-full pl-14 sm:w-1/2 sm:pl-0">
          {control}
        </div>
      ) : null}
    </div>
  )
}

function ValueSlider({
  id,
  value,
  min,
  max,
  disabled = false,
  onChange,
  format,
}: {
  id: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (v: number) => void
  format: (v: number) => string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 transition-opacity",
        disabled && "opacity-50",
      )}
    >
      <span className="text-muted-foreground w-16 shrink-0 text-left font-mono text-sm tabular-nums">
        {format(value)}
      </span>
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? min)}
        aria-label={id}
        className="flex-1 py-2"
      />
    </div>
  )
}

