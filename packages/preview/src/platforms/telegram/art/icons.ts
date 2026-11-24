// Telegram's art (29 section 8.4, D-6247, D-6270, TGP-02): the pattern and the small icons
// each look draws, copied from the apps' GPL sources into this folder; NOTICE.md names each
// file's source and license, and everything here must be replaced before xWriter is ever
// given or sold to others (R-2528).
//
// A look's CSS takes its icons from the custom properties artProperties writes on the
// chat's wallpaper (wallpaper/Wallpaper.tsx): `--tg-art-views` and so on hold a CSS image to
// use as a mask over the part's colour, for example
// `background: currentColor; mask: var(--tg-art-views) center / 16px 11px no-repeat;
// mask-mode: var(--tg-art-mask-mode)`. Desktop's icons are white-on-black PNGs at 1x, 2x and
// 3x (an image-set, mask mode luminance); the others draw with their alpha.
import type { PreviewTheme } from '../../../core/types'
import type { WallpaperLook } from '../wallpaper/settings'
import androidArrowMore from './android/arrow_more.webp?url&no-inline'
import androidBotLink from './android/bot_link.webp?url&no-inline'
import androidShare from './android/filled_button_share.webp?url&no-inline'
import androidMenu from './android/ic_ab_other.webp?url&no-inline'
import androidCopy from './android/menu_copy_s.webp?url&no-inline'
import androidQuote from './android/mini_quote.webp?url&no-inline'
import androidCommentsArrow from './android/msg_arrowright.webp?url&no-inline'
import androidCodeCopy from './android/msg_copy.webp?url&no-inline'
import androidComments from './android/msg_msgbubble.webp?url&no-inline'
import androidViews from './android/msg_views.webp?url&no-inline'
import desktopShare1 from './desktop/fast_share.png?url&no-inline'
import desktopShare2 from './desktop/fast_share@2x.png?url&no-inline'
import desktopShare3 from './desktop/fast_share@3x.png?url&no-inline'
import desktopComments1 from './desktop/history_comments.png?url&no-inline'
import desktopComments2 from './desktop/history_comments@2x.png?url&no-inline'
import desktopComments3 from './desktop/history_comments@3x.png?url&no-inline'
import desktopCommentsArrow1 from './desktop/history_comments_open.png?url&no-inline'
import desktopCommentsArrow2 from './desktop/history_comments_open@2x.png?url&no-inline'
import desktopCommentsArrow3 from './desktop/history_comments_open@3x.png?url&no-inline'
import desktopPlay1 from './desktop/history_file_play.png?url&no-inline'
import desktopPlay2 from './desktop/history_file_play@2x.png?url&no-inline'
import desktopPlay3 from './desktop/history_file_play@3x.png?url&no-inline'
import desktopViews1 from './desktop/history_views.png?url&no-inline'
import desktopViews2 from './desktop/history_views@2x.png?url&no-inline'
import desktopViews3 from './desktop/history_views@3x.png?url&no-inline'
import desktopCopy1 from './desktop/inline_button_copy.png?url&no-inline'
import desktopCopy2 from './desktop/inline_button_copy@2x.png?url&no-inline'
import desktopCopy3 from './desktop/inline_button_copy@3x.png?url&no-inline'
import desktopLink1 from './desktop/inline_button_url.png?url&no-inline'
import desktopLink2 from './desktop/inline_button_url@2x.png?url&no-inline'
import desktopLink3 from './desktop/inline_button_url@3x.png?url&no-inline'
import desktopQuoteExpand1 from './desktop/intro_country_dropdown.png?url&no-inline'
import desktopQuoteExpand2 from './desktop/intro_country_dropdown@2x.png?url&no-inline'
import desktopQuoteExpand3 from './desktop/intro_country_dropdown@3x.png?url&no-inline'
import desktopCodeCopy1 from './desktop/mini_copy.png?url&no-inline'
import desktopCodeCopy2 from './desktop/mini_copy@2x.png?url&no-inline'
import desktopCodeCopy3 from './desktop/mini_copy@3x.png?url&no-inline'
import desktopQuote1 from './desktop/mini_quote.png?url&no-inline'
import desktopQuote2 from './desktop/mini_quote@2x.png?url&no-inline'
import desktopQuote3 from './desktop/mini_quote@3x.png?url&no-inline'
import iosCopy from './ios/button-copy.svg?url&no-inline'
import iosLink from './ios/button-link.svg?url&no-inline'
import iosCodeMark from './ios/code-mark.svg?url&no-inline'
import iosCommentsArrow from './ios/comments-arrow.svg?url&no-inline'
import iosComments from './ios/comments.svg?url&no-inline'
import iosQuoteExpand from './ios/quote-expand-arrow.svg?url&no-inline'
import iosQuote from './ios/quote-mark.svg?url&no-inline'
import iosShare from './ios/share.svg?url&no-inline'
import iosViews2 from './ios/views-eye@2x.png?url&no-inline'
import iosViews3 from './ios/views-eye@3x.png?url&no-inline'
import pattern from './pattern.svg?url&no-inline'
import webLink from './web-a/icon-arrow-right.svg?url&no-inline'
import webCopy from './web-a/icon-copy.svg?url&no-inline'
import webQuoteExpand from './web-a/icon-down.svg?url&no-inline'
import webViews from './web-a/icon-eye.svg?url&no-inline'
import webComments from './web-a/icon-message.svg?url&no-inline'
import webCommentsArrow from './web-a/icon-next.svg?url&no-inline'
import webQuote from './web-a/icon-quote.svg?url&no-inline'
import webShare from './web-a/icon-share-filled.svg?url&no-inline'
import webQuoteCollapse from './web-a/icon-up.svg?url&no-inline'
import webWebApp from './web-a/icon-webapp.svg?url&no-inline'
import webSpoilerLight from './web-a/spoiler-dots-black.png?url&no-inline'
import webSpoilerDark from './web-a/spoiler-dots-white.png?url&no-inline'
import webkQuoteExpand from './web-k/arrowhead.svg?url&no-inline'
import webkLink from './web-k/arrow_next.svg?url&no-inline'
import webkViews from './web-k/channelviews_filled.svg?url&no-inline'
import webkComments from './web-k/comments.svg?url&no-inline'
import webkCodeCopy from './web-k/copy_alt.svg?url&no-inline'
import webkCopy from './web-k/copy.svg?url&no-inline'
import webkShare from './web-k/forward_filled.svg?url&no-inline'
import webkPlay from './web-k/largeplay_filled.svg?url&no-inline'
import webkCodeMenu from './web-k/menu.svg?url&no-inline'
import webkCommentsArrow from './web-k/next.svg?url&no-inline'
import webkQuote from './web-k/quote_filled.svg?url&no-inline'

