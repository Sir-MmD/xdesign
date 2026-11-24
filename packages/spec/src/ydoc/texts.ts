// Text accessors (docs/plan/03-design-model.md section 3, rule 3): rich texts are a
// Y.XmlFragment per language that TipTap edits (two people can type in the same text); plain
// texts (labels, names, popups) are last-writer-wins strings per language. The texts the Texts
// tab copied from the default language (04 section 10) are listed in `meta.copiedTexts`, each
// with the fingerprint of the words copied, so an edit by any means ends the mark.
import * as Y from 'yjs'

import type { Design } from '../model/design.ts'
import type { ButtonId, Lang, StepId, TextId } from '../model/ids.ts'
import { plainText, type RichDoc } from '../text/schema.ts'
import {
  change,
  defaultLanguageOf,
  ensureMap,
  followIdName,
  languagesOf,
  yarray,
  ymap,
  ystring,
  type DesignEditor,
  type DesignMaps,
  type YMap,
} from './layout.ts'
import { pollOf, stepKeyboard } from './refs.ts'
import { docToFragment, fragmentToDoc } from './rich.ts'

/**
 * Where a plain text is: the bot's name, about or description; a button's label, its popup or
 * the text it copies; a command's menu text, a keyboard's input hint, a question's cancel words
 * or an option of a poll or quiz (by its index); an invoice's title, description, refusal
 * message, a price line's label or a shipping option's title (by their indexes).
 */
export type PlainTextAt =
  | { bot: 'name' | 'about' | 'description' }
  | { button: ButtonId; field: 'label' | 'popup' | 'copyText' }
  | { step: StepId; field: StepTextField }
  | { step: StepId; field: 'option' | 'shipping'; option: number }
  | { step: StepId; field: 'price'; price: number }

type StepTextField =
  'menuDescription' | 'placeholder' | 'cancelWords' | 'invoiceTitle' | 'invoiceDescription' | 'refuse'
const STEP_TEXT_FIELDS = new Set<string>([
  'menuDescription',
  'placeholder',
  'cancelWords',
  'invoiceTitle',
  'invoiceDescription',
  'refuse',
])

/** Any text of the design: a rich text by its ID, or a plain text by its place. */
export type TextAt = { text: TextId } | PlainTextAt

// The map of a plain text; with `create`, made when its owner can hold one.
function plainTextMap(maps: DesignMaps, at: PlainTextAt, create = true): YMap | undefined {
  const child = (parent: YMap | undefined, key: string) =>
    create && parent ? ensureMap(parent, key) : ymap(parent, key)
  if ('bot' in at) return child(maps.bot, at.bot)
  if ('button' in at) {
    const button = maps.buttons.get(at.button)
    if (!button) return undefined
    const action = ymap(button, 'action')
    switch (at.field) {
      case 'label':
        return child(button, 'label')
      case 'popup':
        return child(ymap(action, 'popup'), 'text')
      case 'copyText':
        return action && ystring(action, 'type') === 'copyText' ? child(action, 'text') : undefined
    }
  }
  const step = maps.steps.get(at.step)
  if (!step) return undefined
  switch (at.field) {
    case 'menuDescription': {
      const trigger = ymap(step, 'trigger')
      return trigger && ystring(trigger, 'type') === 'command' ? child(trigger, 'menuDescription') : undefined
    }
    case 'placeholder': {
      const keyboard = stepKeyboard(step)
      const type = ystring(keyboard, 'type')
      return keyboard && (type === 'reply' || type === 'forceReply') ? child(keyboard, 'placeholder') : undefined
    }
    case 'cancelWords':
      return ystring(step, 'kind') === 'question' ? child(child(step, 'cancel'), 'words') : undefined
    // An option is added with its map (steps.set), never here.
    case 'option': {
      const option = yarray(pollOf(step), 'options')?.get(at.option)
      return option instanceof Y.Map ? (option as YMap) : undefined
    }
    case 'invoiceTitle':
      return child(ymap(step, 'invoice'), 'title')
    case 'invoiceDescription':
      return child(ymap(step, 'invoice'), 'description')
    case 'refuse':
      return child(ymap(step, 'checkout'), 'refuse')
    // Price lines and shipping options, like poll options, come with their maps (steps.set).
    case 'price': {
      const price = yarray(ymap(step, 'invoice'), 'prices')?.get(at.price)
      return price instanceof Y.Map ? ymap(price as YMap, 'label') : undefined
    }
    case 'shipping': {
      const option = yarray(ymap(ymap(step, 'invoice'), 'physical'), 'shippingOptions')?.get(at.option)
      return option instanceof Y.Map ? ymap(option as YMap, 'title') : undefined
    }
  }
}

