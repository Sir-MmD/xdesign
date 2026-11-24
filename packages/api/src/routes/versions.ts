// Version history (docs/plan/05 section 7, 04 section 15): the History panel's list, a version's
// plain design (to view, compare and export it), "Name this version", renaming and deleting a
// named version, and restore.
import { z } from 'zod'

import { id, ok, person, time } from '../common.ts'
import { defineRoute } from '../route.ts'
import { claudeVia } from './claude.ts'

// auto: made by the server while people edit; named: "Name this version"; before_restore: the
// document just before a restore; restore: the document a restore made.
export const versionKind = z.enum(['auto', 'named', 'restore', 'before_restore'])

export const versionName = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.')

// A row of the History panel.
export const designVersion = z.object({
  id,
  kind: versionKind,
  // A named version's name; for a restore, the name of the version restored when it had one.
  name: z.string().nullable(),
  createdAt: time,
  // Who made it (an automatic version: the person of the last change); null once they are gone.
  createdBy: person.nullable(),
  // MCP-01b: the key it was made through, when a change through Claude made it.
  via: claudeVia.nullable(),
  // The design's docVersion of the version's state.
  docVersion: z.number().int(),
})

const versionsParams = z.object({ id })
const versionParams = z.object({ id, versionId: id })

export const versionRoutes = {
  // Newest first.
  versions: defineRoute({
    key: 'versions',
    method: 'GET',
    path: '/api/designs/:id/versions',
    params: versionsParams,
    response: z.object({ versions: z.array(designVersion) }),
    auth: { design: 'viewer' },
  }),
  // `design` is the version's plain Design of @xdesign/spec (readDesign of its state), for View,
  // Compare and Export.
  version: defineRoute({
    key: 'version',
    method: 'GET',
    path: '/api/designs/:id/versions/:versionId',
    params: versionParams,
    response: z.object({ version: designVersion, design: z.unknown() }),
    auth: { design: 'viewer' },
  }),
  // "Name this version": a named version of the design as it is now (open editors' changes
  // included). Names are unique among a design's named versions, ignoring case.
  nameVersion: defineRoute({
    key: 'nameVersion',
    method: 'POST',
    path: '/api/designs/:id/versions',
    params: versionsParams,
    body: z.object({ name: versionName }),
    response: z.object({ version: designVersion }),
    auth: { design: 'editor' },
  }),
  // Renames a named version.
  renameVersion: defineRoute({
    key: 'renameVersion',
    method: 'PATCH',
    path: '/api/designs/:id/versions/:versionId',
    params: versionParams,
    body: z.object({ name: versionName }),
    response: z.object({ version: designVersion }),
    auth: { design: 'editor' },
  }),
  // Named versions are kept until the design owner deletes them; the others go by themselves.
  deleteVersion: defineRoute({
    key: 'deleteVersion',
    method: 'DELETE',
    path: '/api/designs/:id/versions/:versionId',
    params: versionParams,
    response: ok,
    auth: { design: 'owner' },
  }),
  // "Restore this version": a "Before restore" version of now (`before`), then the version's
  // content becomes the document for everyone as one change; open editors get the live message
  // `versionRestored`.
  restoreVersion: defineRoute({
    key: 'restoreVersion',
    method: 'POST',
    path: '/api/designs/:id/versions/:versionId/restore',
    params: versionParams,
    response: z.object({ before: designVersion }),
    auth: { design: 'editor' },
  }),
}
