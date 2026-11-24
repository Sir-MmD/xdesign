// The type of an uploaded file, from its first bytes, and the types each upload kind takes
// (docs/plan/02 section 8 item 5): the formats of the Telegram catalog (packages/spec, media.ts).
// SVG and HTML are refused for every kind; a file is never typed by its name or the browser's word.
import type { UploadKind } from '@xdesign/api'
import { telegram } from '@xdesign/spec'

// The types a file is detected as, with the names messages use.
const typeNames = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/gif': 'GIF',
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'video/webm': 'WebM',
  'audio/ogg': 'OGG (Opus)',
  'audio/mpeg': 'MP3',
  'audio/mp4': 'M4A',
  'audio/aac': 'AAC',
  'application/pdf': 'PDF',
  'application/zip': 'ZIP',
  // TGS stickers are gzipped Lottie animations.
  'application/gzip': 'TGS',
  'text/plain': 'text',
  'image/svg+xml': 'SVG',
  'text/html': 'HTML',
  // Anything else: only a file (document) takes it.
  'application/octet-stream': 'other',
} as const
export type FileType = keyof typeof typeNames

const refused: readonly FileType[] = ['image/svg+xml', 'text/html']

// Every type but the refused ones: what a file (document) takes.
const anyType = (Object.keys(typeNames) as FileType[]).filter((type) => !refused.includes(type))
const photoTypes: readonly FileType[] = ['image/jpeg', 'image/png', 'image/webp']

type CatalogFormat = (typeof telegram.MEDIA_FORMATS)[number]['formats'][number]
type CatalogKind = (typeof telegram.MEDIA_FORMATS)[number]['id']

// The catalog's format names as the types they are detected as. A format the catalog adds fails
// to compile here until it is named.
const formatTypes: Record<CatalogFormat, readonly FileType[]> = {
  'OGG (Opus)': ['audio/ogg'],
  MP3: ['audio/mpeg'],
  M4A: ['audio/mp4'],
  MPEG4: ['video/mp4'],
  'WEBP (static)': ['image/webp'],
  'TGS (animated)': ['application/gzip'],
  'WEBM (video)': ['video/webm'],
  GIF: ['image/gif'],
  'H.264/MPEG-4 AVC without sound': ['video/mp4'],
  // Phones record the video of a live photo as MOV.
  'video up to 10 seconds': ['video/mp4', 'video/quicktime'],
  'static photo': photoTypes,
  any: anyType,
}

// The types of a kind's formats row.
function catalogTypes(kind: CatalogKind): readonly FileType[] {
  const row = telegram.MEDIA_FORMATS.find((format) => format.id === kind)
  return row ? row.formats.flatMap((format) => formatTypes[format]) : []
}

// Photos have no formats row (sendPhoto names none; a GIF goes as an animation); the bot's photo
// is a JPG or an MPEG4 animation (setMyProfilePhoto in the catalog's bot.ts).
const allowed: Record<UploadKind, readonly FileType[]> = {
  photo: photoTypes,
  livePhoto: catalogTypes('livePhoto'),
  video: catalogTypes('video'),
  animation: catalogTypes('animation'),
  audio: catalogTypes('audio'),
  voice: catalogTypes('voice'),
  document: catalogTypes('document'),
  videoNote: catalogTypes('videoNote'),
  sticker: catalogTypes('sticker'),
  botPhoto: ['image/jpeg', 'video/mp4'],
}

// "JPEG, PNG or WebP"
function names(types: readonly FileType[]): string {
  const list = [...new Set(types.map((type) => typeNames[type]))]
  const last = list.pop() ?? ''
  return list.length > 0 ? `${list.join(', ')} or ${last}` : last
}

// Why the file may not be uploaded for the kind, in words for the screen, or null when it may.
export function refusal(kind: UploadKind, type: FileType): string | null {
  if (refused.includes(type)) {
    return 'SVG and HTML files are not allowed.'
  }
  if (!allowed[kind].includes(type)) {
    return `This type of file cannot be used here. Use ${names(allowed[kind])}.`
  }
  return null
}

// The bytes of the start of a file that detectType needs.
export const headBytes = 4096

