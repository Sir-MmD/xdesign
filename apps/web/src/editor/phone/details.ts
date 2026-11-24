// "Telegram details" under the phone (docs/plan/04 section 4.4): the Bot API method and fields the
// message of a step maps to, as the export's `telegram` block gives them (SPEC-03's sendTelegram
// and waitsFor) with the content's and the options' own fields (the builders' guide's names).
import { type Content, type Design, type MediaSlot, sendTelegram, telegram, waitsFor } from '@xdesign/spec'

import { type PhoneStep, shownOf } from './message'

export interface DetailRow {
  /** The method or field ("sendPhoto", "has_spoiler"). */
  name: string
  value: string
}

// The field of the file in each method (sendLivePhoto's is left out: the catalog names none).
const fileFields: Partial<Record<Content['type'], string>> = {
  photo: 'photo',
  video: 'video',
  animation: 'animation',
  audio: 'audio',
  voice: 'voice',
  document: 'document',
  videoNote: 'video_note',
  sticker: 'sticker',
}

function fileValue(slot: MediaSlot, design: Design): string {
  if ('placeholder' in slot) return `placeholder: ${slot.placeholder.description || '(no description)'}`
  return design.media[slot.media]?.name ?? 'a file'
}

function contentRows(content: Content, design: Design): DetailRow[] {
  const rows: DetailRow[] = []
  const field = fileFields[content.type]
  if (field && 'media' in content) rows.push({ name: field, value: fileValue(content.media, design) })
  switch (content.type) {
    case 'text':
      rows.push({ name: 'text', value: 'the message text' })
      break
    case 'album':
      rows.push({ name: 'media', value: `${String(content.items.length)} items` })
      if (content.items.some((item) => item.spoiler)) rows.push({ name: 'has_spoiler', value: 'true (some items)' })
      break
    case 'location':
      rows.push(
        { name: 'latitude', value: String(content.latitude) },
        { name: 'longitude', value: String(content.longitude) },
      )
      break
    case 'venue':
      rows.push(
        { name: 'latitude', value: String(content.latitude) },
        { name: 'longitude', value: String(content.longitude) },
        { name: 'title', value: content.title },
        { name: 'address', value: content.address },
      )
      break
    case 'contact':
      rows.push({ name: 'phone_number', value: content.phone }, { name: 'first_name', value: content.firstName })
      if (content.lastName) rows.push({ name: 'last_name', value: content.lastName })
      break
    case 'audio':
      if (content.title) rows.push({ name: 'title', value: content.title })
      if (content.performer) rows.push({ name: 'performer', value: content.performer })
      break
    case 'photo':
    case 'livePhoto':
    case 'video':
    case 'animation':
      if (content.spoiler) rows.push({ name: 'has_spoiler', value: 'true' })
      if (content.captionAbove) rows.push({ name: 'show_caption_above_media', value: 'true' })
      break
    default:
      break
  }
  if ('caption' in content && content.caption) rows.push({ name: 'caption', value: 'the caption' })
  return rows
}

/** The rows of the step's details: before sending, the method, its fields, and a question's answer. */
export function telegramDetails(step: PhoneStep, design: Design): DetailRow[] {
  const shown = shownOf(step)
  const { content, options } = shown
  const send = sendTelegram(shown)
  const rows: DetailRow[] = []
  if (options.delaySec !== undefined) rows.push({ name: 'wait', value: `${String(options.delaySec)} seconds` })
  if (options.chatAction) {
    rows.push({
      name: 'sendChatAction',
      value: `${options.chatAction.action} for ${String(options.chatAction.seconds)} seconds`,
    })
  }
  rows.push({ name: 'method', value: send.method }, ...contentRows(content, design))
  if (send.parseMode) rows.push({ name: 'parse_mode', value: send.parseMode })
  if (options.silent) rows.push({ name: 'disable_notification', value: 'true' })
  if (options.protect) rows.push({ name: 'protect_content', value: 'true' })
  const preview = options.linkPreview
  if (preview && content.type === 'text') {
    const parts = preview.off
      ? ['is_disabled: true']
      : [
          ...(preview.url ? [`url: ${preview.url}`] : []),
          ...(preview.size === 'small' ? ['prefer_small_media: true'] : []),
          ...(preview.size === 'large' ? ['prefer_large_media: true'] : []),
          ...(preview.above ? ['show_above_text: true'] : []),
        ]
    if (parts.length > 0) rows.push({ name: 'link_preview_options', value: parts.join(', ') })
  }
  if (options.effect) {
    const effect = telegram.EFFECTS.find((row) => row.effectId === options.effect || row.id === options.effect)
    rows.push({ name: 'message_effect_id', value: effect ? `${effect.effectId} (${effect.emoji})` : options.effect })
  }
  if (send.replyMarkup) rows.push({ name: 'reply_markup', value: send.replyMarkup })
  if (step.kind === 'question') rows.push({ name: 'waits for', value: waitsFor(step.expects).join(', ') })
  return rows
}
