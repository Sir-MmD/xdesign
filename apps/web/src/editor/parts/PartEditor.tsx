// The part editor (docs/plan/04 section 12): a sheet on the right with the part's name and ID
// name, the small phone with just the rows or the text (PartPhone.tsx), "Uses" (each one jumps to
// its step, or opens the text part that places it; a step's use has "Detach") and "Delete part",
// which asks first while the part is used and detaches every use. Everything goes through
// SPEC-04's part accessors, so every use follows at once. Opened through store.ts.
import { PuzzleIcon, Trash2Icon, UnlinkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

import { useDesign, useEditor } from '../context'
import { useSelectionStore } from '../selection'
import { IdNameField, LiveField } from '../variables/fields'
import { PartPhone } from './PartPhone'
import { usePartEditor } from './store'
import type { PartUse } from './uses'

// TXT-01's toolbar is drawn in the page, outside the sheet: a press or the focus there keeps it open.
function inTextToolbar(event: Event | undefined): boolean {
  const target = event instanceof FocusEvent ? event.relatedTarget : event?.target
  return target instanceof Element && target.closest('[role="toolbar"][aria-label="Text formatting"]') !== null
}

/**
 * The open part's editor. The sheet is not modal: the text's toolbar and the button popover draw
 * in the page beside it, and a click on the map closes it.
 */
export function PartEditor({ uses }: { uses: ReadonlyMap<string, PartUse[]> }) {
  const design = useDesign()
  const selection = useSelectionStore()
  const [openId, open] = usePartEditor()
  const part = openId === null ? undefined : design.parts[openId]
  // The part stays drawn while the sheet slides away.
  const [shownId, setShownId] = useState<string | null>(null)
  if (part && part.id !== shownId) setShownId(part.id)
  // Deleted by someone else: the editor closes (and stays closed if it comes back).
  useEffect(() => {
    if (openId !== null && openId === shownId && part === undefined) open(null)
  }, [openId, shownId, part, open])
  const close = () => {
    open(null)
    // A button of the part selected in the sheet's phone is no longer shown.
    const button = selection.get().button
    const shown = shownId === null ? undefined : design.parts[shownId]
    if (button !== null && shown?.kind === 'rows' && shown.rows.some((row) => row.includes(button))) {
      selection.set({ button: null })
    }
  }
  return (
    <Sheet
      modal={false}
      open={part !== undefined}
      onOpenChange={(next, details) => {
        if (!next && !inTextToolbar(details.event)) close()
      }}
    >
      <SheetContent className="flex flex-col gap-0 data-[side=right]:sm:max-w-md">
        {shownId === null ? null : <PartForm key={shownId} id={shownId} uses={uses.get(shownId) ?? []} close={close} />}
      </SheetContent>
    </Sheet>
  )
}

function PartForm({ id, uses, close }: { id: string; uses: readonly PartUse[]; close: () => void }) {
  const design = useDesign()
  const { edits } = useEditor()
  const [deleting, setDeleting] = useState(false)
  const part = design.parts[id]
  // A deleted part draws nothing more (its text would be made again by the phone's editor).
  if (!part) return null
  const remove = () => {
    edits.parts.remove(id)
    close()
  }
  const about =
    part.kind === 'text'
      ? 'A text. Editing it changes every use at once.'
      : part.place === 'inline'
        ? 'Buttons under a message. Editing them changes every use at once.'
        : 'Buttons of a bottom keyboard. Editing them changes every use at once.'
  return (
    <>
      <SheetHeader>
        <SheetTitle dir="auto" className="truncate">
          {part.name.trim() || 'Part'}
        </SheetTitle>
        <SheetDescription>{about}</SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <LiveField
            label="Name"
            dir="auto"
            value={part.name}
            onValue={(name) => {
              edits.parts.rename(id, name)
            }}
          />
          <IdNameField value={part.idName} onSet={(name) => edits.parts.setIdName(id, name)} />
        </div>
        <div className="flex justify-center overflow-hidden rounded-xl">
          <PartPhone part={part} />
        </div>
        <Uses partId={id} uses={uses} close={close} />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="self-start"
          onClick={() => {
            if (uses.length > 0) setDeleting(true)
            else remove()
          }}
        >
          <Trash2Icon aria-hidden />
          Delete part
        </Button>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${part.name.trim() || part.idName}?`}
        description={
          uses.length === 1 ? 'Its 1 use gets its own copy.' : `Its ${String(uses.length)} uses get their own copy.`
        }
        confirmLabel="Delete part"
        onConfirm={remove}
      />
    </>
  )
}

/** "Uses": each step (a jump to it on the map, and "Detach") or text part (opens it) that uses the part. */
function Uses({ partId, uses, close }: { partId: string; uses: readonly PartUse[]; close: () => void }) {
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const [, open] = usePartEditor()
  return (
    <section aria-label="Uses" className="flex flex-col gap-1.5">
      <h3 className="text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase">Uses</h3>
      {uses.length === 0 ? (
        <p className="text-footnote text-fg-3">Nowhere yet</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {uses.map((use) =>
            use.kind === 'step' ? (
              <li key={`step:${use.step.id}`} className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  dir="auto"
                  className="min-w-0 flex-1 justify-start"
                  onClick={() => {
                    close()
                    selection.reveal(use.step.id)
                  }}
                >
                  <span className="truncate">{use.step.title.trim() || use.step.idName}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    edits.parts.detach(use.step.id, partId)
                  }}
                >
                  <UnlinkIcon aria-hidden />
                  Detach
                </Button>
              </li>
            ) : (
              <li key={`part:${use.part.id}`} className="flex items-center">
                <Button
                  variant="outline"
                  size="xs"
                  dir="auto"
                  className="min-w-0 flex-1 justify-start"
                  onClick={() => {
                    open(use.part.id)
                  }}
                >
                  <PuzzleIcon aria-hidden />
                  <span className="truncate">{use.part.name.trim() || use.part.idName}</span>
                </Button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  )
}
