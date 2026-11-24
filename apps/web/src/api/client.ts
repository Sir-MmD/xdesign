// The typed API client (docs/plan/02-architecture.md section 7): `call(routes.signIn, { body })`
// sends a request as the route's declaration in packages/api describes it (method, path with its
// parameters, query, JSON body) and returns the answer checked against the route's response
// schema. A failure becomes an ApiError with the plain message the server wrote for the screen.
// A 401 `not_signed_in` from a route that needs a session means the session ended: the handler
// set with onSignedOut (main.tsx) sends the person to the sign-in page. The TanStack Query
// helpers (apiQuery, useApi, useApiMutation) key every query by its route and input.
import {
  queryOptions,
  useMutation,
  type UseMutationOptions,
  useQuery,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { Route, RouteRequest, RouteResponse } from '@xdesign/api'
import { z } from 'zod'

import { appUrl } from '@/lib/base'

/** The code of an ApiError for a server that could not be reached at all. */
export const NETWORK_ERROR = 'network_error'

/**
 * A failed call. `status` is the HTTP status, 0 when the server could not be reached. `code` is
 * the error code of the answer (`not_found`, `too_many_tries`, ...) or `network_error`; `message`
 * is the plain text to show.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

// The error format of 02 section 7. The code is any string, so a code a newer server adds still
// shows its message.
const errorBody = z.object({ error: z.object({ code: z.string().min(1), message: z.string().min(1) }) })

const messages = {
  network: 'The server could not be reached. Check your connection and try again.',
  failed: 'Something went wrong on the server. Try again.',
  answer: 'The server sent an answer this page does not understand. Reload the page.',
}

type Defined<T> = { [K in keyof T as T[K] extends undefined ? never : K]: T[K] }

/** What a call sends: the route's `params`, `query` and `body`, each only where the route has one. */
export type CallInput<R extends Route> = Defined<RouteRequest<R>>

export interface CallOptions {
  signal?: AbortSignal | undefined
}

// The input may be left out when the route needs none (or only optional parts).
type NeedsInput<R extends Route> = object extends CallInput<R> ? false : true
export type CallArgs<R extends Route> =
  NeedsInput<R> extends true
    ? [input: CallInput<R>, options?: CallOptions]
    : [input?: CallInput<R>, options?: CallOptions]

interface AnyInput {
  params?: Record<string, string | number>
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

let signedOut: ((error: ApiError) => void) | undefined

/** Sets what happens when a call finds the session ended (main.tsx: go to the sign-in page). */
export function onSignedOut(handler: (error: ApiError) => void): void {
  signedOut = handler
}

/** The address of a route with its path parameters and query filled in, under the site's base path. */
export function routeUrl(route: Route, input?: AnyInput): string {
  const path = route.path.replace(/:(\w+)/g, (_, name: string) => {
    const value = input?.params?.[name]
    if (value === undefined) throw new Error(`${route.key}: the path parameter ${name} is missing`)
    return encodeURIComponent(String(value))
  })
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(input?.query ?? {})) {
    if (value !== undefined) query.set(name, String(value))
  }
  const search = query.toString()
  return search === '' ? appUrl(path) : `${appUrl(path)}?${search}`
}

/** Calls a route of packages/api and returns its answer; throws an ApiError when it fails. */
export async function call<R extends Route>(route: R, ...[input, options]: CallArgs<R>): Promise<RouteResponse<R>> {
  const parts = input as AnyInput | undefined
  const hasBody = parts?.body !== undefined
  let response: Response
  try {
    response = await fetch(routeUrl(route, parts), {
      method: route.method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(parts.body) : null,
      credentials: 'same-origin',
      signal: options?.signal ?? null,
    })
  } catch (error) {
    // An aborted query stays an abort, which TanStack Query expects.
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, NETWORK_ERROR, messages.network)
  }
  const json: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const parsed = errorBody.safeParse(json)
    const error = parsed.success
      ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(response.status, 'server_error', messages.failed)
    // A public route (sign in, a view-only link) never needs a session: its 401 is its own answer.
    if (error.code === 'not_signed_in' && route.auth !== 'public') signedOut?.(error)
    throw error
  }
  const answer = route.response.safeParse(json)
  if (!answer.success) throw new ApiError(response.status, 'server_error', messages.answer)
  return answer.data as RouteResponse<R>
}

/** The query key of a route with its input: the route's key first, so one route's queries go together. */
export function apiKey<R extends Route>(route: R, input?: CallInput<R>): readonly [string, unknown] {
  return [route.key, input ?? null]
}

type ApiQueryOptions<R extends Route> = Omit<
  UseQueryOptions<RouteResponse<R>, ApiError, RouteResponse<R>, readonly [string, unknown]>,
  'queryKey' | 'queryFn'
>

/** The TanStack Query options of a GET route, for useQuery and for a route loader's ensureQueryData. */
export function apiQuery<R extends Route>(route: R, input?: CallInput<R>) {
  return queryOptions<RouteResponse<R>, ApiError, RouteResponse<R>, readonly [string, unknown]>({
    queryKey: apiKey(route, input),
    queryFn: ({ signal }) => call(route, ...([input, { signal }] as CallArgs<R>)),
  })
}

type QueryArgs<R extends Route> =
  NeedsInput<R> extends true
    ? [input: CallInput<R>, options?: ApiQueryOptions<R>]
    : [input?: CallInput<R>, options?: ApiQueryOptions<R>]

/** useQuery on a GET route: `useApi(routes.me)`, `useApi(routes.design, { params: { id } })`. */
export function useApi<R extends Route>(route: R, ...[input, options]: QueryArgs<R>) {
  return useQuery({ ...apiQuery(route, input), ...options })
}

// What mutate() takes: nothing for a route without input.
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- mutate() may leave out only void variables
type MutationInput<R extends Route> = NeedsInput<R> extends true ? CallInput<R> : CallInput<R> | void

/** useMutation on a changing route: `useApiMutation(routes.signIn).mutateAsync({ body })`. */
export function useApiMutation<R extends Route>(
  route: R,
  options?: Omit<UseMutationOptions<RouteResponse<R>, ApiError, MutationInput<R>>, 'mutationFn'>,
) {
  return useMutation<RouteResponse<R>, ApiError, MutationInput<R>>({
    mutationFn: (input) => call(route, ...([input ?? undefined] as CallArgs<R>)),
    ...options,
  })
}
