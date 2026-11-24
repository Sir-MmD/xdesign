// Registers the routes declared in @xdesign/api (docs/plan/02-architecture.md section 7): their
// Zod schemas go to Fastify through fastify-type-provider-zod (requests are validated, answers
// encoded with the response schema), and the check of their `auth` runs before the body is read.
import { hasRole, type DesignRole, type Route, type RouteInput, type RouteResponse } from '@xdesign/api'
import type { FastifyInstance, FastifyReply, FastifyRequest, FastifySchema } from 'fastify'

import { getDesignRole, getSessionUser, type SessionUser } from './auth/context.ts'
import { openViewLink } from './designs/viewLinks.ts'
import { ApiError } from './errors.ts'

// What each src/routes/<area>.ts exports: it adds the routes of its area to the app.
export type Register = (app: FastifyInstance) => void

type RawParams = Record<string, string | undefined>

export interface RouteContext<R extends Route> extends RouteInput<R> {
  req: FastifyRequest
  reply: FastifyReply
  // The signed-in person; public routes skip the check and get null, and so does a view link's
  // request (RouteOptions.viewLink).
  user: R['auth'] extends 'public' ? null : SessionUser
  // The person's role on the design of a design route ('owner' for the site owner).
  role: R['auth'] extends { design: DesignRole } ? DesignRole : null
}

// A handler returns the answer, or the reply when it sends something else (a file).
type Result<R extends Route> = RouteResponse<R> | FastifyReply
export type RouteHandler<R extends Route> = (ctx: RouteContext<R>) => Result<R> | Promise<Result<R>>

export interface RouteOptions {
  // For a design route without `:id` (a media file): the design the request is about, or null.
  designOf?: (params: RawParams) => string | null
  // A risky action: the session must have passed "Confirm it's you" (POST /api/auth/confirm) in
  // the last 5 minutes, else 403 confirm_needed.
  confirm?: boolean
  // A Trash route (delete, restore, delete forever): its design owner reaches a design in Trash.
  trash?: boolean
  // The largest JSON body in bytes, instead of Fastify's 1 MiB (an import's spec.json).
  bodyLimit?: number
  // VIEW-01: a working view link's token in the `view` query opens the route for the link's own
  // design as a Viewer, without a session. `user` is then null: only for handlers that do not
  // read it (the media files).
  viewLink?: boolean
}

interface Access {
  user: SessionUser | null
  role: DesignRole | null
}

// The design a design route is about: `:id`, or what its designOf finds.
function designOfRequest(req: FastifyRequest, options: RouteOptions): string | null | undefined {
  const params = req.params as RawParams
  return options.designOf ? options.designOf(params) : params.id
}

// VIEW-01: the access of a request whose `view` token opens the route's design, or null.
function viewAccess(req: FastifyRequest, options: RouteOptions): Access | null {
  const token = (req.query as RawParams).view
  if (!options.viewLink || token === undefined) {
    return null
  }
  const designId = designOfRequest(req, options)
  return designId && openViewLink(token, designId) ? { user: null, role: 'viewer' } : null
}

// Answers 401 not_signed_in or 403 no_access when the request may not use the route.
function checkRole(route: Route, req: FastifyRequest, options: RouteOptions): Access {
  if (route.auth === 'public') {
    return { user: null, role: null }
  }
  const viewed = viewAccess(req, options)
  if (viewed) {
    return viewed
  }
  const user = getSessionUser(req)
  if (!user) {
    throw new ApiError('not_signed_in')
  }
  if (route.auth === 'member') {
    return { user, role: null }
  }
  if (route.auth === 'siteOwner') {
    if (!user.isSiteOwner) {
      throw new ApiError('no_access')
    }
    return { user, role: null }
  }
  if (user.isSiteOwner) {
    return { user, role: 'owner' }
  }
  const designId = designOfRequest(req, options)
  const role = designId ? getDesignRole(user.id, designId, { trash: options.trash ?? false }) : null
  if (!role || !hasRole(role, route.auth.design)) {
    throw new ApiError('no_access')
  }
  return { user, role }
}

// The role check, then 403 confirm_needed for a `confirm` route without a fresh confirmation.
function checkAccess(route: Route, req: FastifyRequest, options: RouteOptions): Access {
  const result = checkRole(route, req, options)
  if (options.confirm && (result.user?.confirmedUntil ?? 0) <= Date.now()) {
    throw new ApiError('confirm_needed')
  }
  return result
}

const access = new WeakMap<FastifyRequest, Access>()

// The options of each route by its key, as addRoute added it: Claude's actions (src/claude/
// actions.ts) refuse a route that needs "Confirm it's you" before running it.
const addedOptions = new Map<string, RouteOptions>()

export function routeOptionsOf(key: string): RouteOptions | undefined {
  return addedOptions.get(key)
}

export function addRoute<R extends Route>(
  app: FastifyInstance,
  route: R,
  handler: NoInfer<RouteHandler<R>>,
  options: RouteOptions = {},
): void {
  addedOptions.set(route.key, options)
  const schema: FastifySchema = { response: { 200: route.response } }
  if (route.params) {
    schema.params = route.params
  }
  if (route.query) {
    schema.querystring = route.query
  }
  if (route.body) {
    schema.body = route.body
  }
  app.route({
    method: route.method,
    url: route.path,
    schema,
    ...(options.bodyLimit === undefined ? {} : { bodyLimit: options.bodyLimit }),
    onRequest: (req, _reply, done) => {
      try {
        access.set(req, checkAccess(route, req, options))
        done()
      } catch (error) {
        done(error as Error)
      }
    },
    handler: (req, reply) => {
      const { user, role } = access.get(req) ?? { user: null, role: null }
      const ctx = { req, reply, params: req.params, query: req.query, body: req.body, user, role }
      return handler(ctx as RouteContext<R>)
    },
  })
}
