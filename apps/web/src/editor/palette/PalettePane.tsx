import type { ReactNode } from 'react'

import { useAddStep } from '../map/addStep'
import { ADD_STEPS, KIND_ICONS, type NewStep, PALETTE_DRAG_TYPE, START_POINTS } from '../map/kinds'
import { PartsGroup } from '../parts/PartsGroup'
import { VariablesEntries } from '../variables/VariablesPanel'

/**
 * The palette on the left (04 section 4.2): "ADD" with the step kinds and "Start points", each
 * added by a click (at the center of the map's view) or dragged onto the map; the new step is
 * selected, so its editor opens. "PARTS" lists the design's parts with "+ Part" (PARTS-01's
 * parts/PartsGroup.tsx, section 12). At the bottom, "Variables" and "Test switches" open
 * LANG-01's panel (section 11). The editor shows the pane only to people who can edit.
 */
export function PalettePane() {
  const add = useAddStep()
  return (
    <aside aria-label="Palette" className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <Group title="Add">
        {ADD_STEPS.map((item) => (
          <Item key={item.label} item={item} onAdd={add} icon />
        ))}
      </Group>
      <Group title="Start points">
        {START_POINTS.map((item) => (
          <Item key={item.label} item={item} onAdd={add} />
        ))}
      </Group>
      <Group title="Parts">
        <PartsGroup />
      </Group>
      <div className="mt-auto flex flex-col gap-0.5 border-t pt-3">
        <VariablesEntries />
      </div>
    </aside>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h2 className="px-2 pb-1 text-caption-2 font-bold tracking-(--tracking-label) text-fg-3 uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Item({ item, onAdd, icon = false }: { item: NewStep; onAdd: (item: NewStep) => void; icon?: boolean }) {
  const Icon = KIND_ICONS[item.kind]
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(PALETTE_DRAG_TYPE, item.label)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => {
        onAdd(item)
      }}
      className="flex min-h-8 cursor-grab items-center gap-2 rounded-md px-2 text-start text-callout transition-colors duration-(--dur-fast) ease-(--ease) outline-none hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid active:cursor-grabbing active:bg-surface-press"
    >
      {icon ? <Icon aria-hidden className="size-4 shrink-0 text-fg-3" /> : null}
      <span className="min-w-0 truncate">{item.label}</span>
    </button>
  )
}
