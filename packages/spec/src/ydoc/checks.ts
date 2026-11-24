// "Ignore here" accessors (docs/plan/04 section 9, 03 section 8): the keys of the checks marked
// (`issueKey`) in `meta.ignoredChecks`, a Y.Array. Errors are never ignored. Keys of deleted
// steps stay, so an undone delete brings its marks back.
import * as Y from 'yjs'

import { issueKey, type Issue } from '../checks/issues.ts'
import { change, yarray, type DesignEditor } from './layout.ts'

export function checkEdits(editor: DesignEditor) {
  return {
    /** Marks an issue "Ignore here"; false for an error or an issue marked already. */
    ignore(issue: Issue): boolean {
      return change(editor, (maps) => {
        const key = issueKey(issue)
        const list = yarray(maps.meta, 'ignoredChecks')
        if (!issue.ignorable || list?.toArray().includes(key) === true) return false
        ;(list ?? maps.meta.set('ignoredChecks', new Y.Array<unknown>())).push([key])
        return true
      })
    },
    /** "Stop ignoring": removes the issue's key (each copy, when two people marked it at once). */
    stopIgnoring(issue: Issue): boolean {
      return change(editor, (maps) => {
        const key = issueKey(issue)
        const list = yarray(maps.meta, 'ignoredChecks')
        const keys = list?.toArray() ?? []
        if (!list || !keys.includes(key)) return false
        for (let index = keys.length - 1; index >= 0; index--) {
          if (keys[index] === key) list.delete(index, 1)
        }
        return true
      })
    },
  }
}
