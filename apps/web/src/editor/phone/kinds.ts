// The content kinds of the phone's kind row (docs/plan/04 section 5.1) with the catalog's labels,
// and what changing the kind keeps: the text as the caption (or a poll's question) where the new
// kind has one, the file where it fits the new kind (else a placeholder described by its name), a
// place's coordinates, a poll's options and settings between poll and quiz.
import {
  type Content,
  type ContentType,
  type Design,
  type MediaKind,
  type MediaSlot,
  newId,
  plainText,
  type RichTextRef,
  telegram,
} from '@xdesign/spec'

// Stage 1, in the row's order, then stage 2's (no checklist, D-36).
const stage1: readonly ContentType[] = [
  'text',
  'photo',
  'livePhoto',
  'video',
  'animation',
  'audio',
  'voice',
  'videoNote',
  'document',
  'sticker',
  'album',
  'location',
  'venue',
  'contact',
]
const stage2: readonly ContentType[] = ['poll', 'quiz', 'dice', 'paidMedia', 'rich']

const item = (kind: ContentType) => ({ value: kind, label: telegram.messageKind(kind).label })

/** The kind row's choices with the catalog's labels ("Text", "Photo", "GIF", "File", ..., "Poll", "Paid media"). */
export const kindItems = [...stage1, ...stage2].map(item)

/**
 * A question's choices: stage 1's (a question waits for a typed or shared answer, not a vote, a
 * roll or a payment), and its own kind when it already is one of stage 2's.
 */
export function promptKindItems(current: ContentType) {
  return [...stage1, ...(stage1.includes(current) ? [] : [current])].map(item)
}

/** The kinds an album item can be: the catalog's album groups together. */
export const albumKinds: readonly MediaKind[] = [...new Set(telegram.ALBUM_GROUPS.flatMap((group) => group.kinds))]

/**
 * The text of a content: a text message's text, a caption, an album's first caption, a poll's
 * question, a rich message's first text block.
 */
export function contentText(content: Content): RichTextRef | undefined {
  switch (content.type) {
    case 'rich':
      for (const block of content.blocks) if ('text' in block) return block.text
      return undefined
    case 'text':
      return content.text
    case 'album':
      return content.items.find((item) => item.caption)?.caption
    case 'poll':
    case 'quiz':
      return content.question
    case 'videoNote':
    case 'sticker':
    case 'location':
    case 'venue':
    case 'contact':
    case 'dice':
      return undefined
    default:
      return content.caption
  }
}

// Words in any language: a variable, a custom emoji or a part counts.
function hasWords(text: RichTextRef | undefined): boolean {
  return Object.values(text?.doc ?? {}).some(
    (doc) =>
      doc !== undefined &&
      plainText(
        doc,
        () => 'x',
        () => 'x',
      ).trim() !== '',
  )
}

/** Whether changing to the kind removes words: the kind has no caption (nor a question) and the message has a text. */
export function removesText(content: Content, kind: ContentType): boolean {
  const keeps =
    kind === 'text' || kind === 'poll' || kind === 'quiz' || kind === 'rich' || telegram.messageKind(kind).caption
  return !keeps && hasWords(contentText(content))
}

const placeholder = (description = ''): MediaSlot => ({ placeholder: { description } })

// The file of a content: its media, an album's or paid media's first item, a rich message's first media block.
function slotOf(content: Content): MediaSlot | undefined {
  if (content.type === 'album' || content.type === 'paidMedia') return content.items[0]?.media
  if (content.type === 'rich') return content.blocks.find((block) => block.type === 'media')?.media
  return 'media' in content ? content.media : undefined
}

// The slot again where its file is of a kind that fits, else a placeholder named after the file.
function fitting(slot: MediaSlot | undefined, fits: (kind: MediaKind) => boolean, design: Design): MediaSlot {
  if (!slot) return placeholder()
  if ('placeholder' in slot) return slot
  const item = design.media[slot.media]
  return item && fits(item.kind) ? slot : placeholder(item?.name ?? '')
}

/** The content as the new kind: the text kept as its text or caption, the file and the place where they fit. */
export function changeKind(content: Content, kind: ContentType, design: Design): Content {
  const text = contentText(content) ?? { id: newId(), doc: {} }
  const slot = slotOf(content)
  const media = fitting(slot, (fileKind) => fileKind === kind, design)
  const place =
    content.type === 'location' || content.type === 'venue'
      ? { latitude: content.latitude, longitude: content.longitude }
      : { latitude: 0, longitude: 0 }
  switch (kind) {
    case 'text':
      return { type: 'text', text }
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation': {
      const shown =
        content.type === 'photo' ||
        content.type === 'livePhoto' ||
        content.type === 'video' ||
        content.type === 'animation'
          ? { spoiler: content.spoiler, captionAbove: content.captionAbove }
          : {}
      return { type: kind, media, caption: text, ...shown }
    }
    case 'audio':
    case 'voice':
    case 'document':
      return { type: kind, media, caption: text }
    case 'videoNote':
    case 'sticker':
      return { type: kind, media }
    case 'album':
      return {
        type: 'album',
        items: [
          { media: fitting(slot, (fileKind) => albumKinds.includes(fileKind), design), caption: text },
          { media: placeholder() },
        ],
      }
    case 'location':
      return { type: 'location', ...place }
    case 'venue':
      return { type: 'venue', ...place, title: '', address: '' }
    case 'contact':
      return { type: 'contact', phone: '', firstName: '' }
    // Stage 2: the text kept as the question or the caption; a poll's options and settings stay
    // between poll and quiz (a quiz's right options where they still fit).
    case 'poll':
    case 'quiz': {
      const was = content.type === 'poll' || content.type === 'quiz' ? content : undefined
      const shared = {
        question: text,
        options: was?.options ?? [{}, {}],
        anonymous: was?.anonymous ?? true,
        multiple: was?.multiple ?? false,
        revote: was?.revote,
        shuffle: was?.shuffle,
        hideResults: was?.hideResults,
        closeAfterSec: was?.closeAfterSec,
        closeAt: was?.closeAt,
      }
      if (kind === 'poll') return { type: 'poll', ...shared }
      const correct = was?.type === 'quiz' ? was.correct : [0]
      return { type: 'quiz', ...shared, correct: correct.filter((index) => index < shared.options.length) }
    }
    case 'dice':
      return { type: 'dice', emoji: '🎲' }
    case 'paidMedia':
      return {
        type: 'paidMedia',
        items: [{ media: fitting(slot, (fileKind) => telegram.paidMediaKind(fileKind) !== undefined, design) }],
        stars: 1,
        caption: text,
      }
    // The text as its first paragraph, the file as a media block after it.
    case 'rich':
      return {
        type: 'rich',
        blocks: [
          { type: 'paragraph', text },
          ...(slot && richFits(slot, design) ? [{ type: 'media' as const, media: slot }] : []),
        ],
      }
  }
}

// Whether a rich message's media block takes the slot's file (a placeholder always).
function richFits(slot: MediaSlot, design: Design): boolean {
  if ('placeholder' in slot) return true
  const item = design.media[slot.media]
  return item !== undefined && telegram.richMediaKind(item.kind) !== undefined
}
