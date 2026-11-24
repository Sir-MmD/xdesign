// The blocks of a Telegram rich message in the preview (docs/plan/28-owner-list-2026-10-20.md
// sections 14.5 and 14.7, RCH-04b): headings, lists, tables, collapsible parts, quotes, code
// blocks, dividers and pictures between paragraphs, and a rich source post's formulas, maps,
// collages and slideshows (28 section 14.6). Approximated from Telegram's page blocks: no
// reference screenshots of rich messages yet. The look comes from preview.css; only the
// collapsible parts (and the spoilers and quotes inside the text) react to clicks, and the
// buttons inside when Try it gives `onButton` (RICH-02).
import { createContext, type ReactNode, useContext, useState } from 'react'
import { Keyboard } from './Keyboard'
import type { PreviewMedia, PreviewRich, RichBlock } from './model'
import { MediaMarks, Segments } from './parts'
import { blockSegments, hasOwnText, placedMedia } from './richBlocks'
import { SkinContext } from './skinContext'

interface BlockProps {
  rich: PreviewRich
  block: RichBlock
  /** The post's media, which the pictures name by position from 1. */
  media: readonly PreviewMedia[]
}

// A press on a button inside: its button row and its place in the row.
type Press = (block: RichBlock, button: number) => void
const PressContext = createContext<Press | undefined>(undefined)

/**
 * The content of a rich message: the media no block places first, as the sender puts them
 * (where a normal post shows its media), then its blocks in order. The caller sets the
 * direction (`dir` on the `.tg-rich` around it). `onButton` makes the buttons inside act, by the
 * button row's number among the message's button rows and the button's place.
 */
export function RichContent({
  rich,
  media,
  onButton,
}: {
  rich: PreviewRich
  media: readonly PreviewMedia[]
  onButton?: ((line: number, button: number) => void) | undefined
}) {
  const placed = placedMedia(rich.blocks)
  const skin = useContext(SkinContext)
  const lines = rich.blocks.filter((block) => block.kind === 'buttons')
  const press: Press | undefined =
    onButton &&
    ((block, button) => {
      const line = lines.indexOf(block)
      if (line >= 0) onButton(line, button)
    })
  return (
    <PressContext.Provider value={press}>
      <div className="tg-rich-blocks" data-gap={skin?.rich.gap ? '' : undefined}>
        {media.map((item, index) =>
          placed.has(index + 1) ? null : <Picture key={`media-${String(index)}`} item={item} />,
        )}
        <Blocks rich={rich} blocks={rich.blocks} media={media} />
      </div>
    </PressContext.Provider>
  )
}

function Blocks({
  rich,
  blocks,
  media,
}: {
  rich: PreviewRich
  blocks: readonly RichBlock[]
  media: readonly PreviewMedia[]
}): ReactNode {
  return blocks.map((block, index) => <Block key={index} rich={rich} block={block} media={media} />)
}

/** The own text of a leaf with its formatting. */
function OwnText({ rich, block }: Omit<BlockProps, 'media'>) {
  return <Segments nodes={blockSegments(rich, block)} />
}

