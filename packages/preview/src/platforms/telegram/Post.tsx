import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PreviewOptions, PreviewTheme } from '../../core/types'
import { Album } from './Album'
import { infoRowOwnLine, paragraphDirection } from './bidi'
import { Emoji } from './emoji'
import { buildSegments, emojiOnly } from './entities'
import { Keyboard } from './Keyboard'
import { albumWidth, keyboardRows } from './layout'
import { MarksContext } from './marksContext'
import { Meta, MetaSpacer } from './Meta'
import { avatarBackground, peerColor, peerColorIndex } from './peerColors'
import type { PreviewWebPage, TgPreviewPost } from './model'
import { ArtIcon, MediaMarks, Segments } from './parts'
import { Poll } from './Poll'
import { wideRich } from './richBlocks'
import { RichContent } from './RichContent'
import { SkinContext } from './skinContext'
import { skins } from './skins'
import { type EmojiCount, peerProperties, type SkinId, type SkinTokens } from './skins/tokens'
import { drawn, type MessageSlots, pressProps } from './slots'
import { formatTime } from './time'

const px = (n: number) => `${String(n)}px`

/** A dice counts as one emoji on one line. */
const diceEmoji: EmojiCount = { count: 1, lines: 1, perLine: 1 }

/** xWriter's own icons where a look has no art (SkinTokens.icons): the top bar's back arrow and menu. */
function BackIcon() {
  return (
    <svg className="tg-header-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M15.4 4.6 8 12l7.4 7.4 1.4-1.4-6-6 6-6z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg className="tg-header-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
    </svg>
  )
}

/** The comments bar's icon and arrow where a look has no art. */
function CommentsIcon() {
  return (
    <svg className="tg-comments-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4c-5 0-9 3.4-9 7.5 0 2.3 1.2 4.3 3.1 5.7l-.6 3.3 3.6-2c.9.2 1.9.3 2.9.3 5 0 9-3.4 9-7.5S17 4 12 4z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg className="tg-comments-arrow" viewBox="0 0 24 24" aria-hidden>
      <path d="M9.4 6 8 7.4l4.6 4.6L8 16.6 9.4 18l6-6z" />
    </svg>
  )
}

/**
 * The chat's top bar (10 section 8.9, 29 section 8.6): the back button, the avatar, the
 * channel's name over "N subscribers" and the menu button, each a part of its own, so a
 * look's stylesheet draws its app's bar: one across the top (Desktop), a floating pill (Web A,
 * Web K) or separate pieces (Android, iOS). .tg-header-main holds the avatar and the text and
 * groups them only where a look draws them as one piece. The avatar's letters are the look's
 * (SkinTokens.header.initials, TGP-02). A private chat (PRV-02) gives its own status under the
 * name ("bot", or what the bot is doing, in the look's typing color with `typing`).
 */
export function ChatHeader({
  channel,
  skin,
  avatar,
  status,
  typing = false,
}: {
  channel: TgPreviewPost['channel']
  skin: SkinTokens
  avatar: string
  status?: ReactNode
  typing?: boolean
}) {
  const initial = skin.header.initials(channel.title)
  return (
    <div className="tg-header">
      {skin.header.back ? (
        <span className="tg-header-button back">
          <ArtIcon src={skin.icons.back} className="tg-header-icon">
            <BackIcon />
          </ArtIcon>
        </span>
      ) : null}
      <span className="tg-header-main">
        <span className="tg-header-avatar" style={{ background: avatar }}>
          {channel.avatarUrl ? <img src={channel.avatarUrl} alt="" /> : initial}
        </span>
        <span className="tg-header-text">
          <span className="tg-header-title">{channel.title}</span>
          <span className={typing ? 'tg-header-sub typing' : 'tg-header-sub'}>
            {status ?? skin.header.subscribers(channel.subscribers)}
          </span>
        </span>
      </span>
      {skin.header.menu ? (
        <span className="tg-header-button menu">
          <ArtIcon src={skin.icons.menu} className="tg-header-icon">
            <MenuIcon />
          </ArtIcon>
        </span>
      ) : null}
    </div>
  )
}

