import type { HttpsMethod, HttpsView, RouteResponse, routes } from '@xdesign/api'

import { isApiError } from '@/api/client'
import { formatDate, formatDateTime } from '@/lib/time'

// What Settings > HTTPS says about the certificate (docs/plan/18 section 7), copied from
// xmtp-panel's SSL manager (web/src/pages/certificates/facts.ts, web/src/api/certs.ts and
// web/src/lib/states.ts): the method chip, the status pill and the line under it, and how the
// days left read on the expiry bar. Shared by the card's row and its Issue and Upload windows.

/** The kind of certificate a chip names: the method, with Wildcard for Cloudflare with a `*.` name. */
export type CertKind = 'http' | 'cloudflare' | 'wildcard' | 'uploaded' | 'file' | 'builtin'

/** The chip's words, xmtp-panel's CERT_METHOD_NAMES with xDesign's two more. */
export const kindNames: Readonly<Record<CertKind, string>> = {
  http: 'HTTP-01',
  cloudflare: 'Cloudflare DNS-01',
  wildcard: 'Wildcard',
  uploaded: 'Uploaded',
  file: 'Files on this server',
  builtin: 'Built-in',
}

/** The chip's colors: HTTP-01 gray, the DNS-01 kinds blue, an upload amber (xmtp-panel's METHOD_CHIP). */
export const kindChip: Readonly<Record<CertKind, string>> = {
  http: 'bg-surface-2 text-fg-2',
  cloudflare: 'bg-brand-weak text-brand',
  wildcard: 'bg-brand-weak text-brand',
  uploaded: 'bg-warn-weak text-warn',
  file: 'bg-surface-2 text-fg-2',
  builtin: 'bg-off-weak text-off',
}

type HttpsAnswer = RouteResponse<typeof routes.https>

/** Puts a changed view into the page's answer. */
export const withView = (view: HttpsView) => (old: HttpsAnswer | undefined) => (old ? { ...old, view } : old)

export const isLetsEncrypt = (method: HttpsMethod) =>
  method === 'letsencrypt_http' || method === 'letsencrypt_cloudflare'

export const isWildcardName = (name: string) => name.startsWith('*.')

export function kindOf(view: HttpsView): CertKind {
  switch (view.method) {
    case 'letsencrypt_http':
      return 'http'
    case 'letsencrypt_cloudflare':
      return view.names.some(isWildcardName) ? 'wildcard' : 'cloudflare'
    default:
      return view.method
  }
}

export const isBusy = (view: HttpsView | null | undefined) => view?.state === 'issuing' || view?.state === 'renewing'

/** Whether the method's own certificate is served, not the built-in one in its place. */
export const ownServed = (view: HttpsView) => view.certificate.method === view.method

/** The issuer's name: the organization of its distinguished name, else its common name. */
export function issuerName(issuer: string): string {
  const part = (key: string) => {
    const found = new RegExp(`(?:^|,)${key}=((?:\\\\.|[^,\\\\])*)`).exec(issuer)
    return found?.[1]?.replace(/\\(.)/g, '$1').trim()
  }
  return part('O') || part('CN') || issuer
}

/** An uploaded or file certificate is flagged this many days before it expires: nobody renews it here. */
export const handWarnDays = 30

const dayMs = 24 * 60 * 60 * 1000

/** Whole days from today to the day of `time`, by the calendar (negative once it is past). */
function calendarDays(time: number, now: number): number {
  const day = (at: number) => {
    const date = new Date(at)
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  }
  return Math.round((day(time) - day(now)) / dayMs)
}

/** A Let's Encrypt certificate whose issuance or renewal failed and waits for its next attempt. */
const failing = (view: HttpsView) => view.state === 'failed' || (isLetsEncrypt(view.method) && view.failures > 0)

/** The expiry as the bar shows it, or undefined for a certificate not issued yet. */
export interface Expiry {
  /** "62 days", "Expires today", "Expired 3 days ago", or hours on the last day. */
  label: string
  /** The share of the certificate's life that is left, at least 4 percent. */
  fill: number
  tone: 'error' | 'warn' | undefined
}

