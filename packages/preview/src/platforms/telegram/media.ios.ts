// Telegram for iOS's single photo or video (.dev/upd29/tg/ios.md section 3.5; 29 section 8.6,
// TGP-07): ChatMessageInteractiveMediaNode.swift:951-1216 in the bubble's constrained mode. The
// picture counts at half its pixel size, fitted to the bubble (by its width when it is wide, by
// its height when it is upright), then at most 300 x 380 (a video as wide as the bubble and 250
// tall, 360 when upright) and at least 170 wide. The bubble widens for its caption or its
// comments bar up to the widest media; the box keeps the picture's height at that width, cut to
// the most and at least 74, and the picture fills it (aspect fill).
import type { PreviewMedia } from './model'
import type { MediaBoxFn, SkinTokens } from './skins/tokens'

interface Size {
  w: number
  h: number
}

/** The caption's 10 px insets less the media's 1 px ones, on both sides together. */
const captionInsets = 18
/** The comments bar around its label: 14 + 24 + 11 before it, 4 + 24 + 8 after it, less the media's 2 px. */
const commentsInsets = 83
const minWidth = 170
const minHeight = 74
const photoMax: Size = { w: 300, h: 380 }
const unbounded = 1e9

// Display's CGSize helpers: each floors its result.
function aspectFitted(s: Size, box: Size): Size {
  const scale = Math.min(box.w / Math.max(1, s.w), box.h / Math.max(1, s.h))
  return { w: Math.floor(s.w * scale), h: Math.floor(s.h * scale) }
}

function aspectFilled(s: Size, box: Size): Size {
  const scale = Math.max(box.w / Math.max(1, s.w), box.h / Math.max(1, s.h))
  return { w: Math.floor(s.w * scale), h: Math.floor(s.h * scale) }
}

function fittedToWidthOrSmaller(s: Size, width: number): Size {
  const scale = Math.min(1, width / Math.max(1, s.w))
  return { w: Math.floor(s.w * scale), h: Math.floor(s.h * scale) }
}

let measure: CanvasRenderingContext2D | null | undefined

/** A line's width in a font, from a canvas; half the size per character where there is none. */
function textWidth(text: string, size: number, family: string, weight: number): number {
  if (measure === undefined) {
    try {
      measure = document.createElement('canvas').getContext('2d')
    } catch {
      measure = null
    }
  }
  if (!measure) return text.length * size * 0.5
  measure.font = `${String(weight)} ${String(size)}px ${family}`
  return Math.ceil(measure.measureText(text).width)
}

/** The caption's widest line, in the text's font. */
function captionWidth(caption: string, skin: SkinTokens): number {
  let widest = 0
  for (const line of caption.split('\n')) {
    widest = Math.max(widest, textWidth(line, skin.fontSize, skin.fontFamily, 400))
  }
  return widest
}

/** The picture at half its pixel size (a GIF filled to 480 x 480), at least 10 x 10 for a photo. */
function unboundSize(m: PreviewMedia): Size {
  const half = {
    w: Math.floor((m.width > 0 ? m.width : 600) * 0.5),
    h: Math.floor((m.height > 0 ? m.height : 600) * 0.5),
  }
  if (m.kind === 'animation') return aspectFilled(half, { w: 480, h: 480 })
  if (m.kind === 'video') return half
  return { w: Math.max(10, half.w), h: Math.max(10, half.h) }
}

export const iosMediaBox: MediaBoxFn = (m, { skin, bubbleMax, caption, comments }) => {
  // The media node's room: the bubble's content width less its 1 px insets.
  const constrained = Math.max(1, bubbleMax - 2)
  const unbound = unboundSize(m)
  const wide = unbound.w > unbound.h
  const maxDims: Size = m.kind === 'video' ? { w: constrained, h: wide ? 250 : 360 } : photoMax
  const native = wide
    ? aspectFitted(unbound, { w: constrained, h: unbounded })
    : aspectFitted(unbound, { w: unbounded, h: constrained })
  const maxFitted = aspectFitted(native, maxDims)
  const result = Math.max(Math.min(native.w, maxFitted.w, constrained, maxDims.w), minWidth)
  const widest = Math.min(maxDims.w, constrained)
  let need = 0
  if (caption.trim() !== '') {
    need = Math.min(captionWidth(caption, skin), widest - captionInsets) + captionInsets
  }
  if (comments) {
    const label = skin.comments.label(0)
    need = Math.max(
      need,
      textWidth(label, skin.comments.fontSize, skin.fontFamily, skin.comments.fontWeight) + commentsInsets,
    )
  }
  const boundingWidth = Math.max(result, Math.min(widest, need))
  const fitted = fittedToWidthOrSmaller(native, boundingWidth)
  const filled = aspectFilled(fitted, { w: boundingWidth, h: fitted.h })
  const width = Math.max(boundingWidth, minWidth)
  const height = Math.max(Math.min(filled.h, maxDims.h), minHeight)
  return { width, height, imageWidth: width, imageHeight: height, blur: false }
}