/**
 * The link preview: its site name, title and description, and its picture; `end` (the info
 * row's room, where the look keeps the row in the preview's last line: Desktop,
 * SkinTokens.webpage.metaInside, TGP-02) closes its last line of text. It is marked data-dir
 * rtl when its title and description start right to left, the direction Web A gives the box
 * (dir="auto", which skips the site name's own dir, WebPage.tsx:219-223, SafeLink.tsx:90); only
 * Web A's stylesheet reads the mark (RVW-29c).
 */
function LinkPreview({ page, end }: { page: PreviewWebPage; end?: ReactNode }) {
  const small = page.photo !== undefined && page.largePhoto !== true
  const last = page.description ? 'desc' : page.title ? 'title' : page.siteName ? 'site' : null
  const rtl = paragraphDirection(`${page.title ?? ''}\n${page.description ?? ''}`) === 'rtl'
  return (
    <span className={small ? 'tg-webpage with-thumb' : 'tg-webpage'} data-dir={rtl ? 'rtl' : undefined}>
      <span className="tg-webpage-text">
        {page.siteName ? (
          <span className="tg-webpage-site">
            {page.siteName}
            {last === 'site' ? end : null}
          </span>
        ) : null}
        {page.title ? (
          <span className="tg-webpage-title">
            {page.title}
            {last === 'title' ? end : null}
          </span>
        ) : null}
        {page.description ? (
          <span className="tg-webpage-desc">
            {page.description}
            {last === 'desc' ? end : null}
          </span>
        ) : null}
        {last === null ? end : null}
      </span>
      {page.photo ? (
        <img className={small ? 'tg-webpage-thumb' : 'tg-webpage-photo'} src={page.photo.url} alt="" />
      ) : null}
    </span>
  )
}

function ShareIcon() {
  return (
    <svg className="tg-share-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M13.5 5.8v3.4C7.4 9.6 4.6 13.5 4 18.5c1.9-2.8 4.8-4.2 9.5-4.2v3.5L20 11.6z" />
    </svg>
  )
}

/**
 * The color of a picture's bottom-left pixel, read on a 1 x 1 canvas once the picture has loaded
 * (Web A's tail under a photo, SkinTokens.media.sampleTail; 29 section 8.4, TGP-02): undefined
 * until then, and on any error or a canvas the browser marks as tainted, so the tail keeps the
 * bubble's color and nothing waits for it. An alpha of 0 makes the tail clear, as in Web A.
 */
function usePictureCorner(url: string | undefined): string | undefined {
  const [sample, setSample] = useState<{ url: string; color: string } | null>(null)
  useEffect(() => {
    if (url === undefined) return
    let current = true
    const image = new Image()
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context || !current) return
        context.drawImage(image, 0, image.naturalHeight - 1, 1, 1, 0, 0, 1, 1)
        const [r = 0, g = 0, b = 0, a = 0] = Array.from(context.getImageData(0, 0, 1, 1).data)
        setSample({ url, color: `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${a > 0 ? '1' : '0'})` })
      } catch {
        // A canvas the browser marks as tainted: the tail keeps the bubble's color.
      }
    }
    image.src = url
    return () => {
      current = false
      image.onload = null
    }
  }, [url])
  return sample !== null && sample.url === url ? sample.color : undefined
}

/**
 * The height under the bubble in the message's column (its buttons, and the reactions under the
 * bubble), measured after layout and again when it changes, while `on` (29 section 8.6, TGP-02);
 * null while not measured, where the buttons' fixed rows give it. The first measure runs before
 * the first paint, so the share button does not jump once the observer reports (RVW-29c).
 */
function useHeightBelow(message: { readonly current: HTMLDivElement | null }, on: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null)
  useLayoutEffect(() => {
    const column = message.current
    if (!on || !column || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const bubble = column.firstElementChild
      if (bubble instanceof HTMLElement) setHeight(column.offsetHeight - bubble.offsetHeight)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(column)
    if (column.firstElementChild) observer.observe(column.firstElementChild)
    return () => {
      observer.disconnect()
    }
  }, [message, on])
  return on ? height : null
}

