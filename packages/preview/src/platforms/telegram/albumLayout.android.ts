// Telegram for Android's album layout (docs/plan/29-owner-list-2026-10-22.md section 8.4,
// TGP-06; .dev/upd29/tg/android.md section 5): a port of MessageObject.GroupedMessages.calculate
// (MessageObject.java:1313-1724, Telegram for Android 13.0.3) and of ChatMessageCell's cell
// sizing (ChatMessageCell.java:10022-10070, 10494-10512, 13366-13377), for an incoming channel
// post. Android scales an album's widths by the chat area's width (a row is 800 of 1000) and its
// heights by half the screen's height, so its shape follows the phone. GPL code, reused for
// private use like albumLayout.ts (FR-GEN-03, D-06); kept close to the original, its quirks
// included, so later changes can be compared line by line.
import { type AlbumItemBox, type AlbumLayoutFn, AlbumRectPart } from './albumLayout'

const { Top, Right, Bottom, Left } = AlbumRectPart

/**
 * A GroupedMessagePosition: its columns and rows, its width in units of a 800 row, its height
 * as a share of 814, the album's sides it touches (AlbumRectPart flags), the shares of the rows
 * a tall item spans, and where an item of the right column starts (units of 800).
 */
interface Position {
  minX: number
  maxX: number
  minY: number
  maxY: number
  pw: number
  ph: number
  flags: number
  siblingHeights: number[] | null
  leftSpanOffset: number
}

function at(minX: number, maxX: number, minY: number, maxY: number, pw: number, ph: number, flags: number): Position {
  return { minX, maxX, minY, maxY, pw, ph, flags, siblingHeights: null, leftSpanOffset: 0 }
}

/** The owner's phone: 1080 device pixels across (android.md section 1), at any chat width. */
const density = (frameWidth: number) => 1080 / frameWidth

/** The screen's height: the owner's 384 x 853 phone, the same 20:9 shape at other widths (android.md section 10, point 1, estimate). */
const screenHeight = (frameWidth: number) => (frameWidth * 853) / 384

/** The space between two pictures, across and down (android.md section 5). */
const gap = 2

/** The picture's inset from the bubble's edges (ChatMessageCell.java:14068-14089). */
const inset = 2