export function expiryOf(view: HttpsView, now = Date.now()): Expiry | undefined {
  const { notBefore, notAfter } = view.certificate
  if (notAfter == null || !ownServed(view)) return undefined
  const left = (notAfter - now) / dayMs
  const life = notBefore == null || notBefore >= notAfter ? 90 : (notAfter - notBefore) / dayMs
  const days = calendarDays(notAfter, now)
  const hand = view.method === 'uploaded' || view.method === 'file'
  const soon = hand ? days <= handWarnDays : left <= life / 3
  const bad = left <= 0 || view.state === 'expired' || failing(view)
  return {
    label: daysLabel(days, left),
    fill: Math.min(100, Math.max(4, Math.round((Math.max(left, 0) / life) * 100))),
    tone: bad ? 'error' : soon ? 'warn' : undefined,
  }
}

/** Days left said plainly (xmtp-panel's daysLabel), in hours on the last day. */
function daysLabel(days: number, left: number): string {
  if (left > 0 && left < 1) {
    const hours = Math.max(1, Math.floor(left * 24))
    return `${String(hours)} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const count = Math.abs(days)
  const unit = count === 1 ? 'day' : 'days'
  if (days < 0) return `Expired ${String(count)} ${unit} ago`
  if (days === 0) return 'Expires today'
  return `${String(count)} ${unit}`
}

export type PillTone = 'ok' | 'info' | 'warn' | 'error' | 'off' | 'brand'

/** The status pill, as xmtp-panel's statusInfo and certStatusInfo. */
export function statusPill(view: HttpsView, now = Date.now()): { label: string; tone: PillTone } {
  switch (view.state) {
    case 'issuing':
      return { label: 'Issuing', tone: 'brand' }
    case 'renewing':
      return { label: 'Renewing', tone: 'warn' }
    case 'failed':
      return { label: 'Issuance failing', tone: 'error' }
    case 'expired':
      return { label: 'Expired', tone: 'error' }
    case 'unreadable':
      return { label: 'Files unreadable', tone: 'error' }
  }
  if (isLetsEncrypt(view.method) && view.failures > 0) return { label: 'Renewal failing', tone: 'error' }
  const notAfter = view.certificate.notAfter
  if ((view.method === 'uploaded' || view.method === 'file') && notAfter != null) {
    if (notAfter <= now) return { label: 'Expired', tone: 'error' }
    if (calendarDays(notAfter, now) <= handWarnDays) return { label: 'Expires soon', tone: 'warn' }
  }
  return { label: 'Valid', tone: 'ok' }
}

/** The line under the pill: when it renews, its next attempt, or that nobody renews it here. */
export function statusNote(view: HttpsView): string {
  if (view.method === 'uploaded') {
    return view.state === 'expired' ? 'Upload a renewed certificate' : 'Not auto-renewed'
  }
  if (!isLetsEncrypt(view.method) || isBusy(view)) return ''
  if (view.nextAttemptAt != null) return `Next attempt ${formatDateTime(view.nextAttemptAt)}`
  if (view.renewAt != null && view.state === 'active') return `Renews from ${formatDate(view.renewAt)}`
  return ''
}

/** The host of the site's address when it is a domain name, not an IP address or localhost. */
export function domainOf(address: string): string | undefined {
  let host: string
  try {
    host = new URL(address).hostname
  } catch {
    return undefined
  }
  if (!host.includes('.') || host.startsWith('[') || /^[\d.]+$/.test(host)) return undefined
  return host
}

/** Whether a certificate for `names` is valid for `host` (a name, or a wildcard one level up). */
export function covers(names: readonly string[], host: string): boolean {
  return names.some((name) => {
    const lower = name.toLowerCase()
    if (lower === host) return true
    if (!isWildcardName(lower)) return false
    const rest = lower.slice(1)
    return host.endsWith(rest) && !host.slice(0, -rest.length).includes('.')
  })
}

/** The words of a refused change. */
export function message(error: unknown): string {
  return isApiError(error) || error instanceof Error ? error.message : String(error)
}