/**
 * A Telegram channel post in one look and theme (10 section 8.2): the chat header, then
 * the bubble with the in-bubble title (Desktop), the media or album, the text with the
 * info row floating at the end of its last line, the link preview, reactions and the
 * comments bar; and a bot's inline keyboard under the bubble (19 section 7.9), which takes
 * away the bubble's tail (except in Web K) and rounds its bottom corners less. A rich post
 * (28 section 14.5, RCH-04b) shows its blocks in place of the media and the text, its media
 * inside them, and the info row on a line of its own under them. A message of emoji only is
 * drawn big without a bubble where the app does.
 *
 * The chat carries data-skin and data-theme, which scope each look's own stylesheet
 * (skins/<look>.css), and the channel's color (peerProperties), which takes the place of the
 * look's colors in the parts the look tints with it (29 section 8.6, TGP-02). Around the text
 * each look places the info row, the reactions and the share button its app's way (TGP-02).
 */
export function TelegramPost({
  post,
  skin: skinId,
  theme,
  options,
  width,
  slots,
}: {
  post: TgPreviewPost
  skin: string
  theme: PreviewTheme
  options: PreviewOptions
  width?: number | undefined
  slots?: MessageSlots | undefined
}) {
  const skin = skins[skinId as SkinId]
  const peer = peerColor(skin.peer.palette, peerColorIndex(post.channel))
  const chatStyle = useMemo(() => peerProperties(skin, theme, peer) as CSSProperties, [skin, theme, peer])
  // A bot's message in a private chat has no top bar (PRV-01).
  const bot = post.bot === true
  return (
    <MarksContext.Provider value={options.marks}>
      <SkinContext.Provider value={skin}>
        <div className="tg-chat" dir="ltr" data-skin={skin.id} data-theme={theme} style={chatStyle}>
          {bot ? null : <ChatHeader channel={post.channel} skin={skin} avatar={avatarBackground(peer, theme)} />}
          {skin.header.fade > 0 && !bot ? <div className="tg-header-fade" /> : null}
          <div className="tg-list">
            <PostRow post={post} skin={skin} options={options} width={width} slots={slots} />
          </div>
        </div>
      </SkinContext.Provider>
    </MarksContext.Provider>
  )
}

/**
 * The row of one post in the chat's list: the bubble, its keyboard and reactions, and the share
 * button; TelegramPost draws one under the top bar, the private chat (Chat.tsx, PRV-02) a row per
 * bot message. `tail` false leaves out the tail of a message that another of the same sender's
 * follows, as the apps draw it only under the last of a group; the slots draw the text (also
 * where there is none yet), the media and the inline keyboard in place of the read-only ones
 * (slots.ts, M4), and a message with a text slot is never drawn as big emoji. `onButton` makes
 * the inline buttons act (Try it), `onInside` a rich message's buttons inside (by the button row's
 * number among its button rows). A poll or quiz takes the widest bubble with its question as the
 * text (Poll.tsx, `onVote` votes); a dice is its emoji drawn big without a bubble; paid media is
 * blurred under its price button until bought (`onUnlock` presses it) (MSG-03). An invoice is its
 * title and description, then its photo with the price over it, or the price on its own line
 * (PAY-02). A gift is its card in the middle of the chat (GiftRow, EVT-02).
 */
export function PostRow(props: PostRowProps) {
  return props.post.gift ? (
    <GiftRow post={props.post} gift={props.post.gift} skin={props.skin} slots={props.slots} />
  ) : (
    <MessageRow {...props} />
  )
}

interface PostRowProps {
  post: TgPreviewPost
  skin: SkinTokens
  options: PreviewOptions
  width?: number | undefined
  tail?: boolean
  slots?: MessageSlots | undefined
  onButton?: ((line: number, button: number) => void) | undefined
  onInside?: ((line: number, button: number) => void) | undefined
  onVote?: ((options: number[]) => void) | undefined
  onUnlock?: (() => void) | undefined
}

/**
 * A gift the bot sent (sendGift, EVT-02): Telegram draws no bubble but a card in the middle of the
 * chat with the gift's picture (the design names the gift in words: a gift emoji with them under
 * it), "Gift from <bot>", the gift's text (the text slot draws it, also where there is none yet)
 * and the button "View" (calibrate: O-02).
 */
