// Keyboards and buttons (docs/plan/03-design-model.md section 8): E03 keyboard sizes, E04
// albums, E05 "Edit this message" where Telegram cannot edit (the catalog's edit matrix and
// EDIT_FACTS), E07 link schemes, E12 buttons without text.
import type { Keyboard } from '../model/buttons.ts'
import type { MediaKind } from '../model/parts.ts'
import { BUTTON_KINDS, type ButtonKindRow } from '../telegram/buttons.ts'
import { EDIT_MATRIX } from '../telegram/edit.ts'
import { KEYBOARD_TYPES, type KeyboardTypeRow } from '../telegram/keyboards.ts'
import { limit } from '../telegram/limits.ts'
import { albumGroup } from '../telegram/media.ts'
import { messageKind, type ContentKind } from '../telegram/messages.ts'
import {
  andList,
  asButtonStep,
  contentOf,
  emptyText,
  keyboardOf,
  orList,
  showsBy,
  type ButtonStep,
  type Context,
} from './context.ts'

export function checkKeyboards(ctx: Context): void {
  const { design } = ctx
  for (const step of ctx.steps) {
    const sending = asButtonStep(step)
    if (!sending) continue
    const keyboard = keyboardOf(sending)
    const rows = ctx.rows(sending)
    const name = ctx.stepName(step)
    const place = { stepId: step.id }

    if (keyboard?.type === 'inline' || keyboard?.type === 'reply') {
      const inline = keyboard.type === 'inline'
      const { max: perRow } = limit(inline ? 'inlineButtonsPerRow' : 'replyButtonsPerRow')
      const { max: inAll } = limit(inline ? 'inlineButtons' : 'replyButtons')
      rows.forEach((row, index) => {
        if (row.length <= perRow) return
        ctx.add(
          'E03',
          `Row ${String(index + 1)} of the buttons of ${name} has ${String(row.length)} buttons; Telegram ` +
            `allows at most ${String(perRow)} in a row.`,
          place,
        )
      })
      const count = rows.reduce((sum, row) => sum + row.length, 0)
      if (count > inAll) {
        ctx.add(
          'E03',
          `${name} has ${String(count)} buttons; Telegram allows at most ${String(inAll)} in a keyboard.`,
          place,
        )
      }
    }

    const content = sending.kind === 'invoice' ? undefined : contentOf(sending)
    if (content?.type === 'album') {
      const { min, max } = limit('albumItems')
      const count = content.items.length
      if (count < min || count > max) {
        ctx.add(
          'E04',
          `The album in ${name} has ${String(count)} ${count === 1 ? 'item' : 'items'}; Telegram needs ` +
            `${String(min)} to ${String(max)}.`,
          place,
        )
      }
      // Placeholders have no kind yet.
      const kinds = [
        ...new Set(
          content.items.flatMap((item): MediaKind[] => {
            const kind = 'media' in item.media ? design.media[item.media.media]?.kind : undefined
            return kind ? [kind] : []
          }),
        ),
      ]
      const label = (kind: MediaKind) => messageKind(kind).label
      const outside = kinds.filter((kind) => albumGroup(kind) === undefined)
      if (outside.length > 0) {
        ctx.add(
          'E04',
          `The album in ${name} has ${andList(outside.map(label))} items, which Telegram does not put in an album.`,
          place,
        )
      } else if (new Set(kinds.map((kind) => albumGroup(kind)?.id)).size > 1) {
        ctx.add(
          'E04',
          `The album in ${name} mixes ${andList(kinds.map(label))}, which Telegram does not put in one album.`,
          place,
        )
      }
      if (messageKind(content.type).buttons === 'none' && keyboard !== null) {
        // A keyboard removal or a forced reply by its editor's name.
        const label = (KEYBOARD_TYPES as readonly KeyboardTypeRow[]).find((row) => row.id === keyboard.type)?.label
        const what = label === undefined ? rows.some((row) => row.length > 0) && 'buttons' : `"${label}"`
        if (what) ctx.add('E04', `The album in ${name} has ${what}, which Telegram does not allow on an album.`, place)
      }
    }

    // "Edit this message": the clicked message becomes each message the target shows first.
    const seen = new Set<string>()
    for (const button of rows.flat()) {
      if (seen.has(button.id) || !showsBy(button, 'edit') || button.action.type !== 'goTo') continue
      seen.add(button.id)
      const { target } = button.action
      if (target === undefined || target === 'stay') continue
      for (const shown of ctx.shown(target)) {
        const why = editProblem(sending, shown)
        if (!why) continue
        ctx.add(
          'E05',
          `The button ${ctx.buttonName(button)} in ${name} edits the message into ${ctx.stepName(shown)}, but ` +
            `${why}. Use "Send a new message" instead.`,
          { stepId: step.id, buttonId: button.id },
        )
        break
      }
    }
  }

  for (const { button, step } of ctx.buttons) {
    const place = { stepId: step.id, buttonId: button.id }
    const name = `${ctx.buttonName(button)} in ${ctx.stepName(step)}`
    if (emptyText(button.label[ctx.defaultLanguage])) {
      ctx.add('E12', `A button in ${ctx.stepName(step)} has no text in ${ctx.defaultLanguage}.`, place)
    }
    if (button.place !== 'inline') continue
    const { action } = button
    if (action.type !== 'url' && action.type !== 'loginUrl') continue
    const login = action.type === 'loginUrl'
    const schemes =
      (BUTTON_KINDS as readonly ButtonKindRow[]).find((kind) => kind.id === (login ? 'login_url' : 'url'))?.schemes ??
      []
    const url = action.url.trim()
    // An empty link goes nowhere yet (W02); a link that starts with a variable is known only when the bot runs.
    if (url === '' || url.startsWith('{')) continue
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
    if (scheme !== undefined && schemes.includes(scheme)) continue
    ctx.add('E07', `The ${login ? 'login link' : 'link'} of ${name} should start with ${orList(schemes)}.`, place)
  }
}

