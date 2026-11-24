// A port of Telegram Web A's calculateAlbumLayout.ts (Ajaxy/telegram-tt commit 28ffcf7,
// src/components/middle/message/helpers/calculateAlbumLayout.ts), itself ported from
// tdesktop ui/grouped_layout.cpp and TelegramSwift GroupedLayout.swift (docs/plan/10-frontend.md
// section 8.7). GPL code, reused for private use under FR-GEN-03 and D-06. Kept as close to
// the original as the lint rules allow, so later Web A changes can be compared line by line.

type ApiDimensions = { width: number; height: number }

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num))
}

// xWriter: checked indexing for noUncheckedIndexedAccess, where the original indexes
// directly (the indexes are always in range).
function at<T>(list: readonly T[], index: number): T {
  const value = list[index]
  if (value === undefined) {
    throw new RangeError(`album layout: no item ${String(index)}`)
  }
  return value
}

export const AlbumRectPart = {
  None: 0,
  Top: 1,
  Right: 2,
  Bottom: 4,
  Left: 8,
}

type IAttempt = {
  lineCounts: number[]
  heights: number[]
}
type IMediaDimensions = {
  width: number
  height: number
  x: number
  y: number
}
type IMediaLayout = {
  dimensions: IMediaDimensions
  sides: number
}
export type IAlbumLayoutItem = {
  rect: IMediaDimensions
  sides: number
}
type ILayoutParams = {
  ratios: number[]
  proportions: string
  averageRatio: number
  maxWidth: number
  minWidth: number
  maxHeight: number
  spacing: number
}
export type IAlbumLayout = {
  items: IAlbumLayoutItem[]
  aspectRatio: number
}

const MAX_COMPLEX_LAYOUT_ROW_ITEMS = 3
const MAX_COMPLEX_LAYOUT_LAST_ROW_ITEMS = 4
const EXTENDED_LAYOUT_EXTRA_ROW_COUNT = 2
const MIN_EXTENDED_LAYOUT_ROW_COUNT = 5
const INTERNAL_LAYOUT_WIDTH = 464
const MIN_ITEM_WIDTH = 100

function getProportions(ratios: number[]) {
  return ratios.map((ratio) => (ratio > 1.2 ? 'w' : ratio < 0.8 ? 'n' : 'q')).join('')
}

function getAverageRatio(ratios: number[]) {
  return ratios.reduce((result, ratio) => ratio + result, 1) / ratios.length
}

function accumulate(list: number[], initValue: number) {
  return list.reduce((accumulator, item) => accumulator + item, initValue)
}

function buildBaseLineCounts(count: number, averageRatio: number) {
  return [
    [MAX_COMPLEX_LAYOUT_ROW_ITEMS, MAX_COMPLEX_LAYOUT_ROW_ITEMS],
    [
      MAX_COMPLEX_LAYOUT_ROW_ITEMS,
      averageRatio < 0.85 ? MAX_COMPLEX_LAYOUT_LAST_ROW_ITEMS : MAX_COMPLEX_LAYOUT_ROW_ITEMS,
      MAX_COMPLEX_LAYOUT_ROW_ITEMS,
    ],
    [
      MAX_COMPLEX_LAYOUT_ROW_ITEMS,
      MAX_COMPLEX_LAYOUT_ROW_ITEMS,
      MAX_COMPLEX_LAYOUT_ROW_ITEMS,
      MAX_COMPLEX_LAYOUT_LAST_ROW_ITEMS,
    ],
  ].flatMap((maxCounts) => buildLineCounts(count, maxCounts))
}

function buildExtendedLineCounts(count: number) {
  const minRowCount = Math.max(
    MIN_EXTENDED_LAYOUT_ROW_COUNT,
    Math.ceil((count - MAX_COMPLEX_LAYOUT_LAST_ROW_ITEMS) / MAX_COMPLEX_LAYOUT_ROW_ITEMS) + 1,
  )
  const maxRowCount = Math.min(count, minRowCount + EXTENDED_LAYOUT_EXTRA_ROW_COUNT)
  const lineCounts: number[][] = []

  for (let rowCount = minRowCount; rowCount <= maxRowCount; rowCount++) {
    const currentLineCounts = buildExtendedLineCount(count, rowCount)
    if (currentLineCounts) {
      lineCounts.push(currentLineCounts)
    }
  }

  return lineCounts
}

