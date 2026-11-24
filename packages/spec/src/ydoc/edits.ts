// All accessors of a design document (docs/plan/03-design-model.md section 3, rule 1): writers
// never touch Yjs directly, and each change runs in one transaction with the person's origin,
// so their undo manager groups it.
import * as Y from 'yjs'

import { botEdits } from './bot.ts'
import { buttonEdits, keyboardEdits } from './buttons.ts'
import { checkEdits } from './checks.ts'
import { languageEdits } from './languages.ts'
import { designMaps } from './layout.ts'
import { mapEdits } from './map.ts'
import { mediaEdits } from './media.ts'
import { partEdits } from './parts.ts'
import { stepEdits } from './steps.ts'
import { textEdits } from './texts.ts'
import { switchEdits, variableEdits } from './variables.ts'

export function designEdits(doc: Y.Doc, origin: unknown) {
  const editor = { doc, origin }
  return {
    steps: stepEdits(editor),
    buttons: buttonEdits(editor),
    keyboard: keyboardEdits(editor),
    texts: textEdits(editor),
    variables: variableEdits(editor),
    switches: switchEdits(editor),
    parts: partEdits(editor),
    media: mediaEdits(editor),
    bot: botEdits(editor),
    languages: languageEdits(editor),
    map: mapEdits(editor),
    checks: checkEdits(editor),
  }
}
export type DesignEdits = ReturnType<typeof designEdits>

/**
 * The person's undo manager (02 section 4, item 6): every area of the document, but only the
 * changes made with their origin, so undo never takes back someone else's work.
 */
export function designUndoManager(doc: Y.Doc, origin: unknown): Y.UndoManager {
  return new Y.UndoManager(Object.values(designMaps(doc)), { trackedOrigins: new Set([origin]) })
}
