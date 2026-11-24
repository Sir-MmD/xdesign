import type { Step } from '@xdesign/spec'
import {
  ClipboardCopyIcon,
  CopyIcon,
  EllipsisIcon,
  MessageSquarePlusIcon,
  NotebookPenIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { useState } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'

import { useDesign, useEditor, useLang } from '../context'
import { stepAnchor } from '../comments/anchors'
import { useCommentStore } from '../comments/store'
import { MakePartItem } from '../parts/MakePartItem'
import { useSelectionStore } from '../selection'
import { useMapActions } from './actions'
import { type Arrow, deriveArrows } from './arrows'
import { isSlashStart } from './kinds'

/**
 * The box menu (04 section 4.3), the "..." on a box for people who can edit: "Edit" (selects the
 * step, so its editor opens), "Duplicate", "Copy", "Make a part from its buttons" (PARTS-01, on
 * messages and questions), "Add a note" (the designer's note for the developer, in the export)
 * and "Delete", which says which arrows into the box it clears. On a box that is one of several
 * selected, "Duplicate", "Copy" and "Delete" act on all of them and "Delete" sums them up.
 * `/start` can be neither copied nor deleted.
 *
 * The menu and the note's dialog are made the first time they open, then opened a frame later so
 * they come in as usual: until then a box draws only a plain button (PERF-01, a map of many boxes).
 */
export function BoxMenu({ step }: { step: Step }) {
  const [open, setOpen] = useState(false)
  const [noting, setNoting] = useState(false)
  const [made, setMade] = useState({ menu: false, note: false })
  if (!made.menu) {
    return (
      <button
        type="button"
        data-slot="button"
        aria-label="Box menu"
        className={buttonVariants({ variant: 'ghost', size: 'icon-xs', className: triggerClass })}
        onClick={() => {
          setMade((now) => ({ ...now, menu: true }))
          requestAnimationFrame(() => {
            setOpen(true)
          })
        }}
      >
        <EllipsisIcon aria-hidden />
      </button>
    )
  }
  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label="Box menu" className={triggerClass} />}
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <BoxMenuItems
            step={step}
            onNote={() => {
              setMade((now) => ({ ...now, note: true }))
              requestAnimationFrame(() => {
                setNoting(true)
              })
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {made.note ? (
        <Dialog open={noting} onOpenChange={setNoting}>
          <DialogContent className="sm:max-w-md">
            {noting ? (
              <NoteForm
                step={step}
                onDone={() => {
                  setNoting(false)
                }}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}

const triggerClass =
  'nodrag shrink-0 opacity-0 group-hover/box:opacity-100 focus-visible:opacity-100 in-[.selected]:opacity-100 data-popup-open:opacity-100'

// The items, made only while the menu is open (the selection and the arrows are read then).
function BoxMenuItems({ step, onNote }: { step: Step; onNote: () => void }) {
  const design = useDesign()
  const lang = useLang()
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const actions = useMapActions()
  const comments = useCommentStore()
  const slashStart = isSlashStart(step)
  const targets = actions.targets(step.id).filter((id) => {
    const target = design.steps[id]
    return target !== undefined && !isSlashStart(target)
  })
  const removing = new Set(targets)
  const into = deriveArrows(design, lang).filter((arrow) => removing.has(arrow.to) && !removing.has(arrow.from.id))
  return (
    <>
      <DropdownMenuItem
        onClick={() => {
          selection.set({ step: step.id })
        }}
      >
        <PencilIcon aria-hidden />
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={slashStart}
        onClick={() => {
          actions.duplicate(targets)
        }}
      >
        <CopyIcon aria-hidden />
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={slashStart}
        onClick={() => {
          actions.copy(targets)
        }}
      >
        <ClipboardCopyIcon aria-hidden />
        Copy
      </DropdownMenuItem>
      <MakePartItem step={step} />
      {step.kind === 'note' ? null : (
        <DropdownMenuItem onClick={onNote}>
          <NotebookPenIcon aria-hidden />
          {step.note?.trim() ? 'Edit the note' : 'Add a note'}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        onClick={() => {
          const anchor = stepAnchor(design, step.id, null, lang)
          if (anchor) comments.start(anchor)
        }}
      >
        <MessageSquarePlusIcon aria-hidden />
        Comment
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={slashStart}
        className="items-start"
        onClick={() => {
          edits.steps.remove(targets)
        }}
      >
        <Trash2Icon aria-hidden className="mt-0.5" />
        <span className="flex min-w-0 flex-col">
          Delete
          <span className="text-footnote text-fg-3">
            {slashStart ? '/start cannot be deleted' : deleteWords(targets.length, into)}
          </span>
        </span>
      </DropdownMenuItem>
    </>
  )
}

// What a deletion does, in words: "Clears the arrows from Main menu (Help) and /start (Then).",
// for several boxes "Deletes 3 steps. No arrows go into them."
function deleteWords(count: number, into: readonly Arrow[]): string {
  if (count < 2) return clearsWords(into, 'it')
  return `Deletes ${String(count)} steps. ${clearsWords(into, 'them')}`
}

// The arrows a deletion clears: "Clears the arrows from Main menu (Help) and /start (Then)."
function clearsWords(arrows: readonly Arrow[], them: string): string {
  if (arrows.length === 0) return `No arrows go into ${them}.`
  const names = arrows.map((arrow) => `${arrow.from.title.trim() || arrow.from.idName} (${arrow.label || 'a button'})`)
  const shown = names.length > 4 ? [...names.slice(0, 3), `${String(names.length - 3)} more`] : names
  const list = shown.length < 2 ? shown.join('') : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1) ?? ''}`
  return `Clears the ${arrows.length === 1 ? 'arrow' : 'arrows'} from ${list}.`
}

// "Add a note": the designer's note for the developer on this step (design.md shows it with the step).
function NoteForm({ step, onDone }: { step: Step; onDone: () => void }) {
  const { edits } = useEditor()
  const [text, setText] = useState(step.note ?? '')
  return (
    <form
      className="grid gap-4"
      // The dialog sits in the box's React tree: its clicks must not select the box.
      onClick={(event) => {
        event.stopPropagation()
      }}
      onSubmit={(event) => {
        event.preventDefault()
        edits.steps.set(step.id, { note: text.trim() === '' ? undefined : text.trim() })
        onDone()
      }}
    >
      <DialogHeader>
        <DialogTitle>Note for the developer</DialogTitle>
        <DialogDescription>It goes with {step.title.trim() || step.idName} in the export.</DialogDescription>
      </DialogHeader>
      <Textarea
        aria-label="Note"
        rows={5}
        value={text}
        autoFocus
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
