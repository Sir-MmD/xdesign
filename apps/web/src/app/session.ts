// The session in the web app (docs/plan/02-architecture.md section 7, 05 section 1): the signed-in
// layout (routes/_app.tsx) loads `GET /api/me` before its pages and sends to the sign-in page
// without a session; a session that ends while a page is open (it expired, it was signed out
// elsewhere, the member was disabled) shows up as a 401 `not_signed_in` from any call, and
// watchSessionEnd sends the person to the sign-in page with the page to come back to.
// DESK-03 (18 section 9): the desktop app has no sign-in; `GET /api/me` (or, on a page without a
// session, `GET /api/health`) says `mode` once, and the pages, menus and cards of the routes it
// refuses (notInDesktop of @xdesign/api) are not shown, as its own Backups page is not on a server.
import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { notInDesktop, onlyInDesktop, type RouteKey, routes, type ServerMode, type User } from '@xdesign/api'
import { createContext, useContext } from 'react'
import { toast } from 'sonner'

import { apiKey, apiQuery, isApiError, onSignedOut } from '@/api/client'

/**
 * The page to come back to after signing in, when it is a path of this site: `/d/abc?x=1`, never
 * `//other.site`, a full address or the sign-in page itself (from xWriter's app/redirects.ts).
 */
export function safeNextPath(next: unknown): string | undefined {
  if (typeof next !== 'string' || next.length > 2048) return undefined
  if (!next.startsWith('/') || next.startsWith('//')) return undefined
  // eslint-disable-next-line no-control-regex -- control characters are what this refuses
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return undefined
  let url: URL
  try {
    url = new URL(next, 'http://site.invalid')
  } catch {
    return undefined
  }
  if (url.origin !== 'http://site.invalid') return undefined
  if (url.pathname === '/sign-in') return undefined
  return `${url.pathname}${url.search}${url.hash}`
}

/** The search of the sign-in page: the page to come back to, when there is one. */
export function signInSearch(href: string): { next?: string } {
  const next = safeNextPath(href)
  return next === undefined ? {} : { next }
}

/** The desktop app's port of this start and the one it prefers (18 section 9.6). */
export interface DesktopPorts {
  port: number
  preferredPort: number
}

// Read once: the first `GET /api/me` or `GET /api/health` answer says it, and it does not change
// while the page is open (a restart of the app's server loads the window again).
let mode: ServerMode | undefined
let ports: DesktopPorts | null = null

/**
 * The mode, from `GET /api/health` when no `GET /api/me` answer said it yet; a server that cannot
 * be reached is taken as a server (the page shows, and its own calls say what failed).
 */
async function readMode(queryClient: QueryClient): Promise<ServerMode> {
  if (mode === undefined) {
    try {
      mode = (await queryClient.query({ ...apiQuery(routes.health), staleTime: 'static' })).mode
    } catch {
      return 'server'
    }
  }
  return mode
}

/** True in the desktop app; known before the first page with a session or without one shows. */
export function inDesktopApp(): boolean {
  return mode === 'desktop'
}

/** The desktop app's ports, null on a server. */
export function desktopPorts(): DesktopPorts | null {
  return ports
}

/**
 * Whether this xDesign has the route: the desktop app lacks some (notInDesktop of @xdesign/api),
 * a server lacks the app's own (onlyInDesktop).
 */
export function hasRoute(key: RouteKey): boolean {
  return mode === 'desktop' ? !notInDesktop(key) : !onlyInDesktop(key)
}

/**
 * The guard of a page this xDesign does not have, `key` being the route the page is for: it goes
 * to Designs. After the page's sign-in guard, which reads the mode with the session; the pages
 * without a session read it from `GET /api/health`.
 */
export async function requireRoute(queryClient: QueryClient, key: RouteKey): Promise<void> {
  await readMode(queryClient)
  if (!hasRoute(key)) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects
    throw redirect({ to: '/', replace: true })
  }
}

/**
 * The desktop app without a session (it ended): the window loads again, and the server answers
 * "Open xDesign from its app." (the app has no sign-in page to go to).
 */
function reloadDesktopWindow(): Promise<never> {
  window.location.reload()
  return new Promise<never>(() => undefined)
}

/**
 * Puts the person's changed `user` (a name, color, username or theme) into the cached `GET
 * /api/me` answer, keeping its `mode` and `desktop`, so the shell shows it at once.
 */
export function setMeUser(queryClient: QueryClient, user: User): void {
  queryClient.setQueryData(apiQuery(routes.me).queryKey, (now) => (now ? { ...now, user } : now))
}

/** The signed-in person for the signed-in layout's guard; redirects to the sign-in page without a session. */
export async function requireMember(queryClient: QueryClient, href: string): Promise<User> {
  try {
    // The answer in the cache when there is one; the shell's queries keep it fresh.
    const me = await queryClient.query({ ...apiQuery(routes.me), staleTime: 'static' })
    mode ??= me.mode
    ports ??= me.desktop
    return me.user
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      if (mode === 'desktop') return reloadDesktopWindow()
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects
      throw redirect({ to: '/sign-in', search: signInSearch(href), replace: true })
    }
    throw error
  }
}

/**
 * The `beforeLoad` of every signed-in page: the signed-in layout (routes/_app.tsx) and the pages
 * outside it (the printable page of a design).
 */
export async function signedInGuard({
  context,
  location,
}: {
  context: { queryClient: QueryClient }
  location: { href: string }
}): Promise<void> {
  await requireMember(context.queryClient, location.href)
}

/** The guard of the site owner's pages (Members, Settings, Maintenance): others go to Designs. */
export async function requireSiteOwner(queryClient: QueryClient, href: string): Promise<User> {
  const user = await requireMember(queryClient, href)
  if (!user.isSiteOwner) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects
    throw redirect({ to: '/', replace: true })
  }
  return user
}

/** The router methods watchSessionEnd needs (the app's router has them). */
export interface SessionRouter {
  state: { location: { pathname: string; href: string } }
  navigate: (options: { to: '/sign-in'; search: { next?: string }; replace: boolean }) => Promise<void>
}

/**
 * Sends the person to the sign-in page when a call finds their session ended, with the page to
 * come back to and the server's message as a toast, then forgets every answer of the session.
 * Only once a session was known: without one, the signed-in layout's guard redirects quietly.
 */
export function watchSessionEnd(router: SessionRouter, queryClient: QueryClient): void {
  let running = false
  onSignedOut((error) => {
    const { location } = router.state
    if (running || location.pathname === '/sign-in') return
    if (queryClient.getQueryData(apiKey(routes.me)) === undefined) return
    running = true
    if (mode === 'desktop') {
      void reloadDesktopWindow()
      return
    }
    toast.error(error.message)
    void router.navigate({ to: '/sign-in', search: signInSearch(location.href), replace: true }).finally(() => {
      // After the signed-in pages are gone, so nothing fetches the forgotten answers again.
      queryClient.clear()
      running = false
    })
  })
}

/** The signed-in person inside the signed-in layout; undefined outside of it. */
export const SessionContext = createContext<User | undefined>(undefined)

/** The signed-in person; only for components inside the signed-in layout (routes/_app.tsx). */
export function useMe(): User {
  const user = useContext(SessionContext)
  if (!user) throw new Error('useMe needs the signed-in layout (src/routes/_app.tsx)')
  return user
}