function buildExtendedLineCount(count: number, rowCount: number) {
  const lineCounts = Array.from({ length: rowCount }, () => 1)
  const maxCounts = Array.from({ length: rowCount }, () => MAX_COMPLEX_LAYOUT_ROW_ITEMS)
  maxCounts[rowCount - 1] = MAX_COMPLEX_LAYOUT_LAST_ROW_ITEMS

  if (count > accumulate(maxCounts, 0)) {
    return undefined
  }

  let remainingCount = count - rowCount
  for (let row = rowCount - 1; row >= 0 && remainingCount; row--) {
    const addedCount = Math.min(remainingCount, at(maxCounts, row) - at(lineCounts, row))
    lineCounts[row] = at(lineCounts, row) + addedCount
    remainingCount -= addedCount
  }

  return lineCounts
}

function buildLineCounts(count: number, maxCounts: number[]) {
  const lineCounts: number[][] = []
  collectLineCounts(count, maxCounts, [], lineCounts)
  return lineCounts
}

function collectLineCounts(
  remainingCount: number,
  maxCounts: number[],
  currentLineCounts: number[],
  result: number[][],
) {
  if (!maxCounts.length) {
    if (!remainingCount) {
      result.push([...currentLineCounts])
    }

    return
  }

  const maxCurrentCount = at(maxCounts, 0)
  const restMaxCounts = maxCounts.slice(1)
  const maxRestCount = accumulate(restMaxCounts, 0)
  const minCurrentCount = Math.max(1, remainingCount - maxRestCount)
  const maxAllowedCount = Math.min(maxCurrentCount, remainingCount - restMaxCounts.length)

  for (let currentCount = minCurrentCount; currentCount <= maxAllowedCount; currentCount++) {
    currentLineCounts.push(currentCount)
    collectLineCounts(remainingCount - currentCount, restMaxCounts, currentLineCounts, result)
    currentLineCounts.pop()
  }
}

function cropRatios(ratios: number[], averageRatio: number) {
  return ratios.map((ratio) => {
    return averageRatio > 1.1 ? clamp(ratio, 1, 2.75) : clamp(ratio, 0.6667, 1)
  })
}

function calculateContainerSize(layout: IMediaLayout[]) {
  const styles: ApiDimensions = { width: 0, height: 0 }
  layout.forEach(({ dimensions, sides }) => {
    if (sides & AlbumRectPart.Right) {
      styles.width = dimensions.width + dimensions.x
    }
    if (sides & AlbumRectPart.Bottom) {
      styles.height = dimensions.height + dimensions.y
    }
  })

  return styles
}

export function calculateAlbumLayout(ratios: number[]): IAlbumLayout {
  if (!ratios.length) {
    return {
      items: [],
      aspectRatio: 1,
    }
  }

  const proportions = getProportions(ratios)
  const averageRatio = getAverageRatio(ratios)
  const albumCount = ratios.length
  const forceCalc = ratios.some((ratio) => ratio > 2)
  const maxWidth = INTERNAL_LAYOUT_WIDTH
  const maxHeight = maxWidth

  let layout: IMediaLayout[]

  const params = {
    ratios,
    proportions,
    averageRatio,
    maxWidth,
    minWidth: MIN_ITEM_WIDTH,
    maxHeight,
    spacing: 0,
  }

  if (albumCount === 1) {
    layout = layoutSingle(params)
  } else if (albumCount >= 5 || forceCalc) {
    layout = layoutWithComplexLayouter(params)
  } else if (albumCount === 2) {
    layout = layoutTwo(params)
  } else if (albumCount === 3) {
    layout = layoutThree(params)
  } else {
    layout = layoutFour(params)
  }

  const containerSize = calculateContainerSize(layout)

  return {
    items: layout.map(({ dimensions, sides }) => ({
      rect: {
        x: dimensions.x / containerSize.width,
        y: dimensions.y / containerSize.height,
        width: dimensions.width / containerSize.width,
        height: dimensions.height / containerSize.height,
      },
      sides,
    })),
    aspectRatio: containerSize.width / containerSize.height,
  }
}

function layoutSingle({ ratios, maxWidth, maxHeight }: ILayoutParams) {
  const height = Math.round(Math.min(maxWidth / at(ratios, 0), maxHeight))

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: maxWidth,
        height,
      },
      sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right | AlbumRectPart.Bottom,
    },
  ]
}