/**
 * What an icon is for, the same in every look; a look has only the ones its app draws.
 * views: the eye of the info row; share: the round share button's glyph; comments and
 * commentsArrow: the comments bar's icon and its arrow; link and copy: the marks of a link
 * and a copy button under the post; webApp: Web A's mark of a button that opens a mini app;
 * quote: the mark in a quote's corner; quoteExpand and quoteCollapse: the arrow of an
 * expandable quote, closed and open (a look with only quoteExpand turns it over when open);
 * play: the play glyph on a video; codeCopy, codeMenu and codeMark: the buttons and the mark
 * of a code block's header (codeCopy also Android's COPY CODE bar under a long block); menu:
 * the top bar's three dots; spoiler: the dots over hidden text (Web A ships them as PNG in
 * the theme's colour).
 */
export type ArtRole =
  | 'views'
  | 'share'
  | 'comments'
  | 'commentsArrow'
  | 'link'
  | 'copy'
  | 'webApp'
  | 'quote'
  | 'quoteExpand'
  | 'quoteCollapse'
  | 'play'
  | 'codeCopy'
  | 'codeMenu'
  | 'codeMark'
  | 'menu'
  | 'spoiler'

/** A look's icons as CSS images, by role. */
export type LookArt = Readonly<Partial<Record<ArtRole, string>>>

