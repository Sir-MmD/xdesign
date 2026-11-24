import type { UploadKind } from '@xdesign/api'
import type { MediaKind, MediaSlot } from '@xdesign/spec'
import { UploadIcon } from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { isApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useDesign, useEditor } from '../../context'
import { addUploaded, filesOf } from './files'
import { FileThumb } from './FileThumb'
import { acceptFor, kindOfFile, probeFile, sendMedia, takesFile } from './upload'

type Upload = { sending: number } | { failed: string } | null

/**
 * Where a media slot's file comes from (04 section 5.4): "Upload a file" (dropped or picked; the
 * server checks its type and size and its plain message shows here), "Use a placeholder" (a
 * description the developer fills in) or "Use a file already in this design". `onPick` puts
 * the new slot in place; an upload's comes when it ends, also after the popover closed.
 */
export function MediaSource({
  kinds,
  slot,
  onPick,
  wrongKind = 'This file cannot be used here.',
  uploadAs,
}: {
  /** The kinds the file may be: one for a message's media, an album group's for an album item. */
  kinds: readonly MediaKind[]
  slot: MediaSlot
  onPick: (slot: MediaSlot) => void
  /** The message for a file of none of `kinds` (an album of photos and videos and a sound). */
  wrongKind?: string
  /**
   * The kind the server checks an upload as when it is not the file's kind (the bot's profile
   * photo: `botPhoto`, a JPEG or an MP4 kept as a photo or a video); only files it takes are offered.
   */
  uploadAs?: UploadKind
}) {
  return (
    <div className="grid gap-4">
      <UploadPart kinds={kinds} onPick={onPick} wrongKind={wrongKind} uploadAs={uploadAs} />
      <PlaceholderPart slot={slot} onPick={onPick} />
      <ReusePart kinds={kinds} slot={slot} onPick={onPick} uploadAs={uploadAs} />
    </div>
  )
}

function UploadPart({
  kinds,
  onPick,
  wrongKind,
  uploadAs,
}: {
  kinds: readonly MediaKind[]
  onPick: (slot: MediaSlot) => void
  wrongKind: string
  uploadAs: UploadKind | undefined
}) {
  const { designId, edits, live } = useEditor()
  const picker = useRef<HTMLInputElement>(null)
  const stop = useRef<(() => void) | null>(null)
  const [upload, setUpload] = useState<Upload>(null)
  const [over, setOver] = useState(false)
  const sending = upload !== null && 'sending' in upload

  const send = async (file: File) => {
    const kind = kinds.length === 1 ? kinds[0] : kindOfFile(file, kinds)
    if (kind === undefined) {
      setUpload({ failed: wrongKind })
      return
    }
    const run = { stopped: false }
    stop.current = () => {
      run.stopped = true
      setUpload(null)
    }
    setUpload({ sending: 0 })
    try {
      const probe = await probeFile(file)
      if (run.stopped) return
      const request = sendMedia(designId, uploadAs ?? kind, file, probe, (part) => {
        setUpload({ sending: part })
      })
      stop.current = request.abort
      const row = await request.done
      const id = addUploaded(edits, live.getState().design, row, kind, file.name)
      setUpload(null)
      onPick({ media: id })
    } catch (failure) {
      if (isApiError(failure) && failure.code === 'aborted') setUpload(null)
      else setUpload({ failed: failure instanceof Error ? failure.message : String(failure) })
    } finally {
      stop.current = null
    }
  }
  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file && !sending) void send(file)
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-subhead font-semibold text-fg-2">Upload a file</p>
      <div
        className={cn(
          'grid justify-items-center gap-2 rounded-lg border border-dashed border-border-strong p-3 text-center text-footnote text-fg-2',
          over && 'border-brand bg-brand-weak',
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => {
          setOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer.files)
        }}
      >
        {upload !== null && 'sending' in upload ? (
          <>
            <div
              role="progressbar"
              aria-label="Uploading"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(upload.sending * 100)}
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-full bg-brand" style={{ width: `${String(Math.round(upload.sending * 100))}%` }} />
            </div>
            <div className="flex items-center gap-2">
              <span>Uploading... {Math.round(upload.sending * 100)}%</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  stop.current?.()
                }}
              >
                Stop
              </Button>
            </div>
          </>
        ) : (
          <>
            <span>Drop a file here, or</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                picker.current?.click()
              }}
            >
              <UploadIcon aria-hidden data-icon="inline-start" />
              Choose a file
            </Button>
          </>
        )}
        <input
          ref={picker}
          type="file"
          hidden
          accept={acceptFor(uploadAs === undefined ? kinds : [uploadAs])}
          onChange={(event) => {
            take(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      {upload !== null && 'failed' in upload ? (
        <p role="alert" className="text-footnote text-error">
          {upload.failed}
        </p>
      ) : null}
    </div>
  )
}

function PlaceholderPart({ slot, onPick }: { slot: MediaSlot; onPick: (slot: MediaSlot) => void }) {
  const inputId = useId()
  const [draft, setDraft] = useState('')
  const hint = 'For example: photo of the product'
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>Use a placeholder</Label>
      {'placeholder' in slot ? (
        <Input
          id={inputId}
          value={slot.placeholder.description}
          placeholder={hint}
          onChange={(event) => {
            onPick({ placeholder: { description: event.target.value } })
          }}
        />
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            onPick({ placeholder: { description: draft.trim() } })
            setDraft('')
          }}
        >
          <Input
            id={inputId}
            value={draft}
            placeholder={hint}
            onChange={(event) => {
              setDraft(event.target.value)
            }}
          />
          <Button type="submit" variant="outline">
            Use
          </Button>
        </form>
      )}
    </div>
  )
}

function ReusePart({
  kinds,
  slot,
  onPick,
  uploadAs,
}: {
  kinds: readonly MediaKind[]
  slot: MediaSlot
  onPick: (slot: MediaSlot) => void
  uploadAs: UploadKind | undefined
}) {
  const design = useDesign()
  const files = filesOf(design, kinds).filter((item) => uploadAs === undefined || takesFile(uploadAs, item))
  const chosen = 'media' in slot ? slot.media : null
  return (
    <div className="grid gap-1.5">
      <p className="text-subhead font-semibold text-fg-2">Use a file already in this design</p>
      {files.length === 0 ? (
        <p className="text-footnote text-fg-3">No files of this kind in the design yet.</p>
      ) : (
        <ul className="grid max-h-48 gap-0.5 overflow-y-auto">
          {files.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={item.id === chosen}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-subhead hover:bg-surface-2 aria-pressed:bg-brand-weak aria-pressed:text-brand"
                onClick={() => {
                  onPick({ media: item.id })
                }}
              >
                <FileThumb item={item} className="size-8" />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="shrink-0 text-footnote text-fg-3">{formatBytes(item.bytes)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
