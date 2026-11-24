// The roles on a design in words (docs/plan/05 sections 2 and 3): "Owner" is the design owner;
// the Share dialog gives "Editor", "Commenter" and "Viewer".
import type { DesignRole } from '@xdesign/api'

export const roleNames: Record<DesignRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
}

/** The roles a design owner gives, highest first. */
export const memberRoles = ['editor', 'commenter', 'viewer'] as const
export type MemberRole = (typeof memberRoles)[number]
