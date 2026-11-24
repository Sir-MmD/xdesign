import { PersonAvatar } from '@/components/PersonAvatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { useDesign, usePresence } from '../context'
import type { Peer } from '../live'
import { useSelectionStore } from '../selection'

// More people than this show as "+n".
const shownAvatars = 5

/**
 * The people in the design now (04 section 4.1, from the awareness): one avatar per person, even
 * with several tabs open. Hover tells the name and the step they have selected; a click selects
 * that step and brings it into view.
 */
export function PresenceAvatars() {
  const design = useDesign()
  const selection = useSelectionStore()
  const peers = usePresence()

  // One per person: the tab with a selected step, else the first one.
  const people = new Map<string, Peer>()
  for (const peer of peers) {
    const known = people.get(peer.user.id)
    if (!known || (known.step === null && peer.step !== null)) people.set(peer.user.id, peer)
  }
  const list = [...people.values()]
  if (list.length === 0) return null
  const more = list.length - shownAvatars

  return (
    <ul aria-label="People in this design" className="flex items-center -space-x-1.5">
      {list.slice(0, shownAvatars).map((peer) => {
        const step = peer.step === null ? undefined : design.steps[peer.step]
        return (
          <li key={peer.user.id} className="flex">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="rounded-full ring-2 ring-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-solid aria-disabled:cursor-default"
                    // Not `disabled`: the tooltip still tells who it is.
                    aria-disabled={!step}
                    onClick={() => {
                      if (step) selection.reveal(step.id, peer.button)
                    }}
                  />
                }
              >
                <PersonAvatar name={peer.user.name} color={peer.user.color} size="sm" />
                <span className="sr-only">{peer.user.name}</span>
              </TooltipTrigger>
              <TooltipContent className="flex flex-col">
                <span className="font-semibold">{peer.user.name}</span>
                {step ? <span dir="auto">Editing {step.title}</span> : null}
              </TooltipContent>
            </Tooltip>
          </li>
        )
      })}
      {more > 0 ? (
        <li className="ms-2.5 text-footnote font-semibold text-fg-2" aria-label={`${String(more)} more`}>
          +{more}
        </li>
      ) : null}
    </ul>
  )
}
