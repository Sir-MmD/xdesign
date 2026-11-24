// The phone's `keyboard` slot (PRV-02, docs/plan/04 section 5.3): under the bubble, the inline
// keyboard's editable rows (KeyboardRows.tsx), then the bar: "+ Inline buttons" or "+ Bottom
// keyboard" while the message has neither (one of them, as in Telegram), the keyboard the message
// sets instead ("Remove the bottom keyboard", "Force a reply"), and "More" with what fits the
// message's keyboard: those two, a bottom keyboard's options, its or a forced reply's hint in the
// input field, and "Open the reply field". A row part dragged from the palette drops here
// (PARTS-01's `usePartDrop`). An invoice (PAY-02) has inline buttons, its pay button first, or
// none: then Telegram's own pay button shows, with "+ Inline buttons" under it.
import type { InvoiceStep, StepId } from '@xdesign/spec'
import { type ReactNode, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { useDesign, useEditor } from '../../context'
import type { SendingStep } from '../../map/arrows'
import { usePartDrop } from '../../parts/drop'
import { useSelectionStore } from '../../selection'
import { FormRow, LangInputs, SwitchRow } from './fields'
import { KeyboardRows } from './KeyboardRows'
import { keyboardOf, keyboardWords, NEW_LABEL } from './model'
import { adoptKeyboardSheet } from './sheet'

/**
 * The inline keyboard and the bar under the bubble of a message, a question's prompt or an invoice
 * (`shown`: the preview's drawing, Telegram's own pay button of an invoice without buttons).
 */
export function InlineKeyboardSlot({ stepId, shown }: { stepId: StepId; shown?: ReactNode }) {
  const design = useDesign()
  const drop = usePartDrop(stepId)
  const step = design.steps[stepId]
  if (step?.kind === 'invoice') return <InvoiceKeyboard step={step} shown={shown} />
  if (step?.kind !== 'message' && step?.kind !== 'question') return null
  const keyboard = keyboardOf(step)
  return (
    <div ref={adoptKeyboardSheet} className={drop.over ? 'xd-kb xd-part-over' : 'xd-kb'} {...drop.handlers}>
      {keyboard?.type === 'inline' && keyboard.rows.length > 0 ? (
        <KeyboardRows at={{ step: stepId }} place="inline" rows={keyboard.rows} />
      ) : null}
      <KeyboardBar step={step} />
    </div>
  )
}

/** An invoice's buttons, or Telegram's own pay button and "+ Inline buttons", which starts them with a pay button. */
function InvoiceKeyboard({ step, shown }: { step: InvoiceStep; shown: ReactNode }) {
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const drop = usePartDrop(step.id)
  const { keyboard } = step
  const start = () => {
    edits.keyboard.setType(step.id, 'inline')
    const id = edits.keyboard.addRow({ step: step.id }, undefined, 'Pay')
    if (id === undefined) return
    edits.buttons.setAction(id, { type: 'pay' })
    selection.set({ button: id })
  }
  return (
    <div ref={adoptKeyboardSheet} className={drop.over ? 'xd-kb xd-part-over' : 'xd-kb'} {...drop.handlers}>
      {keyboard?.type === 'inline' && keyboard.rows.length > 0 ? (
        <KeyboardRows at={{ step: step.id }} place="inline" rows={keyboard.rows} />
      ) : (
        <>
          {shown}
          <div className="xd-kb-bar">
            <button type="button" className="xd-kb-chip" onClick={start}>
              + Inline buttons
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function KeyboardBar({ step }: { step: SendingStep }) {
  const { edits } = useEditor()
  const selection = useSelectionStore()
  const [more, setMore] = useState(false)
  const keyboard = keyboardOf(step)
  const type = keyboard?.type ?? null
  const withButtons = (keyboard?.type === 'inline' || keyboard?.type === 'reply') && keyboard.rows.length > 0
  // A keyboard with its first row and button, whose popover opens.
  const start = (kind: 'inline' | 'reply') => {
    edits.keyboard.setType(step.id, kind)
    const id = edits.keyboard.addRow({ step: step.id }, undefined, NEW_LABEL)
    if (id !== undefined) selection.set({ button: id })
  }
  return (
    <div className="xd-kb-bar">
      {withButtons ? null : (
        <>
          <button
            type="button"
            className="xd-kb-chip"
            onClick={() => {
              start('inline')
            }}
          >
            + Inline buttons
          </button>
          <button
            type="button"
            className="xd-kb-chip"
            onClick={() => {
              start('reply')
            }}
          >
            + Bottom keyboard
          </button>
        </>
      )}
      {type === 'removeReply' || type === 'forceReply' ? (
        <button
          type="button"
          className="xd-kb-chip on"
          onClick={() => {
            setMore(true)
          }}
        >
          {keyboardWords(type)}
        </button>
      ) : null}
      <Popover open={more} onOpenChange={setMore}>
        <PopoverTrigger render={<button type="button" className="xd-kb-chip" />}>More</PopoverTrigger>
        <PopoverContent side="left" align="start" sideOffset={12} className="flex w-80 flex-col gap-3">
          <KeyboardMore step={step} />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** "More": what the message's keyboard can change. */
function KeyboardMore({ step }: { step: SendingStep }) {
  const { edits } = useEditor()
  const keyboard = keyboardOf(step)
  const withButtons = (keyboard?.type === 'inline' || keyboard?.type === 'reply') && keyboard.rows.length > 0
  const hint =
    (keyboard?.type === 'reply' && withButtons) || keyboard?.type === 'forceReply' ? (
      <FormRow label={keyboardWords('input_field_placeholder')}>
        <LangInputs
          label={keyboardWords('input_field_placeholder')}
          value={keyboard.placeholder ?? {}}
          onChange={(lang, text) => {
            edits.texts.setPlain({ step: step.id, field: 'placeholder' }, lang, text)
          }}
        />
      </FormRow>
    ) : null
  return (
    <>
      {withButtons ? null : (
        <>
          <SwitchRow
            label={keyboardWords('removeReply')}
            checked={keyboard?.type === 'removeReply'}
            onChange={(on) => {
              edits.keyboard.setType(step.id, on ? 'removeReply' : null)
            }}
          />
          <SwitchRow
            label={keyboardWords('forceReply')}
            checked={keyboard?.type === 'forceReply'}
            onChange={(on) => {
              edits.keyboard.setType(step.id, on ? 'forceReply' : null)
            }}
          />
        </>
      )}
      {keyboard?.type === 'reply' && withButtons ? (
        <>
          <SwitchRow
            label={keyboardWords('one_time_keyboard')}
            checked={keyboard.oneTime}
            onChange={(on) => {
              edits.keyboard.setOptions(step.id, { oneTime: on })
            }}
          />
          <SwitchRow
            label={keyboardWords('is_persistent')}
            checked={keyboard.persistent}
            onChange={(on) => {
              edits.keyboard.setOptions(step.id, { persistent: on })
            }}
          />
          <SwitchRow
            label={keyboardWords('resize_keyboard')}
            checked={keyboard.resize}
            onChange={(on) => {
              edits.keyboard.setOptions(step.id, { resize: on })
            }}
          />
        </>
      ) : null}
      {hint}
      {(keyboard?.type === 'inline' || keyboard?.type === 'reply') && withButtons ? (
        <SwitchRow
          label={keyboardWords('force_reply')}
          checked={keyboard.openReplyField === true}
          onChange={(on) => {
            edits.keyboard.setOptions(step.id, { openReplyField: on || undefined })
          }}
        />
      ) : null}
    </>
  )
}
