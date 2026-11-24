// Media accessors (docs/plan/03-design-model.md sections 2.11 and 3): the design's uploaded files.
// Deleting one turns the places that showed it into placeholders described by its file name.
import type { MediaId } from '../model/ids.ts'
import type { MediaItem } from '../model/parts.ts'
import { change, newId, setField, toY, ymap, ystring, type DesignEditor, type YMap } from './layout.ts'
import { forEachMediaSlot } from './refs.ts'

export function mediaEdits(editor: DesignEditor) {
  return {
    /** Adds an uploaded file (its `serverId` is the server's media ID). */
    add(item: Omit<MediaItem, 'id'>): MediaId {
      return change(editor, (maps) => {
        const id = newId()
        maps.media.set(id, toY({ id, ...item }) as YMap)
        return id
      })
    },
    /** Points a file at its media ID on the server (an import uploads its files after the design exists). */
    setServerId(id: MediaId, serverId: string): boolean {
      return change(editor, (maps) => {
        const item = maps.media.get(id)
        if (!item) return false
        item.set('serverId', serverId)
        return true
      })
    },
    rename(id: MediaId, name: string): boolean {
      return change(editor, (maps) => {
        const item = maps.media.get(id)
        if (!item) return false
        item.set('name', name)
        return true
      })
    },
    /** Deletes a file; every slot that used it becomes a placeholder. */
    remove(id: MediaId): boolean {
      return change(editor, (maps) => {
        const item = maps.media.get(id)
        if (!item) return false
        const description = ystring(item, 'name') ?? ''
        forEachMediaSlot(maps, (holder, key) => {
          if (ystring(ymap(holder, key), 'media') === id) setField(holder, key, { placeholder: { description } })
        })
        maps.media.delete(id)
        return true
      })
    },
  }
}