function Block({ rich, block, media }: BlockProps): ReactNode {
  switch (block.kind) {
    case 'paragraph':
    case 'pre':
      // A pre block's text carries its pre entity, which draws the code block.
      return (
        <div className="tg-rich-leaf">
          <OwnText rich={rich} block={block} />
        </div>
      )
    case 'heading':
      return (
        <div className={`tg-rich-leaf tg-rich-heading h${String(Math.min(Math.max(block.level ?? 1, 1), 3))}`}>
          <OwnText rich={rich} block={block} />
        </div>
      )
    case 'quote':
      // Its text carries the blockquote entity (expandable when collapsed); a source's pull quote is centered.
      return (
        <div className={block.pull ? 'tg-rich-leaf tg-rich-pull' : 'tg-rich-leaf'}>
          <OwnText rich={rich} block={block} />
        </div>
      )
    case 'math':
      return (
        <div className="tg-rich-leaf tg-rich-math">
          <OwnText rich={rich} block={block} />
        </div>
      )
    case 'summary':
    case 'cell':
      // A title or a cell out of its place (the sanitizer keeps none): its text as a paragraph.
      return (
        <div className="tg-rich-leaf">
          <OwnText rich={rich} block={block} />
        </div>
      )
    case 'list':
      return <List rich={rich} block={block} media={media} />
    case 'item':
    case 'row':
      return <Blocks rich={rich} blocks={block.blocks ?? []} media={media} />
    case 'table':
      return <Table rich={rich} block={block} />
    case 'details':
      return <Details rich={rich} block={block} media={media} />
    case 'divider':
      return <div className="tg-rich-divider" />
    case 'media':
      return <Figure rich={rich} block={block} media={media} />
    case 'map':
      return <MapBlock rich={rich} block={block} />
    case 'collage':
    case 'slideshow':
      return <Gallery block={block} media={media} />
    case 'buttons':
      return <Buttons block={block} />
  }
}

/** A row of buttons inside the message (xDesign, RICH-01), drawn as the look's inline buttons. */
function Buttons({ block }: { block: RichBlock }) {
  const skin = useContext(SkinContext)
  const press = useContext(PressContext)
  if (!skin || !block.buttons) return null
  return (
    <div className="tg-rich-buttons">
      <Keyboard
        rows={[block.buttons]}
        icons={skin.icons}
        onPress={
          press &&
          ((_, button) => {
            press(block, button)
          })
        }
      />
    </div>
  )
}

/**
 * A bulleted or numbered list; an item holds any blocks, a nested list among them. A numbered
 * list writes its own markers ("1.") where the look draws them (SkinTokens.rich.marker: Web A,
 * 29 section 8.4, TGP-02).
 */
function List({ rich, block, media }: BlockProps) {
  const skin = useContext(SkinContext)
  const marked = block.ordered === true && Boolean(skin?.rich.marker)
  const start = block.first !== undefined && block.first > 1 ? block.first : 1
  const items = (block.blocks ?? []).map((item, index) => {
    const content =
      item.kind === 'item' ? (
        <Blocks rich={rich} blocks={item.blocks ?? []} media={media} />
      ) : (
        <Block rich={rich} block={item} media={media} />
      )
    return marked ? (
      <li key={index} className="tg-rich-item marked">
        <span className="tg-rich-marker">{`${String(start + index)}.`}</span>
        <div className="tg-rich-item-body">{content}</div>
      </li>
    ) : (
      <li key={index} className="tg-rich-item">
        {content}
      </li>
    )
  })
  if (!block.ordered) return <ul className="tg-rich-list">{items}</ul>
  return (
    <ol className={marked ? 'tg-rich-list marked' : 'tg-rich-list'} start={start > 1 ? start : undefined}>
      {items}
    </ol>
  )
}

/**
 * A table with its header cells; a table wider than the bubble scrolls sideways. Its outer
 * corners are round where the look rounds them (SkinTokens.rich.tableRadius: Web A).
 */
