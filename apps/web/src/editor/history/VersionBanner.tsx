import { hasRole } from '@xdesign/api'

import { Button } from '@/components/ui/button'

import { Banner } from '../Banners'
import { useEditor } from '../context'
import { useHistory, useHistoryStore } from './store'
import { versionTitle } from './versions'

/**
 * While a version is open (04 section 15): "You are looking at <name or time>." with "Restore this
 * version" (Editors), "Compare with now" and "Back to now".
 */
export function VersionBanner() {
  const { role } = useEditor()
  const store = useHistoryStore()
  const viewed = useHistory((state) => state.viewed)
  if (!viewed) return null
  return (
    <Banner tone="info">
      <span dir="auto">You are looking at {versionTitle(viewed.version)}.</span>
      <span className="flex flex-wrap items-center justify-center gap-2">
        {hasRole(role, 'editor') ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              store.open({ kind: 'restore' })
            }}
          >
            Restore this version
          </Button>
        ) : null}
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            store.open({ kind: 'compare' })
          }}
        >
          Compare with now
        </Button>
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            store.back()
          }}
        >
          Back to now
        </Button>
      </span>
    </Banner>
  )
}
