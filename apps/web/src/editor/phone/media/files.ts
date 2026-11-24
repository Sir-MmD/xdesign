// The design's uploaded files (docs/plan/03 section 2.11) as the media slot uses them: their
// address on the server, which ones fit a kind, and an upload's row added once per file and kind.
import type { Design, DesignEdits, MediaId, MediaItem, MediaKind } from '@xdesign/spec'

import { mediaUrl } from '@/api/media'
import { formatBytes } from '@/lib/format'

import type { MediaRow } from './upload'

/** The address of an uploaded file. */
export function fileUrl(item: MediaItem): string {
  return mediaUrl(item.serverId)
}

/** The design's files of these kinds, in the order they were added. */
export function filesOf(design: Design, kinds: readonly MediaKind[]): MediaItem[] {
  return Object.values(design.media).filter((item) => kinds.includes(item.kind))
}

/** "IMG_1234.jpg, 2.1 MB". */
export function fileLine(item: MediaItem): string {
  return `${item.name}, ${formatBytes(item.bytes)}`
}

/** The design's file for an upload's row: the one it has for that file and kind, else a new one. */
export function addUploaded(
  edits: DesignEdits,
  design: Design | undefined,
  row: MediaRow,
  kind: MediaKind,
  name: string,
): MediaId {
  const known = Object.values(design?.media ?? {}).find((item) => item.serverId === row.id && item.kind === kind)
  if (known) return known.id
  return edits.media.add({
    serverId: row.id,
    kind,
    name: row.originalName ?? name,
    mime: row.mime,
    bytes: row.bytes,
    ...(row.width === null ? {} : { width: row.width }),
    ...(row.height === null ? {} : { height: row.height }),
    ...(row.durationMs === null ? {} : { durationMs: row.durationMs }),
  })
}
