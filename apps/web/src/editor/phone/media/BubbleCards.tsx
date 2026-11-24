// What the bubble shows for content the preview draws no picture for (docs/plan/04 section 5.4):
// a file, a sound or a voice message as a row (an album of them a row each), a round video, a
// sticker, a place as a plain map card (no map tiles are loaded) and a contact as a card. They
// draw inside the phone's shadow root, where the app's classes do not reach: inline styles on
// the look's own custom properties (`--tg-text`, `--tg-meta`, `--tg-link`, the bubble's padding)
// and its media frame (`tg-media`).
import { type Content, type Design, type MediaItem, type MediaSlot, telegram } from '@xdesign/spec'
import { FileIcon, MapPinIcon, MicIcon, PlayIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

import { formatBytes } from '@/lib/format'

import { fileUrl } from './files'

// The preview's placeholder grey (adapt.ts placeholderPicture).
const grey = '#b8bcc0'
const greyText = '#4a4e52'

const padded: CSSProperties = {
  padding: 'var(--tg-pad-top) var(--tg-pad-right) var(--tg-pad-bottom) var(--tg-pad-left)',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minWidth: 220,
}
const title: CSSProperties = {
  color: 'var(--tg-text)',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}
const detail: CSSProperties = { color: 'var(--tg-meta)', fontSize: '0.86em' }
const circle = (size: number, background: string): CSSProperties => ({
  display: 'grid',
  placeItems: 'center',
  flex: 'none',
  width: size,
  height: size,
  borderRadius: '50%',
  background,
  color: '#fff',
  overflow: 'hidden',
})

/** "0:07", "12:30". */
function length(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined) return undefined
  const seconds = Math.round(durationMs / 1000)
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`
}

type FileContent = Extract<Content, { type: 'audio' | 'voice' | 'document' | 'videoNote' | 'sticker' }>

/** A file, a sound, a voice message, a round video or a sticker; a placeholder in grey with its description. */
export function FileCard({ content, design, label }: { content: FileContent; design: Design; label: string }) {
  const item = 'media' in content.media ? design.media[content.media.media] : undefined
  const description = placeholderText(content.media, item, label)
  switch (content.type) {
    case 'videoNote':
      return (
        <div style={{ padding: 'var(--tg-media-inset)' }}>
          <div style={{ ...circle(200, grey), color: greyText, textAlign: 'center' }}>
            {item?.mime.startsWith('video/') ? (
              <video
                src={fileUrl(item)}
                muted
                playsInline
                preload="metadata"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ padding: 24 }}>{description}</span>
            )}
          </div>
        </div>
      )
    case 'sticker':
      return (
        <div style={{ padding: 'var(--tg-media-inset)' }}>
          {item?.mime.startsWith('image/') ? (
            <img
              src={fileUrl(item)}
              alt=""
              style={{ display: 'block', width: 160, height: 160, objectFit: 'contain' }}
            />
          ) : item?.mime === 'video/webm' ? (
            <video
              src={fileUrl(item)}
              muted
              autoPlay
              loop
              playsInline
              style={{ display: 'block', width: 160, height: 160, objectFit: 'contain' }}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 160,
                height: 160,
                borderRadius: 12,
                background: grey,
                color: greyText,
                textAlign: 'center',
                padding: 12,
                boxSizing: 'border-box',
              }}
            >
              {description}
            </div>
          )}
        </div>
      )
    default: {
      const icon =
        content.type === 'document' ? (
          <FileIcon size={20} />
        ) : content.type === 'voice' ? (
          <MicIcon size={20} />
        ) : (
          <PlayIcon size={20} />
        )
      const name = content.type === 'audio' && content.title ? content.title : item ? item.name : description
      const more = item
        ? content.type === 'document'
          ? formatBytes(item.bytes)
          : [content.type === 'audio' ? content.performer : undefined, length(item.durationMs)]
              .filter(Boolean)
              .join(', ')
        : label
      return (
        <div style={padded}>
          <span style={circle(44, item ? 'var(--tg-link)' : grey)}>{icon}</span>
          <span style={{ display: 'grid', minWidth: 0 }}>
            <span style={title}>{name}</span>
            {more ? <span style={detail}>{more}</span> : null}
          </span>
        </div>
      )
    }
  }
}

// A placeholder's description, a missing file's kind.
function placeholderText(slot: MediaSlot, item: MediaItem | undefined, label: string): string {
  if ('placeholder' in slot) return slot.placeholder.description || label
  return item?.name ?? label
}

/** A location or a venue: a plain map with a pin and the coordinates; a venue's name and address under it. */
export function PlaceCard({ content }: { content: Extract<Content, { type: 'location' | 'venue' }> }) {
  const venue = content.type === 'venue' ? content : undefined
  return (
    <div style={{ width: 260 }}>
      <div
        className={venue ? 'tg-media' : 'tg-media alone'}
        style={{
          height: 140,
          display: 'grid',
          placeItems: 'center',
          backgroundColor: '#e8e4da',
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 27px, #d8d3c6 27px 28px), repeating-linear-gradient(90deg, transparent 0 27px, #d8d3c6 27px 28px)',
        }}
      >
        <MapPinIcon size={34} color="#e53935" fill="#ffffff" />
        <span
          style={{
            position: 'absolute',
            left: 8,
            bottom: 6,
            padding: '1px 6px',
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.45)',
            color: '#fff',
            fontSize: '0.8em',
          }}
        >
          {content.latitude.toFixed(5)}, {content.longitude.toFixed(5)}
        </span>
      </div>
      {venue ? (
        <div style={{ ...padded, display: 'grid', gap: 2, minWidth: 0 }}>
          <span style={title}>{venue.title || 'Venue'}</span>
          {venue.address ? <span style={detail}>{venue.address}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

/** A contact: the first letters on a round picture, the name and the phone number. */
export function ContactCard({ content }: { content: Extract<Content, { type: 'contact' }> }) {
  const name = [content.firstName, content.lastName].filter(Boolean).join(' ')
  const letters = [content.firstName, content.lastName]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase()
  return (
    <div style={padded}>
      <span style={{ ...circle(44, 'var(--tg-link)'), fontWeight: 600 }}>{letters || '?'}</span>
      <span style={{ display: 'grid', minWidth: 0 }}>
        <span style={title}>{name || 'Contact'}</span>
        <span style={detail}>{content.phone || 'No phone number'}</span>
      </span>
    </div>
  )
}

/** An album of sounds or files, which the preview draws no picture for: a row per item. */
export function AlbumFiles({ content, design }: { content: Extract<Content, { type: 'album' }>; design: Design }) {
  return (
    <div>
      {content.items.map((item, at) => {
        const audio = 'media' in item.media && design.media[item.media.media]?.kind === 'audio'
        return (
          <FileCard
            key={at}
            content={{ type: audio ? 'audio' : 'document', media: item.media }}
            design={design}
            label={telegram.messageKind(audio ? 'audio' : 'document').label}
          />
        )
      })}
    </div>
  )
}
