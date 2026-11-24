// The entity parts of the Telegram preview (docs/plan/10-frontend.md section 8.4). They
// render inside the preview's shadow root; their look comes from preview.css and the
// look's tokens, their icons from the look's art (SkinContext, 29 section 8.6). Only spoilers
// and expandable quotes react to clicks.
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { PremiumEmoji } from '../../lib/PremiumEmoji'
import { useNow } from '../../lib/useNow'
import { paragraphDirection } from './bidi'
import { absoluteDate, drawsDate, parseDateFormat, relativeDate } from './dates'
import { Emoji } from './emoji'
import type { SegmentNode } from './entities'
import { MarkedText } from './marks'
import type { PreviewMedia } from './model'
import { SkinContext } from './skinContext'
import type { SkinTokens } from './skins/tokens'
import { formatDuration } from './time'

/**
 * An icon of the look (SkinTokens.icons, 29 section 8.4): Telegram's art (a CSS image, handed
 * to the stylesheet as --tg-icon, so a look's rule may swap it) drawn as a mask in the current
 * color, or xWriter's own drawing (`children`, with the same class) when the look has none.
 */
export function ArtIcon({
  src,
  className,
  children,
}: {
  src: string | null | undefined
  className: string
  children: ReactNode
}): ReactNode {
  if (!src) return children
  return <span className={`tg-icon ${className}`} aria-hidden style={{ '--tg-icon': src } as CSSProperties} />
}

/**
 * The marks over a video or an animation: the round play button, and a video's duration in
 * its pill where the look draws one, or "GIF" on an animation (SkinTokens.duration, 29 section
 * 8.4, TGP-02).
 */
export function MediaMarks({ media, skin }: { media: PreviewMedia; skin: SkinTokens }): ReactNode {
  if (media.kind !== 'video' && media.kind !== 'animation') return null
  return (
    <>
      {skin.icons.play ? (
        <span className="tg-play art">
          <ArtIcon src={skin.icons.play} className="tg-play-icon">
            {null}
          </ArtIcon>
        </span>
      ) : (
        <span className="tg-play" />
      )}
      {skin.duration && media.kind === 'video' && media.durationSec !== undefined ? (
        <span className="tg-duration">{formatDuration(media.durationSec, skin.duration.pad)}</span>
      ) : skin.duration?.gif && media.kind === 'animation' ? (
        <span className="tg-duration">{skin.duration.gif}</span>
      ) : null}
    </>
  )
}

/** Renders a node tree. */
export function Segments({ nodes }: { nodes: readonly SegmentNode[] }): ReactNode {
  return nodes.map((node, i) => <Segment key={i} node={node} />)
}

function Segment({ node }: { node: SegmentNode }): ReactNode {
  switch (node.kind) {
    case 'text':
      return <MarkedText text={node.text} />
    case 'emoji':
      return <Emoji text={node.text} />
    case 'autolink':
      return (
        <a className="tg-link" data-link={node.link} title={node.href}>
          <MarkedText text={node.text} />
        </a>
      )
    case 'entity':
      break
  }
  const children = <Segments nodes={node.children} />
  const e = node.entity
  switch (e.type) {
    case 'bold':
      return <strong className="tg-bold">{children}</strong>
    case 'italic':
      return <em>{children}</em>
    case 'underline':
      return <u>{children}</u>
    case 'strike':
      return <s>{children}</s>
    case 'spoiler':
      return <Spoiler>{children}</Spoiler>
    case 'code':
      return <code className="tg-code">{children}</code>
    case 'pre':
      // Its length is the code's (the look may size a long block apart); offset 0: it opens the text.
      return (
        <Pre language={e.language} length={e.length} first={e.offset === 0}>
          {children}
        </Pre>
      )
    case 'text_link':
      return (
        <a className="tg-link" data-link="text" title={e.url}>
          {children}
        </a>
      )
    case 'blockquote':
      return (
        <Blockquote collapsed={e.collapsed === true} first={e.offset === 0} text={plainText(node.children)}>
          {children}
        </Blockquote>
      )
    case 'custom_emoji':
      // The real premium emoji (16 section 10.4); the normal emoji, underlined, while the
      // library does not know it yet.
      return (
        <PremiumEmoji
          id={e.custom_emoji_id ?? ''}
          alt={plainText(node.children)}
          className="tg-premium-emoji"
          fallback={
            <span className="tg-custom-emoji" title="Premium emoji">
              {children}
            </span>
          }
        />
      )
    case 'formatted_date':
      return (
        <FormattedDate unix={e.unix_time ?? 0} format={e.date_format ?? ''} text={plainText(node.children)}>
          {children}
        </FormattedDate>
      )
  }
}

/** The text of a node tree, without its formatting. */
function plainText(nodes: readonly SegmentNode[]): string {
  return nodes.map((node) => (node.kind === 'entity' ? plainText(node.children) : node.text)).join('')
}

