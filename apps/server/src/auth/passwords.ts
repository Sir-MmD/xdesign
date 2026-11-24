// Passwords (docs/plan/02-architecture.md section 8 item 2): argon2id with the library's
// defaults, which are the recommended parameters (19 MiB, 2 passes, 1 thread); a new password
// has at least 10 characters (the schema `newPassword`) and is not one of the most common ones.
import { hash, verify } from '@node-rs/argon2'

import { ApiError } from '../errors.ts'
import { commonPasswords } from './common-passwords.ts'

export function hashPassword(password: string): Promise<string> {
  return hash(password)
}

// Checked against a hash made once for this purpose when there is no person with the username, so
// an unknown username takes as long as a wrong password.
let unknownHash: Promise<string> | undefined

export async function verifyPassword(passwordHash: string | undefined, password: string): Promise<boolean> {
  if (passwordHash === undefined) {
    unknownHash ??= hash('no such person')
    await verify(await unknownHash, password)
    return false
  }
  return verify(passwordHash, password)
}

// Refuses a new password that is one of the most common ones.
export function checkNewPassword(password: string): void {
  if (commonPasswords.has(password.toLowerCase())) {
    throw new ApiError('bad_request', 'This password is too common. Choose another one.')
  }
}
