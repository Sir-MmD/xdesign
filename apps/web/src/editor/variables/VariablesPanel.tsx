import type { Step } from '@xdesign/spec'
import { BracesIcon, ToggleRightIcon } from 'lucide-react'
import { useState } from 'react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useSelectionStore } from '../selection'
import { SwitchesList } from './SwitchesList'
import { VariablesList } from './VariablesList'

export type VariablesTab = 'variables' | 'switches'

/**
 * The palette's "Variables" and "Test switches" (04 section 11): two entries that open the panel
 * on its tab. MAP-01's palette (palette/PalettePane.tsx) places them.
 */
export function VariablesEntries() {
  const [tab, setTab] = useState<VariablesTab | null>(null)
  const entry =
    'flex h-(--control-h-sm) w-full items-center gap-2 rounded-md px-2 text-start text-callout font-semibold text-fg-2 outline-none hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-solid'
  return (
    <>
      <button
        type="button"
        className={entry}
        onClick={() => {
          setTab('variables')
        }}
      >
        <BracesIcon aria-hidden className="size-4 shrink-0" />
        Variables
      </button>
      <button
        type="button"
        className={entry}
        onClick={() => {
          setTab('switches')
        }}
      >
        <ToggleRightIcon aria-hidden className="size-4 shrink-0" />
        Test switches
      </button>
      <VariablesPanel tab={tab} onTab={setTab} />
    </>
  )
}

/**
 * The panel of variables and test switches, open while `tab` is set; a step's button jumps to it
 * on the map (the panel closes).
 */
export function VariablesPanel({
  tab,
  onTab,
}: {
  tab: VariablesTab | null
  onTab: (tab: VariablesTab | null) => void
}) {
  const selection = useSelectionStore()
  const [shown, setShown] = useState<VariablesTab>('variables')
  if (tab !== null && tab !== shown) setShown(tab)
  const jump = (step: Step) => {
    onTab(null)
    selection.reveal(step.id)
  }
  return (
    <Sheet
      open={tab !== null}
      onOpenChange={(open) => {
        if (!open) onTab(null)
      }}
    >
      <SheetContent className="flex flex-col data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{shown === 'variables' ? 'Variables' : 'Test switches'}</SheetTitle>
        </SheetHeader>
        <Tabs
          value={shown}
          onValueChange={(value: VariablesTab) => {
            onTab(value)
          }}
          className="min-h-0 flex-1 gap-3"
        >
          <TabsList aria-label="Show" className="mx-4">
            <TabsTrigger value="variables">Variables</TabsTrigger>
            <TabsTrigger value="switches">Test switches</TabsTrigger>
          </TabsList>
          <TabsContent value="variables" className="min-h-0 overflow-y-auto px-4 pb-4">
            <VariablesList onJump={jump} />
          </TabsContent>
          <TabsContent value="switches" className="min-h-0 overflow-y-auto px-4 pb-4">
            <SwitchesList onJump={jump} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
