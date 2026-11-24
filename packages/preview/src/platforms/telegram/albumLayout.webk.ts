// Web K's album layout (docs/plan/29-owner-list-2026-10-22.md section 8.6, TGP-04): a port of
// tweb's src/components/groupedLayout.ts (morethanwords/tweb commit 1da254b, itself a port of
// tdesktop ui/grouped_layout.cpp) as tweb lays out a chat album (wrappers/album.ts:53-61,
// prepareAlbum.ts:16-67): the album at most W wide (420, 340 in a window of 600 px or less,
// mediaSizes.ts:68, 86), no taller than W (no maxHeight is passed, so maxHeight is maxWidth),
// its items at least 100 wide (album.ts:57) and 1 px apart inside the layout
// (ALBUM_ITEM_SPACING, prepareAlbum.ts:4). From the measurement sheet .dev/upd29/tg/web-k.md
// section 5. GPL code, reused for private use like albumLayout.ts (FR-GEN-03, D-06); kept as
// close to the original as the lint rules allow.
import { type AlbumItemBox, type AlbumLayoutFn, AlbumRectPart } from './albumLayout'

const { Top, Right, Bottom, Left } = AlbumRectPart

/** The narrowest item (album.ts:57). */
const minWidth = 100

/** Telegram's largest album: the complex layout has no rows for more than 12 items. */
const maxItems = 10

const sum = (list: readonly number[]) => list.reduce((total, value) => total + value, 0)

function box(x: number, y: number, width: number, height: number, sides: number): AlbumItemBox {
  return { x, y, width, height, sides }
}

/**
 * Web K's album (29 section 8.4): tweb's layout at the widest album the bubble allows, the
 * look's gap (1) inside it, and the album's box from its items: as wide as the right edge of
 * the first item on the right side and as tall as the bottom of the first item at the bottom
 * (prepareAlbum.ts:25-67). The bubble is as wide as the album.
 */
export const webkAlbumLayout: AlbumLayoutFn = (ratios, { maxWidth, gap }) => {
  const r = ratios.slice(0, maxItems).map((ratio) => (ratio > 0 && Number.isFinite(ratio) ? ratio : 1))
  const items = layout(r, maxWidth, maxWidth, gap)
  const right = items.find((item) => (item.sides & Right) !== 0)
  const bottom = items.find((item) => (item.sides & Bottom) !== 0)
  return {
    width: right ? right.x + right.width : maxWidth,
    height: bottom ? bottom.y + bottom.height : 0,
    items,
  }
}

