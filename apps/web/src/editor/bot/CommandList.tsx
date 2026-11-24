import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { StepId } from '@xdesign/spec'
import { GripVerticalIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

import { useDesign, useEditor, useLang } from '../context'
import { SwitchRow } from '../forms/start/fields'
import {
  COMMAND_RULE,
  type CommandStep,
  commandFits,
  inLanguage,
  isCommand,
  isTheStart,
  MENU_TEXT_MAX,
  newCommandAt,
  sameCommand,
  typedCommand,
} from '../forms/start/rules'

/**
 * "Commands menu" (04 section 7): the command start points in Bot setup's order, dragged to
 * reorder (or moved with the keyboard: Space, the arrow keys, Space), each with its command, its
 * menu text in the language shown and "Show in menu"; "+ Command" adds a command start point on
 * the map under the others, shown in the menu.
 */
export function CommandList() {
  const design = useDesign()
  const { edits, readOnly } = useEditor()
  // The command just added, whose field takes the focus.
  const [added, setAdded] = useState<StepId | null>(null)
  const order = design.bot.commandOrder
  const commands = order.flatMap((id) => {
    const step = design.steps[id]
    return isCommand(step) ? [step] : []
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  )
  const move = ({ active, over }: DragEndEvent) => {
    const to = over ? order.indexOf(String(over.id)) : -1
    if (to < 0 || active.id === over?.id) return
    edits.bot.moveCommand(String(active.id), to)
  }

  return (
    <div className="grid gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={move}>
        <SortableContext items={commands.map((step) => step.id)} strategy={verticalListSortingStrategy}>
          <ul className="grid gap-2">
            {commands.map((step) => (
              <CommandRow key={step.id} step={step} focus={step.id === added} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {readOnly ? null : (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            setAdded(
              edits.steps.add('start', newCommandAt(design.steps), {
                trigger: { type: 'command', command: '', inMenu: true, menuDescription: {} },
              }),
            )
          }}
        >
          + Command
        </Button>
      )}
    </div>
  )
}

function CommandRow({ step, focus }: { step: CommandStep; focus: boolean }) {
  const design = useDesign()
  const lang = useLang()
  const { edits, readOnly } = useEditor()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    disabled: readOnly,
  })
  const { trigger } = step
  const slashStart = isTheStart(step, design.steps)
  const problem =
    sameCommand(step, design.steps) ??
    (trigger.command !== '' && !commandFits(trigger.command) ? COMMAND_RULE : undefined)
  const menuText = trigger.menuDescription[lang] ?? ''
  const fallback = lang === design.languages.default ? undefined : trigger.menuDescription[design.languages.default]
  const menuLabel = inLanguage('Menu text', design, lang)

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-2 rounded-lg border bg-surface p-2',
        isDragging && 'relative z-10 shadow-(--shadow-lg)',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Move ${trigger.command === '' ? 'this command' : `/${trigger.command}`}`}
        disabled={readOnly}
        className="row-span-2 grid w-6 cursor-grab touch-none place-items-center self-stretch rounded-md text-fg-3 hover:bg-surface-2 disabled:cursor-default disabled:opacity-50"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon aria-hidden className="size-4" />
      </button>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {slashStart ? (
          <span className="font-mono text-callout font-semibold">/start</span>
        ) : (
          <InputGroup className="w-56">
            <InputGroupAddon>/</InputGroupAddon>
            <InputGroupInput
              aria-label="Command"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              placeholder="command"
              autoFocus={focus}
              disabled={readOnly}
              value={trigger.command}
              aria-invalid={problem !== undefined || undefined}
              onChange={(event) => {
                edits.steps.set(step.id, { trigger: { ...trigger, command: typedCommand(event.target.value) } })
              }}
            />
          </InputGroup>
        )}
        <SwitchRow
          label="Show in menu"
          checked={trigger.inMenu}
          onChange={(inMenu) => {
            edits.steps.set(step.id, { trigger: { ...trigger, inMenu } })
          }}
        />
      </div>
      <InputGroup>
        <InputGroupInput
          aria-label={menuLabel}
          dir="auto"
          placeholder={fallback ?? menuLabel}
          disabled={readOnly}
          value={menuText}
          aria-invalid={menuText.length > MENU_TEXT_MAX || undefined}
          onChange={(event) => {
            edits.texts.setPlain({ step: step.id, field: 'menuDescription' }, lang, event.target.value)
          }}
        />
        <InputGroupAddon align="inline-end">
          <span
            className={cn('font-normal tabular-nums', menuText.length > MENU_TEXT_MAX ? 'text-error' : 'text-fg-3')}
          >
            {menuText.length} / {MENU_TEXT_MAX}
          </span>
        </InputGroupAddon>
      </InputGroup>
      {problem === undefined || slashStart ? null : <p className="col-start-2 text-footnote text-error">{problem}</p>}
    </li>
  )
}
