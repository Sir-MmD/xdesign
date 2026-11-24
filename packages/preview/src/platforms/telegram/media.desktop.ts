// Telegram Desktop's single photo or video in a bubble (docs/plan/29-owner-list-2026-10-22.md
// section 8.4, TGP-05; .dev/upd29/tg/desktop.md section 4.7): the box tdesktop 7.3.3 gives it
// (Photo::countOptimalSize and countCurrentSize, history_view_photo.cpp:329-433; Gif's for a
// video or an animation, history_view_gif.cpp:365-550; history_view_media_common.cpp:320-344)
// in whole pixels as Qt computes them, and whether the picture covers that box or sits whole
// in it over its blurred copy (DecideFrameResize, media_streaming_utility.cpp:371-415): a photo
// covers it when only its top and bottom are cut and at least 3/4 of its height stays, a video
// when at least half does.
import type { MediaBoxFn } from './skins/tokens'

interface Size {
  width: number
  height: number
}

/** maxMediaSize (= msgMaxWidth), minPhotoSize, historyPhotoBubbleMinWidth and maxGifSize (chat.style). */
const maxMedia = 430
const minPhoto = 100
const bubbleMinWidth = 200
const maxGif = 320

/**
 * Element::minWidthForMedia: the info row's pill under media, the row about 107 px (the eye's
 * 20, "1234", 8 and "3:35 PM") and 2 x (4 + 8) around it; with the comments bar, three
 * repliers' pictures, the paddings and the arrow (134 px) and its label, about 90 px. Both are
 * estimates: the preview measures no text.
 */
const infoMinWidth = 131
const commentsMinWidth = 224

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** QSize::scaled: fitted into the box (KeepAspectRatio) or covering it (KeepAspectRatioByExpanding), in whole pixels. */
function scaled(size: Size, box: Size, cover = false): Size {
  if (size.width === 0 || size.height === 0) return box
  const width = Math.trunc((box.height * size.width) / size.height)
  if (cover ? width >= box.width : width <= box.width) return { width, height: box.height }
  return { width: box.width, height: Math.trunc((box.width * size.height) / size.width) }
}

/** NonEmptySize. */
const nonEmpty = (size: Size): Size => ({ width: Math.max(size.width, 1), height: Math.max(size.height, 1) })

/** DownscaledSize: fitted into the box when larger. */
function downscaled(size: Size, box: Size): Size {
  return nonEmpty(size.width > box.width || size.height > box.height ? scaled(size, box) : size)
}

/** DecideFrameResize: the picture covers the box when no side is cut and at least num/den of its height stays. */
function covers(box: Size, picture: Size, num: number, den: number): boolean {
  const big = scaled(picture, box, true)
  return big.width <= box.width && big.height * num <= box.height * den
}

/** Photo::adjustHeightForLessCrop with FrameResizeMayExpand: as tall as the picture at that width when it may cover the box. */
function photoLessCrop(picture: Size, current: Size): number {
  const min = Math.min(current.width, current.height, picture.width, picture.height)
  if (2 * 3 * min < 2 * 4 + 4 * min || !covers(current, picture, 3 * min - 4, 4 * min)) return current.height
  return Math.max(current.height, Math.trunc((current.width * picture.height) / picture.width))
}

/** Gif::adjustHeightForLessCrop: taller for less crop, by at most a third. */
function gifLessCrop(picture: Size, current: Size): number {
  return Math.max(
    current.height,
    Math.min(Math.trunc((current.width * picture.height) / picture.width), Math.trunc((current.height * 4) / 3)),
  )
}

const characters = new Intl.Segmenter()

/**
 * Element::textualMaxWidth: the text's widest line with the bubble's padding (22), the last
 * line with the info row's room after it (its 107 and 10); about 6.3 px a character in 13 px
 * Open Sans (an estimate: the preview measures no text).
 */
function textualMaxWidth(text: string): number {
  const lines = text === '' ? [] : text.split('\n')
  const widest = lines.reduce(
    (max, line, i) =>
      Math.max(max, Array.from(characters.segment(line)).length * 6.3 + (i === lines.length - 1 ? 117 : 0)),
    0,
  )
  return Math.ceil(widest) + 22
}

