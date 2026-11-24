// Templates (docs/plan/04 section 15, 05 section 2): the gallery `/templates` with the built-in
// starter templates and the server's own, "Use this template", a design's "Save as template", and
// removing one of the server's templates.
import { z } from 'zod'

import { id, ok, person, time } from '../common.ts'
import { defineRoute } from '../route.ts'
import { design, designName } from './designs.ts'

// A built-in template's own ID (`shop`), or the design ID of one of the server's templates.
export const templateId = z.string().regex(/^[\w-]{1,40}$/, 'Not a valid id.')

export const templateDescription = z.string().trim().max(300, 'Use at most 300 characters.')

// A card of the gallery.
export const template = z.object({
  id: templateId,
  name: z.string(),
  description: z.string(),
  // A built-in starter template.
  builtIn: z.boolean(),
  // The picture of a built-in template ('shop', 'support', 'quiz', 'signUp'); null for the
  // server's own.
  icon: z.string().nullable(),
  // Who saved one of the server's templates, and when; null for a built-in one.
  savedBy: person.nullable(),
  savedAt: time.nullable(),
  stepCount: z.number().int(),
  languages: z.array(z.string()),
})

const templateParams = z.object({ id: templateId })

export const templateRoutes = {
  // The built-in templates first, then the server's own, newest first; every member sees all.
  templates: defineRoute({
    key: 'templates',
    method: 'GET',
    path: '/api/templates',
    response: z.object({ templates: z.array(template) }),
    auth: 'member',
  }),
  // "Use this template": a new design named after the template, owned by the person, without
  // sharing (as a duplicate).
  useTemplate: defineRoute({
    key: 'useTemplate',
    method: 'POST',
    path: '/api/templates/:id/use',
    params: templateParams,
    response: z.object({ design }),
    auth: 'member',
  }),
  // A design's "Save as template" (design owner and site owner): a copy of the design as it is
  // now, shared with every member in the gallery.
  saveAsTemplate: defineRoute({
    key: 'saveAsTemplate',
    method: 'POST',
    path: '/api/designs/:id/template',
    params: z.object({ id }),
    body: z.object({ name: designName, description: templateDescription }),
    response: z.object({ template }),
    auth: { design: 'owner' },
  }),
  // Removes one of the server's templates: the person who saved it, or the site owner.
  deleteTemplate: defineRoute({
    key: 'deleteTemplate',
    method: 'DELETE',
    path: '/api/templates/:id',
    params: templateParams,
    response: ok,
    auth: 'member',
  }),
}