/**
 * A formatted date (docs/plan/19-x-proxies-server-media.md section 7.3) as the apps draw
 * it, in the viewer's language and time zone: a relative time that counts by itself, or
 * the day of the week, the time and the date; one without a format shows its text, as a
 * link. Its text, which apps that cannot draw dates show, is the tooltip.
 */
function FormattedDate({
  unix,
  format,
  text,
  children,
}: {
  unix: number
  format: string
  text: string
  children: ReactNode
}) {
  const flags = parseDateFormat(format)
  const relative = flags?.relative === true
  // A relative date counts every second, like the apps; the others only need the year.
  const now = useNow(relative ? 1000 : 60_000)
  if (!flags || !drawsDate(flags)) {
    return (
      <a className="tg-link tg-date" title={text}>
        {children}
      </a>
    )
  }
  return (
    <span className="tg-link tg-date" title={text}>
      {relative ? relativeDate(unix, now) : absoluteDate(unix, flags, now)}
    </span>
  )
}

/** Hidden text under animated dots until clicked, like Telegram's spoilers. */
function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <span
      className={shown ? 'tg-spoiler shown' : 'tg-spoiler'}
      onClick={() => {
        setShown(!shown)
      }}
    >
      {children}
    </span>
  )
}

/**
 * A code block, with its language in a header when it has one, as the look writes it; a look may
 * label a block without one ("copy") and draw a copy mark at the header's end (SkinTokens.code,
 * 29 section 8.6). A look may also size a block by its code's length, draw a bar that copies a
 * long one and space a block that opens the text apart (Android, 29 section 8.4, TGP-02). TXT-01's
 * editor draws its code blocks with it too, so editing keeps the bubble's look.
 */
export function Pre({
  language,
  length,
  first,
  children,
}: {
  language: string | undefined
  length: number
  first: boolean
  children: ReactNode
}) {
  const skin = useContext(SkinContext)
  const code = skin?.code
  let label: string | null | undefined = code?.noLanguage
  if (language) label = (code ? code.language(language) : language) ?? code?.noLanguage
  const copy = code?.copyMark ? (
    <ArtIcon src={skin?.icons.codeCopy} className="tg-pre-copy">
      <CopyIcon className="tg-pre-copy" />
    </ArtIcon>
  ) : null
  // The look's sizes for code of this length, over its tokens' custom properties.
  const sizes = code?.sizes ? code.sizes(length) : null
  const style = sizes
    ? ({
        '--tg-code-block-size': `${String(sizes.fontSize)}px`,
        '--tg-code-header-size': `${String(sizes.headerSize)}px`,
        '--tg-code-header-height': sizes.headerHeight === null ? 'auto' : `${String(sizes.headerHeight)}px`,
      } as CSSProperties)
    : undefined
  const bar = code?.copyBar && length >= code.copyBar.minLength ? code.copyBar : null
  return (
    <span className={first && code?.first ? 'tg-pre first' : 'tg-pre'} style={style}>
      {label || copy ? (
        <span className="tg-pre-header">
          {label ? <span className="tg-pre-label">{label}</span> : null}
          {copy}
        </span>
      ) : null}
      <code className="tg-pre-body">{children}</code>
      {bar ? (
        <span className="tg-pre-copy-bar">
          <ArtIcon src={skin?.icons.codeCopy} className="tg-pre-copy-bar-icon">
            <CopyIcon className="tg-pre-copy-bar-icon" />
          </ArtIcon>
          {bar.label}
        </span>
      ) : null}
    </span>
  )
}

/**
 * Measures a quote's body where the look's rules need its drawn size (29 section 8.4, TGP-02):
 * whether its text is longer than `foldLines` lines (SkinTokens.quote.foldLong) and whether the
 * quote with its padding is wider than `wideAt` of the text's column (quote.wideAt). It measures
 * when the body or the column changes size and when the text changes; without either rule, or
 * where the browser cannot observe sizes, the quote is long and not wide.
 */
