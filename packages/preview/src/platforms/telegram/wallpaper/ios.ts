// iOS's chat background (.dev/upd29/tg/ios.md sections 3.3, 3.4 and 7; 29 section 8.4,
// TGP-02). The gradient is computed for the screen fitted in 80 x 80 (36 x 80 on a 393 x 852
// iPhone), its channels cut to whole numbers, and stretched over the screen
// (SoftwareGradientBackground.swift:95-240, 525); the pattern covers the screen once, centred
// (ChatControllerNode.swift:2092-2101). Classic: black shapes soft-light at 0.5; Night: the
// gradient at 0.34 seen only through the shapes, over black (WallpaperBackgroundNode.swift:
// 1499-1545, 1660-1675).
//
// The share button, the buttons under a post, the reactions under the bubble
// (ChatMessageReactionsFooterContentNode.swift:304-318, RVW-29c), the info row's pill under big
// emoji and Night's bubble take the "free" fill: the gradient without the pattern, saturated
// 1.7, under a tint (WallpaperBackgroundNode.swift: 690-830, DefaultDayPresentationTheme.swift:
// 8-15, DefaultDarkPresentationTheme.swift:520-526); ios.css draws them with it (TGP-07).
import { coverTile, iosLuma, type WallpaperSettings, wholeScreen } from './settings'

export const iosWallpaper: WallpaperSettings = {
  bitmap: {
    method: { kind: 'swirl', reach: 0.92, power: 3 },
    width: 36,
    height: 80,
    pixelCentre: false,
    rounding: 'cut',
  },
  // An iPhone 15 screen, 393 x 852 (ios.md section 1); the bottom bar and the home
  // indicator's inset take about 84 px under the last message (estimate).
  screen: { height: 852, bottomInset: 84 },
  gradientRect: wholeScreen,
  patternTile: coverTile,
  // The private chat's service lines and empty chat card too; the user's bubbles keep their own color (PRV-02).
  fillParts:
    '.tg-share, .tg-kb-button, .tg-reactions.outside .tg-reaction, .tg-row:not(.out) .tg-bubble, .tg-row:not(.out) .tg-tail, .tg-meta.overlay.big, .tg-service-text, .tg-empty-card',
  light: {
    base: '#88b884',
    colors: ['#dbddbb', '#6ba587', '#d5d88d', '#88b884'],
    pattern: { blend: 'soft-light', opacity: 0.5 },
    fill: { filter: { saturation: 1.7, luma: iosLuma, multiply: 1, add: 0 }, tint: { color: '#000000', alpha: 0.2 } },
  },
  dark: {
    base: '#000000',
    colors: ['#598bf6', '#7a5eef', '#d67cff', '#f38b58'],
    pattern: { blend: 'mask', opacity: 0.34 },
    fill: { filter: { saturation: 1.7, luma: iosLuma, multiply: 1, add: 0 }, tint: { color: '#1d1d1d', alpha: 0.9 } },
  },
}
