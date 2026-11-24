// The desktop app's one person (docs/plan/18 section 9.3, DESK-01): on the first start, the
// username "me", the Name from the computer's user name (else "Me"), the site owner, with a
// password hash of a random secret nobody is told, so no password ever matches. The window signs
// in as them with the app's key (src/routes/desktop.ts).
import { userInfo } from 'node:os'

import { personName } from '@xdesign/api'

import { hashPassword } from '../auth/passwords.ts'
import { newToken } from '../auth/tokens.ts'
import { createUser, findSiteOwner } from '../auth/users.ts'

const desktopUsername = 'me'

// The computer's user name as a Name: without control characters, at most 100 characters.
function computerName(): string {
  let name = ''
  try {
    name = userInfo().username
  } catch {
    // No user name for this process (a user missing from the system's list).
  }
  const cleaned = Array.from(name.replace(/\p{C}/gu, '').trim()).slice(0, 100).join('')
  const parsed = personName.safeParse(cleaned)
  return parsed.success ? parsed.data : 'Me'
}

// Made before the server listens, so the window never enters before them.
export async function ensureDesktopPerson(): Promise<void> {
  if (findSiteOwner() === undefined) {
    const passwordHash = await hashPassword(newToken())
    createUser({ username: desktopUsername, name: computerName(), passwordHash, isSiteOwner: true })
  }
}