function GiftRow({
  post,
  gift,
  skin,
  slots,
}: {
  post: TgPreviewPost
  gift: { description: string }
  skin: SkinTokens
  slots?: MessageSlots | undefined
}) {
  const segments = useMemo(() => buildSegments(post.text, post.entities), [post.text, post.entities])
  const shownText = post.text.length > 0 ? <Segments nodes={segments} /> : null
  const textNode = slots?.text ? slots.text(shownText) : shownText
  const { events } = skin
  return (
    <div className="tg-gift-row">
      <div className="tg-gift">
        <span className="tg-gift-picture" aria-hidden>
          🎁
        </span>
        {gift.description === '' ? null : (
          <span className="tg-gift-about" dir="auto">
            {gift.description}
          </span>
        )}
        <span className="tg-gift-title" dir="auto">
          {events.gift.title(post.channel.title)}
        </span>
        {drawn(textNode) ? (
          <div className="tg-gift-text" dir="auto">
            {textNode}
          </div>
        ) : null}
        <span className="tg-gift-button">{events.gift.button}</span>
      </div>
    </div>
  )
}

function MessageRow({
  post,
  skin,
  options,
  width,
  tail: withTail = true,
  slots,
  onButton,
  onInside,
  onVote,
  onUnlock,
}: PostRowProps) {
  const frameWidth = width ?? skin.frameWidth
  // A rich post is one message with its media inside (28 section 14.5, RCH-04b): its blocks
  // take the place of the media and the text, right to left when the message is.
  const rich = post.rich
  // A code block may widen the bubble past its widest (Desktop: SkinTokens.code.wideBubble).
  const wideBubble = !rich && post.entities.some((e) => e.type === 'pre') ? skin.code.wideBubble : null
  const bubbleMax = Math.max(skin.bubbleMaxWidth(frameWidth), wideBubble ? wideBubble(frameWidth) : 0)
  const segments = useMemo(() => buildSegments(post.text, post.entities), [post.text, post.entities])
  const metaOwnLine = useMemo(
    () => infoRowOwnLine(post.text, post.entities, skin.meta.rtl),
    [post.text, post.entities, skin.meta.rtl],
  )
  // Web A: a message that starts right to left floats its info row left and mirrors its quotes.
  const mirrored = useMemo(
    () => skin.meta.rtl === 'float' && (rich ? rich.rtl : paragraphDirection(post.text) === 'rtl'),
    [post.text, rich, skin.meta.rtl],
  )
  // Web K: the text takes the message's own direction, so a quote in a message that starts right
  // to left sits on the right (SkinTokens.messageDir, TGP-02).
  const textDir = useMemo(
    () => (skin.messageDir && paragraphDirection(post.text) === 'rtl' ? 'rtl' : undefined),
    [post.text, skin.messageDir],
  )
  const ratios = useMemo(
    () => post.media.map((m) => (m.width > 0 && m.height > 0 ? m.width / m.height : 1)),
    [post.media],
  )
  const album = useMemo(
    () =>
      !rich && ratios.length > 1
        ? skin.album.layout(ratios, {
            maxWidth: albumWidth(skin, bubbleMax, frameWidth),
            frameWidth,
            gap: skin.album.gap,
          })
        : undefined,
    [rich, ratios, skin, bubbleMax, frameWidth],
  )
  const time = formatTime(post.date, skin, options, post.timeZone)
  // A bot's message in a private chat has no top bar, no name in the bubble and no share button (PRV-01).
  const bot = post.bot === true
  const shareButton = bot ? null : skin.shareButton
  // The text, or what the text slot draws in its place (PRV-02).
  const shownText = post.text.length > 0 ? <Segments nodes={segments} /> : null
  const textNode = slots?.text ? slots.text(shownText) : shownText
  const hasText = drawn(textNode)
  const rows = keyboardRows(post.keyboard)
  const keyboard = rows.length > 0 ? rows : undefined
  const shownKeyboard = keyboard ? <Keyboard rows={keyboard} icons={skin.icons} onPress={onButton} /> : null
  const keyboardNode = slots?.keyboard ? slots.keyboard(shownKeyboard) : shownKeyboard
  const hasKeyboard = drawn(keyboardNode)
  const comments = post.comments && options.comments ? post.comments : null
  // A message of emoji only, without media, a link preview or buttons, by the look's rule (29 section
  // 8.4); a dice always, at its own size (MSG-03).
  const emoji =
    post.dice === true
      ? diceEmoji
      : skin.bigEmoji && !slots?.text && !rich && post.media.length === 0 && !post.linkPreview && !keyboard
        ? emojiOnly(segments, skin.bigEmoji.rule)
        : undefined
  let bigSize = emoji && skin.bigEmoji ? skin.bigEmoji.size(emoji) : null
  if (post.dice === true) bigSize = skin.dice.size
  const poll = post.poll
  const invoice = post.invoice
  const single = !rich && post.media.length === 1 ? post.media[0] : undefined
  // The info row's texts as the look writes them, for a photo as wide as its info row (Android).
  const views = options.views ? skin.meta.views(post.views) : undefined
  const signature = post.signature ? post.signature.slice(0, 16) : undefined
  const box = single
    ? skin.media.box(single, {
        skin,
        bubbleMax,
        frameWidth,
        caption: post.text,
        comments: comments !== null,
        info: { views, time: signature === undefined ? time : `${signature}, ${time}` },
      })
    : undefined
  // A rich message with a table, a picture or a map takes the widest bubble; another is as wide as
  // its text, and a bubble of media as its media and their insets (SkinTokens.album.inset, TGP-02).
  const wide = rich ? wideRich(rich.blocks, post.media.length) : false
  let bubbleWidth: number | undefined
  if (wide || poll) bubbleWidth = bubbleMax
  else if (box) bubbleWidth = box.width + 2 * skin.media.inset
  else if (album) bubbleWidth = album.width + 2 * skin.album.inset
  const widthStyle = bubbleWidth ? { width: px(bubbleWidth) } : undefined
  const pills =
    post.reactions && options.reactions
      ? post.reactions.map((r) => (
          <span key={r.emoji} className="tg-reaction">
            <Emoji text={r.emoji} />
            {r.count > 0 ? skin.reactions.count(r.count) : null}
          </span>
        ))
      : null
  // Under media without a caption (and under big emoji) the reactions sit under the bubble, over
  // the wallpaper; or under the media inside the bubble (Android), where the info row leaves the
  // picture for them (SkinTokens.reactions.outside, TGP-02).
  const reactionsOutside =
    pills && (bigSize !== null || (!hasText && !rich && skin.reactions.outside)) ? (
      <div className="tg-reactions outside">{pills}</div>
    ) : null
  const reactionsUnderMedia = pills !== null && reactionsOutside === null && !hasText && !rich
  // The bubble ends with media when it has no caption, no comments bar and no reactions under the media.
  const endsWithMedia =
    (single !== undefined || album !== undefined) && !hasText && comments === null && !reactionsUnderMedia
  // A keyboard takes the tail (not in Web K), media at the bubble's end does in Desktop and
  // Android, and reactions under the bubble do in iOS, which merges the bubble's bottom with them.
  const tail =
    withTail &&
    skin.tail &&
    bigSize === null &&
    (!keyboard || skin.tail.aboveKeyboard) &&
    (!endsWithMedia || skin.tail.underMedia) &&
    (reactionsOutside === null || skin.reactions.outsideTail)
      ? skin.tail
      : null
  // Web A: the tail under a photo without a caption, comments or reactions takes the picture's
  // bottom-left color (SkinTokens.media.sampleTail, TGP-02).
  const tailFill = usePictureCorner(
    tail && skin.media.sampleTail && single?.kind === 'photo' && endsWithMedia && pills === null
      ? single.url
      : undefined,
  )
  // The share button stays level with the bubble, above the keyboard and the reactions under the
  // bubble, whose height is measured where the keyboard's fixed rows do not give it (TGP-02).
  const keyboardHeight = keyboard
    ? keyboard.length * skin.keyboard.height + (keyboard.length - 1) * skin.keyboard.rowGap + skin.keyboard.top
    : 0
  const messageRef = useRef<HTMLDivElement>(null)
  const below = useHeightBelow(messageRef, reactionsOutside !== null || (keyboard !== undefined && skin.keyboard.wrap))
  const shareBottom = shareButton ? (below ?? keyboardHeight) + shareButton.bottom : 0
  const meta = (overlay: boolean, big = false) => (
    <Meta
      views={post.views}
      time={time}
      signature={post.signature}
      skin={skin}
      options={options}
      overlay={overlay}
      left={!overlay && mirrored}
      big={big}
    />
  )
  const spacer = (ownLine: boolean) => (
    <MetaSpacer
      views={post.views}
      time={time}
      signature={post.signature}
      skin={skin}
      options={options}
      ownLine={ownLine}
      left={mirrored}
    />
  )
  // The info row's room: at the end of the reactions' last row where the look moves it there
  // (SkinTokens.reactions.meta), in a link preview's last line where the look keeps it there
  // (Desktop, SkinTokens.webpage.metaInside), else at the end of the text (TGP-02).
  const metaInReactions = pills !== null && reactionsOutside === null && skin.reactions.meta !== null
  const page = !rich && post.linkPreview && post.media.length === 0 ? post.linkPreview : undefined
  const metaInPage =
    page !== undefined &&
    !metaInReactions &&
    skin.webpage.metaInside &&
    !post.invertMedia &&
    (page.photo === undefined || page.largePhoto !== true)
  const webpage = page ? <LinkPreview page={page} end={metaInPage ? spacer(metaOwnLine) : undefined} /> : null
  const reactions = pills ? (
    <div className="tg-reactions">
      {pills}
      {metaInReactions ? spacer(false) : null}
    </div>
  ) : null
  // The classes are joined here: Prettier's class sorting trims the spaces of strings in a className.
  let bubbleClass = 'tg-bubble'
  if (tail) bubbleClass += ' has-tail'
  if (keyboard) bubbleClass += ' with-keyboard'
  let textClass = mirrored ? 'tg-text rtl' : 'tg-text'
  if (reactions !== null || comments !== null) textClass += ' before-footer'
  // Without a caption the info row's pill sits over the media, unless it moved under them.
  const mediaMeta = !hasText && !reactionsUnderMedia
  // An invoice's price with the look's word after it, over its photo or on its own line (PAY-02).
  const price = invoice ? (
    <>
      <Segments nodes={buildSegments(invoice.price, [])} />
      {skin.invoice.label === '' ? null : <span className="tg-invoice-label">{skin.invoice.label}</span>}
    </>
  ) : null
  // Paid media not bought yet: the price button over the blurred media.
  const paid = post.paid?.locked ? (
    <span className="tg-paid">
      <span className="tg-paid-button" {...pressProps(onUnlock)}>
        <Segments nodes={buildSegments(skin.paid.label(post.paid.stars), [])} />
      </span>
    </span>
  ) : null
  const shownMedia =
    single && box ? (
      <div className={hasText ? 'tg-media' : 'tg-media alone'} style={{ width: px(box.width), height: px(box.height) }}>
        {box.blur ? (
          <>
            <img className="tg-media-fill" src={single.url} alt="" />
            <span className="tg-media-shade" />
          </>
        ) : null}
        <img
          className="tg-media-image"
          src={single.url}
          alt=""
          style={{ width: px(box.imageWidth), height: px(box.imageHeight) }}
        />
        <MediaMarks media={single} skin={skin} />
        {paid}
        {price ? <span className="tg-invoice-pill">{price}</span> : null}
        {mediaMeta ? meta(true) : null}
      </div>
    ) : album !== undefined ? (
      <Album
        media={post.media}
        layout={album}
        skin={skin}
        withText={hasText}
        meta={mediaMeta ? meta(true) : undefined}
        overlay={paid}
      />
    ) : null
  const mediaNode = slots?.media ? slots.media(shownMedia) : shownMedia
  const bubble =
    bigSize !== null ? (
      <div
        className={emoji?.count === 1 && skin.bigEmoji?.single ? 'tg-big-emoji single' : 'tg-big-emoji'}
        style={{ '--tg-big-emoji-size': px(bigSize) } as CSSProperties}
      >
        <div className="tg-big-emoji-text">
          <Segments nodes={segments} />
        </div>
        {meta(true, true)}
      </div>
    ) : (
      <div
        className={comments ? 'tg-bubble-wrap with-comments' : 'tg-bubble-wrap'}
        style={hasKeyboard || reactionsOutside ? undefined : widthStyle}
      >
        {tail ? (
          <svg className="tg-tail" viewBox={tail.viewBox} preserveAspectRatio="none" aria-hidden>
            <path d={tail.path} style={tailFill ? { fill: tailFill } : undefined} />
          </svg>
        ) : null}
        <div className={bubbleClass} data-media={post.media.length > 0} data-paid={paid ? 'locked' : undefined}>
          {skin.title.show && !bot ? (
            <div className={single || album ? 'tg-title before-media' : 'tg-title'}>{post.channel.title}</div>
          ) : null}
          {invoice ? null : mediaNode}
          {webpage && post.invertMedia ? <div className="tg-webpage-wrap above">{webpage}</div> : null}
          {invoice ? (
            <>
              <div className="tg-body">
                <div className="tg-invoice">
                  <div className="tg-invoice-title" dir="auto">
                    <Segments nodes={buildSegments(invoice.title, [])} />
                  </div>
                  {invoice.description === '' ? null : (
                    <div className="tg-invoice-text" dir="auto">
                      <Segments nodes={buildSegments(invoice.description, [])} />
                    </div>
                  )}
                  {single ? null : (
                    <div className="tg-invoice-price">
                      {price}
                      {spacer(false)}
                    </div>
                  )}
                </div>
                {single ? null : meta(false)}
              </div>
              {single ? mediaNode : null}
            </>
          ) : poll ? (
            <div className="tg-body">
              <Poll poll={poll} question={textNode} labels={skin.poll.labels} option={slots?.option} onVote={onVote} />
              {reactions}
              {meta(false)}
            </div>
          ) : rich ? (
            <div className="tg-body">
              <div className="tg-rich" dir={rich.rtl ? 'rtl' : 'ltr'}>
                <RichContent rich={rich} media={post.media} onButton={onInside} />
                {metaInReactions ? null : spacer(true)}
              </div>
              {reactions}
              {meta(false)}
            </div>
          ) : hasText ? (
            <div className="tg-body">
              <div className={textClass} dir={textDir}>
                {textNode}
                {webpage && !post.invertMedia ? webpage : null}
                {metaInReactions || metaInPage ? null : spacer(metaOwnLine)}
              </div>
              {reactions}
              {meta(false)}
            </div>
          ) : reactionsUnderMedia ? (
            <div className="tg-body">
              {reactions}
              {meta(false)}
            </div>
          ) : null}
          {comments ? (
            <div className="tg-comments">
              {skin.comments.icons ? (
                <ArtIcon src={skin.icons.comments} className="tg-comments-icon">
                  <CommentsIcon />
                </ArtIcon>
              ) : null}
              <span className="tg-comments-text">{skin.comments.label(comments.count)}</span>
              {skin.comments.icons ? (
                <ArtIcon src={skin.icons.commentsArrow} className="tg-comments-arrow">
                  <ArrowIcon />
                </ArtIcon>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  return (
    <div className="tg-row" style={wideBubble ? ({ '--tg-bubble-max': px(bubbleMax) } as CSSProperties) : undefined}>
      {hasKeyboard || reactionsOutside ? (
        <div className="tg-message" style={widthStyle} ref={messageRef}>
          {bubble}
          {keyboardNode}
          {reactionsOutside}
        </div>
      ) : (
        bubble
      )}
      {shareButton ? (
        <span
          className={shareButton.hover ? 'tg-share on-hover' : 'tg-share'}
          style={shareBottom > 0 ? { marginBottom: px(shareBottom) } : undefined}
        >
          <ArtIcon src={skin.icons.share} className="tg-share-icon">
            <ShareIcon />
          </ArtIcon>
        </span>
      ) : null}
    </div>
  )
}
