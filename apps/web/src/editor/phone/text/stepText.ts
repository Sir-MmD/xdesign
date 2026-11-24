// The text the phone's bubble shows for a step (docs/plan/04 section 5.2): a text message's text, a
// media message's caption (an album's first one, as the preview shows it), a poll's or quiz's
// question, a question's prompt likewise. Locations, venues, contacts, round videos, stickers and
// dice have none; a rich message's texts are written block by block under the phone (RichSection).
import type { MessageStep, QuestionStep, RichTextRef } from '@xdesign/spec'

export interface StepText {
  text: RichTextRef
  /** A caption (1024 characters), not a message text (4096). */
  caption: boolean
  /** A poll's question (300 characters, only custom emoji kept): written without formatting. */
  question?: boolean
}

/** The text in the step's bubble; undefined when its kind has none or no caption yet. */
export function stepText(step: MessageStep | QuestionStep): StepText | undefined {
  const { content } = step.kind === 'message' ? step : step.prompt
  switch (content.type) {
    case 'text':
      return { text: content.text, caption: false }
    case 'album': {
      const caption = content.items.find((item) => item.caption)?.caption
      return caption ? { text: caption, caption: true } : undefined
    }
    case 'poll':
    case 'quiz':
      return { text: content.question, caption: false, question: true }
    case 'location':
    case 'venue':
    case 'contact':
    case 'videoNote':
    case 'sticker':
    case 'dice':
    case 'rich':
      return undefined
    default:
      return content.caption ? { text: content.caption, caption: true } : undefined
  }
}
