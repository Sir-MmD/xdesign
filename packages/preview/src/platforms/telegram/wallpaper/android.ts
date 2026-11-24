// Android's chat background (.dev/upd29/tg/android.md sections 4.9 and 7; 29 section 8.4,
// TGP-02). MotionBackgroundDrawable computes a 60 x 80 bitmap, its channels cut to whole
// numbers (MotionBackgroundDrawable.java:111-112, image.cpp:1075-1200), drawn to cover the
// chat area, centred; the pattern is drawn once, covering the area, centred
// (SizeNotifierFrameLayout.java:228-241). Classic: black shapes soft-light at 0.34; Night (the
// owner's phone): its own colours at 0.57 seen only through the shapes, over black
// (Theme.java:1781-1786, 9621-9629; MotionBackgroundDrawable.java:515-575).
//
// The share button, the buttons under a post, the time's pill of a message of emoji only and
// the reactions under it take the service fill: the gradient without the pattern through a
// colour matrix (Theme.java:8735-8785), measured where each part is (--tg-wp-fill); the fixed
// colours of android.md 4.9 are the tokens' fallback until it is (TGP-06).
import { androidLuma, coverTile, type WallpaperSettings } from './settings'

export const androidWallpaper: WallpaperSettings = {
  bitmap: {
    method: { kind: 'swirl', reach: 0.9, power: 4 },
    width: 60,
    height: 80,
    pixelCentre: false,
    rounding: 'cut',
  },
  // The chat area of the owner's phone, 384 x 829 (android.md 4.9). Under the post's list (its
  // 10, android.ts) the bottom bar's island of 44 and the 9 under it (ChatActivity.java:12114,
  // 46575-46598), and the phone's gesture bar of about 16 (estimate).
  screen: { height: 829, bottomInset: 69 },
  gradientRect: (w, h) => {
    const scale = Math.max(w / 60, h / 80)
    return { left: (w - 60 * scale) / 2, top: (h - 80 * scale) / 2, width: 60 * scale, height: 80 * scale }
  },
  patternTile: coverTile,
  // The private chat's service lines and empty chat card too (PRV-02).
  fillParts:
    '.tg-share, .tg-kb-button, .tg-meta.overlay.big, .tg-reactions.outside .tg-reaction, .tg-service-text, .tg-empty-card',
  light: {
    base: '#88b884',
    colors: ['#dbddbb', '#6ba587', '#d5d88d', '#88b884'],
    pattern: { blend: 'soft-light', opacity: 0.34 },
    fill: { filter: { saturation: 1.6, luma: androidLuma, multiply: 0.92, add: -0.06 }, tint: null },
  },
  dark: {
    base: '#000000',
    colors: ['#6c7fa6', '#2e344b', '#7874a7', '#333258'],
    pattern: { blend: 'mask', opacity: 0.57 },
    fill: { filter: { saturation: 1.1, luma: androidLuma, multiply: 0.4, add: 0.08 }, tint: null },
  },
}
