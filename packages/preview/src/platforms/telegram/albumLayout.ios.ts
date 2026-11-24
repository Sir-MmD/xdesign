// Telegram for iOS's album layout (.dev/upd29/tg/ios.md section 5; 29 section 8.6, TGP-07): a
// port of ChatMessageBubbleMosaicLayout.swift:58-375 with its floors, rounds and ceils. The
// album fits 300 x 380 scaled to the bubble, items 1 pt apart; two to four items take the fixed
// layouts, five or more (or any item wider than 2:1) the best of the line attempts.
import { type AlbumItemBox, type AlbumLayoutFn, AlbumRectPart } from './albumLayout'

interface Frame {
  x: number
  y: number
  w: number
  h: number
}

interface Attempt {
  counts: number[]
  heights: number[]
}

const minWidth = 68
const minHeight = 81

function frame(x: number, y: number, w: number, h: number): Frame {
  return { x, y, w, h }
}

function sum(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0)
}

/** The fixed layouts of one to four items (MOSAIC:88-196); null for more. */
function fixedLayout(r: readonly number[], maxW: number, maxH: number, spacing: number): Frame[] | null {
  const n = r.length
  const at = (i: number) => r[i] ?? 1
  const prop = r.map((x) => (x > 1.2 ? 'w' : x < 0.8 ? 'n' : 'q')).join('')
  const avg = (1 + sum(r)) / n
  const maxRatio = maxW / maxH
  if (n === 1) return [frame(0, 0, maxW, Math.floor(Math.min(maxH, maxW / at(0))))]
  if (n === 2) {
    if (prop === 'ww' && avg > 1.4 * maxRatio && at(1) - at(0) < 0.2) {
      const w = maxW
      const h = Math.floor(Math.min(w / at(0), w / at(1), (maxH - spacing) / 2))
      return [frame(0, 0, w, h), frame(0, h + spacing, w, h)]
    }
    if (prop === 'ww' || prop === 'qq') {
      const w = (maxW - spacing) / 2
      const h = Math.floor(Math.min(w / at(0), w / at(1), maxH))
      return [frame(0, 0, w, h), frame(w + spacing, 0, w, h)]
    }
    const w1 = Math.floor(
      Math.min(0.5 * (maxW - spacing), Math.round((maxW - spacing) / at(0) / (1 / at(0) + 1 / at(1)))),
    )
    const w0 = maxW - w1 - spacing
    const h = Math.floor(Math.min(maxH, Math.round(Math.min(w0 / at(0), w1 / at(1)))))
    return [frame(0, 0, w0, h), frame(w0 + spacing, 0, w1, h)]
  }
  if (n === 3) {
    if (prop.startsWith('n')) {
      const h0 = maxH
      const h2 = Math.min((maxH - spacing) * 0.5, Math.round((at(1) * (maxW - spacing)) / (at(2) + at(1))))
      const h1 = maxH - h2 - spacing
      const rw = Math.max(minWidth, Math.min((maxW - spacing) * 0.5, Math.round(Math.min(h2 * at(2), h1 * at(1)))))
      const lw = Math.round(Math.min(h0 * at(0), maxW - spacing - rw))
      return [frame(0, 0, lw, h0), frame(lw + spacing, 0, rw, h1), frame(lw + spacing, h1 + spacing, rw, h2)]
    }
    const h0 = Math.floor(Math.min(maxW / at(0), (maxH - spacing) * 0.66))
    const w = (maxW - spacing) / 2
    const h1 = Math.min(maxH - h0 - spacing, Math.round(Math.min(w / at(1), w / at(2))))
    return [frame(0, 0, maxW, h0), frame(0, h0 + spacing, w, h1), frame(w + spacing, h0 + spacing, w, h1)]
  }
  if (n === 4) {
    if (prop.startsWith('w')) {
      const h0 = Math.round(Math.min(maxW / at(0), (maxH - spacing) * 0.66))
      const row = Math.round((maxW - 2 * spacing) / (at(1) + at(2) + at(3)))
      const w0 = Math.max(minWidth, Math.min((maxW - 2 * spacing) * 0.4, row * at(1)))
      const w2 = Math.max(Math.max(minWidth, (maxW - 2 * spacing) * 0.33), row * at(3))
      const w1 = maxW - w0 - w2 - 2 * spacing
      const h = Math.max(minHeight, Math.min(maxH - h0 - spacing, row))
      return [
        frame(0, 0, maxW, h0),
        frame(0, h0 + spacing, w0, h),
        frame(w0 + spacing, h0 + spacing, w1, h),
        frame(w0 + w1 + 2 * spacing, h0 + spacing, w2, h),
      ]
    }
    const h = maxH
    const w0 = Math.round(Math.min(h * at(0), (maxW - spacing) * 0.6))
    const column = Math.round((maxH - 2 * spacing) / (1 / at(1) + 1 / at(2) + 1 / at(3)))
    const h0 = Math.floor(column / at(1))
    const h1 = Math.floor(column / at(2))
    const h2 = h - h0 - h1 - 2 * spacing
    const w = Math.max(minWidth, Math.min(maxW - w0 - spacing, column))
    return [
      frame(0, 0, w0, h),
      frame(w0 + spacing, 0, w, h0),
      frame(w0 + spacing, h0 + spacing, w, h1),
      frame(w0 + spacing, h0 + h1 + 2 * spacing, w, h2),
    ]
  }
  return null
}

