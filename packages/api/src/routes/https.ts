// Settings > HTTPS (docs/plan/07 section 4), for the site owner: the Go helper's HTTPS manager
// through its control socket. The app passes the helper's answers through with the names in
// camelCase and the times in UTC milliseconds (null for none); the helper's refusals keep their
// plain words. The changing routes need "Confirm it's you".
import { z } from 'zod'

import { time } from '../common.ts'
import { defineRoute } from '../route.ts'
import { maintenanceRequest } from './maintenance.ts'

// xWriter's methods (07 section 4.1); `uploaded` is a pasted certificate. A wildcard is
// `letsencrypt_cloudflare` with the names `*.<domain>` and `<domain>` (18 section 7.5).
export const httpsMethods = ['letsencrypt_http', 'letsencrypt_cloudflare', 'file', 'uploaded', 'builtin'] as const
export const httpsMethod = z.enum(httpsMethods)
export type HttpsMethod = z.output<typeof httpsMethod>

// A time the helper may leave out or send as zero.
const helperTime = time.nullish()

// The certificate served now.
export const servedCertificate = z.object({
  method: z.string(),
  subject: z.string(),
  issuer: z.string(),
  names: z.array(z.string()).nullable(),
  notBefore: helperTime,
  notAfter: helperTime,
  fingerprintSha256: z.string(),
  selfSigned: z.boolean(),
  trusted: z.boolean(),
  // Why the method's certificate is not served as it is.
  problem: z.string().optional(),
})

// The method, its state and the certificate.
export const httpsView = z.object({
  // port (xDesign serves HTTPS itself on its port), or dev for `xdesign serve --dev`.
  mode: z.string(),
  method: httpsMethod,
  // The Let's Encrypt names, else the served certificate's.
  names: z.array(z.string()),
  // issuing, active, renewing, failed, expired or unreadable.
  state: z.string(),
  expiresAt: helperTime,
  renewAt: helperTime,
  nextAttemptAt: helperTime,
  failures: z.number().int(),
  lastProblem: z.string().optional(),
  lastProblemAt: helperTime,
  cloudflareTokenSet: z.boolean(),
  certFile: z.string().optional(),
  keyFile: z.string().optional(),
  certificate: servedCertificate,
  // The log of the last (or running) issuance or renewal.
  log: z.array(z.object({ at: helperTime, level: z.string(), text: z.string() })),
  // What a pasted bundle had that was left out (the answer of pasteCertificate only).
  leftOut: z.array(z.object({ subject: z.string(), reason: z.string() })).optional(),
})
export type HttpsView = z.output<typeof httpsView>

export const httpsChoice = z.object({
  method: httpsMethod,
  // The domain names of a Let's Encrypt certificate; a wildcard name (`*.example.com`, the first
  // label only) only through Cloudflare.
  names: z.array(z.string().trim().min(1).max(253)).max(100).optional(),
  // Let's Encrypt through Cloudflare DNS: empty keeps the saved token.
  cloudflareToken: z.string().trim().max(1000).optional(),
  // Certificate files on this server.
  certFile: z.string().trim().max(4096).optional(),
  keyFile: z.string().trim().max(4096).optional(),
})

// The helper's words for a port that is no port.
const portProblem = 'Give a port number from 1 to 65535.'

export const httpsRoutes = {
  // The site's address with the helper's view, and the server's system: the "Files on this
  // server" examples and hint differ on Windows (18 section 8.4).
  https: defineRoute({
    key: 'https',
    method: 'GET',
    path: '/api/https',
    response: z.object({ address: z.string(), system: z.enum(['linux', 'windows']), view: httpsView }),
    auth: 'siteOwner',
  }),
  chooseHttps: defineRoute({
    key: 'chooseHttps',
    method: 'PUT',
    path: '/api/https',
    body: httpsChoice,
    response: httpsView,
    auth: 'siteOwner',
  }),
  // "Upload a certificate": the full chain and its private key as PEM text.
  pasteCertificate: defineRoute({
    key: 'pasteCertificate',
    method: 'POST',
    path: '/api/https/certificate',
    body: z.object({
      certificate: z
        .string()
        .min(1, 'Paste the certificate.')
        .max(96 * 1024, 'This is too long for a certificate.'),
      privateKey: z
        .string()
        .min(1, 'Paste the private key.')
        .max(32 * 1024, 'This is too long for a private key.'),
    }),
    response: httpsView,
    auth: 'siteOwner',
  }),
  // "Try now": Let's Encrypt issues or renews at once; the file method reads its files again.
  issueHttps: defineRoute({
    key: 'issueHttps',
    method: 'POST',
    path: '/api/https/issue',
    response: httpsView,
    auth: 'siteOwner',
  }),
  // The site's domain: the root helper writes config.toml, keeping the port, and restarts xDesign;
  // `maintenance` follows the request.
  changeDomain: defineRoute({
    key: 'changeDomain',
    method: 'PUT',
    path: '/api/https/domain',
    body: z.object({ domain: z.string().trim().min(1, "Enter the site's domain.").max(253) }),
    response: maintenanceRequest,
    auth: 'siteOwner',
  }),
  // The site's port and web base path (Settings > Site address, docs/plan/17 section 6), both sent
  // (the unchanged one as it is): the root helper checks them and moves xDesign there;
  // `maintenance` follows the request.
  changeAddress: defineRoute({
    key: 'changeAddress',
    method: 'PUT',
    path: '/api/address',
    body: z.object({
      port: z.number().int().min(1, portProblem).max(65535, portProblem),
      basePath: z.string().max(200),
    }),
    response: maintenanceRequest,
    auth: 'siteOwner',
  }),
}