/** Layouter.layout (groupedLayout.ts:59-77): one item, two, three, four, or the complex layout. */
function layout(r: readonly number[], maxWidth: number, maxHeight: number, spacing: number): AlbumItemBox[] {
  const count = r.length
  if (count === 0) return []
  const [r0 = 1, r1 = 1, r2 = 1, r3 = 1] = r
  if (count === 1) return [box(0, 0, maxWidth, maxWidth / r0, Left | Top | Right | Bottom)]
  const proportions = r.map((ratio) => (ratio > 1.2 ? 'w' : ratio < 0.8 ? 'n' : 'q')).join('')
  // accumulate(ratios, 1): the 1 is in the source (groupedLayout.ts:55).
  const averageRatio = (1 + sum(r)) / count
  const maxSizeRatio = maxWidth / maxHeight
  if (count >= 5 || r.some((ratio) => ratio > 2)) return complex(r, averageRatio, maxWidth, spacing)

  if (count === 2) {
    if (proportions === 'ww' && averageRatio > 1.4 * maxSizeRatio && r1 - r0 < 0.2) {
      // layoutTwoTopBottom
      const height = Math.round(Math.min(maxWidth / r0, Math.min(maxWidth / r1, (maxHeight - spacing) / 2)))
      return [
        box(0, 0, maxWidth, height, Left | Top | Right),
        box(0, height + spacing, maxWidth, height, Left | Bottom | Right),
      ]
    }
    if (proportions === 'ww' || proportions === 'qq') {
      // layoutTwoLeftRightEqual: the width is not rounded.
      const width = (maxWidth - spacing) / 2
      const height = Math.round(Math.min(width / r0, Math.min(width / r1, maxHeight)))
      return [
        box(0, 0, width, height, Top | Left | Bottom),
        box(width + spacing, 0, width, height, Top | Right | Bottom),
      ]
    }
    // layoutTwoLeftRight
    const minimalWidth = Math.round(minWidth * 1.5)
    const secondWidth = Math.min(
      Math.round(Math.max(0.4 * (maxWidth - spacing), (maxWidth - spacing) / r0 / (1 / r0 + 1 / r1))),
      maxWidth - spacing - minimalWidth,
    )
    const firstWidth = maxWidth - secondWidth - spacing
    const height = Math.min(maxHeight, Math.round(Math.min(firstWidth / r0, secondWidth / r1)))
    return [
      box(0, 0, firstWidth, height, Top | Left | Bottom),
      box(firstWidth + spacing, 0, secondWidth, height, Top | Right | Bottom),
    ]
  }

  if (count === 3) {
    if (proportions.startsWith('n')) {
      // layoutThreeLeftAndOther
      const firstHeight = maxHeight
      const thirdHeight = Math.round(Math.min((maxHeight - spacing) / 2, (r1 * (maxWidth - spacing)) / (r2 + r1)))
      const secondHeight = firstHeight - thirdHeight - spacing
      const rightWidth = Math.max(
        minWidth,
        Math.round(Math.min((maxWidth - spacing) / 2, Math.min(thirdHeight * r2, secondHeight * r1))),
      )
      const leftWidth = Math.min(Math.round(firstHeight * r0), maxWidth - spacing - rightWidth)
      return [
        box(0, 0, leftWidth, firstHeight, Top | Left | Bottom),
        box(leftWidth + spacing, 0, rightWidth, secondHeight, Top | Right),
        box(leftWidth + spacing, secondHeight + spacing, rightWidth, thirdHeight, Bottom | Right),
      ]
    }
    // layoutThreeTopAndOther
    const firstWidth = maxWidth
    const firstHeight = Math.round(Math.min(firstWidth / r0, (maxHeight - spacing) * 0.66))
    const secondWidth = (maxWidth - spacing) / 2
    const secondHeight = Math.min(
      maxHeight - firstHeight - spacing,
      Math.round(Math.min(secondWidth / r1, secondWidth / r2)),
    )
    const thirdWidth = firstWidth - secondWidth - spacing
    return [
      box(0, 0, firstWidth, firstHeight, Left | Top | Right),
      box(0, firstHeight + spacing, secondWidth, secondHeight, Bottom | Left),
      box(secondWidth + spacing, firstHeight + spacing, thirdWidth, secondHeight, Bottom | Right),
    ]
  }

  if (proportions.startsWith('w')) {
    // layoutFourTopAndOther
    const w = maxWidth
    const h0 = Math.round(Math.min(w / r0, (maxHeight - spacing) * 0.66))
    const h = Math.round((maxWidth - 2 * spacing) / (r1 + r2 + r3))
    const w0 = Math.max(minWidth, Math.round(Math.min((maxWidth - 2 * spacing) * 0.4, h * r1)))
    const w2 = Math.round(Math.max(Math.max(minWidth, (maxWidth - 2 * spacing) * 0.33), h * r3))
    const w1 = w - w0 - w2 - 2 * spacing
    const h1 = Math.min(maxHeight - h0 - spacing, h)
    return [
      box(0, 0, w, h0, Left | Top | Right),
      box(0, h0 + spacing, w0, h1, Bottom | Left),
      box(w0 + spacing, h0 + spacing, w1, h1, Bottom),
      box(w0 + spacing + w1 + spacing, h0 + spacing, w2, h1, Right | Bottom),
    ]
  }
  // layoutFourLeftAndOther
  const h = maxHeight
  const w0 = Math.round(Math.min(h * r0, (maxWidth - spacing) * 0.6))
  const w = Math.round((maxHeight - 2 * spacing) / (1 / r1 + 1 / r2 + 1 / r3))
  const h0 = Math.round(w / r1)
  const h1 = Math.round(w / r2)
  const h2 = h - h0 - h1 - 2 * spacing
  const w1 = Math.max(minWidth, Math.min(maxWidth - w0 - spacing, w))
  return [
    box(0, 0, w0, h, Top | Left | Bottom),
    box(w0 + spacing, 0, w1, h0, Top | Right),
    box(w0 + spacing, h0 + spacing, w1, h1, Right),
    box(w0 + spacing, h0 + h1 + 2 * spacing, w1, h2, Bottom | Right),
  ]
}