/**
 * The key of a text in a language in the design's `copiedTexts`: `text.<textId>:<lang>`,
 * `bot.<field>:<lang>`, `button.<buttonId>.<field>:<lang>`, `step.<stepId>.<field>:<lang>` or
 * `step.<stepId>.option.<index>:<lang>` (also `shipping` and `price`).
 */
export function textKey(at: TextAt, lang: Lang): string {
  const place =
    'text' in at
      ? `text.${at.text}`
      : 'bot' in at
        ? `bot.${at.bot}`
        : 'button' in at
          ? `button.${at.button}.${at.field}`
          : at.field === 'option' || at.field === 'shipping'
            ? `step.${at.step}.${at.field}.${String(at.option)}`
            : at.field === 'price'
              ? `step.${at.step}.price.${String(at.price)}`
              : `step.${at.step}.${at.field}`
  return `${place}:${lang}`
}

// The text and language of a `copiedTexts` key; undefined for a key of no known place.
function parseTextKey(key: string): { at: TextAt; lang: Lang } | undefined {
  const [place = '', lang = ''] = key.split(':')
  const [kind, id = '', field, index] = place.split('.')
  switch (kind) {
    case 'text':
      return { at: { text: id }, lang }
    case 'bot':
      return id === 'name' || id === 'about' || id === 'description' ? { at: { bot: id }, lang } : undefined
    case 'button':
      return field === 'label' || field === 'popup' || field === 'copyText'
        ? { at: { button: id, field }, lang }
        : undefined
    case 'step':
      if (index !== undefined && /^\d+$/.test(index)) {
        if (field === 'option' || field === 'shipping') return { at: { step: id, field, option: Number(index) }, lang }
        return field === 'price' ? { at: { step: id, field, price: Number(index) }, lang } : undefined
      }
      return field !== undefined && STEP_TEXT_FIELDS.has(field)
        ? { at: { step: id, field: field as StepTextField }, lang }
        : undefined
    default:
      return undefined
  }
}

/**
 * A short fingerprint of a text's words (variables and parts by their IDs, marks left out), as
 * `copiedTexts` keeps it for each copied text.
 */