/** `url("…")` of an asset URL. */
function url(href: string): string {
  return `url("${href}")`
}

/** The 1x, 2x and 3x files of a Desktop icon as one image-set. */
function densities(x1: string, x2: string, x3: string): string {
  return `image-set(url("${x1}") 1x, url("${x2}") 2x, url("${x3}") 3x)`
}

/** Each look's icons (light theme; artProperties swaps the spoiler's for dark). */
export const telegramArt: Readonly<Record<WallpaperLook, LookArt>> = {
  web: {
    views: url(webViews),
    share: url(webShare),
    comments: url(webComments),
    commentsArrow: url(webCommentsArrow),
    link: url(webLink),
    copy: url(webCopy),
    webApp: url(webWebApp),
    quote: url(webQuote),
    quoteExpand: url(webQuoteExpand),
    quoteCollapse: url(webQuoteCollapse),
    spoiler: url(webSpoilerLight),
  },
  webk: {
    views: url(webkViews),
    share: url(webkShare),
    comments: url(webkComments),
    commentsArrow: url(webkCommentsArrow),
    link: url(webkLink),
    copy: url(webkCopy),
    quote: url(webkQuote),
    quoteExpand: url(webkQuoteExpand),
    play: url(webkPlay),
    codeCopy: url(webkCodeCopy),
    codeMenu: url(webkCodeMenu),
  },
  desktop: {
    views: densities(desktopViews1, desktopViews2, desktopViews3),
    share: densities(desktopShare1, desktopShare2, desktopShare3),
    comments: densities(desktopComments1, desktopComments2, desktopComments3),
    commentsArrow: densities(desktopCommentsArrow1, desktopCommentsArrow2, desktopCommentsArrow3),
    link: densities(desktopLink1, desktopLink2, desktopLink3),
    copy: densities(desktopCopy1, desktopCopy2, desktopCopy3),
    quote: densities(desktopQuote1, desktopQuote2, desktopQuote3),
    quoteExpand: densities(desktopQuoteExpand1, desktopQuoteExpand2, desktopQuoteExpand3),
    play: densities(desktopPlay1, desktopPlay2, desktopPlay3),
    codeCopy: densities(desktopCodeCopy1, desktopCodeCopy2, desktopCodeCopy3),
  },
  android: {
    views: url(androidViews),
    share: url(androidShare),
    comments: url(androidComments),
    commentsArrow: url(androidCommentsArrow),
    link: url(androidBotLink),
    copy: url(androidCopy),
    quote: url(androidQuote),
    quoteExpand: url(androidArrowMore),
    codeCopy: url(androidCodeCopy),
    menu: url(androidMenu),
  },
  ios: {
    views: `image-set(url("${iosViews2}") 2x, url("${iosViews3}") 3x)`,
    share: url(iosShare),
    comments: url(iosComments),
    commentsArrow: url(iosCommentsArrow),
    link: url(iosLink),
    copy: url(iosCopy),
    quote: url(iosQuote),
    quoteExpand: url(iosQuoteExpand),
    codeMark: url(iosCodeMark),
  },
}

/** The pattern every look draws (wallpaper/), as a URL. */
export const patternUrl = pattern

/** The custom property of a role: views is --tg-art-views, commentsArrow --tg-art-comments-arrow. */
function propertyOf(role: string): string {
  return `--tg-art-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
}

/**
 * A look's icons as custom properties for its CSS, in the theme: one per role it has, the
 * pattern as --tg-art-pattern, and --tg-art-mask-mode (luminance for Desktop, else alpha).
 */
export function artProperties(look: WallpaperLook, theme: PreviewTheme): Record<string, string> {
  const art: LookArt =
    look === 'web' && theme === 'dark' ? { ...telegramArt.web, spoiler: url(webSpoilerDark) } : telegramArt[look]
  const properties: Record<string, string> = {
    '--tg-art-pattern': url(pattern),
    '--tg-art-mask-mode': look === 'desktop' ? 'luminance' : 'alpha',
  }
  for (const [role, image] of Object.entries(art)) if (image) properties[propertyOf(role)] = image
  return properties
}