/** Two to four lines of up to three items (four in a middle line of narrow ones), the attempt nearest maxW / 3 x 4 tall (MOSAIC:198-364). */
function gridLayout(r: readonly number[], maxW: number, spacing: number): Frame[] {
  const n = r.length
  const avg = (1 + sum(r)) / n
  const c = r.map((x) => Math.min(1.7, Math.max(0.66667, avg > 1.1 ? Math.max(1, x) : Math.min(1, x))))
  const attempt = (counts: number[]): Attempt => {
    const heights: number[] = []
    let start = 0
    for (const count of counts) {
      heights.push((maxW - (count - 1) * spacing) / sum(c.slice(start, start + count)))
      start += count
    }
    return { counts, heights }
  }
  const attempts: Attempt[] = []
  for (let a = 1; a < n; a++) {
    const b = n - a
    if (a <= 3 && b <= 3) attempts.push(attempt([a, b]))
  }
  for (let a = 1; a < n - 1; a++) {
    for (let b = 1; b < n - a; b++) {
      const d = n - a - b
      if (a <= 3 && b <= (avg < 0.85 ? 4 : 3) && d <= 3) attempts.push(attempt([a, b, d]))
    }
  }
  for (let a = 1; a < n - 2; a++) {
    for (let b = 1; b < n - a; b++) {
      for (let d = 1; d < n - a - b; d++) {
        const e = n - a - b - d
        if (a <= 3 && b <= 3 && d <= 3 && e <= 3) attempts.push(attempt([a, b, d, e]))
      }
    }
  }
  const maxHeight = Math.floor((maxW / 3) * 4)
  let best: Attempt | undefined
  let bestDiff = Infinity
  for (const candidate of attempts) {
    let total = spacing * (candidate.heights.length - 1)
    // iOS keeps the smallest running total, which is the first line's height (MOSAIC:270-276).
    let minLine = Infinity
    for (const h of candidate.heights) {
      total += Math.floor(h)
      minLine = Math.min(minLine, total)
    }
    let diff = Math.abs(total - maxHeight)
    const lines = candidate.counts.length
    const [k0 = 0, k1 = 0, k2 = 0, k3 = 0] = candidate.counts
    if (lines > 1 && (k0 > k1 || (lines > 2 && k1 > k2) || (lines > 3 && k2 > k3))) diff *= 1.5
    if (minLine < minWidth) diff *= 1.5
    if (!best || diff < bestDiff) {
      best = candidate
      bestDiff = diff
    }
  }
  if (!best) return []
  const chosen = best
  const frames: Frame[] = []
  const lastOfLine: Frame[] = []
  let y = 0
  let i = 0
  for (let line = 0; line < chosen.counts.length; line++) {
    const lineHeight = Math.ceil(chosen.heights[line] ?? 0)
    const count = chosen.counts[line] ?? 0
    let x = 0
    let last: Frame | undefined
    for (let k = 0; k < count; k++) {
      const w = Math.ceil((c[i] ?? 1) * lineHeight)
      last = frame(x, y, w, lineHeight)
      frames.push(last)
      x += w + spacing
      i++
    }
    if (last) lastOfLine.push(last)
    y += lineHeight + spacing
  }
  const maxRight = Math.max(...lastOfLine.map((f) => f.x + f.w))
  for (const f of lastOfLine) f.w = Math.max(f.w, maxRight - f.x)
  return frames
}

export const iosAlbumLayout: AlbumLayoutFn = (ratios, { maxWidth, gap }) => {
  const r = ratios.map((x) => (x > 0 && Number.isFinite(x) ? x : 1))
  // 300 x 380 fitted to the bubble's media width (BUB:2612), floored as fittedToWidthOrSmaller.
  const scale = Math.min(1, Math.max(1, maxWidth - 2) / 300)
  const maxW = Math.floor(300 * scale)
  const maxH = Math.floor(380 * scale)
  const forceCalc = r.some((x) => x > 2)
  // At least 1 px: a very wide or very tall picture can take the app's sums to 0 or under (RVW-29c).
  const frames = ((forceCalc ? null : fixedLayout(r, maxW, maxH, gap)) ?? gridLayout(r, maxW, gap)).map((f) =>
    frame(f.x, f.y, Math.max(1, f.w), Math.max(1, f.h)),
  )
  const width = Math.round(Math.max(0, ...frames.map((f) => f.x + f.w)))
  const height = Math.round(Math.max(0, ...frames.map((f) => f.y + f.h)))
  const items: AlbumItemBox[] = frames.map((f) => ({
    x: f.x,
    y: f.y,
    width: f.w,
    height: f.h,
    sides:
      (f.y <= 0.5 ? AlbumRectPart.Top : 0) |
      (f.x + f.w >= width - 0.5 ? AlbumRectPart.Right : 0) |
      (f.y + f.h >= height - 0.5 ? AlbumRectPart.Bottom : 0) |
      (f.x <= 0.5 ? AlbumRectPart.Left : 0),
  }))
  // The bubble adds the album's 1 px inset at each side (SkinTokens.album.inset, TGP-02).
  return { width, height, items }
}
