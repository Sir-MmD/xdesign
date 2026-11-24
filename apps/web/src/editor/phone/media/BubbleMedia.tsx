import { type Content, type MediaKind, newId, type StepId, telegram } from '@xdesign/spec'
import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverDescription, PopoverTitle } from '@/components/ui/popover'

import { useDesign } from '../../context'
import { type PhoneStep, shownOf, useUpdateContent } from '../message'
import { AlbumEditor } from './AlbumEditor'
import { AlbumFiles, ContactCard, FileCard, PlaceCard } from './BubbleCards'
import { ContactForm } from './ContactForm'
import { fileLine } from './files'
import { MediaSource } from './MediaSource'
import { PlaceForm } from './PlaceForm'

/**
 * The media slot of the phone (04 section 5.4, PRV-02's `media` slot): the bubble's photo, video
 * or album as the preview draws it (`shown`), and what the preview has no picture for (a file,
 * a sound, a round video, a sticker, a place, a contact) drawn here. While the design can be
 * edited, a click on it (or Enter) opens its editor beside the phone.
 */
export function BubbleMedia({ step, shown, readOnly }: { step: PhoneStep; shown: ReactNode; readOnly: boolean }) {
  const design = useDesign()
  const { content } = shownOf(step)
  if (content.type === 'text') return shown
  const label = telegram.messageKind(content.type).label
  let drawing: ReactNode
  let editor: ReactNode
  switch (content.type) {
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation':
      drawing = shown
      editor = <FileEditor stepId={step.id} content={content} />
      break
    case 'audio':
    case 'voice':
    case 'document':
    case 'videoNote':
    case 'sticker':
      drawing = <FileCard content={content} design={design} label={label} />
      editor = <FileEditor stepId={step.id} content={content} />
      break
    case 'album':
      drawing = drawn(shown) ? shown : <AlbumFiles content={content} design={design} />
      editor = <AlbumEditor stepId={step.id} content={content} />
      break
    // MSG-03: paid media's pictures blurred under the price button (the preview's); polls,
    // quizzes and dice have no media.
    case 'paidMedia':
      drawing = shown
      editor = <AlbumEditor stepId={step.id} content={content} />
      break
    case 'location':
    case 'venue':
      drawing = <PlaceCard content={content} />
      editor = <PlaceForm stepId={step.id} content={content} />
      break
    case 'contact':
      drawing = <ContactCard content={content} />
      editor = <ContactForm stepId={step.id} content={content} />
      break
  }
  if (readOnly || !drawn(drawing)) return drawing
  return (
    <EditablePart label={label} drawing={drawing}>
      {editor}
    </EditablePart>
  )
}

function drawn(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false
}

/**
 * The drawing made clickable in place, its editor in a popover beside the phone. The drawing is
 * not wrapped: the look's rules read the media as the bubble's child and the caption as its next
 * sibling (`.tg-media + .tg-body`), so a hidden marker before it finds the element to listen on.
 */
function EditablePart({ label, drawing, children }: { label: string; drawing: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const marker = useRef<HTMLSpanElement>(null)
  const name = `Edit the ${label.toLowerCase()}`
  // After every render: the preview may have drawn a new element.
  useEffect(() => {
    const element = marker.current?.nextElementSibling
    if (!(element instanceof HTMLElement)) return
    // The click that opens the popover is not also an outside press that closes it.
    const show = (event: MouseEvent) => {
      event.stopPropagation()
      setOpen(true)
    }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      setOpen(true)
    }
    element.addEventListener('click', show)
    element.addEventListener('keydown', key)
    element.setAttribute('role', 'button')
    element.setAttribute('tabindex', '0')
    element.setAttribute('aria-label', name)
    element.title = name
    element.style.cursor = 'pointer'
    return () => {
      element.removeEventListener('click', show)
      element.removeEventListener('keydown', key)
      for (const attribute of ['role', 'tabindex', 'aria-label', 'title']) element.removeAttribute(attribute)
      element.style.cursor = ''
    }
  })
  return (
    <>
      {/* First: an open popover's focus guards draw where it sits, and must not come between the
      media and the caption. */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverContent
          side="left"
          align="start"
          anchor={() => marker.current?.nextElementSibling ?? null}
          className="grid w-80 gap-3"
        >
          <PopoverTitle>{label}</PopoverTitle>
          {children}
        </PopoverContent>
      </Popover>
      <span ref={marker} hidden />
      {drawing}
    </>
  )
}

type FileContent = Extract<Content, { media: unknown }>

// One file: where it comes from, and the file it is now.
function FileEditor({ stepId, content }: { stepId: StepId; content: FileContent }) {
  const design = useDesign()
  const update = useUpdateContent(stepId)
  const item = 'media' in content.media ? design.media[content.media.media] : undefined
  const kind: MediaKind = content.type
  return (
    <>
      {item ? <PopoverDescription className="truncate">{fileLine(item)}</PopoverDescription> : null}
      <MediaSource
        kinds={[kind]}
        slot={content.media}
        onPick={(media) => {
          update((now) => (now.type === kind && 'media' in now ? { ...now, media } : undefined))
        }}
      />
      {telegram.messageKind(kind).caption && !('caption' in content && content.caption) ? (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            update((now) =>
              now.type === kind && 'media' in now && now.type !== 'videoNote' && now.type !== 'sticker'
                ? { ...now, caption: { id: newId(), doc: {} } }
                : undefined,
            )
          }}
        >
          Add a caption
        </Button>
      ) : null}
    </>
  )
}
