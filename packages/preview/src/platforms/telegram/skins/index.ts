import { android } from './android'
import { desktop } from './desktop'
import { ios } from './ios'
import type { SkinId, SkinTokens } from './tokens'
import { web } from './web'
import { webk } from './webk'

// The five looks in the pickers' order: Web A, Web K, Desktop, Android, iOS
// (docs/plan/29-owner-list-2026-10-22.md section 8.5, D-6244, D-6271).
export const skins: Readonly<Record<SkinId, SkinTokens>> = { web, webk, desktop, android, ios }

export const skinIds: readonly SkinId[] = ['web', 'webk', 'desktop', 'android', 'ios']

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && (skinIds as readonly string[]).includes(v)
}