function useQuoteSize(
  text: string,
  foldLines: number | null,
  wideAt: number | null,
): [{ long: boolean; wide: boolean }, RefObject<HTMLSpanElement | null>] {
  const [size, setSize] = useState({ long: true, wide: false })
  const body = useRef<HTMLSpanElement | null>(null)
  const measure = useCallback(() => {
    const element = body.current
    if (!element) return
    let long = true
    if (foldLines !== null) {
      // Whole lines: more than the folded part's (Android folds 3.97 lines, so four are long).
      const line = parseFloat(getComputedStyle(element).lineHeight)
      long = !(line > 0) || Math.round(element.scrollHeight / line) > Math.floor(foldLines + 0.001)
    }
    let wide = false
    const quote = element.parentElement
    const column = quote?.closest('.tg-text')
    if (wideAt !== null && quote && column) {
      // The text's widest line (a range over it), and the quote's padding: its own width.
      const range = document.createRange()
      range.selectNodeContents(element)
      const pad = getComputedStyle(quote)
      const own = range.getBoundingClientRect().width + parseFloat(pad.paddingLeft) + parseFloat(pad.paddingRight)
      const room = getComputedStyle(column)
      wide = own > wideAt * (column.clientWidth - parseFloat(room.paddingLeft) - parseFloat(room.paddingRight))
    }
    setSize((previous) => (previous.long === long && previous.wide === wide ? previous : { long, wide }))
  }, [foldLines, wideAt])
  // A new observer for a new text: it reports the sizes as soon as it starts.
  useLayoutEffect(() => {
    const element = body.current
    if (!element || (foldLines === null && wideAt === null) || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const column = element.closest('.tg-text')
    if (wideAt !== null && column) observer.observe(column)
    return () => {
      observer.disconnect()
    }
  }, [measure, text, foldLines, wideAt])
  return [size, body]
}

/**
 * A quote; an expandable one shows its first lines until clicked. Its mark and arrow are the
 * look's art where it has some. The look decides whether a short expandable quote folds at all,
 * which way a quote faces (the message's way, its own text's or always left to right), when it
 * takes the whole column and how one that opens the text is spaced (SkinTokens.quote, 29 section
 * 8.4, TGP-02). TXT-01's editor draws its quotes with it too, `held` open, so a click places the
 * caret instead of folding the quote.
 */
export function Blockquote({
  collapsed,
  first,
  text,
  held = false,
  children,
}: {
  collapsed: boolean
  first: boolean
  text: string
  held?: boolean
  children: ReactNode
}) {
  const [opened, setOpen] = useState(false)
  const open = held || opened
  const skin = useContext(SkinContext)
  const quote = skin?.quote
  const [size, body] = useQuoteSize(
    text,
    collapsed && quote?.foldLong ? quote.collapsedLines : null,
    quote?.wideAt ?? null,
  )
  // A short expandable quote is a plain one where the look folds only long ones.
  const expandable = collapsed && size.long
  const folded = expandable && !open
  let className = folded ? 'tg-quote folded' : expandable ? 'tg-quote expandable' : 'tg-quote'
  if (first && quote?.first) className += ' first'
  // The side of its bar where the look does not take the message's (preview.css mirrors data-dir rtl).
  let dir: 'rtl' | 'ltr' | undefined
  if (quote?.direction === 'ltr') dir = 'ltr'
  else if (quote?.direction === 'own') dir = paragraphDirection(text) ?? 'ltr'
  return (
    <span
      className={className}
      data-dir={dir}
      data-wide={size.wide ? '' : undefined}
      onClick={
        expandable && !held
          ? () => {
              setOpen(!open)
            }
          : undefined
      }
    >
      <span className="tg-quote-body" ref={body}>
        {children}
      </span>
      <ArtIcon src={skin?.icons.quote} className="tg-quote-icon">
        <QuoteIcon />
      </ArtIcon>
      {expandable ? (
        <ArtIcon src={skin?.icons.quoteExpand} className={open ? 'tg-quote-expand open' : 'tg-quote-expand'}>
          <span className={open ? 'tg-quote-chevron up' : 'tg-quote-chevron'} />
        </ArtIcon>
      ) : null}
    </span>
  )
}

function QuoteIcon() {
  return (
    <svg className="tg-quote-icon" viewBox="0 0 16 16" aria-hidden>
      <path d="M3.5 4.5h3.2l-1.4 4.2H7v3H3.5v-3l1.1-4.2zm5.6 0h3.2l-1.4 4.2h1.7v3H9.1v-3l1.1-4.2z" />
    </svg>
  )
}

/** Two sheets: the mark of a copy button and of a code block's copy button. */
export function CopyIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" aria-hidden>
      <rect x="1.5" y="4.5" width="6" height="6" rx="1.2" />
      <path d="M4.5 4.5V2.7c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2v3.6c0 .7-.5 1.2-1.2 1.2H7.5" />
    </svg>
  )
}

/** The eye of the view counter: the look's art (SkinIcons.views), else xWriter's. */
export function EyeIcon({ className, src }: { className: string; src?: string | null | undefined }) {
  return (
    <ArtIcon src={src} className={`tg-eye ${className}`}>
      <svg className={`tg-eye ${className}`} viewBox="0 0 24 24" aria-hidden>
        <path d="M12 5.5c-4.6 0-8.4 3-9.8 6.5 1.4 3.5 5.2 6.5 9.8 6.5s8.4-3 9.8-6.5C20.4 8.5 16.6 5.5 12 5.5zm0 10.8a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6zm0-6.8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
      </svg>
    </ArtIcon>
  )
}
