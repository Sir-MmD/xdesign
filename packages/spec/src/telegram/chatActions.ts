// Chat actions of sendChatAction (docs/plan/08 section 1, 04 section 5.5 "Before sending"): each
// action with the status the user sees, in plain words, and the content kinds Telegram names it
// for. Telegram shows an action for 5 seconds at most (limit chatActionDuration).
import type { ContentKind } from './messages.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type ChatActionRow = Sourced & {
  /** The action value of sendChatAction. */
  readonly id: string
  /** The status under the bot's name, as the editor shows it. */
  readonly label: string
  /** The content kinds sendChatAction names the action for. */
  readonly kinds: readonly ContentKind[]
}

export const CHAT_ACTIONS = [
  {
    id: 'typing',
    label: 'typing...',
    kinds: ['text'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'upload_photo',
    label: 'sending a photo...',
    kinds: ['photo'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'record_video',
    label: 'recording a video...',
    kinds: ['video'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'upload_video',
    label: 'sending a video...',
    kinds: ['video'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'record_voice',
    label: 'recording a voice message...',
    kinds: ['voice'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'upload_voice',
    label: 'sending a voice message...',
    kinds: ['voice'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'upload_document',
    label: 'sending a file...',
    kinds: ['document'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'choose_sticker',
    label: 'choosing a sticker...',
    kinds: ['sticker'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'find_location',
    label: 'finding a location...',
    kinds: ['location'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'record_video_note',
    label: 'recording a round video...',
    kinds: ['videoNote'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'upload_video_note',
    label: 'sending a round video...',
    kinds: ['videoNote'],
    source: apiDoc('sendchataction'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly ChatActionRow[]

export type ChatAction = (typeof CHAT_ACTIONS)[number]['id']

const actionsById = new Map<string, ChatActionRow>(CHAT_ACTIONS.map((row) => [row.id, row]))

/** The catalog row of a chat action. */
export function chatAction(id: ChatAction): ChatActionRow {
  const row = actionsById.get(id)
  if (!row) throw new Error(`no chat action ${id}`)
  return row
}
