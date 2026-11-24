// The app's pino logger: JSON lines on stdout, which the helper passes to the journal (docs/plan/07
// section 8). Requests log one line each without bodies (src/app.ts); cookies and authorization
// headers (and the desktop app's key, DESK-01) are hidden wherever an object carrying them is
// logged.
import { pino } from 'pino'

import { config } from './config.ts'

export const log = pino({
  level: config.logLevel,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      'headers.cookie',
      'headers.authorization',
      'req.headers["x-xdesign-desktop"]',
      'headers["x-xdesign-desktop"]',
    ],
    censor: '[hidden]',
  },
})
