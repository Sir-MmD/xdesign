// Polls, quizzes and paid media (docs/plan/08 sections 1 and 7, 03 section 7.2): the sendPoll
// parameters a design maps to, with the model's field for each (null: xDesign does not offer it
// yet), and the kinds of media paid media takes. Channel-only parameters (members_only,
// country_codes) are left out: xDesign designs private chats.
import type { ContentKind } from './messages.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type PollFieldRow = Sourced & {
  /** The sendPoll parameter (or the InputPollOption field for an option's media). */
  readonly id: string
  /** The content field of the model that gives it, or null. */
  readonly model: string | null
  /** The kinds it applies to. */
  readonly kinds: readonly ('poll' | 'quiz')[]
  /** The Bot API version that added it, when it is newer than 9.4. */
  readonly since?: string
}

const BOTH = ['poll', 'quiz'] as const

export const POLL_FIELDS = [
  {
    id: 'question',
    model: 'question',
    kinds: BOTH,
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'With question_parse_mode or question_entities: only custom emoji entities are allowed.',
  },
  {
    id: 'options',
    model: 'options',
    kinds: BOTH,
    source: apiDoc('inputpolloption'),
    botApi: BOT_API,
    verified: true,
    note: 'InputPollOption text: only custom emoji entities are allowed.',
  },
  { id: 'type', model: 'type', kinds: BOTH, source: apiDoc('sendpoll'), botApi: BOT_API, verified: true },
  { id: 'is_anonymous', model: 'anonymous', kinds: BOTH, source: apiDoc('sendpoll'), botApi: BOT_API, verified: true },
  {
    id: 'allows_multiple_answers',
    model: 'multiple',
    kinds: BOTH,
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'Quizzes take it since 9.6.',
  },
  {
    id: 'allows_revoting',
    model: 'revote',
    kinds: BOTH,
    since: '9.6',
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'Defaults to false for quizzes and to true for regular polls.',
  },
  {
    id: 'shuffle_options',
    model: 'shuffle',
    kinds: BOTH,
    since: '9.6',
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'allow_adding_options',
    model: 'addOptions',
    kinds: ['poll'],
    since: '9.6',
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'Not supported for anonymous polls and quizzes.',
  },
  {
    id: 'hide_results_until_closes',
    model: 'hideResults',
    kinds: BOTH,
    since: '9.6',
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'correct_option_ids',
    model: 'correct',
    kinds: ['quiz'],
    since: '9.6',
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'Replaced correct_option_id; increasing 0-based indexes, required for quizzes.',
  },
  {
    id: 'explanation',
    model: 'explanation',
    kinds: ['quiz'],
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'With explanation_parse_mode or explanation_entities; shown after a wrong answer or a tap on the lamp.',
  },
  {
    id: 'open_period',
    model: 'closeAfterSec',
    kinds: BOTH,
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'Up to 2628000 seconds since 9.6; not together with close_date.',
  },
  {
    id: 'close_date',
    model: 'closeAt',
    kinds: BOTH,
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'A Unix time 5 to 2628000 seconds ahead; not together with open_period.',
  },
  {
    id: 'description',
    model: null,
    kinds: BOTH,
    since: '9.6',
    source: apiDoc('sendpoll'),
    botApi: BOT_API,
    verified: true,
    note: 'With description_parse_mode or description_entities.',
  },
  {
    id: 'media',
    model: null,
    kinds: BOTH,
    since: '10.0',
    source: apiDoc('inputpollmedia'),
    botApi: BOT_API,
    verified: true,
    note: 'Media added to the poll description.',
  },
  {
    id: 'explanation_media',
    model: null,
    kinds: ['quiz'],
    since: '10.0',
    source: apiDoc('inputpollmedia'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'option_media',
    model: null,
    kinds: BOTH,
    since: '10.0',
    source: apiDoc('inputpolloptionmedia'),
    botApi: BOT_API,
    verified: true,
    note: 'The media field of InputPollOption.',
  },
] as const satisfies readonly PollFieldRow[]

export type PaidMediaKindRow = Sourced & {
  /** The content kind of the item. */
  readonly id: ContentKind
  /** The InputPaidMedia type it is sent as. */
  readonly type: string
  readonly since?: string
}

/** The kinds of media paid media holds (sendPaidMedia, 1 to 10 of them, mixed). */
export const PAID_MEDIA_KINDS = [
  {
    id: 'photo',
    type: 'InputPaidMediaPhoto',
    source: apiDoc('inputpaidmediaphoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'video',
    type: 'InputPaidMediaVideo',
    source: apiDoc('inputpaidmediavideo'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'livePhoto',
    type: 'InputPaidMediaLivePhoto',
    since: '10.0',
    source: apiDoc('inputpaidmedialivephoto'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly PaidMediaKindRow[]

/** Whether paid media can hold a kind of file. */
export function paidMediaKind(kind: ContentKind): PaidMediaKindRow | undefined {
  return (PAID_MEDIA_KINDS as readonly PaidMediaKindRow[]).find((row) => row.id === kind)
}
