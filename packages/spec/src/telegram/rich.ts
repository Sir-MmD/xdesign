// Rich messages and drafts (docs/plan/08 section 7, Bot API 10.1 to 10.3): the InputRichBlock
// types a rich message's blocks are sent as, with the model's block for each (null: xDesign does
// not offer it yet), the kinds of media a media block takes, the two draft methods of "Write it
// out like a draft" and its stop button (RICH-02). The limits are in limits.ts (richText,
// richBlocks, richNesting, richMedia, richTableColumns, richButtons, richHeadingSize, draftText,
// draftLife).
import type { ContentKind } from './messages.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type RichBlockRow = Sourced & {
  /** The InputRichBlock type field. */
  readonly id: string
  /** The InputRichBlock class. */
  readonly type: string
  /** The model's block type that is sent as it, or null. */
  readonly model: string | null
  /** The Bot API version that added it, when it is newer than 10.1. */
  readonly since?: string
}

const block = (id: string, type: string, model: string | null, since?: string): RichBlockRow => ({
  id,
  type,
  model,
  ...(since !== undefined && { since }),
  source: apiDoc(type.toLowerCase()),
  botApi: BOT_API,
  verified: true,
})

/** The blocks of InputRichMessage.blocks (Bot API 10.2; buttons, documents and expandable quotes 10.3). */
export const RICH_BLOCKS = [
  block('paragraph', 'InputRichBlockParagraph', 'paragraph', '10.2'),
  block('heading', 'InputRichBlockSectionHeading', 'heading', '10.2'),
  block('pre', 'InputRichBlockPreformatted', 'code', '10.2'),
  block('footer', 'InputRichBlockFooter', 'footer', '10.2'),
  block('divider', 'InputRichBlockDivider', 'divider', '10.2'),
  block('mathematical_expression', 'InputRichBlockMathematicalExpression', null, '10.2'),
  block('anchor', 'InputRichBlockAnchor', null, '10.2'),
  block('list', 'InputRichBlockList', 'list', '10.2'),
  block('blockquote', 'InputRichBlockBlockQuotation', 'quote', '10.2'),
  block('expandable_blockquote', 'InputRichBlockExpandableBlockQuotation', 'quote', '10.3'),
  block('pullquote', 'InputRichBlockPullQuotation', null, '10.2'),
  block('collage', 'InputRichBlockCollage', null, '10.2'),
  block('slideshow', 'InputRichBlockSlideshow', null, '10.2'),
  block('table', 'InputRichBlockTable', 'table', '10.2'),
  block('details', 'InputRichBlockDetails', 'details', '10.2'),
  block('map', 'InputRichBlockMap', null, '10.2'),
  block('buttons', 'InputRichBlockButtons', 'buttons', '10.3'),
  block('animation', 'InputRichBlockAnimation', 'media', '10.2'),
  block('audio', 'InputRichBlockAudio', 'media', '10.2'),
  block('document', 'InputRichBlockDocument', 'media', '10.3'),
  block('photo', 'InputRichBlockPhoto', 'media', '10.2'),
  block('video', 'InputRichBlockVideo', 'media', '10.2'),
  block('voice_note', 'InputRichBlockVoiceNote', 'media', '10.2'),
  block('thinking', 'InputRichBlockThinking', null, '10.2'),
] as const satisfies readonly RichBlockRow[]

export type RichMediaKindRow = Sourced & {
  /** The content kind of the file. */
  readonly id: ContentKind
  /** The InputRichBlock type field it is sent as. */
  readonly block: string
  /** The InputMedia type InputRichMessageMedia takes for it. */
  readonly media: string
  readonly since?: string
}

