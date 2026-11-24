// Web K's chat background (.dev/upd29/tg/web-k.md section 7; 29 section 8.4, TGP-02). tweb
// computes a 50 x 50 bitmap (gradientRenderer.ts:9-10, 200-263) on a canvas as wide as the
// window and 1.5 times as tall at -25 %, object-fit cover (chatBackground.module.scss:54-66),
// and draws the pattern in tiles 500 + window height / 2.5 tall from the window's left edge,
// one row centred (patternRenderer.ts:143-210). Light: black shapes soft-light at 0.5 over
// the gradient; dark: the gradient at 0.3 seen only through the shapes, over black
// (state.ts:316-363, chatBackground.tsx:226-274).
import { patternRatio, type WallpaperSettings } from './settings'

export const webkWallpaper: WallpaperSettings = {
  bitmap: {
    method: { kind: 'swirl', reach: 0.9, power: 4 },
    width: 50,
    height: 50,
    pixelCentre: false,
    rounding: 'round',
  },
  // A 1440 x 900 window: the 728 px frame (the 696 px chat column and its 16 px gutters)
  // spans x 544 to 1272 (web-k.md section 1); under the messages the composer (48) and the
  // gutter (16): --chat-padding-bottom (_chat.scss:610, base.scss:180; TGP-04).
  screen: { width: 1440, frameCentre: 908, height: 900, bottomInset: 64 },
  gradientRect: (w, h) => {
    const side = Math.max(w, 1.5 * h)
    return { left: (w - side) / 2, top: -0.25 * h + (1.5 * h - side) / 2, width: side, height: side }
  },
  patternTile: (_w, h) => {
    const height = 500 + h / 2.5
    return { left: 0, top: (h - height) / 2, width: height * patternRatio, height }
  },
  fillParts: '',
  // The base shows only until the gradient is drawn (the app's is black).
  light: {
    base: '#88b884',
    colors: ['#dbddbb', '#6ba587', '#d5d88d', '#88b884'],
    pattern: { blend: 'soft-light', opacity: 0.5 },
    fill: null,
  },
  dark: {
    base: '#000000',
    colors: ['#fec496', '#dd6cb9', '#962fbf', '#4f5bd5'],
    pattern: { blend: 'mask', opacity: 0.3 },
    fill: null,
  },
}