function layoutWithComplexLayouter({
  ratios: originalRatios,
  averageRatio,
  maxWidth,
  minWidth,
  spacing,
  maxHeight,
}: ILayoutParams) {
  const ratios = cropRatios(originalRatios, averageRatio)
  const count = originalRatios.length
  const result = new Array<IMediaLayout>(count)
  const attempts: IAttempt[] = []

  const multiHeight = (offset: number, attemptCount: number) => {
    const attemptRatios = ratios.slice(offset, offset + attemptCount)
    const sum = accumulate(attemptRatios, 0)

    return (maxWidth - (attemptCount - 1) * spacing) / sum
  }

  const pushAttempt = (lineCounts: number[]) => {
    const heights: number[] = []
    let offset = 0
    lineCounts.forEach((currentCount) => {
      heights.push(multiHeight(offset, currentCount))
      offset += currentCount
    })

    attempts.push({
      lineCounts,
      heights,
    })
  }

  buildBaseLineCounts(count, averageRatio).forEach(pushAttempt)

  if (!attempts.length) {
    buildExtendedLineCounts(count).forEach(pushAttempt)
  }

  let optimalAttempt: IAttempt | undefined
  let optimalDiff = 0
  for (let i = 0; i < attempts.length; i++) {
    const { heights, lineCounts } = at(attempts, i)
    const lineCount = lineCounts.length
    const totalHeight = accumulate(heights, 0) + spacing * (lineCount - 1)
    const minLineHeight = Math.min(...heights)
    const bad1 = minLineHeight < minWidth ? 1.5 : 1
    const bad2 = (() => {
      for (let line = 1; line !== lineCount; ++line) {
        if (at(lineCounts, line - 1) > at(lineCounts, line)) {
          return 1.5
        }
      }

      return 1
    })()
    const diff = Math.abs(totalHeight - maxHeight) * bad1 * bad2

    if (!optimalAttempt || diff < optimalDiff) {
      optimalAttempt = attempts[i]
      optimalDiff = diff
    }
  }

  if (!optimalAttempt) {
    return result
  }
  const optimalCounts = optimalAttempt.lineCounts
  const optimalHeights = optimalAttempt.heights
  const rowCount = optimalCounts.length
  let index = 0
  let y = 0
  for (let row = 0; row !== rowCount; ++row) {
    const colCount = at(optimalCounts, row)
    const lineHeight = at(optimalHeights, row)
    const height = Math.round(lineHeight)
    let x = 0

    for (let col = 0; col !== colCount; ++col) {
      const sides =
        AlbumRectPart.None |
        (row === 0 ? AlbumRectPart.Top : AlbumRectPart.None) |
        (row === rowCount - 1 ? AlbumRectPart.Bottom : AlbumRectPart.None) |
        (col === 0 ? AlbumRectPart.Left : AlbumRectPart.None) |
        (col === colCount - 1 ? AlbumRectPart.Right : AlbumRectPart.None)
      const ratio = at(ratios, index)
      const width = col === colCount - 1 ? maxWidth - x : Math.round(ratio * lineHeight)
      result[index] = {
        dimensions: {
          x,
          y,
          width,
          height,
        },
        sides,
      }
      x += width + spacing
      ++index
    }
    y += height + spacing
  }

  return result
}

function layoutTwo(params: ILayoutParams) {
  const { ratios, proportions, averageRatio } = params
  return proportions === 'ww' && averageRatio > 1.4 && at(ratios, 1) - at(ratios, 0) < 0.2
    ? layoutTwoTopBottom(params)
    : proportions === 'ww' || proportions === 'qq'
      ? layoutTwoLeftRightEqual(params)
      : layoutTwoLeftRight(params)
}

function layoutTwoTopBottom(params: ILayoutParams) {
  const { ratios, maxWidth, spacing, maxHeight } = params
  const height = Math.round(
    Math.min(maxWidth / at(ratios, 0), Math.min(maxWidth / at(ratios, 1), (maxHeight - spacing) / 2)),
  )

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: maxWidth,
        height,
      },
      sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right,
    },
    {
      dimensions: {
        x: 0,
        y: height + spacing,
        width: maxWidth,
        height,
      },
      sides: AlbumRectPart.Left | AlbumRectPart.Bottom | AlbumRectPart.Right,
    },
  ]
}

function layoutTwoLeftRightEqual(params: ILayoutParams) {
  const { ratios, maxWidth, spacing, maxHeight } = params
  const width = (maxWidth - spacing) / 2
  const height = Math.round(Math.min(width / at(ratios, 0), Math.min(width / at(ratios, 1), maxHeight)))
  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width,
        height,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
    },
    {
      dimensions: {
        x: width + spacing,
        y: 0,
        width,
        height,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Right | AlbumRectPart.Bottom,
    },
  ]
}