/** The kinds of file a rich message's media block holds (no live photos, round videos or stickers). */
export const RICH_MEDIA_KINDS = [
  {
    id: 'photo',
    block: 'photo',
    media: 'InputMediaPhoto',
    source: apiDoc('inputrichblockphoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'video',
    block: 'video',
    media: 'InputMediaVideo',
    source: apiDoc('inputrichblockvideo'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'animation',
    block: 'animation',
    media: 'InputMediaAnimation',
    source: apiDoc('inputrichblockanimation'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'audio',
    block: 'audio',
    media: 'InputMediaAudio',
    source: apiDoc('inputrichblockaudio'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'voice',
    block: 'voice_note',
    media: 'InputMediaVoiceNote',
    since: '10.2',
    source: apiDoc('inputrichblockvoicenote'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'document',
    block: 'document',
    media: 'InputMediaDocument',
    since: '10.3',
    source: apiDoc('inputrichblockdocument'),
    botApi: BOT_API,
    verified: true,
    note: 'Files are linked as tg://document?id= in html or markdown.',
  },
] as const satisfies readonly RichMediaKindRow[]

/** Whether a rich message's media block can hold a kind of file. */
export function richMediaKind(kind: ContentKind): RichMediaKindRow | undefined {
  return (RICH_MEDIA_KINDS as readonly RichMediaKindRow[]).find((row) => row.id === kind)
}

export type DraftMethodRow = Sourced & {
  readonly id: string
  /** The content kind it streams. */
  readonly kind: ContentKind
  /** The method that sends the complete message after the draft. */
  readonly then: string
  readonly since: string
}

/**
 * "Write it out like a draft": private chats only; a non-zero draft_id (changes to the same
 * draft animate); the draft is a 30-second preview, then the bot sends the complete message.
 * can_stop and keep_on_stop (10.3) add a stop button (DRAFT_STOP).
 */
export const DRAFT_METHODS = [
  {
    id: 'sendMessageDraft',
    kind: 'text',
    then: 'sendMessage',
    since: '9.5',
    source: apiDoc('sendmessagedraft'),
    botApi: BOT_API,
    verified: true,
    note: 'An empty text shows a "Thinking..." placeholder (10.0).',
  },
  {
    id: 'sendRichMessageDraft',
    kind: 'rich',
    then: 'sendRichMessage',
    since: '10.1',
    source: apiDoc('sendrichmessagedraft'),
    botApi: BOT_API,
    verified: true,
    note: 'No new uploads: the partial message reuses files by tg:// links.',
  },
] as const satisfies readonly DraftMethodRow[]

/** The draft method of a content kind, if it has one. */
export function draftMethod(kind: ContentKind): DraftMethodRow | undefined {
  return (DRAFT_METHODS as readonly DraftMethodRow[]).find((row) => row.kind === kind)
}

export type DraftStopRow = Sourced & {
  /** The parameter of both draft methods, or the update. */
  readonly id: string
  readonly type: 'parameter' | 'update'
  /** Its words in the editor. */
  readonly label: string
  readonly since: string
}

/**
 * A draft's stop button (Bot API 10.3): "Let the user stop it" passes can_stop to the draft
 * method, "Keep what was written" keep_on_stop; a press on the button sends the bot the update
 * stopped_message_generation, which the message's "If the user stops it" arrow takes.
 */
export const DRAFT_STOP = [
  {
    id: 'can_stop',
    type: 'parameter',
    label: 'Let the user stop it',
    since: '10.3',
    source: apiDoc('sendmessagedraft'),
    botApi: BOT_API,
    verified: true,
    note: 'Shows the user a button to stop further drafts (sendMessageDraft and sendRichMessageDraft).',
  },
  {
    id: 'keep_on_stop',
    type: 'parameter',
    label: 'Keep what was written',
    since: '10.3',
    source: apiDoc('sendmessagedraft'),
    botApi: BOT_API,
    verified: true,
    note: 'The draft stays when the button is pressed, but still disappears after a short time or once the bot sends a message; to keep it, the bot sends it as a new message.',
  },
  {
    id: 'stopped_message_generation',
    type: 'update',
    label: 'If the user stops it',
    since: '10.3',
    source: apiDoc('messagegenerationstopped'),
    botApi: BOT_API,
    verified: true,
    note: 'MessageGenerationStopped: the chat, message_thread_id and the draft_id that was stopped.',
  },
] as const satisfies readonly DraftStopRow[]

/** The words of a draft stop row (DRAFT_STOP), by its id. */
export function draftStopLabel(id: DraftStopRow['id']): string {
  return (DRAFT_STOP as readonly DraftStopRow[]).find((row) => row.id === id)?.label ?? id
}
