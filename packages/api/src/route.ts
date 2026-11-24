// The route declaration helper (docs/plan/02-architecture.md section 7): every route of the API
// is declared once with its method, path, Zod schemas and the role it needs. The server
// registers the declarations with the Zod type provider; the web app's typed client calls them.
import type { z } from 'zod'

// The roles on a design, lowest first; the design owner is 'owner' (docs/plan/05 section 2).
export const designRoles = ['viewer', 'commenter', 'editor', 'owner'] as const
export type DesignRole = (typeof designRoles)[number]

// True when role is min or a higher one.
export function hasRole(role: DesignRole, min: DesignRole): boolean {
  return designRoles.indexOf(role) >= designRoles.indexOf(min)
}

// Who may call a route: everyone, any signed-in member, only the site owner, or a member with at
// least this role on the design in `:id`. The site owner passes every check.
export type RouteAuth = 'public' | 'member' | 'siteOwner' | { design: DesignRole }

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface Route {
  // The route's name in `routes`.
  key: string
  method: RouteMethod
  // The path as Fastify writes it, with `:name` for each path parameter.
  path: string
  params?: z.ZodType
  query?: z.ZodType
  // The JSON body. A multipart upload has none and sets `multipart` instead.
  body?: z.ZodType
  multipart?: true
  // The answer with status 200; failures answer `apiError` with their own status.
  response: z.ZodType
  auth: RouteAuth
}

export function defineRoute<const R extends Route>(route: R): R {
  return route
}

type Part<R, K extends 'params' | 'query' | 'body'> = R extends Record<K, infer S> ? S : undefined
type Input<S> = S extends z.ZodType ? z.input<S> : undefined
type Output<S> = S extends z.ZodType ? z.output<S> : undefined

// What a client sends: the input types of the route's schemas (undefined where it has none).
export interface RouteRequest<R extends Route> {
  params: Input<Part<R, 'params'>>
  query: Input<Part<R, 'query'>>
  body: Input<Part<R, 'body'>>
}

// What the server's handler gets once the request passed the schemas.
export interface RouteInput<R extends Route> {
  params: Output<Part<R, 'params'>>
  query: Output<Part<R, 'query'>>
  body: Output<Part<R, 'body'>>
}

export type RouteResponse<R extends Route> = z.output<R['response']>
