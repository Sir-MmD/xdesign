// Bot setup accessors (docs/plan/03-design-model.md sections 2.9 and 3). The name, about and
// description are plain texts per language (`texts.setPlain`); `commandOrder` follows the
// command start points by itself, and these only reorder it.
import type { BotSetup } from '../model/bot.ts'
import type { MediaSlot } from '../model/content.ts'
import type { StepId } from '../model/ids.ts'
import { change, setField, yarray, type DesignEditor } from './layout.ts'

export function botEdits(editor: DesignEditor) {
  return {
    /** The bot's username without the @ ('' clears it). */
    setUsername(username: string): void {
      change(editor, (maps) => {
        setField(maps.bot, 'username', username === '' ? undefined : username)
      })
    },
    setMenuButton(menuButton: BotSetup['menuButton']): void {
      change(editor, (maps) => {
        maps.bot.set('menuButton', menuButton)
      })
    },
    /** The profile photo, or none (`undefined`). */
    setPhoto(photo: MediaSlot | undefined): void {
      change(editor, (maps) => {
        setField(maps.bot, 'photo', photo)
      })
    },
    /** Moves a command in the commands menu order. */
    moveCommand(stepId: StepId, to: number): boolean {
      return change(editor, (maps) => {
        const order = yarray(maps.bot, 'commandOrder')
        const from = order?.toArray().indexOf(stepId) ?? -1
        if (!order || from < 0) return false
        order.delete(from, 1)
        order.insert(Math.max(0, Math.min(to, order.length)), [stepId])
        return true
      })
    },
  }
}
