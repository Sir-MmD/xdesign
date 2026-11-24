import { createContext } from 'react'
import type { SkinTokens } from './skins/tokens'

/**
 * The look of the bubble, for the parts the text draws deep inside it (a quote's mark and
 * arrow, a code block's header and copy mark: docs/plan/29-owner-list-2026-10-22.md section 8.6,
 * TGP-02); without one, they draw xWriter's own icons. In a module of its own, so parts.tsx
 * exports only its components (fast refresh).
 */
export const SkinContext = createContext<SkinTokens | undefined>(undefined)