/** GroupedMessages.calculate: the positions of 2 to 10 items of these width / height ratios. */
function calculate(ratios: readonly number[], frameWidth: number): Position[] {
  const d = density(frameWidth)
  // AndroidUtilities.dp: whole device pixels, rounded up.
  const dpPx = (x: number) => Math.ceil(d * x)
  const maxW = 800
  const maxH = 814
  const count = ratios.length
  const r = (i: number) => ratios[i] ?? 1
  const proportions = ratios.map((ratio) => (ratio > 1.2 ? 'w' : ratio < 0.8 ? 'n' : 'q')).join('')
  // The average starts at 1 (MessageObject.java:1330, 1432), as in the app.
  const average = ratios.reduce((sum, ratio) => sum + ratio, 1) / count
  const forceCalc = ratios.some((ratio) => ratio > 2)
  const unit = (frameWidth * d) / maxW
  const minWidth = Math.trunc(dpPx(120) / unit)
  const paddingsWidth = Math.trunc(dpPx(40) / unit)
  // Device pixels compared with units of 814 (MessageObject.java:1428, 1548-1549), as in the app.
  const minHeight = dpPx(120)
  const maxAspect = maxW / maxH
  const minH = dpPx(100) / maxH

  if (!forceCalc && count === 2) {
    const r1 = r(0)
    const r2 = r(1)
    if (proportions === 'ww' && average > 1.4 * maxAspect && r1 - r2 < 0.2) {
      const height = Math.round(Math.min(maxW / r1, maxW / r2, maxH / 2)) / maxH
      return [at(0, 0, 0, 0, maxW, height, Left | Right | Top), at(0, 0, 1, 1, maxW, height, Left | Right | Bottom)]
    }
    if (proportions === 'ww' || proportions === 'qq') {
      const width = maxW / 2
      const height = Math.round(Math.min(width / r1, width / r2, maxH)) / maxH
      return [at(0, 0, 0, 0, width, height, Left | Bottom | Top), at(1, 1, 0, 0, width, height, Right | Bottom | Top)]
    }
    let secondWidth = Math.trunc(Math.max(0.4 * maxW, Math.round(maxW / r1 / (1 / r1 + 1 / r2))))
    let firstWidth = maxW - secondWidth
    if (firstWidth < minWidth) {
      secondWidth -= minWidth - firstWidth
      firstWidth = minWidth
    }
    const height = Math.min(maxH, Math.round(Math.min(firstWidth / r1, secondWidth / r2))) / maxH
    return [
      at(0, 0, 0, 0, firstWidth, height, Left | Bottom | Top),
      at(1, 1, 0, 0, secondWidth, height, Right | Bottom | Top),
    ]
  }

  if (!forceCalc && count === 3) {
    const r1 = r(0)
    const r2 = r(1)
    const r3 = r(2)
    if (proportions.startsWith('n')) {
      const thirdHeight = Math.min(maxH * 0.5, Math.round((r2 * maxW) / (r3 + r2)))
      const secondHeight = maxH - thirdHeight
      const rightWidth = Math.trunc(
        Math.max(minWidth, Math.min(maxW * 0.5, Math.round(Math.min(thirdHeight * r3, secondHeight * r2)))),
      )
      const leftWidth = Math.round(Math.min(maxH * r1 + paddingsWidth, maxW - rightWidth))
      const first = at(0, 0, 0, 1, leftWidth, 1, Left | Bottom | Top)
      first.siblingHeights = [thirdHeight / maxH, secondHeight / maxH]
      const third = at(0, 1, 1, 1, rightWidth, thirdHeight / maxH, Right | Bottom)
      third.leftSpanOffset = leftWidth
      return [first, at(1, 1, 0, 0, rightWidth, secondHeight / maxH, Right | Top), third]
    }
    const firstHeight = Math.round(Math.min(maxW / r1, maxH * 0.66)) / maxH
    const width = maxW / 2
    // 814 less a share of it (MessageObject.java:1503), as in the app.
    const secondHeight = Math.max(
      minH,
      Math.min(maxH - firstHeight, Math.round(Math.min(width / r2, width / r3))) / maxH,
    )
    return [
      at(0, 1, 0, 0, maxW, firstHeight, Left | Right | Top),
      at(0, 0, 1, 1, width, secondHeight, Left | Bottom),
      at(1, 1, 1, 1, width, secondHeight, Right | Bottom),
    ]
  }

  if (!forceCalc && count === 4) {
    const r1 = r(0)
    const r2 = r(1)
    const r3 = r(2)
    const r4 = r(3)
    if (proportions.startsWith('w')) {
      const h0 = Math.round(Math.min(maxW / r1, maxH * 0.66)) / maxH
      let h = Math.round(maxW / (r2 + r3 + r4))
      let w0 = Math.trunc(Math.max(minWidth, Math.min(maxW * 0.4, h * r2)))
      let w2 = Math.trunc(Math.max(Math.max(minWidth, maxW * 0.33), h * r4))
      let w1 = maxW - w0 - w2
      // dp(58) in device pixels, compared with units of 800 (MessageObject.java:1531), as in the app.
      const least = dpPx(58)
      if (w1 < least) {
        const diff = least - w1
        w1 = least
        w0 -= Math.trunc(diff / 2)
        w2 -= diff - Math.trunc(diff / 2)
      }
      h = Math.max(minH, Math.min(maxH - h0, h) / maxH)
      return [
        at(0, 2, 0, 0, maxW, h0, Left | Right | Top),
        at(0, 0, 1, 1, w0, h, Left | Bottom),
        at(1, 1, 1, 1, w1, h, Bottom),
        at(2, 2, 1, 1, w2, h, Right | Bottom),
      ]
    }
    const w = Math.max(minWidth, Math.round(maxH / (1 / r2 + 1 / r3 + 1 / r4)))
    const h0 = Math.min(0.33, Math.max(minHeight, w / r2) / maxH)
    const h1 = Math.min(0.33, Math.max(minHeight, w / r3) / maxH)
    const h2 = 1 - h0 - h1
    const w0 = Math.round(Math.min(maxH * r1 + paddingsWidth, maxW - w))
    const first = at(0, 0, 0, 2, w0, h0 + h1 + h2, Left | Top | Bottom)
    first.siblingHeights = [h0, h1, h2]
    const third = at(0, 1, 1, 1, w, h1, Right)
    third.leftSpanOffset = w0
    const fourth = at(0, 1, 2, 2, w, h2, Right | Bottom)
    fourth.leftSpanOffset = w0
    return [first, at(1, 1, 0, 0, w, h0, Right | Top), third, fourth]
  }

  // Five items or more, or a very wide one: the rows of up to three (four in the middle of
  // tall albums) whose heights come closest to 1064 (MessageObject.java:1569-1690).
  const cropped = ratios.map((ratio) =>
    Math.max(0.66667, Math.min(1.7, average > 1.1 ? Math.max(1, ratio) : Math.min(1, ratio))),
  )
  const multiHeight = (from: number, to: number) => maxW / cropped.slice(from, to).reduce((sum, x) => sum + x, 0)
  const attempts: { counts: number[]; heights: number[] }[] = []
  for (let a = 1; a < count; a++) {
    const b = count - a
    if (a > 3 || b > 3) continue
    attempts.push({ counts: [a, b], heights: [multiHeight(0, a), multiHeight(a, count)] })
  }
  for (let a = 1; a < count - 1; a++) {
    for (let b = 1; b < count - a; b++) {
      const c = count - a - b
      if (a > 3 || b > (average < 0.85 ? 4 : 3) || c > 3) continue
      attempts.push({
        counts: [a, b, c],
        heights: [multiHeight(0, a), multiHeight(a, a + b), multiHeight(a + b, count)],
      })
    }
  }
  for (let a = 1; a < count - 2; a++) {
    for (let b = 1; b < count - a; b++) {
      for (let c = 1; c < count - a - b; c++) {
        const e = count - a - b - c
        if (a > 3 || b > 3 || c > 3 || e > 3) continue
        attempts.push({
          counts: [a, b, c, e],
          heights: [
            multiHeight(0, a),
            multiHeight(a, a + b),
            multiHeight(a + b, a + b + c),
            multiHeight(a + b + c, count),
          ],
        })
      }
    }
  }
  const target = Math.trunc(maxW / 3) * 4
  let best: { counts: number[]; heights: number[] } | undefined
  let bestDiff = 0
  for (const attempt of attempts) {
    const height = attempt.heights.reduce((sum, x) => sum + x, 0)
    let diff = Math.abs(height - target)
    const [k0 = 0, k1 = 0, k2 = 0, k3 = 0] = attempt.counts
    const rows = attempt.counts.length
    if (rows > 1 && (k0 > k1 || (rows > 2 && k1 > k2) || (rows > 3 && k2 > k3))) diff *= 1.2
    // A row's height compared with the narrowest width (MessageObject.java:1641), as in the app.
    if (Math.min(...attempt.heights) < minWidth) diff *= 1.5
    if (!best || diff < bestDiff) {
      best = attempt
      bestDiff = diff
    }
  }
  if (!best) return []
  const positions: Position[] = []
  let index = 0
  for (let row = 0; row < best.counts.length; row++) {
    const c = best.counts[row] ?? 0
    const lineHeight = best.heights[row] ?? 0
    let spanLeft = maxW
    for (let k = 0; k < c; k++, index++) {
      const width = Math.trunc((cropped[index] ?? 1) * lineHeight)
      spanLeft -= width
      let flags = 0
      if (row === 0) flags |= Top
      if (row === best.counts.length - 1) flags |= Bottom
      if (k === 0) flags |= Left
      if (k === c - 1) flags |= Right
      positions.push(at(k, k, row, row, width, Math.max(minH, lineHeight / maxH), flags))
    }
    // An incoming post's row ends with its right item, which takes what is left of the 800.
    const last = positions[positions.length - 1]
    if (last) last.pw += spanLeft
  }
  return positions
}

