import type { ReactNode } from 'react'
import { type AlbumLayout, AlbumRectPart } from './albumLayout'
import type { PreviewMedia } from './model'
import { MediaMarks } from './parts'
import type { SkinTokens } from './skins/tokens'

const bottomRight = AlbumRectPart.Right | AlbumRectPart.Bottom

/**
 * Grouped media (2 to 10 items) in the boxes of the look's album layout (10 section 8.7,
 * 29 section 8.6): Post.tsx lays the album out with the app's own algorithm
 * (SkinTokens.album.layout), and each item takes its rectangle, in pixels. Without a caption
 * the info row's pill (`meta`) sits over the bottom-right item, as over a single photo (TGP-02).
 * `overlay` lies over the whole album (paid media's price button, MSG-03).
 */
export function Album({
  media,
  layout,
  skin,
  withText,
  meta,
  overlay,
}: {
  media: readonly PreviewMedia[]
  layout: AlbumLayout
  skin: SkinTokens
  withText: boolean
  meta?: ReactNode
  overlay?: ReactNode
}) {
  const corner = layout.items.findIndex((item) => (item.sides & bottomRight) === bottomRight)
  const metaAt = corner >= 0 ? corner : layout.items.length - 1
  return (
    <div
      className={withText ? 'tg-album' : 'tg-album alone'}
      style={{ width: `${String(layout.width)}px`, height: `${String(layout.height)}px` }}
    >
      {layout.items.map((item, i) => {
        const m = media[i]
        if (!m) return null
        return (
          <span
            key={i}
            className="tg-album-item"
            data-sides={item.sides}
            style={{
              left: `${String(item.x)}px`,
              top: `${String(item.y)}px`,
              width: `${String(item.width)}px`,
              height: `${String(item.height)}px`,
            }}
          >
            <img src={m.url} alt="" />
            <MediaMarks media={m} skin={skin} />
            {i === metaAt ? meta : null}
          </span>
        )
      })}
      {overlay}
    </div>
  )
}
