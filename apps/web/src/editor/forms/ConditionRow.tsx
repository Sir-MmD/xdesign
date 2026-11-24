import { CONDITION_OPS, type ConditionItem, sayVariable, type Value } from '@xdesign/spec'
import { XIcon } from 'lucide-react'
import { useState } from 'react'

import { LanguageFlag } from '@/components/LanguagePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { findLanguage, languageName } from '@/lib/languages'

import { useDesign, useEditor } from '../context'
import { InvoiceSelect } from './InvoiceSelect'
import { groupVariables, type Item } from './logic'
import { ValueInput } from './ValueInput'
import { conditionValueKind } from './values'
import { NewName } from './VariableSelect'

type VariableItem = Extract<ConditionItem, { op: unknown }>
type Op = VariableItem['op']

// The first select of a sentence: a variable, a test switch, the user's language or the user;
// "+ Switch" names a new test switch.
const LANGUAGE = 'language'
const MEMBER = 'memberOf'
const NEW_SWITCH = '+switch'

function subjectOf(item: ConditionItem): string {
  if ('var' in item) return `var:${item.var}`
  if ('switch' in item) return `switch:${item.switch}`
  return 'language' in item ? LANGUAGE : MEMBER
}

const opItems: Item[] = (Object.keys(CONDITION_OPS) as Op[]).map((op) => ({ value: op, label: CONDITION_OPS[op] }))
// What is said of the user: a member of a chat, or (stage 2, PAY-02) an invoice paid or subscribed to.
const userItems: Item[] = [
  { value: 'memberOf', label: 'is a member of' },
  { value: 'hasPaid', label: 'has paid' },
  { value: 'subscribed', label: 'is subscribed to' },
]

const yesNoItems: Item[] = [
  { value: 'yes', label: 'yes' },
  { value: 'no', label: 'no' },
]

// A variable's condition with a comparison and a value; "is set" and "is empty" take none.
function withValue(item: VariableItem, op: Op, value: Value | undefined): VariableItem {
  return value === undefined || op === 'isSet' || op === 'isEmpty'
    ? { var: item.var, op }
    : { var: item.var, op, value }
}

/**
 * One condition of a case as a sentence of selects (docs/plan/04 section 6, 03 section 2.10):
 * "[saved answer age] [is at least] [18]", "[User is admin] [is yes]", "[The user's language] is
 * [Persian]", "[The user] [is a member of] [@channel]", "[The user] [has paid] [Club card]", "[The
 * user] [is subscribed to] [Coffee club]" (PAY-02).
 */
