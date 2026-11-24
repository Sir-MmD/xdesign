// The versions of a design (HIST-01's routes, docs/plan/05 section 7) as the History panel, the
// banner and the export dialog name them, and a version's plain design read from the server.
import type { QueryClient } from '@tanstack/react-query'
import { type designVersion, type RouteResponse, routes } from '@xdesign/api'
import { type Design, validateDesign } from '@xdesign/spec'
import type { z } from 'zod'

import { apiQuery } from '@/api/client'
import { formatDateTime } from '@/lib/time'

export type DesignVersion = z.output<typeof designVersion>

/** A version with its plain design, to view, compare or export it. */
export interface VersionDesign {
  version: DesignVersion
  design: Design
}

/** "Automatic", a named version's name, "Before restore", "Restored" (with the restored version's name). */
export function versionLabel(version: DesignVersion): string {
  switch (version.kind) {
    case 'auto':
      return 'Automatic'
    case 'named':
      return version.name ?? 'Named'
    case 'before_restore':
      return 'Before restore'
    case 'restore':
      return version.name === null ? 'Restored' : `Restored "${version.name}"`
  }
}

/** The banner's "<name or time>": a named version's name, else when it was made. */
export function versionTitle(version: DesignVersion): string {
  return version.kind === 'named' && version.name !== null ? version.name : formatDateTime(version.createdAt)
}

/** The plain design of a version's answer (`GET /api/designs/:id/versions/:versionId`); throws when it is not one. */
export function versionDesign(answer: RouteResponse<typeof routes.version>): VersionDesign {
  const read = validateDesign(answer.design)
  if (!read.ok) throw new Error('This version could not be read. Reload the page and try again.')
  return { version: answer.version, design: read.design }
}

/** A version and its plain design, from the query client's cache when it was read before. */
export async function readVersion(
  queryClient: QueryClient,
  designId: string,
  versionId: string,
): Promise<VersionDesign> {
  // A version's state never changes.
  const answer = await queryClient.query({
    ...apiQuery(routes.version, { params: { id: designId, versionId } }),
    staleTime: 'static',
  })
  return versionDesign(answer)
}