// EDIT_FACTS editableMarkup: a message sent with a bottom keyboard, a keyboard removal or a forced
// reply cannot be edited; inlineKeyboardOnly: an edit sets an inline keyboard only.
type EditableKeyboard = Extract<Keyboard, { type: 'inline' }> | null

function editable(keyboard: Keyboard): keyboard is EditableKeyboard {
  return keyboard === null || keyboard.type === 'inline'
}

const MARKUP_WORDS = { reply: 'a bottom keyboard', removeReply: 'a keyboard removal', forceReply: 'a forced reply' }

// The catalog's kind of what a step sends: its content's, or an invoice.
function sentKind(step: ButtonStep): ContentKind {
  return step.kind === 'invoice' ? 'invoice' : contentOf(step).type
}

// What Telegram cannot do when `from` is edited into `to`, in plain words, or undefined.
function editProblem(from: ButtonStep, to: ButtonStep): string | undefined {
  const fromKeyboard = keyboardOf(from)
  if (!editable(fromKeyboard)) return `Telegram cannot edit a message sent with ${MARKUP_WORDS[fromKeyboard.type]}`
  const toKeyboard = keyboardOf(to)
  if (!editable(toKeyboard)) return `an edit cannot add ${MARKUP_WORDS[toKeyboard.type]}`
  const before = sentKind(from)
  const after = sentKind(to)
  const rule = EDIT_MATRIX[before][after]
  const label = messageKind(before).label
  if (!rule.allowed) return `Telegram cannot edit a message from ${label} to ${messageKind(after).label}`
  switch (rule.change) {
    case 'all':
      return undefined
    case 'caption':
      return sameFile(from, to) ? undefined : `Telegram can change only the caption and buttons of a ${label} message`
    case 'buttons':
      return sameFile(from, to) ? undefined : `Telegram can change only the buttons of a ${label} message`
    case 'items':
      return 'Telegram edits an album only item by item'
    case 'none':
      return `Telegram cannot edit a message from ${label} to ${messageKind(after).label}`
  }
}

// The part of a message an edit of its caption or buttons keeps: the file (paid media: its items
// and price), an invoice's whole invoice, or all of it.
function sameFile(a: ButtonStep, b: ButtonStep): boolean {
  const kept = (step: ButtonStep) => {
    if (step.kind === 'invoice') return JSON.stringify(step.invoice)
    const content = contentOf(step)
    return JSON.stringify(
      'media' in content
        ? content.media
        : content.type === 'paidMedia'
          ? { items: content.items, stars: content.stars }
          : content,
    )
  }
  return kept(a) === kept(b)
}