/** A photo: Photo::countOptimalSize, then countCurrentSize at the width the bubble gives it. */
function photoSize(picture: Size, bubbleMax: number, textual: number, minForMedia: number): Size {
  const desired = downscaled(picture, { width: maxMedia, height: maxMedia })
  const withCaption = Math.min(maxMedia, textual)
  const optimalMin = clamp(minForMedia, bubbleMinWidth, maxMedia)
  const optimalWidth = Math.min(Math.max(Math.max(desired.width, optimalMin), desired.height, withCaption), maxMedia)
  const optimalHeight = photoLessCrop(picture, { width: optimalWidth, height: Math.max(desired.height, minPhoto) })
  // The message lays the media out at its widest part, at most the bubble's widest.
  const newWidth = Math.min(bubbleMax, Math.max(optimalWidth, textual))
  const thumbMax = Math.min(newWidth, maxMedia)
  const minWidth = clamp(minForMedia, Math.min(thumbMax, bubbleMinWidth), thumbMax)
  // CountPhotoMediaSize: narrowed to the width, then lowered to the width's height.
  const limit = Math.min(newWidth, optimalWidth)
  let pix = desired.width <= limit ? desired : nonEmpty(scaled(desired, { width: limit, height: desired.height }))
  if (pix.height > newWidth) pix = nonEmpty(scaled(pix, { width: pix.width, height: newWidth }))
  const width = Math.min(Math.max(pix.width, minWidth, withCaption), thumbMax)
  const height = photoLessCrop(picture, { width, height: Math.max(pix.height, minPhoto) })
  return { width, height: width >= optimalWidth ? Math.min(height, optimalHeight) : height }
}

/** A video (430 at most) or an animation (320): Gif::countOptimalSize, then countCurrentSize. */
function videoSize(picture: Size, bubbleMax: number, textual: number, minForMedia: number, maxSize: number): Size {
  const optimalThumbMax = Math.min(maxMedia, maxSize)
  const optimalScaled = downscaled(picture, { width: optimalThumbMax, height: maxSize })
  const optimalMin = clamp(minForMedia, bubbleMinWidth, maxMedia)
  const optimalWidth = Math.max(Math.min(Math.max(optimalScaled.width, optimalMin), optimalThumbMax), textual)
  const newWidth = Math.min(bubbleMax, optimalWidth)
  const thumbMax = Math.min(newWidth, maxSize)
  const thumb = downscaled(picture, { width: thumbMax, height: maxSize })
  const byInfo = clamp(Math.max(thumb.width, infoMinWidth), Math.min(minPhoto, thumbMax), thumbMax)
  const width = Math.min(Math.max(byInfo, minForMedia, Math.min(maxMedia, textual)), thumbMax)
  return { width, height: gifLessCrop(thumb, { width, height: Math.max(thumb.height, minPhoto) }) }
}

/**
 * Desktop's box of a single photo or video (SkinTokens.media.box, 29 section 8.4): its size,
 * and the picture covering it, else whole and centred over its blurred copy, which
 * SkinColors.mediaShade darkens. A picture of unknown size counts as a square.
 */
export const desktopMediaBox: MediaBoxFn = (media, { bubbleMax, caption, comments }) => {
  const picture: Size =
    media.width > 0 && media.height > 0
      ? { width: Math.max(1, Math.round(media.width)), height: Math.max(1, Math.round(media.height)) }
      : { width: maxMedia, height: maxMedia }
  const textual = textualMaxWidth(caption)
  const minForMedia = comments ? Math.max(infoMinWidth, commentsMinWidth) : infoMinWidth
  const widest = Math.max(1, Math.floor(bubbleMax))
  const video = media.kind === 'video' || media.kind === 'animation'
  const size = video
    ? videoSize(picture, widest, textual, minForMedia, media.kind === 'animation' ? maxGif : maxMedia)
    : photoSize(picture, widest, textual, minForMedia)
  const cover = video ? covers(size, picture, 1, 2) : covers(size, picture, 3, 4)
  const image = scaled(picture, size, cover)
  return { width: size.width, height: size.height, imageWidth: image.width, imageHeight: image.height, blur: !cover }
}
