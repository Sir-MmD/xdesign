// Desktop's chat background (.dev/upd29/tg/desktop.md section 7; 29 section 8.4, TGP-02).
// Classic computes a 64 x 64 bitmap, its channels cut to whole numbers (image_prepare.cpp:
// 173-306), scaled smoothly over the history area (chat_theme.cpp:82-105, 1210-1224); the
// pattern's tiles are as tall as the area and repeat across it with one centred
// (chat_theme.cpp:121-127, 166-182), black shapes soft-light at intensity 50 = 0.5
// (data_wall_paper.cpp:256-258, 707-717). Tinted (dark) fills the area with a plain #0e1621
// (window_theme.cpp:720-743): no gradient, no pattern.
import { centredTile, type WallpaperSettings, wholeScreen } from './settings'

export const desktopWallpaper: WallpaperSettings = {
  bitmap: {
    method: { kind: 'swirl', reach: 0.9, power: 4 },
    width: 64,
    height: 64,
    pixelCentre: false,
    rounding: 'cut',
  },
  // The history area of a 1440 x 900 window at 100 %, between the top bar and the composer:
  // about 800 px tall (estimate); the last message sits at its bottom.
  screen: { height: 800, bottomInset: 0 },
  gradientRect: wholeScreen,
  patternTile: (w, h) => centredTile(h, w / 2, h / 2),
  fillParts: '',
  light: {
    base: '#88b884',
    colors: ['#dbddbb', '#6ba587', '#d5d88d', '#88b884'],
    pattern: { blend: 'soft-light', opacity: 0.5 },
    fill: null,
  },
  dark: { base: '#0e1621', colors: null, pattern: null, fill: null },
}
