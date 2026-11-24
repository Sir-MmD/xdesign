// Web A's chat background (.dev/upd29/tg/web-a.md section 7; 29 section 8.4, TGP-02).
// telegram-tt draws its gradient with a WebGL shader into a 100 x 100 canvas stretched over
// the whole window (useGradientBackground.ts:9, gradientBackground.ts:27-61, Main.tsx:625)
// and the pattern as a mask 26.875rem (430 px) wide, repeated and centred in the chat column
// (_patternBackground.module.scss:84-111). Light: black shapes soft-light at intensity 50 x
// 75 % = 0.375 over the gradient; dark: the gradient at 0.375 seen only through the shapes,
// over black (wallpaper.ts:55-68, 101-105; useChatBackground.ts:72-73).
import { centredTile, patternRatio, type WallpaperSettings, wholeScreen } from './settings'

export const webWallpaper: WallpaperSettings = {
  bitmap: { method: { kind: 'webA' }, width: 100, height: 100, pixelCentre: true, rounding: 'round' },
  // A 1440 x 900 window: the 760 px messages column sits in the middle of the chat column
  // right of the 376 px left column, so its centre is at x 908 (web-a.md section 1). Under the
  // last post's 6 px (skins/web.ts list.bottom) the list keeps 72 px for the composer: 3rem
  // tall, 1rem over the window's bottom and 0.5rem under the list (_composer-primitives.scss:3-13,
  // MessageList.scss:14-18; TGP-03).
  screen: { width: 1440, frameCentre: 908, height: 900, bottomInset: 72 },
  gradientRect: wholeScreen,
  patternTile: (_w, h) => centredTile(430 / patternRatio, 908, h / 2),
  fillParts: '',
  light: {
    base: '#bdcd8c',
    colors: ['#bdcd8c', '#8eba89', '#83b28f', '#c5d3b0'],
    pattern: { blend: 'soft-light', opacity: 0.375 },
    fill: null,
  },
  dark: {
    base: '#000000',
    colors: ['#4f5bd5', '#962fbf', '#dd6cb9', '#fec496'],
    pattern: { blend: 'mask', opacity: 0.375 },
    fill: null,
  },
}
