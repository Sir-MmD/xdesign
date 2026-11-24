import { hasRole } from '@xdesign/api'

import { hasRoute } from '@/app/session'
import { CommentsBell } from '@/comments/CommentsBell'

import { useDesign, useEditor } from '../context'
import type { SaveState } from '../useDesignDoc'
import { ChecksButton } from './ChecksButton'
import { CommentButton } from './CommentButton'
import { DesignName } from './DesignName'
import { type EditorTab, EditorTabs } from './EditorTabs'
import { ExportButton } from './ExportButton'
import { LanguageSwitch } from './LanguageSwitch'
import { LookSwitch } from './LookSwitch'
import { MoreMenu } from './MoreMenu'
import { PresenceAvatars } from './PresenceAvatars'
import { SaveStateText } from './SaveStateText'
import { ShareButton } from './ShareButton'
import { TryItButton } from './TryItButton'

/**
 * The editor's top bar (04 section 4.1): "< Designs", the name, the tabs, the people in the
 * design, the save state, the language and look switches, then "Checks", "Try it", (S2)
 * "Comment" and the bell, "Share", "Export" and "...". One file per piece in this folder; on a
 * narrow window the bar wraps. The desktop app has no "Share" (DESK-03, 18 section 9.4).
 */
export function TopBar({
  saveState,
  tab,
  onTab,
}: {
  saveState: SaveState
  tab: EditorTab
  onTab: (tab: EditorTab) => void
}) {
  const design = useDesign()
  const { designId, role, readOnly } = useEditor()
  const owner = hasRole(role, 'owner')
  return (
    <header className="border-b bg-surface pt-[env(safe-area-inset-top,0px)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        <DesignName id={designId} name={design.name} canRename={owner && !readOnly} />
        <EditorTabs tab={tab} onTab={onTab} />
        <div className="ms-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
          <PresenceAvatars />
          <SaveStateText state={saveState} />
          <LanguageSwitch />
          <LookSwitch />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChecksButton />
          <TryItButton />
          <CommentButton />
          <CommentsBell />
          {owner && hasRoute('setDesignMember') ? <ShareButton id={designId} name={design.name} /> : null}
          <ExportButton />
          <MoreMenu id={designId} />
        </div>
      </div>
    </header>
  )
}
