// The error format of docs/plan/02-architecture.md section 7: every failure answers
// { "error": { "code": "not_found", "message": "Plain-words text for the screen" } }, from the one
// error handler below. Zod validation errors become `bad_request` with the first problem.
import type { ApiErrorBody, ApiErrorCode } from '@xdesign/api'
import type { FastifyError, FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { z } from 'zod'

const statuses: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_signed_in: 401,
  no_access: 403,
  confirm_needed: 403,
  bad_origin: 403,
  not_found: 404,
  conflict: 409,
  too_large: 413,
  too_many_tries: 429,
  step_expired: 401,
  server_error: 500,
  no_helper: 503,
  not_in_desktop: 404,
}

const messages: Record<ApiErrorCode, string> = {
  bad_request: 'The request is not valid.',
  not_signed_in: 'Sign in to continue.',
  no_access: 'You do not have access to this.',
  confirm_needed: "Confirm it's you with your password first.",
  bad_origin: "This request did not come from the site's own address.",
  not_found: 'This was not found.',
  conflict: 'This was changed meanwhile. Reload and try again.',
  too_large: 'This is too large.',
  too_many_tries: 'Too many tries. Wait a few minutes and try again.',
  step_expired: 'The sign-in step expired. Enter your password again.',
  server_error: 'Something went wrong on the server. Try again in a moment.',
  no_helper: 'The server helper is not running (development).',
  not_in_desktop: 'Not in the desktop app.',
}

// Thrown by handlers and the route helper to answer with an error of the API.
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, message: string = messages[code]) {
    super(message)
    this.code = code
    this.status = statuses[code]
  }
}

export function errorBody(code: ApiErrorCode, message: string = messages[code]): ApiErrorBody {
  return { error: { code, message } }
}

// A Zod problem in words, with the field it is about: "name: Enter a name."
function problem(path: string, message: string): ApiError {
  return new ApiError('bad_request', path ? `${path}: ${message}` : message)
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }
  if (hasZodFastifySchemaValidationErrors(error)) {
    const [first] = error.validation
    return first
      ? problem(first.instancePath.slice(1).replaceAll('/', '.'), first.message ?? messages.bad_request)
      : new ApiError('bad_request')
  }
  if (error instanceof z.ZodError) {
    const [first] = error.issues
    return first ? problem(first.path.join('.'), first.message) : new ApiError('bad_request')
  }
  // Fastify's own errors (a body that is not JSON or too large) and plugins' carry a status.
  const status = (error as Partial<FastifyError> | null)?.statusCode ?? 500
  if (status === 404) {
    return new ApiError('not_found')
  }
  if (status === 413) {
    return new ApiError('too_large')
  }
  if (status === 429) {
    return new ApiError('too_many_tries')
  }
  if (status >= 400 && status < 500) {
    return new ApiError('bad_request')
  }
  return new ApiError('server_error')
}

export function setErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const apiError = toApiError(error)
    if (apiError.status >= 500) {
      request.log.error({ err: error }, 'request failed')
    }
    return reply.code(apiError.status).send(errorBody(apiError.code, apiError.message))
  })
}
