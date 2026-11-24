// The fonts of the Telegram looks, declared at document level because a shadow root
// cannot rely on @font-face rules of its own in every browser (10 section 8.11). Only the
// subsets a text uses are downloaded.
import '@fontsource-variable/roboto'
import '@fontsource-variable/open-sans'
import '@fontsource-variable/inter'
import '@fontsource-variable/vazirmatn'
import './fonts/fonts.css'

/**
 * The fonts a look ships beyond the panel's own (29 section 8.4, TGP-02), from the research
 * sheets' section 8, by look and use: a look's tokens put them in its font stacks. The files
 * and their licenses are in fonts/ (NOTICE.md there).
 */
export const lookFonts = {
  /** Web A: the avatar's initial, Nunito ExtraBold (weight 800), as telegram-tt ships it. */
  web: { avatar: '"TG Nunito"' },
  /** Web K: code, Roboto Mono (400 and 500), as tweb ships it. */
  webk: { code: '"TG Roboto Mono"' },
  /**
   * Desktop: text in the app's own Open Sans 1.10 (400, Semibold 600 for bold, and their
   * italics) and Persian in its Vazirmatn UI NL 33.003 (400 and 600, no Latin letters).
   */
  desktop: { text: '"TG Open Sans"', persian: '"TG Vazirmatn UI NL"' },
  /**
   * Android: code in Noto Sans Mono (the closest free font to the phone's Droid Sans Mono)
   * and Persian in the phone's Noto Naskh Arabic UI (400, and 700 also for the app's Medium 500).
   */
  android: { code: '"TG Noto Sans Mono"', persian: '"TG Noto Naskh Arabic UI"' },
  /**
   * iOS on computers without Apple's fonts (D-6272): text in Inter at 96.8 %, so its cap
   * height matches SF Pro's at the same size (after -apple-system in the stack), and code in
   * DejaVu Sans Mono, Menlo's own source with its metrics.
   */
  ios: { text: '"TG Inter SF"', code: '"TG DejaVu Sans Mono"' },
} as const
