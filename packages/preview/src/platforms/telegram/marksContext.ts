import { createContext } from 'react'

/**
 * Whether the bubble draws its invisible direction marks (the preview option "Invisible
 * marks", docs/plan/20-cards-kinds-x-admins-docker.md section 4.3.7). In a module of its
 * own, so marks.tsx exports only its component (fast refresh).
 */
export const MarksContext = createContext(false)