function layoutTwoLeftRight(params: ILayoutParams) {
  const { ratios, minWidth, maxWidth, spacing, maxHeight } = params
  const minimalWidth = Math.round(1.5 * minWidth)
  const secondWidth = Math.min(
    Math.round(
      Math.max(
        0.4 * (maxWidth - spacing),
        (maxWidth - spacing) / at(ratios, 0) / (1 / at(ratios, 0) + 1 / at(ratios, 1)),
      ),
    ),
    maxWidth - spacing - minimalWidth,
  )
  const firstWidth = maxWidth - secondWidth - spacing
  const height = Math.min(maxHeight, Math.round(Math.min(firstWidth / at(ratios, 0), secondWidth / at(ratios, 1))))

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: firstWidth,
        height,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
    },
    {
      dimensions: {
        x: firstWidth + spacing,
        y: 0,
        width: secondWidth,
        height,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Right | AlbumRectPart.Bottom,
    },
  ]
}

function layoutThree(params: ILayoutParams) {
  const { proportions } = params

  return proportions[0] === 'n' ? layoutThreeLeftAndOther(params) : layoutThreeTopAndOther(params)
}

function layoutThreeLeftAndOther(params: ILayoutParams) {
  const { maxHeight, spacing, ratios, maxWidth, minWidth } = params
  const firstHeight = maxHeight
  const thirdHeight = Math.round(
    Math.min((maxHeight - spacing) / 2, (at(ratios, 1) * (maxWidth - spacing)) / (at(ratios, 2) + at(ratios, 1))),
  )
  const secondHeight = firstHeight - thirdHeight - spacing
  const rightWidth = Math.max(
    minWidth,
    Math.round(Math.min((maxWidth - spacing) / 2, Math.min(thirdHeight * at(ratios, 2), secondHeight * at(ratios, 1)))),
  )
  const leftWidth = Math.min(Math.round(firstHeight * at(ratios, 0)), maxWidth - spacing - rightWidth)

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: leftWidth,
        height: firstHeight,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
    },
    {
      dimensions: {
        x: leftWidth + spacing,
        y: 0,
        width: rightWidth,
        height: secondHeight,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Right,
    },
    {
      dimensions: {
        x: leftWidth + spacing,
        y: secondHeight + spacing,
        width: rightWidth,
        height: thirdHeight,
      },
      sides: AlbumRectPart.Bottom | AlbumRectPart.Right,
    },
  ]
}

function layoutThreeTopAndOther(params: ILayoutParams) {
  const { maxWidth, ratios, maxHeight, spacing } = params
  const firstWidth = maxWidth
  const firstHeight = Math.round(Math.min(firstWidth / at(ratios, 0), 0.66 * (maxHeight - spacing)))
  const secondWidth = (maxWidth - spacing) / 2
  const secondHeight = Math.min(
    maxHeight - firstHeight - spacing,
    Math.round(Math.min(secondWidth / at(ratios, 1), secondWidth / at(ratios, 2))),
  )
  const thirdWidth = firstWidth - secondWidth - spacing

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: firstWidth,
        height: firstHeight,
      },
      sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right,
    },
    {
      dimensions: {
        x: 0,
        y: firstHeight + spacing,
        width: secondWidth,
        height: secondHeight,
      },
      sides: AlbumRectPart.Bottom | AlbumRectPart.Left,
    },
    {
      dimensions: {
        x: secondWidth + spacing,
        y: firstHeight + spacing,
        width: thirdWidth,
        height: secondHeight,
      },
      sides: AlbumRectPart.Bottom | AlbumRectPart.Right,
    },
  ]
}

function layoutFour(params: ILayoutParams) {
  const { proportions } = params

  return proportions[0] === 'w' ? layoutFourTopAndOther(params) : layoutFourLeftAndOther(params)
}

