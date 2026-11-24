import { type ContentType, telegram } from '@xdesign/spec'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { useDesign, useEditor } from '../context'
import { changeKind, kindItems, promptKindItems, removesText } from './kinds'
import { type PhoneStep, setShown, shownOf } from './message'

/**
 * The kind row above the phone (04 section 5.1): the content kind of the message the step sends
 * (a question's prompt: stage 1's kinds only). A new kind keeps the text as its caption or
 * question; a kind without captions asks first when there is a text to remove.
 */
export function KindRow({ step }: { step: PhoneStep }) {
  const design = useDesign()
  const { edits } = useEditor()
  const { content, options } = shownOf(step)
  const [asking, setAsking] = useState<ContentType | null>(null)
  const items = step.kind === 'message' ? kindItems : promptKindItems(content.type)
  const change = (kind: ContentType) => {
    const next = changeKind(content, kind, design)
    if (options.draft !== true || telegram.draftMethod(kind)) {
      setShown(edits, step, { content: next })
      return
    }
    // "Write it out like a draft" goes with a kind that has no draft method (RICH-01), with its
    // stop button and "If the user stops it" (RICH-02).
    const without = { ...options, draft: undefined, draftStop: undefined, draftKeep: undefined }
    if (step.kind === 'message') edits.steps.set(step.id, { content: next, options: without, onStop: undefined })
    else setShown(edits, step, { content: next, options: without })
  }

  return (
    <div className="flex items-center gap-2 border-b px-4 py-2">
      <Select<ContentType>
        items={items}
        value={content.type}
        onValueChange={(kind) => {
          if (kind === null || kind === content.type) return
          if (removesText(content, kind)) setAsking(kind)
          else change(kind)
        }}
      >
        <SelectTrigger size="sm" aria-label="Kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null)
        }}
        title="The text will be removed. Change anyway?"
        confirmLabel="Change"
        onConfirm={() => {
          if (asking !== null) change(asking)
        }}
      />
    </div>
  )
}
