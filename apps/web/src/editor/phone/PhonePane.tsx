import { type ChatEntry, TelegramChat } from '@xdesign/preview'
import type { Design, InvoiceStep, MessageStep, QuestionStep } from '@xdesign/spec'
import { ReceiptIcon, SmartphoneIcon } from 'lucide-react'
import { type MouseEvent, useCallback, useMemo, useRef, useState } from 'react'

import { mediaUrl } from '@/api/media'
import { cn } from '@/lib/utils'

import { phoneAnchorAt } from '../comments/anchors'
import { PhonePins } from '../comments/Pins'
import { useCanComment, useCommentStore, useComments } from '../comments/store'
import { useDesign, useEditor, useLang } from '../context'
import { InvoiceForm } from '../forms/InvoiceForm'
import { isLogicStep } from '../forms/logic'
import { LogicForm } from '../forms/LogicForm'
import { QuestionForm } from '../forms/QuestionForm'
import { StartForm } from '../forms/start/StartForm'
import { useLook } from '../look'
import { useSelection } from '../selection'
import { invoiceMessage } from './invoice'
import { useKeyboardSlots } from './keyboard/keyboardSlots'
import { KindRow } from './KindRow'
import { KindSection } from './KindSection'
import { OptionsSection } from './options/OptionsSection'
import { usePhoneSlots } from './slots'
import { TelegramDetails } from './TelegramDetails'
import { TextCounter } from './text/TextCounter'

/**
 * The phone on the right (04 section 4.4): the selected message or question step as the Telegram
 * app shows it (PRV-02's TelegramChat) in the chosen look and language, updated as anyone changes
 * it; TXT-01, MSG-01 and BTN-01 fill its slots (slots.ts). Above it the kind row, under it the
 * text's counter (TXT-01), a poll's, quiz's, dice's or paid media's settings (MSG-03), a question's
 * form (LOGIC-01), "Options" and "Telegram details" (MSG-01). The open comment threads have their
 * pins on the bubble and the buttons; in comment mode (CMT-02) the phone is drawn read-only and a
 * click on the bubble or a button starts a thread there. A start point
 * shows its form (START-01's forms/start/), a logic step its form (LOGIC-01's forms/), an invoice its card
 * with its buttons and its form under it (PAY-02); with no step selected the pane says "Select a step
 * to see it here".
 */
export function PhonePane() {
  const design = useDesign()
  const stepId = useSelection((selection) => selection.step)
  const step = stepId === null ? undefined : design.steps[stepId]
  return (
    <section aria-label="Phone" className="flex h-full min-h-0 flex-col">
      {step?.kind === 'message' || step?.kind === 'question' ? (
        <StepPhone step={step} />
      ) : step?.kind === 'invoice' ? (
        <InvoicePhone step={step} />
      ) : step?.kind === 'start' ? (
        <StartForm step={step} />
      ) : step && isLogicStep(step) ? (
        <LogicForm key={step.id} step={step} />
      ) : (
        <div className="grid flex-1 place-items-center p-6 text-center text-callout text-fg-3">
          <div className="flex flex-col items-center gap-2">
            <SmartphoneIcon aria-hidden className="size-6 opacity-60" />
            <p>Select a step to see it here</p>
          </div>
        </div>
      )}
    </section>
  )
}

