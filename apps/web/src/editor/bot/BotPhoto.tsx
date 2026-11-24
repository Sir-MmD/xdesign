import type { MediaKind, MediaSlot } from '@xdesign/spec'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'

import { useDesign, useEditor } from '../context'
import { fileLine } from '../phone/media/files'
import { FileThumb } from '../phone/media/FileThumb'
import { MediaSource } from '../phone/media/MediaSource'

// A JPEG goes up as a photo, an MP4 as a video (an animated profile photo); the server checks
// both as `botPhoto`.
const photoKinds: readonly MediaKind[] = ['photo', 'video']

// No photo yet: a slot of no file, so the picker offers "Use" for a placeholder.
const noPhoto: MediaSlot = { media: '' }

/**
 * The bot's profile photo (04 section 7, setMyProfilePhoto): the file or placeholder it is now,
 * MSG-01's picker in a popover with the upload kind `botPhoto` (a JPEG or an MP4), and "Remove".
 */
export function BotPhoto() {
  const design = useDesign()
  const { edits, readOnly } = useEditor()
  const [open, setOpen] = useState(false)
  const { photo } = design.bot
  const item = photo && 'media' in photo ? design.media[photo.media] : undefined
  const line = item
    ? fileLine(item)
    : photo && 'placeholder' in photo
      ? photo.placeholder.description || 'Placeholder'
      : 'No photo'

  return (
    <div className="grid gap-2">
      <p className="text-subhead font-semibold text-fg-2">Profile photo</p>
      <div className="flex min-w-0 items-center gap-3">
        <FileThumb slot={photo} item={item} className="size-12 rounded-full" />
        <span dir="auto" className="min-w-0 flex-1 truncate text-callout text-fg-2">
          {line}
        </span>
        {readOnly ? null : (
          <>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger render={<Button variant="outline" size="sm" />}>
                {photo ? 'Change' : 'Add a photo'}
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="grid w-80 gap-3">
                <PopoverTitle>Profile photo</PopoverTitle>
                {item ? <PopoverDescription className="truncate">{fileLine(item)}</PopoverDescription> : null}
                <MediaSource
                  kinds={photoKinds}
                  uploadAs="botPhoto"
                  wrongKind="This type of file cannot be used here. Use JPEG or MP4."
                  slot={photo ?? noPhoto}
                  onPick={(slot) => {
                    edits.bot.setPhoto(slot)
                  }}
                />
              </PopoverContent>
            </Popover>
            {photo ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  edits.bot.setPhoto(undefined)
                }}
              >
                Remove
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
