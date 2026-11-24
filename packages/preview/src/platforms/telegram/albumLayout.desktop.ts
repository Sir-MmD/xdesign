// Telegram Desktop's album layout (docs/plan/29-owner-list-2026-10-22.md section 8.4, TGP-05;
// .dev/upd29/tg/desktop.md section 5): a port of tdesktop 7.3.3's ui/grouped_layout.cpp, GPL
// code reused for private use under FR-GEN-03 and D-06 like albumLayout.ts, kept as close to
// the original as the lint rules allow. The album is laid out in a 430 px box with the items
// 4 px apart (historyGroupWidthMax, historyGroupWidthMin and historyGroupSkip, chat.style:
// 508-510), then scaled to the bubble with the spacing scaled and rounded
// (GroupedMedia::countCurrentSize, history_view_media_grouped.cpp:209-262). Unlike Web A's:
// the 4 px are inside every formula, the complex case aims at 430 x 4/3, at most 3 items a
// row, and an album may be narrower than 430 (the bubble is then as narrow).
import { type AlbumItemBox, type AlbumLayoutFn, AlbumRectPart } from './albumLayout'

const { Top, Right, Bottom, Left } = AlbumRectPart

/** An item in the 430 px box, its sides in AlbumRectPart flags. */
interface Part {
  x: number
  y: number
  w: number
  h: number
  sides: number
}

interface Attempt {
  counts: number[]
  heights: number[]
}

/** The box's width and its items' narrowest (maxMediaSize, minPhotoSize). */
const maxWidth = 430
const minWidth = 100

/** base::SafeRound: half away from zero. */
const round = (v: number) => Math.sign(v) * Math.round(Math.abs(v))

