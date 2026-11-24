// Settings > HTTPS (httpsRoutes of @xdesign/api, docs/plan/07 section 4) and Site address (17
// section 6): the helper's HTTPS manager and requests through the control socket
// (src/helper/control.ts). The changes need "Confirm it's you"; "Try now" does not, as it only
// runs again what was chosen.
import { routes, type HttpsView, type MaintenanceRequest } from '@xdesign/api'

import { audit } from '../audit.ts'
import { config } from '../config.ts'
import { control } from '../helper/control.ts'
import { addRoute, type Register } from '../route.ts'

export const register: Register = (app) => {
  addRoute(app, routes.https, async () => {
    const view = (await control('GET', '/https')) as HttpsView
    return { address: config.publicUrl, system: process.platform === 'win32' ? 'windows' : 'linux', view }
  })

  addRoute(
    app,
    routes.chooseHttps,
    async ({ user, body }) => {
      const view = (await control('PUT', '/https', {
        json: {
          method: body.method,
          names: body.names,
          cloudflare_token: body.cloudflareToken,
          cert_file: body.certFile,
          key_file: body.keyFile,
        },
      })) as HttpsView
      audit('https_changed', { userId: user.id, detail: { method: body.method, names: body.names ?? [] } })
      return view
    },
    { confirm: true },
  )

  addRoute(
    app,
    routes.pasteCertificate,
    async ({ user, body }) => {
      const view = (await control('POST', '/https/certificate', {
        json: { certificate: body.certificate, private_key: body.privateKey },
      })) as HttpsView
      audit('https_changed', { userId: user.id, detail: { method: 'uploaded', names: view.names } })
      return view
    },
    { confirm: true },
  )

  addRoute(app, routes.issueHttps, async () => (await control('POST', '/https/issue')) as HttpsView)

  addRoute(
    app,
    routes.changeDomain,
    async ({ user, body }) => {
      const request = (await control('PUT', '/https/domain', { json: { domain: body.domain } })) as MaintenanceRequest
      audit('domain_change_started', { userId: user.id, detail: { domain: body.domain } })
      return request
    },
    { confirm: true },
  )

  // Settings > Site address (docs/plan/17 section 6): the port and the web base path.
  addRoute(
    app,
    routes.changeAddress,
    async ({ user, body }) => {
      const request = (await control('PUT', '/address', {
        json: { port: body.port, base_path: body.basePath },
      })) as MaintenanceRequest
      audit('address_change_started', { userId: user.id, detail: { port: body.port, basePath: body.basePath } })
      return request
    },
    { confirm: true },
  )
}