export function textFingerprint(value: RichDoc | string): string {
  const words =
    typeof value === 'string'
      ? value
      : plainText(
          value,
          (id) => id,
          (id) => `{${id}}`,
        )
  // cyrb53: 53 bits in base 36.
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < words.length; i++) {
    const code = words.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Whether a text in a language still holds what "Copy the default language into empty cells"
 * put there (04 section 10: not translated until edited); `value` is the plain model's.
 */
export function isCopiedText(
  design: Pick<Design, 'copiedTexts'>,
  at: TextAt,
  lang: Lang,
  value: RichDoc | string | undefined,
): boolean {
  const fingerprint = design.copiedTexts?.[textKey(at, lang)]
  return fingerprint !== undefined && value !== undefined && fingerprint === textFingerprint(value)
}

// A rich text's document in a language, as the plain model reads it.
function richValue(maps: DesignMaps, textId: TextId, lang: Lang): RichDoc | undefined {
  const fragment = maps.texts.get(textId)?.get(lang)
  return fragment instanceof Y.XmlFragment && fragment.length > 0 ? fragmentToDoc(fragment) : undefined
}

function plainValue(maps: DesignMaps, at: PlainTextAt, lang: Lang): string | undefined {
  const value = plainTextMap(maps, at, false)?.get(lang)
  return typeof value === 'string' ? value : undefined
}

// Nothing to show: no text, or only spaces (the checks' emptyDoc and emptyText).
function isEmpty(value: RichDoc | string | undefined): boolean {
  if (value === undefined) return true
  const words =
    typeof value === 'string'
      ? value
      : plainText(
          value,
          () => 'v',
          () => 'p',
        )
  return words.trim() === ''
}

/**
 * Drops the `copiedTexts` keys whose text was edited since, or whose text or language is gone
 * (tidy, and before a new copy).
 */
export function pruneCopied(maps: DesignMaps): void {
  const copied = ymap(maps.meta, 'copiedTexts')
  if (!copied) return
  const languages = new Set(languagesOf(maps))
  const stale: string[] = []
  copied.forEach((fingerprint, key) => {
    const place = parseTextKey(key)
    let value: RichDoc | string | undefined
    if (place && languages.has(place.lang)) {
      const { at, lang } = place
      value = 'text' in at ? richValue(maps, at.text, lang) : plainValue(maps, at, lang)
    }
    if (value === undefined || fingerprint !== textFingerprint(value)) stale.push(key)
  })
  for (const key of stale) copied.delete(key)
}

export function textEdits(editor: DesignEditor) {
  /**
   * The fragment TipTap's Collaboration edits for a rich text in a language, created when it is
   * missing (new texts already have one per language).
   */
  const fragment = (textId: TextId, lang: Lang): Y.XmlFragment =>
    change(editor, (maps) => {
      const text = maps.texts.get(textId) ?? maps.texts.set(textId, new Y.Map<Y.XmlFragment>())
      const existing = text.get(lang)
      return existing instanceof Y.XmlFragment ? existing : text.set(lang, new Y.XmlFragment())
    })
  // Copies a text where it is empty from the default language; the value copied, else undefined.
  const copyText = (maps: DesignMaps, at: TextAt, from: Lang, to: Lang): RichDoc | string | undefined => {
    if ('text' in at) {
      const doc = richValue(maps, at.text, from)
      if (doc === undefined || isEmpty(doc) || !isEmpty(richValue(maps, at.text, to))) return undefined
      docToFragment(doc, fragment(at.text, to))
      return doc
    }
    const value = plainValue(maps, at, from)
    if (value === undefined || isEmpty(value) || !isEmpty(plainValue(maps, at, to))) return undefined
    plainTextMap(maps, at)?.set(to, value)
    return value
  }
  return {
    fragment,
    /** Replaces a rich text in a language with a document (a copied translation, an import). */
    setRich(textId: TextId, lang: Lang, doc: RichDoc): void {
      change(editor, () => {
        docToFragment(doc, fragment(textId, lang))
      })
    },
    /**
     * A plain text in a language ('' clears it); a button's ID name follows its label in the
     * default language. False when the place cannot hold the text.
     */
    setPlain(at: PlainTextAt, lang: Lang, value: string): boolean {
      return change(editor, (maps) => {
        const text = plainTextMap(maps, at)
        if (!text) return false
        if (value === '') text.delete(lang)
        else text.set(lang, value)
        ymap(maps.meta, 'copiedTexts')?.delete(textKey(at, lang))
        if ('button' in at && at.field === 'label' && lang === defaultLanguageOf(maps)) {
          const button = maps.buttons.get(at.button)
          if (button) followIdName(maps, at.button, button, value, 'btn_')
        }
        return true
      })
    },
    /**
     * "Copy the default language into empty cells" (04 section 10): each of these texts that is
     * empty in another language of the design gets the default language's text there, listed in
     * `meta.copiedTexts` (not translated until edited). Returns how many it filled.
     */
    copyDefault(places: readonly TextAt[]): number {
      return change(editor, (maps) => {
        pruneCopied(maps)
        const from = defaultLanguageOf(maps)
        const others = languagesOf(maps).filter((lang) => lang !== from)
        let count = 0
        for (const at of places) {
          for (const lang of others) {
            const value = copyText(maps, at, from, lang)
            if (value === undefined) continue
            ensureMap(maps.meta, 'copiedTexts').set(textKey(at, lang), textFingerprint(value))
            count++
          }
        }
        return count
      })
    },
  }
}