// The ISO media brands (bytes 8 to 12 after "ftyp") of audio, QuickTime and still images; any other
// brand is MP4 video.
const audioBrands = ['M4A ', 'M4B ', 'M4P ']
const imageBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1', 'avif', 'avis']

// The start of a text a browser sniffs as HTML (the WHATWG patterns), and the start of SVG or XML.
const htmlStart =
  /^<(?:!--|(?:!doctype html|html|head|script|iframe|h1|div|font|table|a|style|title|b|body|br|p)(?:[\s>]|$))/i
const svgStart = /^<(?:svg|!doctype svg|\?xml)(?:[\s>]|$)/i

// Bytes that no text has (the WHATWG binary data bytes).
function isBinaryByte(byte: number): boolean {
  return byte <= 0x08 || byte === 0x0b || (byte >= 0x0e && byte <= 0x1a) || (byte >= 0x1c && byte <= 0x1f)
}

// Plain text is UTF-8 without binary bytes; HTML and SVG are text too, and refused.
function textType(head: Buffer): FileType {
  if (head.some(isBinaryByte)) {
    return 'application/octet-stream'
  }
  let text: string
  try {
    // `stream` keeps a character cut at the end of the head from failing.
    text = new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true }).trimStart()
  } catch {
    return 'application/octet-stream'
  }
  if (svgStart.test(text)) {
    return 'image/svg+xml'
  }
  return htmlStart.test(text) ? 'text/html' : 'text/plain'
}

// An MPEG audio frame (MP3) or an ADTS frame (AAC) starts with 11 set bits.
function frameType(second: number): FileType {
  const layer = (second >> 1) & 0x03
  if (layer === 0) {
    return (second & 0xf6) === 0xf0 ? 'audio/aac' : 'application/octet-stream'
  }
  // Version 01 is reserved.
  return ((second >> 3) & 0x03) === 1 ? 'application/octet-stream' : 'audio/mpeg'
}

// The type of a file from its first bytes (up to headBytes of them).
export function detectType(head: Buffer): FileType {
  const ascii = (start: number, text: string) => head.toString('latin1', start, start + text.length) === text
  const bytes = (start: number, ...values: number[]) => values.every((value, i) => head[start + i] === value)

  if (bytes(0, 0xff, 0xd8, 0xff)) {
    return 'image/jpeg'
  }
  if (bytes(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return 'image/png'
  }
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) {
    return 'image/gif'
  }
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    return 'image/webp'
  }
  if (ascii(4, 'ftyp')) {
    const brand = head.toString('latin1', 8, 12)
    if (audioBrands.includes(brand)) {
      return 'audio/mp4'
    }
    if (brand === 'qt  ') {
      return 'video/quicktime'
    }
    return imageBrands.includes(brand) ? 'application/octet-stream' : 'video/mp4'
  }
  // Older QuickTime files start with a box other than "ftyp".
  if (ascii(4, 'moov') || ascii(4, 'mdat') || ascii(4, 'wide')) {
    return 'video/quicktime'
  }
  // EBML, with the DocType "webm" (Matroska otherwise).
  if (bytes(0, 0x1a, 0x45, 0xdf, 0xa3)) {
    return head.subarray(0, 64).includes('webm') ? 'video/webm' : 'application/octet-stream'
  }
  // An Ogg page whose first packet is the Opus header.
  if (ascii(0, 'OggS')) {
    return ascii(28, 'OpusHead') ? 'audio/ogg' : 'application/octet-stream'
  }
  if (ascii(0, 'ID3')) {
    return 'audio/mpeg'
  }
  if (head.length >= 2 && head.readUInt8(0) === 0xff && (head.readUInt8(1) & 0xe0) === 0xe0) {
    return frameType(head.readUInt8(1))
  }
  if (ascii(0, '%PDF-')) {
    return 'application/pdf'
  }
  if (ascii(0, 'PK') && (bytes(2, 3, 4) || bytes(2, 5, 6) || bytes(2, 7, 8))) {
    return 'application/zip'
  }
  if (bytes(0, 0x1f, 0x8b, 0x08)) {
    return 'application/gzip'
  }
  return textType(head)
}