function layoutFourTopAndOther({ maxWidth, ratios, spacing, maxHeight, minWidth }: ILayoutParams) {
  const w = maxWidth
  const h0 = Math.round(Math.min(w / at(ratios, 0), 0.66 * (maxHeight - spacing)))
  const h = Math.round((maxWidth - 2 * spacing) / (at(ratios, 1) + at(ratios, 2) + at(ratios, 3)))
  const w0 = Math.max(minWidth, Math.round(Math.min(0.4 * (maxWidth - 2 * spacing), h * at(ratios, 1))))
  const w2 = Math.round(Math.max(Math.max(minWidth, 0.33 * (maxWidth - 2 * spacing)), h * at(ratios, 3)))
  const w1 = w - w0 - w2 - 2 * spacing
  const h1 = Math.min(maxHeight - h0 - spacing, h)

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: w,
        height: h0,
      },
      sides: AlbumRectPart.Left | AlbumRectPart.Top | AlbumRectPart.Right,
    },
    {
      dimensions: {
        x: 0,
        y: h0 + spacing,
        width: w0,
        height: h1,
      },
      sides: AlbumRectPart.Bottom | AlbumRectPart.Left,
    },
    {
      dimensions: {
        x: w0 + spacing,
        y: h0 + spacing,
        width: w1,
        height: h1,
      },
      sides: AlbumRectPart.Bottom,
    },
    {
      dimensions: {
        x: w0 + spacing + w1 + spacing,
        y: h0 + spacing,
        width: w2,
        height: h1,
      },
      sides: AlbumRectPart.Right | AlbumRectPart.Bottom,
    },
  ]
}

function layoutFourLeftAndOther({ maxHeight, ratios, maxWidth, spacing, minWidth }: ILayoutParams) {
  const h = maxHeight
  const w0 = Math.round(Math.min(h * at(ratios, 0), 0.6 * (maxWidth - spacing)))
  const w = Math.round((maxHeight - 2 * spacing) / (1 / at(ratios, 1) + 1 / at(ratios, 2) + 1 / at(ratios, 3)))
  const h0 = Math.round(w / at(ratios, 1))
  const h1 = Math.round(w / at(ratios, 2))
  const h2 = h - h0 - h1 - 2 * spacing
  const w1 = Math.max(minWidth, Math.min(maxWidth - w0 - spacing, w))

  return [
    {
      dimensions: {
        x: 0,
        y: 0,
        width: w0,
        height: h,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Left | AlbumRectPart.Bottom,
    },
    {
      dimensions: {
        x: w0 + spacing,
        y: 0,
        width: w1,
        height: h0,
      },
      sides: AlbumRectPart.Top | AlbumRectPart.Right,
    },
    {
      dimensions: {
        x: w0 + spacing,
        y: h0 + spacing,
        width: w1,
        height: h1,
      },
      sides: AlbumRectPart.Right,
    },
    {
      dimensions: {
        x: w0 + spacing,
        y: h0 + h1 + 2 * spacing,
        width: w1,
        height: h2,
      },
      sides: AlbumRectPart.Bottom | AlbumRectPart.Right,
    },
  ]
}

// ---------------------------------------------------------------------------------------------
// xWriter: the albums of the looks (docs/plan/29-owner-list-2026-10-22.md section 8.6, TGP-02).
// Each look lays an album out with its app's own algorithm (SkinTokens.album.layout: this
// file's for Web A, albumLayout.<look>.ts for the others), and every layout gives the album's
// box and its items' rectangles in pixels, the gaps between the items already left out.
// ---------------------------------------------------------------------------------------------

/** An item of an album: its rectangle in the album's box and the sides of the box it touches (AlbumRectPart flags). */
export interface AlbumItemBox {
  x: number
  y: number
  width: number
  height: number
  sides: number
}

/** An album's box and its items, in pixels. */
export interface AlbumLayout {
  width: number
  height: number
  items: AlbumItemBox[]
}

/**
 * A look's album layout: the items' width / height ratios (1 when unknown), the widest album
 * the bubble allows, the chat area's width and the look's gap between items.
 */
export type AlbumLayoutFn = (
  ratios: readonly number[],
  box: { maxWidth: number; frameWidth: number; gap: number },
) => AlbumLayout

/**
 * Web A's album (10 section 8.7): the layout above at the widest album, each item's inner
 * sides keeping half the look's gap.
 */
export const webAlbumLayout: AlbumLayoutFn = (ratios, { maxWidth, gap }) => {
  const layout = calculateAlbumLayout([...ratios])
  const width = maxWidth
  const height = width / layout.aspectRatio
  const half = gap / 2
  return {
    width,
    height,
    items: layout.items.map((item) => {
      const inner = (side: number) => ((item.sides & side) === 0 ? half : 0)
      return {
        x: item.rect.x * width + inner(AlbumRectPart.Left),
        y: item.rect.y * height + inner(AlbumRectPart.Top),
        width: item.rect.width * width - inner(AlbumRectPart.Left) - inner(AlbumRectPart.Right),
        height: item.rect.height * height - inner(AlbumRectPart.Top) - inner(AlbumRectPart.Bottom),
        sides: item.sides,
      }
    }),
  }
}