/** C++ integer division. */
const idiv = (a: number, b: number) => Math.trunc(a / b)

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** Layouter::layout (grouped_layout.cpp:88-146): 2 to 4 items by their proportions, more in rows. */
function layout(ratios: readonly number[], spacing: number): Part[] {
  // "All apps currently use square max size first" (grouped_layout.cpp:96-99).
  const maxHeight = maxWidth
  const count = ratios.length
  const [r0 = 1, r1 = 1, r2 = 1, r3 = 1] = ratios
  if (count === 0) return []
  // layoutOne: as wide as the box, as tall as its ratio gives.
  if (count === 1) return [{ x: 0, y: 0, w: maxWidth, h: idiv(maxWidth, r0), sides: Left | Top | Right | Bottom }]
  // The average starts at 1, as the app's does (ranges::accumulate(_ratios, 1.)).
  const average = ratios.reduce((sum, r) => sum + r, 1) / count
  if (count >= 5 || ratios.some((r) => r > 2)) return complex(ratios, average, spacing)
  const proportions = ratios.map((r) => (r > 1.2 ? 'w' : r < 0.8 ? 'n' : 'q')).join('')
  if (count === 2) {
    if (proportions === 'ww' && average > 1.4 && r1 - r0 < 0.2) {
      // layoutTwoTopBottom (_maxSizeRatio is 1).
      const height = round(Math.min(maxWidth / r0, maxWidth / r1, (maxHeight - spacing) / 2))
      return [
        { x: 0, y: 0, w: maxWidth, h: height, sides: Left | Top | Right },
        { x: 0, y: height + spacing, w: maxWidth, h: height, sides: Left | Bottom | Right },
      ]
    }
    if (proportions === 'ww' || proportions === 'qq') {
      // layoutTwoLeftRightEqual.
      const width = idiv(maxWidth - spacing, 2)
      const height = round(Math.min(width / r0, width / r1, maxHeight))
      return [
        { x: 0, y: 0, w: width, h: height, sides: Top | Left | Bottom },
        { x: width + spacing, y: 0, w: width, h: height, sides: Top | Right | Bottom },
      ]
    }
    // layoutTwoLeftRight.
    const minimalWidth = round(minWidth * 1.5)
    const secondWidth = Math.min(
      round(Math.max(0.4 * (maxWidth - spacing), (maxWidth - spacing) / r0 / (1 / r0 + 1 / r1))),
      maxWidth - spacing - minimalWidth,
    )
    const firstWidth = maxWidth - secondWidth - spacing
    const height = Math.min(maxHeight, round(Math.min(firstWidth / r0, secondWidth / r1)))
    return [
      { x: 0, y: 0, w: firstWidth, h: height, sides: Top | Left | Bottom },
      { x: firstWidth + spacing, y: 0, w: secondWidth, h: height, sides: Top | Right | Bottom },
    ]
  }
  if (count === 3) {
    if (proportions.startsWith('n')) {
      // layoutThreeLeftAndOther.
      const firstHeight = maxHeight
      const thirdHeight = round(Math.min((maxHeight - spacing) / 2, (r1 * (maxWidth - spacing)) / (r2 + r1)))
      const secondHeight = firstHeight - thirdHeight - spacing
      const rightWidth = Math.max(
        minWidth,
        round(Math.min((maxWidth - spacing) / 2, thirdHeight * r2, secondHeight * r1)),
      )
      const leftWidth = Math.min(round(firstHeight * r0), maxWidth - spacing - rightWidth)
      return [
        { x: 0, y: 0, w: leftWidth, h: firstHeight, sides: Top | Left | Bottom },
        { x: leftWidth + spacing, y: 0, w: rightWidth, h: secondHeight, sides: Top | Right },
        {
          x: leftWidth + spacing,
          y: secondHeight + spacing,
          w: rightWidth,
          h: thirdHeight,
          sides: Bottom | Right,
        },
      ]
    }
    // layoutThreeTopAndOther.
    const firstWidth = maxWidth
    const firstHeight = round(Math.min(firstWidth / r0, (maxHeight - spacing) * 0.66))
    const secondWidth = idiv(maxWidth - spacing, 2)
    const secondHeight = Math.min(
      maxHeight - firstHeight - spacing,
      round(Math.min(secondWidth / r1, secondWidth / r2)),
    )
    const thirdWidth = firstWidth - secondWidth - spacing
    return [
      { x: 0, y: 0, w: firstWidth, h: firstHeight, sides: Left | Top | Right },
      { x: 0, y: firstHeight + spacing, w: secondWidth, h: secondHeight, sides: Bottom | Left },
      {
        x: secondWidth + spacing,
        y: firstHeight + spacing,
        w: thirdWidth,
        h: secondHeight,
        sides: Bottom | Right,
      },
    ]
  }
  if (proportions.startsWith('w')) {
    // layoutFourTopAndOther.
    const w = maxWidth
    const h0 = round(Math.min(w / r0, (maxHeight - spacing) * 0.66))
    const h = round((maxWidth - 2 * spacing) / (r1 + r2 + r3))
    const w0 = Math.max(minWidth, round(Math.min((maxWidth - 2 * spacing) * 0.4, h * r1)))
    const w2 = round(Math.max(minWidth, (maxWidth - 2 * spacing) * 0.33, h * r3))
    const w1 = w - w0 - w2 - 2 * spacing
    const h1 = Math.min(maxHeight - h0 - spacing, h)
    return [
      { x: 0, y: 0, w, h: h0, sides: Left | Top | Right },
      { x: 0, y: h0 + spacing, w: w0, h: h1, sides: Bottom | Left },
      { x: w0 + spacing, y: h0 + spacing, w: w1, h: h1, sides: Bottom },
      { x: w0 + spacing + w1 + spacing, y: h0 + spacing, w: w2, h: h1, sides: Right | Bottom },
    ]
  }
  // layoutFourLeftAndOther.
  const h = maxHeight
  const w0 = round(Math.min(h * r0, (maxWidth - spacing) * 0.6))
  const w = round((maxHeight - 2 * spacing) / (1 / r1 + 1 / r2 + 1 / r3))
  const h0 = round(w / r1)
  const h1 = round(w / r2)
  const h2 = h - h0 - h1 - 2 * spacing
  const w1 = Math.max(minWidth, Math.min(maxWidth - w0 - spacing, w))
  return [
    { x: 0, y: 0, w: w0, h, sides: Top | Left | Bottom },
    { x: w0 + spacing, y: 0, w: w1, h: h0, sides: Top | Right },
    { x: w0 + spacing, y: h0 + spacing, w: w1, h: h1, sides: Right },
    { x: w0 + spacing, y: h0 + h1 + 2 * spacing, w: w1, h: h2, sides: Bottom | Right },
  ]
}

/**
 * ComplexLayouter (grouped_layout.cpp:421-575): the ratios cropped to 1..2.75 (wide albums) or
 * 0.6667..1, every split into 2, 3 or 4 rows of at most 3 (the middle row of 3 rows takes 4
 * when the album is narrow), and the split whose height is nearest to 430 x 4/3, with a
 * penalty for a row lower than 100 or a row with more items than the next one.
 */
