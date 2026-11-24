// Helpers of the starter templates (TPL-01): each template makes its own kit, so its ID names are
// unique within its design and come out as the editor gives them (variables first, then each box
// and button in the order written), the same way coffee-shop.ts makes them.
import type {
  Button,
  ButtonId,
  InlineAction,
  InlineButton,
  Keyboard,
  MediaSlot,
  ReplyAction,
  Row,
  StepId,
  Variable,
} from '../../src/index.ts'
import { idNames } from '../build.ts'

export const goTo = (
  target: Extract<InlineAction, { type: 'goTo' }>['target'],
  show: 'edit' | 'new' | 'replace',
): InlineAction => ({
  type: 'goTo',
  target,
  show,
})
export const row = (...ids: ButtonId[]): Row => ({ type: 'buttons', ids })
export const inlineKeyboard = (...rows: Row[]): Keyboard => ({ type: 'inline', rows })
export const placeholder = (description: string): MediaSlot => ({ placeholder: { description } })

/** The builders of one template: variables, inline and bottom buttons (into `buttons`), boxes. */
export function templateKit() {
  const idName = idNames()
  const buttons: Button[] = []
  const variable = (
    id: string,
    label: string,
    type: Variable['type'],
    source: Variable['source'],
    testValue?: string | number | boolean,
  ): Variable => ({
    id,
    idName: idName(label, '', 'var_'),
    label,
    type,
    source,
    ...(testValue !== undefined && { testValue }),
  })
  const inline = (
    id: ButtonId,
    en: string,
    fa: string,
    action: InlineAction,
    more: Partial<Pick<InlineButton, 'look'>> = {},
  ): ButtonId => {
    buttons.push({
      id,
      idName: idName(en, 'btn_'),
      label: { en, fa },
      look: 'default',
      place: 'inline',
      action,
      ...more,
    })
    return id
  }
  const bottom = (id: ButtonId, en: string, fa: string, action: ReplyAction): ButtonId => {
    buttons.push({ id, idName: idName(en, 'btn_'), label: { en, fa }, look: 'default', place: 'reply', action })
    return id
  }
  // A box on the map, left to right and top to bottom.
  const box = (id: StepId, title: string, col: number, line: number) => ({
    id,
    idName: idName(title),
    title,
    x: col * 320,
    y: line * 240,
  })
  return { buttons, variable, inline, bottom, box }
}
