import type { member } from '@xdesign/api'
import type { z } from 'zod'

/** A member of the site as the Members page lists them (`GET /api/members`). */
export type Member = z.output<typeof member>

/** "1 design", "3 designs". */
export function designCount(count: number): string {
  return count === 1 ? '1 design' : `${String(count)} designs`
}
