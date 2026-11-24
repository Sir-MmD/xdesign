import { type Condition, type ConditionItem, sayCondition } from '@xdesign/spec'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { useDesign, useEditor } from '../context'
import { ConditionRow } from './ConditionRow'
import { newCondition } from './values'

/** A condition's items, whether all or any of them must hold. */
const itemsOf = (when: Condition): ConditionItem[] => ('all' in when ? when.all : when.any)

/**
 * A condition (04 section 6): "all of these" or "any of these", its items as sentences of selects
 * (ConditionRow), "+ Condition", and the whole condition in words after `lead` (EXP-01's
 * sayCondition, "If ..."). An If case's, a reminder's ("Only once these hold") and a broadcast's
 * audience (EVT-02).
 */
export function ConditionList({
  when,
  onChange,
  lead,
}: {
  when: Condition
  onChange: (when: Condition) => void
  lead: string
}) {
  const design = useDesign()
  const { readOnly } = useEditor()
  const all = 'all' in when
  const conditions = itemsOf(when)
  const setConditions = (next: ConditionItem[]) => {
    onChange(all ? { all: next } : { any: next })
  }
  return (
    <div className="grid gap-2">
      <ToggleGroup
        aria-label="Which conditions must hold"
        spacing={0}
        value={[all ? 'all' : 'any']}
        onValueChange={([mode]) => {
          if (mode === 'all' && !all) onChange({ all: conditions })
          else if (mode === 'any' && all) onChange({ any: conditions })
        }}
      >
        <ToggleGroupItem value="all">all of these</ToggleGroupItem>
        <ToggleGroupItem value="any">any of these</ToggleGroupItem>
      </ToggleGroup>
      {conditions.map((condition, place) => (
        <ConditionRow
          key={place}
          item={condition}
          onChange={(next) => {
            setConditions(conditions.map((other, at) => (at === place ? next : other)))
          }}
          onRemove={() => {
            setConditions(conditions.filter((_other, at) => at !== place))
          }}
        />
      ))}
      {readOnly ? null : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            setConditions([...conditions, newCondition(design)])
          }}
        >
          + Condition
        </Button>
      )}
      <p dir="auto" className="text-footnote text-fg-3">
        {`${lead} ${sayCondition(when, design)}`}
      </p>
    </div>
  )
}
