// Telegram's four-colour gradient (29 section 8.4, TGP-02), computed the way each app
// computes it: into a small bitmap that the browser scales up smoothly, as the apps scale
// theirs. Also the colour filters iOS and Android run over that bitmap for the parts drawn
// from the wallpaper (the share button, the buttons under a post).

/** A colour as three channels from 0 to 255. */
export type Rgb = readonly [number, number, number]

/** How an app blends its four colours. */
export type GradientMethod =
  /**
   * Web A's shader (telegram-tt src/util/gradientBackground.ts:27-61): every colour sits at
   * its own point and weighs (1 - (d - min d))^3, d being the pixel's distance to it.
   */
  | { kind: 'webA' }
  /**
   * Telegram's own (tweb gradientRenderer.ts:200-263, tdesktop image_prepare.cpp:173-306,
   * Android image.cpp:1075-1200, iOS SoftwareGradientBackground.swift:95-240): the pixel is
   * swirled around the centre first, then every colour weighs max(0, reach - d)^power.
   */
  | { kind: 'swirl'; reach: number; power: number }

/** The bitmap an app computes the gradient into. */
export interface GradientBitmap {
  method: GradientMethod
  width: number
  height: number
  /** Samples each pixel at its centre, as a shader does, instead of its top-left corner. */
  pixelCentre: boolean
  /** How a channel becomes a byte: rounded (a browser's ImageData and WebGL) or cut (C and Swift casts). */
  rounding: 'round' | 'cut'
}

type Point = readonly [number, number]

/** Web A's points of the four colours, x to the right and y down (rotation 0). */
const webAPoints: readonly Point[] = [
  [0.265, 0.582],
  [0.415, 0.836],
  [0.735, 0.418],
  [0.585, 0.164],
]

/** The swirl's points of the four colours at phase 0, x to the right and y down. */
const swirlPoints: readonly Point[] = [
  [0.8, 0.9],
  [0.35, 0.75],
  [0.2, 0.1],
  [0.65, 0.25],
]

/** "#rrggbb" as channels. */
export function parseHex(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The four weights of a point (u, v) of the box, both from 0 to 1. */
function weights(method: GradientMethod, u: number, v: number): number[] {
  if (method.kind === 'webA') {
    const d = webAPoints.map(([x, y]) => Math.hypot(u - x, v - y))
    const nearest = Math.min(...d)
    return d.map((di) => (1 - (di - nearest)) ** 3)
  }
  const dx = u - 0.5
  const dy = v - 0.5
  const swirl = 0.35 * Math.hypot(dx, dy)
  const theta = swirl * swirl * 0.8 * 8
  const sin = Math.sin(theta)
  const cos = Math.cos(theta)
  const x = Math.min(1, Math.max(0, 0.5 + dx * cos - dy * sin))
  const y = Math.min(1, Math.max(0, 0.5 + dx * sin + dy * cos))
  return swirlPoints.map(([px, py]) => Math.max(0, method.reach - Math.hypot(x - px, y - py)) ** method.power)
}

/** The gradient's RGBA pixels, row by row from the top-left. */
export function renderGradient(colors: readonly string[], bitmap: GradientBitmap): Uint8ClampedArray {
  const rgb = colors.map(parseHex)
  const { width, height } = bitmap
  const pixels = new Uint8ClampedArray(width * height * 4)
  const half = bitmap.pixelCentre ? 0.5 : 0
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const w = weights(bitmap.method, (column + half) / width, (row + half) / height)
      const sum = Math.abs(w.reduce((a, b) => a + b, 0)) || 1
      const i = (row * width + column) * 4
      for (let channel = 0; channel < 3; channel++) {
        let value = 0
        for (let k = 0; k < rgb.length; k++) value += (rgb[k]?.[channel] ?? 0) * (w[k] ?? 0)
        value /= sum
        // A Uint8ClampedArray rounds what it is given; a cast in C or Swift cuts it.
        pixels[i + channel] = bitmap.rounding === 'cut' ? Math.trunc(value) : value
      }
      pixels[i + 3] = 255
    }
  }
  return pixels
}

/**
 * The colour filter an app runs over the gradient for a part drawn from the wallpaper: the
 * saturation with the app's own luma weights, then each channel times multiply plus add
 * (a fraction of 255). iOS: saturation 1.7 with 0.3086, 0.6094, 0.0820
 * (SoftwareGradientBackground.swift:36-70); Android: ColorMatrix.setSaturation with 0.213,
 * 0.715, 0.072, then multiply and add (Theme.java:8735-8785).
 */
export interface FillFilter {
  saturation: number
  luma: Rgb
  multiply: number
  add: number
}

/** The pixels through a fill filter, still opaque. */
export function filterPixels(pixels: Uint8ClampedArray, filter: FillFilter): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length)
  const [wr, wg, wb] = filter.luma
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    const luma = wr * r + wg * g + wb * b
    out[i] = (luma + filter.saturation * (r - luma)) * filter.multiply + filter.add * 255
    out[i + 1] = (luma + filter.saturation * (g - luma)) * filter.multiply + filter.add * 255
    out[i + 2] = (luma + filter.saturation * (b - luma)) * filter.multiply + filter.add * 255
    out[i + 3] = 255
  }
  return out
}

/**
 * The colour of the bitmap at (u, v) of the box it is stretched over, both from 0 to 1, as
 * the browser's smooth scaling shows it (bilinear between pixel centres).
 */
export function sampleBitmap(pixels: Uint8ClampedArray, width: number, height: number, u: number, v: number): Rgb {
  const x = Math.min(width - 1, Math.max(0, u * width - 0.5))
  const y = Math.min(height - 1, Math.max(0, v * height - 0.5))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const at = (px: number, py: number, channel: number) => pixels[(py * width + px) * 4 + channel] ?? 0
  const channel = (c: number) =>
    (at(x0, y0, c) * (1 - fx) + at(x1, y0, c) * fx) * (1 - fy) + (at(x0, y1, c) * (1 - fx) + at(x1, y1, c) * fx) * fy
  return [channel(0), channel(1), channel(2)]
}

/** The pixels as a PNG data URL, or null where the browser has no 2D canvas. */
export function bitmapUrl(pixels: Uint8ClampedArray, width: number, height: number): string | null {
  if (typeof document === 'undefined') return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    const image = context.createImageData(width, height)
    image.data.set(pixels)
    context.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