/**
 * Android's album: GroupedMessages.calculate, then each cell's picture as ChatMessageCell sizes
 * it. A cell is ceil(pw / 1000 x the chat width) device pixels wide; its picture loses 17 when
 * it touches both sides, 14 on the left, 5 on the right and 2 inside; a row is ceil(ph x half
 * the screen's height) tall, a picture 4 taller below the top row and 1 above the bottom one, a
 * tall item the rows it spans and about 7 for each row it crosses; pictures 2 apart. The box is
 * the bubble's: the album 2 inside its edges (android.css draws each picture's corners and
 * takes the 2 under it away above a caption).
 */
export const androidAlbumLayout: AlbumLayoutFn = (ratios, { frameWidth }) => {
  const positions = calculate(
    ratios.map((r) => (Number.isFinite(r) && r > 0 ? r : 1)),
    frameWidth,
  )
  if (positions.length === 0) return { width: 0, height: 0, items: [] }
  const d = density(frameWidth)
  const dp = (x: number) => Math.ceil(d * x)
  const groupWidth = frameWidth * d
  const rowsHeight = (Math.max(frameWidth, screenHeight(frameWidth)) * d) / 2
  const cell = (units: number) => Math.ceil((units / 1000) * groupWidth)
  const lineWidth = (row: number) =>
    positions
      .filter((p) => p.minY === row)
      .reduce((sum, p) => sum + cell(p.pw) + (p.leftSpanOffset !== 0 ? cell(p.leftSpanOffset) : 0), 0)
  const firstLine = lineWidth(0)
  const sizes = positions.map((p) => {
    const left = (p.flags & Left) !== 0
    const right = (p.flags & Right) !== 0
    let w = cell(p.pw)
    // A lower row's right item ends where the first row does.
    if (p.minY !== 0 && right) w += firstLine - lineWidth(p.minY)
    w -= dp(9)
    if (left && right) w -= dp(8)
    else if (!left && !right) w -= dp(11)
    else if (right) w -= dp(10)
    else w -= dp(9)
    // An incoming item off the album's left edge (edge false) and the sides it does not touch.
    if (!left) w += dp(10)
    if (!right) w += dp(4)
    if (!left) w += dp(4)
    let h = p.siblingHeights
      ? p.siblingHeights.reduce((sum, s) => sum + Math.ceil(rowsHeight * s), 0) + (p.maxY - p.minY) * Math.round(7 * d)
      : Math.ceil(rowsHeight * p.ph)
    if ((p.flags & Top) === 0) h += dp(4)
    if ((p.flags & Bottom) === 0) h += dp(1)
    // At least 1 px: a very wide or very tall picture can take a cell under its insets (RVW-29c).
    return { p, width: Math.max(1, w / d), height: Math.max(1, h / d) }
  })
  const rows = Math.max(...positions.map((p) => p.maxY)) + 1
  const rowTops: number[] = []
  let y = 0
  for (let row = 0; row < rows; row++) {
    rowTops.push(y)
    const one = sizes.find((s) => s.p.minY === row && s.p.maxY === row)
    y += (one?.height ?? 0) + gap
  }
  // Each row's pictures left to right; a right column's start after the tall item on the left.
  const tall = sizes.find((s) => s.p.siblingHeights !== null)
  const rowEnds = rowTops.map(() => 0)
  const items: AlbumItemBox[] = sizes.map(({ p, width, height }) => {
    let x = rowEnds[p.minY] ?? 0
    if (p.leftSpanOffset !== 0 && x === 0) x = (tall?.width ?? 0) + gap
    rowEnds[p.minY] = x + width + gap
    return { x: inset + x, y: inset + (rowTops[p.minY] ?? 0), width, height, sides: p.flags }
  })
  const width = Math.max(...items.map((item) => item.x + item.width)) + inset
  const height = Math.max(...items.map((item) => item.y + item.height)) + inset
  return { width, height, items }
}
