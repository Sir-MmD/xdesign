// Designs (docs/plan/04 section 3, 05 sections 2, 3 and 5): the Designs page, the editor's
// header, rename, duplicate, Trash, transfer, sharing and import.
import { z } from 'zod'

import { id, ok, person, time } from '../common.ts'
import { defineRoute, designRoles } from '../route.ts'

export const designName = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.')

// A language code as Telegram sends it in `language_code`: IETF tags such as en, fa, pt-br
// (docs/plan/03 section 1).
export const languageCode = z.string().regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i, 'Not a language code.')

// The person's role on a design; the site owner gets 'owner' on every design.
export const designRole = z.enum(designRoles)
// The roles the design owner gives in the Share dialog.
export const memberRole = z.enum(['editor', 'commenter', 'viewer'])

// The editor's header of a design.
export const design = z.object({
  id,
  name: z.string(),
  owner: person,
  createdAt: time,
  updatedAt: time,
  updatedBy: person.nullable(),
  // Set while the design is in Trash.
  deletedAt: time.nullable(),
  docVersion: z.number().int(),
})

// A card on the Designs page.
export const designCard = z.object({
  id,
  name: z.string(),
  owner: person,
  updatedAt: time,
  updatedBy: person.nullable(),
  role: designRole,
  stepCount: z.number().int(),
  languages: z.array(z.string()),
  deletedAt: time.nullable(),
})

// A person under "People with access"; the design owner is listed with 'owner'.
export const designMember = z.object({
  id,
  name: z.string(),
  username: z.string(),
  color: z.string(),
  role: designRole,
})

const designParams = z.object({ id })

export const designRoutes = {
  // The filter chips "All", "Mine", "Shared with me", "Trash" and "Search designs".
  designs: defineRoute({
    key: 'designs',
    method: 'GET',
    path: '/api/designs',
    query: z.object({
      filter: z.enum(['all', 'mine', 'shared', 'trash']).default('all'),
      q: z.string().trim().max(100).optional(),
    }),
    response: z.object({ designs: z.array(designCard) }),
    auth: 'member',
  }),
  // "New design": languages lists every language of the design, the default one included.
  createDesign: defineRoute({
    key: 'createDesign',
    method: 'POST',
    path: '/api/designs',
    body: z
      .object({
        name: designName,
        defaultLanguage: languageCode,
        languages: z.array(languageCode).min(1).max(50),
      })
      .refine((body) => body.languages.includes(body.defaultLanguage), {
        message: 'The default language must be one of the languages.',
        path: ['defaultLanguage'],
      }),
    response: z.object({ design }),
    auth: 'member',
  }),
  design: defineRoute({
    key: 'design',
    method: 'GET',
    path: '/api/designs/:id',
    params: designParams,
    response: z.object({ design, role: designRole }),
    auth: { design: 'viewer' },
  }),
  renameDesign: defineRoute({
    key: 'renameDesign',
    method: 'PATCH',
    path: '/api/designs/:id',
    params: designParams,
    body: z.object({ name: designName }),
    response: z.object({ design }),
    auth: { design: 'owner' },
  }),
  // The copy belongs to the person who duplicates it; no sharing is copied.
  duplicateDesign: defineRoute({
    key: 'duplicateDesign',
    method: 'POST',
    path: '/api/designs/:id/duplicate',
    params: designParams,
    response: z.object({ design }),
    auth: { design: 'viewer' },
  }),
  // To Trash, kept 30 days.
  deleteDesign: defineRoute({
    key: 'deleteDesign',
    method: 'DELETE',
    path: '/api/designs/:id',
    params: designParams,
    response: ok,
    auth: { design: 'owner' },
  }),
  restoreDesign: defineRoute({
    key: 'restoreDesign',
    method: 'POST',
    path: '/api/designs/:id/restore',
    params: designParams,
    response: z.object({ design }),
    auth: { design: 'owner' },
  }),
  deleteDesignForever: defineRoute({
    key: 'deleteDesignForever',
    method: 'DELETE',
    path: '/api/designs/:id/forever',
    params: designParams,
    response: ok,
    auth: { design: 'owner' },
  }),
  transferDesign: defineRoute({
    key: 'transferDesign',
    method: 'POST',
    path: '/api/designs/:id/transfer',
    params: designParams,
    body: z.object({ userId: id }),
    response: z.object({ design }),
    auth: 'siteOwner',
  }),
  designMembers: defineRoute({
    key: 'designMembers',
    method: 'GET',
    path: '/api/designs/:id/members',
    params: designParams,
    response: z.object({ members: z.array(designMember) }),
    auth: { design: 'viewer' },
  }),
  // Adds the member or changes their role.
  setDesignMember: defineRoute({
    key: 'setDesignMember',
    method: 'PUT',
    path: '/api/designs/:id/members/:userId',
    params: z.object({ id, userId: id }),
    body: z.object({ role: memberRole }),
    response: ok,
    auth: { design: 'owner' },
  }),
  removeDesignMember: defineRoute({
    key: 'removeDesignMember',
    method: 'DELETE',
    path: '/api/designs/:id/members/:userId',
    params: z.object({ id, userId: id }),
    response: ok,
    auth: { design: 'owner' },
  }),
  // "Import as a new design": an export's spec.json, read by the server with fromSpec of
  // @xdesign/spec (which migrates older format versions and words its problems), so its schema is
  // not checked here. The importer becomes the design owner. `files` is the path in the zip of
  // each uploaded file by its media ID in the new design: the browser uploads them next and sets
  // their server IDs in the document.
  importDesign: defineRoute({
    key: 'importDesign',
    method: 'POST',
    path: '/api/designs/import',
    body: z.object({ spec: z.unknown() }),
    response: z.object({ design, files: z.record(z.string(), z.string()) }),
    auth: 'member',
  }),
}
