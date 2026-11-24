import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type Content, type Design, type MediaKind, newId, plainText, type StepId, telegram } from '@xdesign/spec'
import { PlusIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { useDesign, useLang } from '../../context'
import { albumKinds } from '../kinds'
import { useUpdateContent } from '../message'
import { FileThumb } from './FileThumb'
import { MediaSource } from './MediaSource'

type Album = Extract<Content, { type: 'album' }>
type AlbumItem = Album['items'][number]
type PaidMedia = Extract<Content, { type: 'paidMedia' }>

const albumItems = telegram.limit('albumItems')
const paidItems = telegram.limit('paidMediaItems')
// Paid media holds photos, videos and live photos (MSG-03).
const paidKinds = {
  kinds: telegram.PAID_MEDIA_KINDS.map((row) => row.id) as readonly MediaKind[],
  wrongKind: 'Paid media holds photos and videos. Use a photo or a video.',
}

/**
 * The album group the other items set (photos and videos, audio, or files; 08's album groups):
 * the kinds an item may be, and the message for a file of another kind.
 */
function itemKinds(items: readonly AlbumItem[], except: number, design: Design) {
  for (const [index, item] of items.entries()) {
    if (index === except || !('media' in item.media)) continue
    const kind = design.media[item.media.media]?.kind
    const group = kind === undefined ? undefined : telegram.albumGroup(kind)
    if (!group) continue
    const kinds = group.kinds as readonly MediaKind[]
    const wrongKind =
      group.id === 'visual'
        ? 'This album holds photos and videos. Use a photo or a video.'
        : group.id === 'audio'
          ? 'This album holds sounds. Use an audio file.'
          : undefined
    return { kinds, wrongKind }
  }
  return { kinds: albumKinds, wrongKind: undefined }
}

/**
 * An album (04 section 5.4): its items as thumbnails in a row, dragged to reorder (or moved with
 * the keyboard), "+" adds a placeholder (2 to 10 items); the chosen item's file, spoiler and
 * caption under the row. Paid media's items likewise (1 to 10 photos and videos, without spoiler
 * or caption of their own, MSG-03).
 */
export function AlbumEditor({ stepId, content }: { stepId: StepId; content: Album | PaidMedia }) {
  const design = useDesign()
  const update = useUpdateContent(stepId)
  const [chosen, setChosen] = useState(0)
  const items: readonly AlbumItem[] = content.items
  const index = Math.min(chosen, items.length - 1)
  const item = items[index]
  const ids = items.map((_, at) => `item-${String(at)}`)
  // A press without moving chooses the item; Space picks it up for the arrow keys, Enter chooses.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
  const paid = content.type === 'paidMedia'
  const { min, max } = paid ? paidItems : albumItems
  const setItems = (change: (items: AlbumItem[]) => AlbumItem[]) => {
    update((now) => {
      if (now.type === 'album' && !paid) return { ...now, items: change(now.items) }
      if (now.type === 'paidMedia' && paid) return { ...now, items: change(now.items).map(({ media }) => ({ media })) }
      return undefined
    })
  }
  const setItem = (at: number, fields: Partial<AlbumItem>) => {
    setItems((now) => now.map((one, position) => (position === at ? { ...one, ...fields } : one)))
  }
  const move = ({ active, over }: DragEndEvent) => {
    const from = ids.indexOf(String(active.id))
    const to = over ? ids.indexOf(String(over.id)) : -1
    if (from < 0 || to < 0 || from === to) return
    setItems((now) => arrayMove(now, from, to))
    setChosen(to)
  }
  const { kinds, wrongKind } = paid ? paidKinds : itemKinds(items, index, design)

  return (
    <div className="grid gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={move}>
        <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-2 overflow-x-auto p-0.5">
            {items.map((one, at) => (
              <AlbumThumb
                key={ids[at]}
                id={ids[at] ?? ''}
                item={one}
                design={design}
                number={at + 1}
                chosen={at === index}
                onChoose={() => {
                  setChosen(at)
                }}
              />
            ))}
            <Button
              variant="outline"
              size="icon"
              aria-label="Add an item"
              disabled={items.length >= max}
              onClick={() => {
                setItems((now) => [...now, { media: { placeholder: { description: '' } } }])
                setChosen(items.length)
              }}
            >
              <PlusIcon aria-hidden />
            </Button>
          </div>
        </SortableContext>
      </DndContext>
      {item ? (
        <>
          <p className="text-subhead font-semibold">
            Item {index + 1} of {items.length}
          </p>
          <MediaSource
            key={index}
            kinds={kinds}
            slot={item.media}
            wrongKind={wrongKind}
            onPick={(media) => {
              setItem(index, { media })
            }}
          />
          {paid ? null : (
            <>
              <SpoilerSwitch
                checked={item.spoiler === true}
                onChange={(spoiler) => {
                  setItem(index, { spoiler: spoiler ? true : undefined })
                }}
              />
              <AlbumCaption
                item={item}
                inBubble={items.findIndex((one) => one.caption) === index}
                onAdd={
                  items.some((one) => one.caption)
                    ? undefined
                    : () => {
                        setItem(index, { caption: { id: newId(), doc: {} } })
                      }
                }
              />
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="justify-self-start"
            disabled={items.length <= min}
            onClick={() => {
              setItems((now) => now.filter((_, position) => position !== index))
              setChosen(Math.max(0, index - 1))
            }}
          >
            Remove this item
          </Button>
        </>
      ) : null}
    </div>
  )
}

function AlbumThumb({
  id,
  item,
  design,
  number,
  chosen,
  onChoose,
}: {
  id: string
  item: AlbumItem
  design: Design
  number: number
  chosen: boolean
  onChoose: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const file = 'media' in item.media ? design.media[item.media.media] : undefined
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Item ${String(number)}`}
      aria-pressed={chosen}
      className={cn(
        'relative shrink-0 touch-none rounded-lg p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-focus',
        chosen ? 'bg-brand' : 'bg-transparent',
        isDragging && 'z-10 opacity-80',
      )}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onClick={onChoose}
    >
      <FileThumb slot={item.media} item={file} className="size-12" />
      <span className="absolute end-1 bottom-1 rounded-sm bg-black/55 px-1 text-caption-2 text-white">{number}</span>
    </button>
  )
}

function SpoilerSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>Hide under a spoiler</Label>
    </div>
  )
}

// The item's caption as it reads in the phone's language. The bubble shows the album's first
// caption, which TXT-01's editor writes there; "Add a caption" gives an album without one its
// caption on this item.
function AlbumCaption({ item, inBubble, onAdd }: { item: AlbumItem; inBubble: boolean; onAdd?: () => void }) {
  const design = useDesign()
  const lang = useLang()
  const doc = item.caption?.doc[lang] ?? item.caption?.doc[design.languages.default]
  const text = doc
    ? plainText(
        doc,
        (id) => design.variables[id]?.idName ?? id,
        (id) => {
          const part = design.parts[id]
          return part?.kind === 'text' ? part.name : ''
        },
      )
    : ''
  return (
    <div className="grid gap-1">
      <p className="text-subhead font-semibold text-fg-2">Caption</p>
      <p className={cn('text-subhead whitespace-pre-wrap', text === '' && 'text-fg-3')}>{text || 'No caption'}</p>
      {inBubble ? <p className="text-footnote text-fg-3">Write it in the bubble.</p> : null}
      {onAdd ? (
        <Button variant="outline" size="sm" className="justify-self-start" onClick={onAdd}>
          Add a caption
        </Button>
      ) : null}
    </div>
  )
}