interface Attempt {
  lineCounts: number[]
  heights: number[]
}

/**
 * ComplexLayouter (groupedLayout.ts:340-503): five items or more, or one wider than 2:1. The
 * ratios cropped by the average, every split into two to four rows of at most three (the middle
 * of three rows four when the album is tall), and the split whose height is nearest W x 4 / 3,
 * a row under 100 high or a row with fewer items above more counting half again. The heights
 * are not scaled (no maxHeight is passed).
 */
function complex(ratios: readonly number[], averageRatio: number, maxWidth: number, spacing: number): AlbumItemBox[] {
  const r = ratios.map((ratio) => (averageRatio > 1.1 ? clamp(ratio, 1, 2.75) : clamp(ratio, 0.6667, 1)))
  const count = r.length
  const maxHeight = (maxWidth * 4) / 3
  const attempts: Attempt[] = []
  const multiHeight = (offset: number, lineCount: number) =>
    (maxWidth - (lineCount - 1) * spacing) / sum(r.slice(offset, offset + lineCount))
  const pushAttempt = (lineCounts: number[]) => {
    const heights: number[] = []
    let offset = 0
    for (const lineCount of lineCounts) {
      heights.push(multiHeight(offset, lineCount))
      offset += lineCount
    }
    attempts.push({ lineCounts, heights })
  }
  for (let first = 1; first < count; first++) {
    const second = count - first
    if (first > 3 || second > 3) continue
    pushAttempt([first, second])
  }
  for (let first = 1; first < count - 1; first++) {
    for (let second = 1; second < count - first; second++) {
      const third = count - first - second
      if (first > 3 || second > (averageRatio < 0.85 ? 4 : 3) || third > 3) continue
      pushAttempt([first, second, third])
    }
  }
  for (let first = 1; first < count - 1; first++) {
    for (let second = 1; second < count - first; second++) {
      for (let third = 1; third < count - first - second; third++) {
        const fourth = count - first - second - third
        if (first > 3 || second > 3 || third > 3 || fourth > 3) continue
        pushAttempt([first, second, third, fourth])
      }
    }
  }
  let optimal: Attempt | undefined
  let optimalDiff = 0
  for (const attempt of attempts) {
    const { heights, lineCounts } = attempt
    const totalHeight = sum(heights) + spacing * (lineCounts.length - 1)
    const bad1 = Math.min(...heights) < minWidth ? 1.5 : 1
    let bad2 = 1
    for (let line = 1; line < lineCounts.length; line++) {
      if ((lineCounts[line - 1] ?? 0) > (lineCounts[line] ?? 0)) {
        bad2 = 1.5
        break
      }
    }
    const diff = Math.abs(totalHeight - maxHeight) * bad1 * bad2
    if (!optimal || diff < optimalDiff) {
      optimal = attempt
      optimalDiff = diff
    }
  }
  if (!optimal) return []
  const { lineCounts, heights } = optimal
  const result: AlbumItemBox[] = []
  const rowCount = lineCounts.length
  let index = 0
  let y = 0
  lineCounts.forEach((colCount, row) => {
    const lineHeight = heights[row] ?? 0
    const height = Math.round(lineHeight)
    let x = 0
    for (let col = 0; col < colCount; col++) {
      const sides =
        (row === 0 ? Top : 0) |
        (row === rowCount - 1 ? Bottom : 0) |
        (col === 0 ? Left : 0) |
        (col === colCount - 1 ? Right : 0)
      const width = col === colCount - 1 ? maxWidth - x : Math.round((r[index] ?? 1) * lineHeight)
      result.push(box(x, y, width, height, sides))
      x += width + spacing
      index++
    }
    y += height + spacing
  })
  return result
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
