// The rows of the Texts tab (docs/plan/04 section 10): every text of the design, rich and plain,
// grouped by where it is: the bot setup, then each step in map order (left to right, then top to
// bottom), then the parts. A cell is missing where the checks' W03 would miss it (a message text
// and a button's text in every language, the others where the default language has them) and
// while it still holds the default language's copy.
import {
  type Button,
  type Content,
  type Design,
  isCopiedText,
  type Keyboard,
  type LangText,
  type PlainTextAt,
  plainText,
  type RichDoc,
  type RichText,
  type RichTextRef,
  type Step,
  type TextId,
} from '@xdesign/spec'

interface RowBase {
  /** Unique in the table: the text's ID or place. */
  id: string
  /** What the text is: "Text", "Caption of item 2", "Button", "Popup of "Buy"". */
  what: string
  /** Needed in every language (a message text, a button's text), not only where the default has it. */
  needed: boolean
}

export interface RichRow extends RowBase {
  at: { text: TextId }
  rich: RichText
}

export interface PlainRow extends RowBase {
  at: PlainTextAt
  plain: LangText
  /** Takes several lines (the bot's description, a popup, a text to copy). */
  multiline: boolean
}

export type TextRow = RichRow | PlainRow

export interface TextGroup {
  id: string
  /** "Bot setup", the step's title, or the part's name. */
  title: string
  rows: TextRow[]
}

/** A cell: has a text, is missing (or still the default language's copy), or may stay empty. */
export type CellState = 'filled' | 'missing' | 'copied' | 'empty'

function richRow(ref: RichTextRef, what: string, needed = false): RichRow {
  return { id: ref.id, what, needed, at: { text: ref.id }, rich: ref.doc }
}

function plainRow(
  at: PlainTextAt,
  what: string,
  plain: LangText,
  opts: { needed?: boolean; multiline?: boolean } = {},
): PlainRow {
  const id =
    'bot' in at
      ? `bot.${at.bot}`
      : 'button' in at
        ? `${at.button}.${at.field}`
        : 'price' in at
          ? `${at.step}.price.${String(at.price)}`
          : 'option' in at
            ? `${at.step}.${at.field}.${String(at.option)}`
            : `${at.step}.${at.field}`
  return { id, what, needed: opts.needed ?? false, at, plain, multiline: opts.multiline ?? false }
}