function StepPhone({ step }: { step: MessageStep | QuestionStep }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const { readOnly } = useEditor()
  const comments = useCommentStore()
  const canComment = useCanComment()
  const commenting = useComments((state) => state.mode) && canComment
  const slots = usePhoneSlots(step, readOnly || commenting)
  const phone = useRef<HTMLDivElement>(null)
  const message = step.kind === 'message' ? step : step.prompt
  // TelegramChat adapts the chat again when the entries change, so they follow the step's object.
  const entries = useMemo<ChatEntry[]>(() => [{ type: 'bot', message }], [message])
  const mediaUrl = useMediaUrl(design)
  const [box, measure] = usePhoneBox()

  // Comment mode: the bubble or a button (inside the preview's shadow root) gets the thread.
  const comment = (event: MouseEvent) => {
    const target = event.nativeEvent.composedPath()[0]
    const anchor = target instanceof Element ? phoneAnchorAt(target, design, step, lang) : null
    if (!anchor) return
    event.preventDefault()
    event.stopPropagation()
    comments.start(anchor)
  }

  return (
    <>
      <KindRow step={step} />
      <div ref={measure} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex justify-center overflow-hidden p-4">
          <div
            ref={phone}
            className={cn('relative', commenting && 'cursor-crosshair')}
            onClickCapture={commenting ? comment : undefined}
          >
            {box ? (
              <TelegramChat
                entries={entries}
                design={design}
                lang={lang}
                skin={look.skin}
                theme={look.theme}
                maxWidth={box.width}
                height={Math.max(box.height, minPhoneHeight)}
                slots={slots}
                mediaUrl={mediaUrl}
              />
            ) : null}
            <PhonePins box={phone} design={design} step={step} />
          </div>
        </div>
        <TextCounter step={step} />
        <KindSection step={step} />
        {step.kind === 'question' ? <QuestionForm key={step.id} step={step} /> : null}
        <OptionsSection step={step} />
        <TelegramDetails step={step} />
      </div>
    </>
  )
}

// The phone's room in the pane, in pixels: its padding (p-4), the strip under it (TXT-01's counter
// and the options' heading), its least height.
const phonePadding = 16
const optionsPeek = 64
const minPhoneHeight = 360

/**
 * The phone's room: its width up to the look's own, its height but a strip where the counter and
 * the "Options" heading show; what is under the phone follows when the pane scrolls.
 */
function usePhoneBox() {
  const [box, setBox] = useState<{ width: number; height: number }>()
  const measure = useCallback((element: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setBox({
        width: Math.floor(width) - 2 * phonePadding,
        height: Math.floor(height) - 2 * phonePadding - optionsPeek,
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])
  return [box, measure] as const
}

/**
 * An invoice (PAY-02): its card as the user sees it (or a subscription's message with its link)
 * with its buttons edited in place (BTN-01's keyboard slot; Telegram's own pay button while it has
 * none), and its form under the phone.
 */
function InvoicePhone({ step }: { step: InvoiceStep }) {
  const design = useDesign()
  const lang = useLang()
  const [look] = useLook()
  const { readOnly } = useEditor()
  const canComment = useCanComment()
  const commenting = useComments((state) => state.mode) && canComment
  const { keyboard } = useKeyboardSlots(step)
  const entries = useMemo<ChatEntry[]>(() => [{ type: 'bot', message: invoiceMessage(step) }], [step])
  const mediaUrl = useMediaUrl(design)
  const [box, measure] = usePhoneBox()
  return (
    <>
      <div className="flex min-h-12 items-center gap-2 border-b px-4 py-2">
        <ReceiptIcon aria-hidden className="size-4 shrink-0 text-fg-3" />
        <h2 className="text-callout font-semibold">Invoice</h2>
      </div>
      <div ref={measure} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex justify-center overflow-hidden p-4">
          {box ? (
            <TelegramChat
              entries={entries}
              design={design}
              lang={lang}
              skin={look.skin}
              theme={look.theme}
              maxWidth={box.width}
              height={Math.max(box.height, minPhoneHeight)}
              slots={readOnly || commenting ? undefined : { keyboard }}
              mediaUrl={mediaUrl}
            />
          ) : null}
        </div>
        <InvoiceForm key={step.id} step={step} />
      </div>
    </>
  )
}

/** The picture of an uploaded image (a photo or a sticker) for the phone; other files show as placeholders. */
function useMediaUrl(design: Design): (id: string) => string | undefined {
  const { media } = design
  return useCallback(
    (id: string) => {
      const item = media[id]
      if (!item?.mime.startsWith('image/')) return undefined
      return mediaUrl(item.serverId)
    },
    [media],
  )
}
