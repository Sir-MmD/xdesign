// Language accessors (docs/plan/03-design-model.md sections 2.1 and 3): `meta.languages` and
// `meta.defaultLanguage`. A new language gets an empty fragment in every rich text; a removed
// one takes its texts with it, rich and plain, and their copied marks.
import * as Y from 'yjs'

import { LangSchema, type Lang } from '../model/ids.ts'
import { change, defaultLanguageOf, languagesOf, yarray, type DesignEditor } from './layout.ts'
import { forEachLangText } from './refs.ts'
import { pruneCopied } from './texts.ts'

export function languageEdits(editor: DesignEditor) {
  return {
    /** Adds a language at the end of the list; false when it is there or not a language code. */
    add(lang: Lang): boolean {
      return change(editor, (maps) => {
        if (!LangSchema.safeParse(lang).success || languagesOf(maps).includes(lang)) return false
        const list = yarray(maps.meta, 'languages') ?? maps.meta.set('languages', new Y.Array<unknown>())
        list.push([lang])
        maps.texts.forEach((text) => {
          if (!text.has(lang)) text.set(lang, new Y.XmlFragment())
        })
        return true
      })
    },
    /** Removes a language and every text in it; the default language cannot be removed. */
    remove(lang: Lang): boolean {
      return change(editor, (maps) => {
        const list = yarray(maps.meta, 'languages')
        const index = list?.toArray().indexOf(lang) ?? -1
        if (!list || index < 0 || lang === defaultLanguageOf(maps)) return false
        list.delete(index, 1)
        maps.texts.forEach((text) => {
          text.delete(lang)
        })
        forEachLangText(maps, (text) => {
          text.delete(lang)
        })
        pruneCopied(maps)
        return true
      })
    },
    /** Makes a language of the list the default one. */
    setDefault(lang: Lang): boolean {
      return change(editor, (maps) => {
        if (!languagesOf(maps).includes(lang)) return false
        maps.meta.set('defaultLanguage', lang)
        return true
      })
    },
  }
}
