// Media (docs/plan/08 sections 3 and 7, TG-00 section 4.2): upload size limits, the formats of
// each media kind, photo dimensions, which kinds an album may mix, and the file_id rules.
import type { LimitRow } from './limits.ts'
import type { ContentKind } from './messages.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export const UPLOAD_LIMITS = [
  {
    id: 'photoUpload',
    about: 'Photo uploaded by the bot',
    max: 10,
    unit: 'megabytes',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'fileUpload',
    about: 'Other file uploaded by the bot',
    max: 50,
    unit: 'megabytes',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'photoByUrl',
    about: 'Photo sent by URL',
    max: 5,
    unit: 'megabytes',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'fileByUrl',
    about: 'Other file sent by URL',
    max: 20,
    unit: 'megabytes',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'voiceByUrl',
    about: 'Voice message sent by URL (audio/ogg)',
    max: 1,
    unit: 'megabytes',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
    note: 'From 1 to 20 MB it is sent as a file.',
  },
  {
    id: 'photoSides',
    about: 'Photo width plus height',
    max: 10000,
    unit: 'pixels',
    source: apiDoc('sendphoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'photoRatio',
    about: 'Photo width to height ratio (either way)',
    max: 20,
    unit: 'ratio',
    source: apiDoc('sendphoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'livePhotoVideoSize',
    about: 'Video of a live photo',
    max: 10,
    unit: 'megabytes',
    source: apiDoc('sendlivephoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'livePhotoVideoLength',
    about: 'Length of the video of a live photo',
    max: 10,
    unit: 'seconds',
    source: apiDoc('sendlivephoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'videoNoteLength',
    about: 'Length of a round video',
    max: 60,
    unit: 'seconds',
    source: apiDoc('sendvideonote'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'thumbnailSize',
    about: 'Thumbnail (JPEG, upload only)',
    max: 200,
    unit: 'kilobytes',
    source: apiDoc('sendvideo'),
    botApi: BOT_API,
    verified: true,
    note: 'Less than 200 kB.',
  },
  {
    id: 'thumbnailSide',
    about: 'Thumbnail width and height',
    max: 320,
    unit: 'pixels',
    source: apiDoc('sendvideo'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly LimitRow[]

export type MediaFormatRow = Sourced & {
  readonly id: ContentKind
  /** The file formats Telegram names, as extensions or codecs. */
  readonly formats: readonly string[]
  /** Sending by URL: yes, no, or only some formats (see the note). */
  readonly byUrl: 'yes' | 'no' | 'some'
}

export const MEDIA_FORMATS = [
  {
    id: 'voice',
    formats: ['OGG (Opus)', 'MP3', 'M4A'],
    byUrl: 'some',
    source: apiDoc('sendvoice'),
    botApi: BOT_API,
    verified: true,
    note: 'By URL only audio/ogg up to 1 MB; other formats go as audio or a file.',
  },
  {
    id: 'videoNote',
    formats: ['MPEG4'],
    byUrl: 'no',
    source: apiDoc('sendvideonote'),
    botApi: BOT_API,
    verified: true,
    note: 'Square video up to 1 minute; length is the diameter.',
  },
  {
    id: 'sticker',
    formats: ['WEBP (static)', 'TGS (animated)', 'WEBM (video)'],
    byUrl: 'some',
    source: apiDoc('sendsticker'),
    botApi: BOT_API,
    verified: true,
    note: 'Animated and video stickers cannot be sent by URL.',
  },
  {
    id: 'animation',
    formats: ['GIF', 'H.264/MPEG-4 AVC without sound'],
    byUrl: 'yes',
    source: apiDoc('sendanimation'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'audio',
    formats: ['MP3', 'M4A'],
    byUrl: 'yes',
    source: apiDoc('sendaudio'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'video',
    formats: ['MPEG4'],
    byUrl: 'yes',
    source: apiDoc('sendvideo'),
    botApi: BOT_API,
    verified: true,
    note: 'Other formats may be sent as a file.',
  },
  {
    id: 'livePhoto',
    formats: ['video up to 10 seconds', 'static photo'],
    byUrl: 'no',
    source: apiDoc('sendlivephoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'document',
    formats: ['any'],
    byUrl: 'some',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
    note: 'By URL only .PDF and .ZIP.',
  },
] as const satisfies readonly MediaFormatRow[]

export type AlbumGroupRow = Sourced & {
  readonly id: string
  /** The kinds one album of this group may hold, mixed. */
  readonly kinds: readonly ContentKind[]
}

/** An album holds kinds of one group only; an item can be edited only into a kind of its group. */
export const ALBUM_GROUPS = [
  {
    id: 'visual',
    kinds: ['photo', 'livePhoto', 'video'],
    source: apiDoc('sendmediagroup'),
    botApi: BOT_API,
    verified: true,
    note: 'Live photos since 10.0; GIFs cannot be in an album.',
  },
  {
    id: 'audio',
    kinds: ['audio'],
    source: apiDoc('sendmediagroup'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'document',
    kinds: ['document'],
    source: apiDoc('sendmediagroup'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly AlbumGroupRow[]

/** The album group a kind belongs to, or undefined for kinds no album takes. */
export function albumGroup(kind: ContentKind): AlbumGroupRow | undefined {
  return ALBUM_GROUPS.find((group) => (group.kinds as readonly ContentKind[]).includes(kind))
}

export type MediaRuleRow = Sourced & { readonly id: string; readonly rule: string }

export const MEDIA_RULES = [
  {
    id: 'fileIdPerBot',
    rule: 'A file_id belongs to one bot: the preview bot and the exported bot cannot share file IDs.',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'fileIdKeepsType',
    rule: 'A file resent by file_id keeps its type: a video cannot be sent as a photo.',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'urlMime',
    rule: 'A file sent by URL must have the right MIME type.',
    source: apiDoc('sending-files'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly MediaRuleRow[]
