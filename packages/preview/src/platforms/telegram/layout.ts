// The sizes of media in a bubble (docs/plan/10-frontend.md section 8.7), and the rows of
// the inline keyboard under it (docs/plan/19-x-proxies-server-media.md section 7.9).
import type { InlineKeyboard } from './model'
import type { MediaBoxFn, SkinTokens } from './skins/tokens'

/** The rows of a keyboard that have buttons: a keyboard of only empty rows is no keyboard. */
export function keyboardRows(keyboard: InlineKeyboard | undefined): InlineKeyboard {
  return (keyboard ?? []).filter((row) => row.buttons.length > 0)
}

/** The box of a single photo or video: its size, and the picture's own size inside it
 * (smaller on Web A, which fills the rest of a wider box with a blurred copy). A look whose
 * app sizes media its own way gives its own function (SkinTokens.media.box, 29 section 8.6). */
export const mediaBox: MediaBoxFn = (m, { skin, bubbleMax, frameWidth }) => {
  const maxW = Math.min(skin.media.maxWidth(frameWidth), bubbleMax) - 2 * skin.media.inset
  const maxH = skin.media.maxHeight(frameWidth)
  const aspect = m.width > 0 && m.height > 0 ? m.width / m.height : 1
  if (skin.media.blurFill) {
    const width = maxW
    const height = Math.max(Math.min(width / aspect, maxH), skin.media.minHeight)
    const imageWidth = Math.min(width, height * aspect)
    const imageHeight = imageWidth / aspect
    return { width, height, imageWidth, imageHeight, blur: imageWidth < width || imageHeight < height }
  }
  let width = maxW
  let height = width / aspect
  if (height > maxH) {
    height = maxH
    width = height * aspect
  }
  width = Math.max(width, Math.min(skin.media.minWidth, maxW))
  height = Math.max(height, skin.media.minHeight)
  return { width, height, imageWidth: width, imageHeight: height, blur: false }
}

/** The width of an album in a bubble of at most bubbleMax pixels. */
export function albumWidth(skin: SkinTokens, bubbleMax: number, frameWidth: number): number {
  return Math.min(skin.media.maxWidth(frameWidth), bubbleMax)
}