function Table({ rich, block }: Omit<BlockProps, 'media'>) {
  const skin = useContext(SkinContext)
  return (
    <div className="tg-rich-table-wrap">
      <table className={skin?.rich.tableRadius ? 'tg-rich-table round' : 'tg-rich-table'}>
        <tbody>
          {(block.blocks ?? []).map((row, r) => (
            <tr key={r}>
              {(row.blocks ?? []).map((cell, c) =>
                cell.header ? (
                  <th key={c}>
                    <OwnText rich={rich} block={cell} />
                  </th>
                ) : (
                  <td key={c}>
                    <OwnText rich={rich} block={cell} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A collapsible part: its title with a chevron, and its blocks while open (open at first when it was written so). */
function Details({ rich, block, media }: BlockProps) {
  const [open, setOpen] = useState(block.open === true)
  const skin = useContext(SkinContext)
  const blocks = block.blocks ?? []
  const first = blocks[0]
  const title = first?.kind === 'summary' ? first : undefined
  return (
    <div className={open ? 'tg-rich-details open' : 'tg-rich-details'}>
      <div
        className="tg-rich-summary"
        onClick={() => {
          setOpen(!open)
        }}
      >
        <span className="tg-rich-leaf tg-rich-summary-text">
          {title ? <OwnText rich={rich} block={title} /> : null}
        </span>
        <span className="tg-rich-chevron" />
      </div>
      {open ? (
        <div className="tg-rich-blocks tg-rich-details-body" data-gap={skin?.rich.gap ? '' : undefined}>
          <Blocks rich={rich} blocks={title ? blocks.slice(1) : blocks} media={media} />
        </div>
      ) : null}
    </div>
  )
}

/** A picture or video of the post's media, as wide as the text and as tall as it is (up to a limit). */
/** A picture or video between paragraphs, with the look's marks over a video (29 section 8.6). */
function Picture({ item }: { item: PreviewMedia }) {
  const skin = useContext(SkinContext)
  const ratio = item.width > 0 && item.height > 0 ? `${String(item.width)} / ${String(item.height)}` : undefined
  const video = item.kind === 'video' || item.kind === 'animation'
  return (
    <span className="tg-rich-picture">
      <img src={item.url} alt="" style={ratio ? { aspectRatio: ratio } : undefined} />
      {skin ? <MediaMarks media={item} skin={skin} /> : video ? <span className="tg-play" /> : null}
    </span>
  )
}

/**
 * A picture or video between paragraphs with its caption; one naming a position the post's
 * media do not have keeps only its caption, as the sender sends it.
 */
function Figure({ rich, block, media }: BlockProps) {
  const item = block.media !== undefined ? media[block.media - 1] : undefined
  const caption = hasOwnText(block) ? <OwnText rich={rich} block={block} /> : null
  if (!item) return caption ? <div className="tg-rich-leaf">{caption}</div> : null
  return (
    <figure className="tg-rich-figure">
      <Picture item={item} />
      {caption ? <figcaption className="tg-rich-leaf tg-rich-caption">{caption}</figcaption> : null}
    </figure>
  )
}

/** A source's map: a stand-in with a pin and the place, and its caption. */
function MapBlock({ rich, block }: Omit<BlockProps, 'media'>) {
  const point = block.map
  const ratio =
    point && point.width > 0 && point.height > 0 ? `${String(point.width)} / ${String(point.height)}` : undefined
  return (
    <figure className="tg-rich-figure">
      <span className="tg-rich-map" style={ratio ? { aspectRatio: ratio } : undefined}>
        <svg className="tg-rich-map-pin" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 2.5a7 7 0 0 0-7 7c0 5.1 7 12 7 12s7-6.9 7-12a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" />
        </svg>
        {point ? (
          <span className="tg-rich-map-place">{`${point.lat.toFixed(4)}, ${point.long.toFixed(4)}`}</span>
        ) : null}
      </span>
      {hasOwnText(block) ? (
        <figcaption className="tg-rich-leaf tg-rich-caption">
          <OwnText rich={rich} block={block} />
        </figcaption>
      ) : null}
    </figure>
  )
}

/** A source's collage (its pictures side by side) or slideshow (the first, with how many there are). */
function Gallery({ block, media }: { block: RichBlock; media: readonly PreviewMedia[] }) {
  const items = (block.blocks ?? []).flatMap((child) => {
    const item = child.kind === 'media' && child.media !== undefined ? media[child.media - 1] : undefined
    return item ? [item] : []
  })
  const first = items[0]
  if (!first) return null
  if (block.kind === 'slideshow') {
    return (
      <span className="tg-rich-slideshow">
        <Picture item={first} />
        {items.length > 1 ? <span className="tg-rich-count">{`1 / ${String(items.length)}`}</span> : null}
      </span>
    )
  }
  return (
    <span className="tg-rich-collage">
      {items.map((item, index) => (
        <img key={index} src={item.url} alt="" />
      ))}
    </span>
  )
}
