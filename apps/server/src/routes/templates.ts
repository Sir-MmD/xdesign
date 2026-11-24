// Templates (templateRoutes of @xdesign/api; docs/plan/04 section 15, 05 section 2): the gallery
// with the built-in starter templates (STARTER_TEMPLATES of @xdesign/spec/templates, carried in
// the server's bundle) and the server's own, "Use this template", a design's "Save as template"
// and removing one of the server's templates. The server's templates are design rows with
// is_template set: copies of a design as it was when saved, owned by the person who saved it,
// listed only here and never opened (getDesignRole gives no role on them).
import { routes, type template } from '@xdesign/api'
import { STARTER_TEMPLATES } from '@xdesign/spec/templates'
import { and, desc, eq } from 'drizzle-orm'
import type { z } from 'zod'

import { audit } from '../audit.ts'
import { getDb } from '../db/index.ts'
import { designs, users } from '../db/schema.ts'
import { copyDesign, importDesign } from '../designs/store.ts'
import { summaryOf } from '../designs/summary.ts'
import { deleteForever } from '../designs/trash.ts'
import { ApiError } from '../errors.ts'
import { flushLiveDesign, maxBytes } from '../live/server.ts'
import { addRoute, type Register } from '../route.ts'
import { designHeader, findDesign } from './designs.ts'

type Template = z.output<typeof template>

const templateNotFound = 'This template was not found.'

// The cards of the built-in templates, in the gallery's order.
const builtInCards: Template[] = STARTER_TEMPLATES.map((starter) => ({
  id: starter.id,
  name: starter.design.name,
  description: starter.description,
  builtIn: true,
  icon: starter.icon,
  savedBy: null,
  savedAt: null,
  ...summaryOf(starter.design),
}))

// The server's templates with the names of the people who saved them.
function selectTemplates() {
  return getDb()
    .select({
      id: designs.id,
      name: designs.name,
      templateMeta: designs.templateMeta,
      ownerId: designs.ownerId,
      ownerName: users.name,
      createdAt: designs.createdAt,
      stepCount: designs.stepCount,
      languages: designs.languages,
    })
    .from(designs)
    .innerJoin(users, eq(users.id, designs.ownerId))
}

type TemplateRow = ReturnType<ReturnType<typeof selectTemplates>['all']>[number]

function toTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.templateMeta?.description ?? '',
    builtIn: false,
    icon: null,
    savedBy: { id: row.ownerId, name: row.ownerName },
    savedAt: row.createdAt,
    stepCount: row.stepCount,
    languages: row.languages,
  }
}

// One of the server's templates, or 404.
function findTemplate(templateId: string): TemplateRow {
  const row = selectTemplates()
    .where(and(eq(designs.id, templateId), eq(designs.isTemplate, true)))
    .get()
  if (!row) {
    throw new ApiError('not_found', templateNotFound)
  }
  return row
}

export const register: Register = (app) => {
  // Every member sees every template: the built-in ones, then the server's own, newest first.
  addRoute(app, routes.templates, () => {
    const own = selectTemplates().where(eq(designs.isTemplate, true)).orderBy(desc(designs.createdAt)).all()
    return { templates: [...builtInCards, ...own.map(toTemplate)] }
  })

  // "Use this template": a new design named after the template, owned by the person, without
  // sharing. A built-in template's design is stored as an import is; one of the server's is
  // copied with its media rows, as "Duplicate" copies a design.
  addRoute(app, routes.useTemplate, ({ user, params }) => {
    const starter = STARTER_TEMPLATES.find((item) => item.id === params.id)
    let name: string
    let id: string | null
    if (starter) {
      name = starter.design.name
      id = importDesign(starter.design, user.id, maxBytes)
    } else {
      const row = findTemplate(params.id)
      name = row.name
      id = copyDesign(row.id, row.name, user.id)
    }
    if (id === null) {
      throw new ApiError('not_found', templateNotFound)
    }
    audit('template_used', {
      userId: user.id,
      designId: id,
      detail: { templateId: params.id, name, builtIn: starter !== undefined },
    })
    return { design: designHeader(id, user.id) }
  })

  // "Save as template" (design owner and site owner): the design as it is now, with the changes
  // live editing has not saved yet, copied into a template the person owns.
  addRoute(app, routes.saveAsTemplate, async ({ user, params, body }) => {
    const row = findDesign(params.id)
    await flushLiveDesign(row.id)
    const id = copyDesign(row.id, body.name, user.id, { description: body.description })
    if (id === null) {
      throw new ApiError('not_found', 'This design was not found.')
    }
    audit('template_saved', { userId: user.id, designId: row.id, detail: { templateId: id, name: body.name } })
    return { template: toTemplate(findTemplate(id)) }
  })

  // Removing one of the server's templates (the person who saved it, or the site owner) deletes
  // it as "Delete forever" deletes a design; designs made from it stay.
  addRoute(app, routes.deleteTemplate, ({ user, params }) => {
    if (STARTER_TEMPLATES.some((item) => item.id === params.id)) {
      throw new ApiError('bad_request', 'A built-in template cannot be removed.')
    }
    const row = findTemplate(params.id)
    if (!user.isSiteOwner && row.ownerId !== user.id) {
      throw new ApiError('no_access')
    }
    deleteForever(row.id)
    audit('template_deleted', { userId: user.id, detail: { templateId: row.id, name: row.name } })
    return { ok: true as const }
  })
}
