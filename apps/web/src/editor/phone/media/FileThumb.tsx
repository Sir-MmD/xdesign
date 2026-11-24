import type { MediaItem, MediaSlot } from '@xdesign/spec'
import { FileIcon, FilmIcon, MicIcon, MusicIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { fileUrl } from './files'

/**
 * A small square for a file in the editor's lists: an uploaded picture itself, an icon for
 * other files, a grey box for a placeholder (or a file the design no longer has).
 */
export function FileThumb({ slot, item, className }: { slot?: MediaSlot; item?: MediaItem; className?: string }) {
  const box = cn(
    'grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-surface-2 text-fg-2',
    className,
  )
  if (item?.mime.startsWith('image/')) {
    return <img src={fileUrl(item)} alt="" className={cn(box, 'object-cover')} draggable={false} />
  }
  if (!item || (slot && 'placeholder' in slot)) return <span aria-hidden className={cn(box, 'bg-[#b8bcc0]')} />
  const icon =
    item.kind === 'voice' ? (
      <MicIcon className="size-4" />
    ) : item.kind === 'audio' ? (
      <MusicIcon className="size-4" />
    ) : item.mime.startsWith('video/') ? (
      <FilmIcon className="size-4" />
    ) : (
      <FileIcon className="size-4" />
    )
  return (
    <span aria-hidden className={box}>
      {icon}
    </span>
  )
}
