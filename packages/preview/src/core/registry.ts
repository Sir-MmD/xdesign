// The platforms the preview can render (docs/plan/10-frontend.md section 8.2). Telegram
// registers itself; a later platform (FR-PL-02) adds its own definition.
import type { PlatformPreviewDefinition } from './types'

const platforms = new Map<string, PlatformPreviewDefinition<unknown>>()

export function registerPlatform<P>(definition: PlatformPreviewDefinition<P>): void {
  platforms.set(definition.id, definition as unknown as PlatformPreviewDefinition<unknown>)
}

export function getPlatform<P>(id: string): PlatformPreviewDefinition<P> | undefined {
  return platforms.get(id) as PlatformPreviewDefinition<P> | undefined
}