export function ConditionRow({
  item,
  onChange,
  onRemove,
}: {
  item: ConditionItem
  onChange: (item: ConditionItem) => void
  onRemove: () => void
}) {
  const design = useDesign()
  const { edits, readOnly } = useEditor()
  const [naming, setNaming] = useState(false)
  const variables = Object.values(design.variables)
  const switches = Object.values(design.switches).sort((a, b) => a.label.localeCompare(b.label))
  const subject = subjectOf(item)
  const subjects: Item[] = [
    ...variables.map((variable) => ({ value: `var:${variable.id}`, label: sayVariable(variable.id, design) })),
    ...switches.map((testSwitch) => ({
      value: `switch:${testSwitch.id}`,
      label: testSwitch.label || testSwitch.idName,
    })),
    { value: LANGUAGE, label: "The user's language" },
    { value: MEMBER, label: 'The user' },
    { value: NEW_SWITCH, label: '+ Switch' },
  ]
  if (!subjects.some((choice) => choice.value === subject)) {
    subjects.push({ value: subject, label: 'var' in item ? 'Deleted variable' : 'Deleted switch' })
  }
  const choose = (next: string) => {
    if (next.startsWith('var:')) {
      const id = next.slice(4)
      onChange('var' in item ? { ...item, var: id } : { var: id, op: 'equals' })
    } else if (next.startsWith('switch:')) {
      const testSwitch = design.switches[next.slice(7)]
      if (!testSwitch) return
      onChange({ switch: testSwitch.id, is: testSwitch.type === 'yesNo' ? true : (testSwitch.options?.[0] ?? '') })
    } else if (next === LANGUAGE) onChange({ language: [] })
    else onChange({ memberOf: '' })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {naming ? (
        <NewName
          placeholder="Switch name"
          className="w-full"
          onAdd={(label) => {
            setNaming(false)
            onChange({ switch: edits.switches.add({ label, type: 'yesNo', testValue: false }), is: true })
          }}
          onCancel={() => {
            setNaming(false)
          }}
        />
      ) : (
        <Select<string>
          items={subjects}
          value={subject}
          onValueChange={(next) => {
            if (next === NEW_SWITCH) setNaming(true)
            else if (next !== null && next !== subject) choose(next)
          }}
        >
          <SelectTrigger size="sm" aria-label="What to test" className="max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groupVariables(variables).map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.items.map((variable) => (
                  <SelectItem key={variable.id} value={`var:${variable.id}`}>
                    <span className="font-mono text-subhead">{variable.idName}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {switches.length > 0 ? (
              <SelectGroup>
                <SelectLabel>Test switches</SelectLabel>
                {switches.map((testSwitch) => (
                  <SelectItem key={testSwitch.id} value={`switch:${testSwitch.id}`}>
                    <span dir="auto">{testSwitch.label || testSwitch.idName}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : null}
            <SelectGroup>
              <SelectLabel>The user</SelectLabel>
              <SelectItem value={LANGUAGE}>The user&apos;s language</SelectItem>
              <SelectItem value={MEMBER}>The user</SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectItem value={NEW_SWITCH}>+ Switch</SelectItem>
          </SelectContent>
        </Select>
      )}
      {naming ? null : <Rest item={item} onChange={onChange} />}
      {readOnly || naming ? null : (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove this condition" onClick={onRemove}>
          <XIcon />
        </Button>
      )}
    </div>
  )
}

// The rest of the sentence after its subject.
function Rest({ item, onChange }: { item: ConditionItem; onChange: (item: ConditionItem) => void }) {
  const design = useDesign()
  if ('var' in item) {
    const noValue = item.op === 'isSet' || item.op === 'isEmpty'
    const yesNo = design.variables[item.var]?.type === 'yesNo' && (item.op === 'equals' || item.op === 'notEquals')
    return (
      <>
        <Select<string>
          items={opItems}
          value={item.op}
          onValueChange={(next) => {
            if (next === null || next === item.op) return
            onChange(withValue(item, next as Op, item.value))
          }}
        >
          <SelectTrigger size="sm" aria-label="How to compare">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opItems.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {noValue ? null : yesNo ? (
          <Select<string>
            items={yesNoItems}
            value={item.value === true ? 'yes' : item.value === false ? 'no' : null}
            onValueChange={(next) => {
              if (next !== null) onChange({ ...item, value: next === 'yes' })
            }}
          >
            <SelectTrigger size="sm" aria-label="Value">
              <SelectValue placeholder="Value" />
            </SelectTrigger>
            <SelectContent>
              {yesNoItems.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>
                  {choice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <ValueInput
            aria-label="Value"
            placeholder="Value"
            className="h-(--control-h-sm) w-28 min-w-0 flex-1"
            kind={conditionValueKind(item, design)}
            value={item.value}
            onCommit={(value) => {
              onChange(withValue(item, item.op, value))
            }}
          />
        )}
      </>
    )
  }
  if ('switch' in item) {
    const testSwitch = design.switches[item.switch]
    const choices: Item[] =
      testSwitch?.type === 'choice'
        ? (testSwitch.options ?? []).map((option) => ({ value: `option:${option}`, label: `is ${option}` }))
        : [
            { value: 'yes', label: 'is yes' },
            { value: 'no', label: 'is no' },
          ]
    const current = typeof item.is === 'boolean' ? (item.is ? 'yes' : 'no') : `option:${item.is}`
    return (
      <Select<string>
        items={choices}
        value={choices.some((choice) => choice.value === current) ? current : null}
        onValueChange={(next) => {
          if (next === null || next === current) return
          onChange({ switch: item.switch, is: next.startsWith('option:') ? next.slice(7) : next === 'yes' })
        }}
      >
        <SelectTrigger size="sm" aria-label="Is">
          <SelectValue placeholder="is" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              <span dir="auto">{choice.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  if ('language' in item) {
    return (
      <>
        <span className="text-callout">is</span>
        <ToggleGroup
          multiple
          variant="outline"
          size="sm"
          spacing={1}
          aria-label="Languages"
          className="flex-wrap"
          value={item.language}
          onValueChange={(languages) => {
            onChange({ language: design.languages.list.filter((code) => languages.includes(code)) })
          }}
        >
          {design.languages.list.map((code) => (
            <ToggleGroupItem key={code} value={code}>
              <LanguageFlag language={findLanguage(code)} />
              {languageName(code)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </>
    )
  }
  const verb = 'hasPaid' in item ? 'hasPaid' : 'subscribed' in item ? 'subscribed' : 'memberOf'
  const invoice = 'hasPaid' in item ? item.hasPaid : 'subscribed' in item ? item.subscribed : ''
  const firstInvoice = Object.values(design.steps).find((step) => step.kind === 'invoice')?.id ?? ''
  return (
    <>
      <Select<string>
        items={userItems}
        value={verb}
        onValueChange={(next) => {
          if (next === null || next === verb) return
          const id = invoice === '' ? firstInvoice : invoice
          if (next === 'hasPaid') onChange({ hasPaid: id })
          else if (next === 'subscribed') onChange({ subscribed: id })
          else onChange({ memberOf: '' })
        }}
      >
        <SelectTrigger size="sm" aria-label="What the user is">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {userItems.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {'memberOf' in item ? (
        <Input
          aria-label="Channel or chat"
          placeholder="@channel"
          dir="ltr"
          className="h-(--control-h-sm) w-36 min-w-0 flex-1"
          value={item.memberOf}
          onChange={(event) => {
            onChange({ memberOf: event.target.value })
          }}
        />
      ) : (
        <InvoiceSelect
          aria-label="Invoice"
          className="w-40 min-w-0 flex-1"
          subscriptions={verb === 'subscribed'}
          value={invoice === '' ? undefined : invoice}
          onChange={(id) => {
            if (id === undefined) return
            onChange(verb === 'subscribed' ? { subscribed: id } : { hasPaid: id })
          }}
        />
      )}
    </>
  )
}