function complex(ratios: readonly number[], average: number, spacing: number): Part[] {
  const maxHeight = idiv(maxWidth * 4, 3)
  const cropped = ratios.map((r) => (average > 1.1 ? clamp(r, 1, 2.75) : clamp(r, 0.6667, 1)))
  const count = cropped.length
  const attempts: Attempt[] = []
  const push = (counts: number[]) => {
    let offset = 0
    const heights = counts.map((n) => {
      const sum = cropped.slice(offset, offset + n).reduce((total, r) => total + r, 0)
      offset += n
      return (maxWidth - (n - 1) * spacing) / sum
    })
    attempts.push({ counts, heights })
  }
  for (let first = 1; first !== count; ++first) {
    const second = count - first
    if (first > 3 || second > 3) continue
    push([first, second])
  }
  for (let first = 1; first < count - 1; ++first) {
    for (let second = 1; second !== count - first; ++second) {
      const third = count - first - second
      if (first > 3 || second > (average < 0.85 ? 4 : 3) || third > 3) continue
      push([first, second, third])
    }
  }
  for (let first = 1; first < count - 1; ++first) {
    for (let second = 1; second !== count - first; ++second) {
      for (let third = 1; third < count - first - second; ++third) {
        const fourth = count - first - second - third
        if (first > 3 || second > 3 || third > 3 || fourth > 3) continue
        push([first, second, third, fourth])
      }
    }
  }
  // The first attempt with the smallest difference wins.
  let optimal: Attempt | undefined
  let optimalDiff = 0
  for (const attempt of attempts) {
    const { counts, heights } = attempt
    const total = heights.reduce((sum, height) => sum + height, 0) + spacing * (counts.length - 1)
    const bad1 = Math.min(...heights) < minWidth ? 1.5 : 1
    const bad2 = counts.some((n, line) => line > 0 && (counts[line - 1] ?? 0) > n) ? 1.5 : 1
    const diff = Math.abs(total - maxHeight) * bad1 * bad2
    if (!optimal || diff < optimalDiff) {
      optimal = attempt
      optimalDiff = diff
    }
  }
  // xWriter: more than 12 items (Telegram sends at most 10) leaves no attempt; one row each.
  const rows = optimal ?? { counts: cropped.map(() => 1), heights: cropped.map((r) => maxWidth / r) }
  const parts: Part[] = []
  let index = 0
  let y = 0
  rows.counts.forEach((columns, row) => {
    const lineHeight = rows.heights[row] ?? minWidth
    const height = round(lineHeight)
    let x = 0
    for (let column = 0; column !== columns; ++column, ++index) {
      let sides = 0
      if (row === 0) sides |= Top
      if (row === rows.counts.length - 1) sides |= Bottom
      if (column === 0) sides |= Left
      if (column === columns - 1) sides |= Right
      const width = column === columns - 1 ? maxWidth - x : round((cropped[index] ?? 1) * lineHeight)
      parts.push({ x, y, w: width, h: height, sides })
      x += width + spacing
    }
    y += height + spacing
  })
  return parts
}

/**
 * Desktop's album (29 section 8.4): laid out at 430 with the look's gap (4) between the items,
 * then scaled to the widest album the bubble allows, the box never wider than its layout
 * (the bubble is as wide as the album).
 */
export const desktopAlbumLayout: AlbumLayoutFn = (ratios, { maxWidth: available, gap }) => {
  const parts = layout(
    ratios.map((r) => (Number.isFinite(r) && r > 0 ? r : 1)),
    gap,
  )
  if (parts.length === 0) return { width: 0, height: 0, items: [] }
  const naturalWidth = Math.max(1, ...parts.map((p) => p.x + p.w))
  const width = Math.min(Math.floor(available), naturalWidth)
  const factor = width / naturalWidth
  const scale = (v: number) => round(v * factor)
  const spacing = scale(gap)
  const items: AlbumItemBox[] = parts.map((p) => {
    const rightSkip = (p.sides & Right) === 0
    const bottomSkip = (p.sides & Bottom) === 0
    const left = scale(p.x)
    const top = scale(p.y)
    // At least 1 px: a very wide or very tall picture can take the app's sums under 0 (RVW-29c).
    return {
      x: left,
      y: top,
      width: Math.max(1, scale(p.x + p.w + (rightSkip ? gap : 0)) - left - (rightSkip ? spacing : 0)),
      height: Math.max(1, scale(p.y + p.h + (bottomSkip ? gap : 0)) - top - (bottomSkip ? spacing : 0)),
      sides: p.sides,
    }
  })
  return { width, height: Math.max(...items.map((item) => item.y + item.height)), items }
}
