// Moving designs to another owner (docs/plan/05 section 1 item 5): "Remove" a member with "Move
// their designs to: <member>" (src/routes/members.ts), and the site owner's transfer of one design.
import { and, eq, inArray } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import { designMembers, designs } from '../db/schema.ts'

// Makes `toUserId` the design owner of every design `fromUserId` owns, those in Trash too, and
// returns how many moved. Where the new owner was a member of a design, that membership goes
// (the design owner is designs.owner_id). Runs inside the caller's transaction, if any; the
// caller emits the access change once it is saved.
export function moveDesigns(fromUserId: string, toUserId: string): number {
  const db = getDb()
  const moved = db
    .select({ id: designs.id })
    .from(designs)
    .where(eq(designs.ownerId, fromUserId))
    .all()
    .map((row) => row.id)
  if (moved.length === 0) {
    return 0
  }
  db.delete(designMembers)
    .where(and(eq(designMembers.userId, toUserId), inArray(designMembers.designId, moved)))
    .run()
  db.update(designs).set({ ownerId: toUserId }).where(eq(designs.ownerId, fromUserId)).run()
  return moved.length
}

// The site owner's "Transfer ownership" of one design (src/routes/designs.ts): `toUserId` becomes
// its design owner (their membership goes) and the old design owner stays as an Editor, added by
// `byUserId`. Runs inside the caller's transaction, if any; the caller emits the access changes.
export function transferDesign(designId: string, fromUserId: string, toUserId: string, byUserId: string): void {
  const db = getDb()
  db.delete(designMembers)
    .where(and(eq(designMembers.designId, designId), eq(designMembers.userId, toUserId)))
    .run()
  db.update(designs).set({ ownerId: toUserId }).where(eq(designs.id, designId)).run()
  db.insert(designMembers)
    .values({ designId, userId: fromUserId, role: 'editor', addedBy: byUserId, addedAt: Date.now() })
    .onConflictDoUpdate({ target: [designMembers.designId, designMembers.userId], set: { role: 'editor' } })
    .run()
}
