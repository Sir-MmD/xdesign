// Telegram for Android's single photo or video (docs/plan/29-owner-list-2026-10-22.md section
// 8.4, TGP-06; .dev/upd29/tg/android.md sections 3 and 4.12): ChatMessageCell.setMessageContent
// and getMessageSize (ChatMessageCell.java:9817-9848, 10142-10154, 10261-10275, 26717-26760).
import type { MediaBoxFn, SkinTokens } from './skins/tokens'

/** The look's font, for measuring the caption's lines (16 px) and the info row (12 px). */
const font = '"Roboto Variable", Roboto, sans-serif'

let measurer: CanvasRenderingContext2D | null | undefined

/** A 2D canvas to measure text with, or null where the browser has none; made once. */
function canvas(): CanvasRenderingContext2D | null {
  if (measurer === undefined) {
    measurer = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  return measurer
}

/**
 * The width of a caption's widest paragraph in Roboto at 16 px, or Infinity where the browser
 * has no 2D canvas to measure with; measured with the font the page has at that moment.
 */
function captionWidth(caption: string): number {
  const context = canvas()
  if (!context) return Number.POSITIVE_INFINITY
  context.font = `16px ${font}`
  return Math.max(...caption.split('\n').map((line) => context.measureText(line).width))
}

/**
 * A photo's least width: its info row's and 22 (ChatMessageCell.java:9995-9999; 29 section 8.4,
 * TGP-02), the time with the signature and the view count with its eye and their gaps, in the
 * info row's size; media.minWidth where the browser has no canvas to measure with.
 */
function photoMinWidth(skin: SkinTokens, info: { views: string | undefined; time: string }): number {
  const context = canvas()
  if (!context) return skin.media.minWidth
  context.font = `${String(skin.metaFontSize)}px ${font}`
  let width = context.measureText(info.time).width
  if (info.views !== undefined) {
    width += context.measureText(info.views).width + skin.meta.iconSize + skin.meta.countGap + skin.meta.iconGap
  }
  return Math.ceil(width) + 22
}

/**
 * Android's box of a single photo or video in a chat area of frameWidth (384 on the owner's
 * phone): a landscape one up to the width - 74 (the share button's room included), a portrait
 * one up to 0.7 x the width - 20 and 0.7 x the width + 100 tall; scaled to the widest, then
 * fitted to the tallest, or made 120 tall (and as wide as its shape allows) when lower; a
 * video or animation at least 129 wide ("100%" in 12 px and 100) and each at least as wide
 * as its info row and 22. With a caption, a picture narrower than the text's widest column
 * (width - 94) widens to the caption's widest line and its paddings, cut to fill.
 * The picture fills its box (centre-cropped); there is never a blurred copy.
 */
export const androidMediaBox: MediaBoxFn = (m, { skin, frameWidth, caption, info }) => {
  const landscape = m.width >= m.height
  const maxW = landscape ? frameWidth - 74 : 0.7 * frameWidth - 20
  const maxH = landscape ? frameWidth - 74 + 100 : 0.7 * frameWidth + 100
  const aspect = m.width > 0 && m.height > 0 ? m.width / m.height : 1
  let width = maxW
  let height = width / aspect
  if (height > maxH) {
    height = maxH
    width = height * aspect
  } else if (height < skin.media.minHeight) {
    height = skin.media.minHeight
    width = Math.min(maxW, height * aspect)
  }
  // The info row's least width holds for a video too, under its 129 (ChatMessageCell.java:
  // 9990-10002; RVW-29c).
  const least = photoMinWidth(skin, info)
  width = Math.max(width, m.kind === 'video' || m.kind === 'animation' ? Math.max(129, least) : least)
  const textWidth = frameWidth - 94
  if (caption.trim() !== '' && width < textWidth) {
    // The caption keeps its side paddings of 9 inside a bubble 2 wider than the picture on each side.
    const sides = 2 * 9 - 2 * skin.media.inset
    width = Math.max(width, Math.min(textWidth, captionWidth(caption)) + sides)
  }
  return { width, height, imageWidth: width, imageHeight: height, blur: false }
}
