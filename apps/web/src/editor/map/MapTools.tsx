import type { MapLinesView } from '@xdesign/api'
import { MiniMap, Panel, useReactFlow, useStore } from '@xyflow/react'
import { ArrowLeftIcon, MinusIcon, PlusIcon, SearchIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ViewOnlyContext } from '@/components/viewOnly'

import type { StepNode } from './nodes'

// The minimap sits above the tools' row.
const minimapStyle = { marginBottom: 60 }

/**
 * The map's tools at the bottom right (04 section 4.3): the minimap (drag or scroll it to move
 * the view), "Back" after a jump (MAP-11), search, zoom out, the zoom, zoom in, "Fit", for people
 * who can edit "Auto-arrange" (off while it runs), and the switch "Lines: Short tags | All lines"
 * (18 section 5.3), which works read-only too. `onMoved` tells the map the person moved it with
 * the minimap or the zoom buttons, which ends "Back".
 */
export function MapTools({
  onSearch,
  onFit,
  onArrange,
  arranging,
  onBack,
  onMoved,
  lines,
  onLines,
}: {
  onSearch: () => void
  onFit: () => void
  /** Missing while read-only. */
  onArrange?: () => void
  arranging: boolean
  /** Missing while there is no place to go back to. */
  onBack?: () => void
  onMoved: () => void
  lines: MapLinesView
  onLines: (view: MapLinesView) => void
}) {
  const flow = useReactFlow()
  const zoom = useStore((state) => state.transform[2])
  return (
    <>
      <div className="contents" onPointerDown={onMoved}>
        <MiniMap<StepNode>
          position="bottom-right"
          pannable
          zoomable
          ariaLabel="Minimap"
          nodeBorderRadius={4}
          nodeClassName={(node) => (node.type === 'frame' ? 'xd-minimap-frame' : '')}
          style={minimapStyle}
          className="xd-minimap"
        />
      </div>
      <Panel
        position="bottom-right"
        className="flex max-w-[calc(100%-30px)] flex-wrap items-center justify-end gap-0.5 rounded-lg border bg-surface p-1 shadow-(--shadow-sm)"
      >
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeftIcon aria-hidden data-icon="inline-start" />
            Back
          </Button>
        ) : null}
        <IconTool label="Search (Ctrl+F)" onClick={onSearch}>
          <SearchIcon aria-hidden />
        </IconTool>
        <IconTool
          label="Zoom out"
          onClick={() => {
            onMoved()
            void flow.zoomOut({ duration: 150 })
          }}
        >
          <MinusIcon aria-hidden />
        </IconTool>
        <span className="w-11 text-center text-footnote text-fg-2 tabular-nums">{Math.round(zoom * 100)}%</span>
        <IconTool
          label="Zoom in"
          onClick={() => {
            onMoved()
            void flow.zoomIn({ duration: 150 })
          }}
        >
          <PlusIcon aria-hidden />
        </IconTool>
        <Button variant="ghost" size="sm" onClick={onFit}>
          Fit
        </Button>
        {onArrange ? (
          <Button variant="ghost" size="sm" disabled={arranging} onClick={onArrange}>
            Auto-arrange
          </Button>
        ) : null}
        <span className="ps-1.5 pe-1 text-footnote text-fg-2">Lines:</span>
        {/* A view of the map, not an edit: it works read-only too. */}
        <ViewOnlyContext value={false}>
          <ToggleGroup
            aria-label="Lines"
            spacing={0}
            size="sm"
            value={[lines]}
            onValueChange={([next]) => {
              if (next === 'short' || next === 'all') onLines(next)
            }}
          >
            <ToggleGroupItem value="short">Short tags</ToggleGroupItem>
            <ToggleGroupItem value="all">All lines</ToggleGroupItem>
          </ToggleGroup>
        </ViewOnlyContext>
      </Panel>
    </>
  )
}

function IconTool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