/** Every text of the design in groups, in the order of the table. */
export function textGroups(design: Design): TextGroup[] {
  const lang = design.languages.default
  const { bot } = design
  const groups: TextGroup[] = [
    {
      id: 'bot',
      title: 'Bot setup',
      rows: [
        plainRow({ bot: 'name' }, 'Name', bot.name),
        plainRow({ bot: 'about' }, 'About', bot.about),
        plainRow({ bot: 'description' }, 'Description', bot.description, { multiline: true }),
      ],
    },
  ]

  const buttonRows = (button: Button, rows: TextRow[]) => {
    const name = button.label[lang]?.trim() || button.idName
    rows.push(plainRow({ button: button.id, field: 'label' }, 'Button', button.label, { needed: true }))
    if (button.place !== 'inline') return
    const { action } = button
    if (action.type === 'goTo' && action.popup) {
      rows.push(
        plainRow({ button: button.id, field: 'popup' }, `Popup of "${name}"`, action.popup.text, { multiline: true }),
      )
    } else if (action.type === 'copyText') {
      rows.push(
        plainRow({ button: button.id, field: 'copyText' }, `Copy text of "${name}"`, action.text, { multiline: true }),
      )
    }
  }
  const contentRows = (content: Content, rows: TextRow[]) => {
    if (content.type === 'text') rows.push(richRow(content.text, 'Text', true))
    else if (content.type === 'album') {
      content.items.forEach((item, index) => {
        if (item.caption) rows.push(richRow(item.caption, `Caption of item ${String(index + 1)}`))
      })
    } else if ('caption' in content && content.caption) rows.push(richRow(content.caption, 'Caption'))
  }
  // The keyboard's own buttons (a part's rows are the part's) and its input hint.
  const keyboardRows = (step: Step, keyboard: Keyboard, rows: TextRow[]) => {
    if (keyboard?.type === 'inline' || keyboard?.type === 'reply') {
      for (const row of keyboard.rows) {
        if (row.type !== 'buttons') continue
        for (const id of row.ids) {
          const button = design.buttons[id]
          if (button) buttonRows(button, rows)
        }
      }
    }
    if (keyboard?.type === 'reply' || keyboard?.type === 'forceReply') {
      rows.push(
        plainRow({ step: step.id, field: 'placeholder' }, 'Hint in the input field', keyboard.placeholder ?? {}),
      )
    }
  }

  const steps = Object.values(design.steps).sort((a, b) => a.x - b.x || a.y - b.y)
  for (const step of steps) {
    const rows: TextRow[] = []
    switch (step.kind) {
      case 'start':
        if (step.trigger.type === 'command') {
          rows.push(plainRow({ step: step.id, field: 'menuDescription' }, 'Menu text', step.trigger.menuDescription))
        }
        break
      case 'message':
        contentRows(step.content, rows)
        keyboardRows(step, step.keyboard, rows)
        break
      case 'question':
        contentRows(step.prompt.content, rows)
        keyboardRows(step, step.prompt.keyboard, rows)
        rows.push(richRow(step.wrongAnswer.message, 'Wrong answer message'))
        if (step.cancel) rows.push(plainRow({ step: step.id, field: 'cancelWords' }, 'Cancel word', step.cancel.words))
        break
      // An invoice's title, description, price lines, shipping options, refusal message and buttons (PAY-02).
      case 'invoice': {
        const { invoice, checkout } = step
        rows.push(
          plainRow({ step: step.id, field: 'invoiceTitle' }, 'Invoice title', invoice.title, { needed: true }),
          plainRow({ step: step.id, field: 'invoiceDescription' }, 'Description', invoice.description, {
            needed: true,
            multiline: true,
          }),
        )
        invoice.prices.forEach((price, index) => {
          rows.push(
            plainRow({ step: step.id, field: 'price', price: index }, 'Price line', price.label, { needed: true }),
          )
        })
        if (invoice.physical?.flexibleShipping) {
          invoice.physical.shippingOptions.forEach((option, index) => {
            rows.push(
              plainRow({ step: step.id, field: 'shipping', option: index }, 'Shipping option', option.title, {
                needed: true,
              }),
            )
          })
        }
        if (checkout) rows.push(plainRow({ step: step.id, field: 'refuse' }, 'Refuse message', checkout.refuse))
        keyboardRows(step, step.keyboard, rows)
        break
      }
      // A gift's text (EVT-02).
      case 'action':
        if (step.action.type === 'gift' && step.action.text) rows.push(richRow(step.action.text, 'Gift text'))
        break
      default:
        break
    }
    if (rows.length > 0) groups.push({ id: step.id, title: step.title.trim() || step.idName, rows })
  }

  const parts = Object.values(design.parts).sort((a, b) => a.name.localeCompare(b.name))
  for (const part of parts) {
    const rows: TextRow[] = []
    if (part.kind === 'text') rows.push(richRow(part.text, 'Text'))
    else {
      for (const id of part.rows.flat()) {
        const button = design.buttons[id]
        if (button) buttonRows(button, rows)
      }
    }
    if (rows.length > 0) groups.push({ id: part.id, title: `Part "${part.name.trim() || part.idName}"`, rows })
  }
  return groups
}

/** A row's text in a language: a document or a string; undefined where it has none. */
export function cellValue(row: TextRow, lang: string): RichDoc | string | undefined {
  return 'rich' in row ? row.rich[lang] : row.plain[lang]
}

// Whether a document shows nothing, cached per document (unchanged texts keep their objects).
const emptyDocs = new WeakMap<RichDoc, boolean>()

/** Nothing to show: no text, or only spaces (the checks' emptyDoc and emptyText). */
export function isEmpty(value: RichDoc | string | undefined): boolean {
  if (value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  let empty = emptyDocs.get(value)
  if (empty === undefined) {
    empty =
      plainText(
        value,
        () => 'v',
        () => 'p',
      ).trim() === ''
    emptyDocs.set(value, empty)
  }
  return empty
}

/** The state of a row's cell in a language. */
export function cellState(design: Design, row: TextRow, lang: string): CellState {
  const fallback = design.languages.default
  const value = cellValue(row, lang)
  if (lang !== fallback && isCopiedText(design, row.at, lang, value)) return 'copied'
  if (!isEmpty(value)) return 'filled'
  return row.needed || (lang !== fallback && !isEmpty(cellValue(row, fallback))) ? 'missing' : 'empty'
}
