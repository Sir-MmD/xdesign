import {
  defaultSimUser,
  type SimBuiltin,
  type SimTestUser,
  type SimValue,
  type TestSwitch,
  type Variable,
} from '@xdesign/spec'
import { RotateCcwIcon } from 'lucide-react'
import { useId } from 'react'

import { LanguageFlag } from '@/components/LanguagePicker'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ViewOnlyContext } from '@/components/viewOnly'
import { findLanguage, languageName } from '@/lib/languages'

import { useDesign } from '../context'
import { useTry, useTryStore } from './store'

// The built-in values the panel offers (04 section 8): the user's first name and username.
const builtinFields: readonly { name: SimBuiltin; label: string }[] = [
  { name: 'first_name', label: 'First name' },
  { name: 'username', label: 'Username' },
]

/**
 * The test user beside the phone (04 section 8): "Language" (the design's languages), every test
 * switch, the built-in values (first name, username) and "Reset"; then the variables with their
 * values in this try. A switch or the language takes effect at the next step; a built-in value
 * at once.
 */
export function TestUserPanel() {
  const design = useDesign()
  const store = useTryStore()
  const user = useTry((session) => session.user) ?? defaultSimUser(design)
  const vars = useTry((session) => session.history.at(-1)?.vars)
  const langId = useId()
  const switches = Object.values(design.switches).sort((a, b) => a.label.localeCompare(b.label))
  const variables = Object.values(design.variables).sort(
    (a, b) => Number(b.source === 'builtin') - Number(a.source === 'builtin') || a.idName.localeCompare(b.idName),
  )
  const builtin = (name: string) =>
    Object.values(design.variables).find((item) => item.source === 'builtin' && item.idName === name)
  const languages = design.languages.list.map((code) => ({ value: code, label: languageName(code) }))
  // A design that rolls a dice lets the tester pick the value (MSG-03): empty rolls at random.
  const rolls = Object.values(design.steps).some(
    (step) =>
      (step.kind === 'message' && step.content.type === 'dice') ||
      (step.kind === 'question' && step.prompt.content.type === 'dice'),
  )

  // Every role can try: the panel's switches and selects stay on in a read-only editor.
  return (
    <ViewOnlyContext value={false}>
      <aside aria-label="Test user" className="flex flex-col gap-5 p-4">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-headline">Test user</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const reset = defaultSimUser(design)
                const language = builtin('language')
                const values: Partial<Record<string, SimValue>> = {}
                for (const item of Object.values(design.variables))
                  if (item.source === 'builtin' && item.testValue !== undefined) values[item.id] = item.testValue
                if (language) values[language.id] = reset.language
                store.setUser(reset, values)
              }}
            >
              <RotateCcwIcon aria-hidden data-icon="inline-start" />
              Reset
            </Button>
          </div>
          <Field>
            <FieldLabel htmlFor={langId}>Language</FieldLabel>
            <Select
              items={languages}
              value={user.language}
              onValueChange={(language: string | null) => {
                if (language === null) return
                const variable = builtin('language')
                store.setUser({ ...user, language }, variable ? { [variable.id]: language } : undefined)
              }}
            >
              <SelectTrigger id={langId} className="w-full">
                <SelectValue>
                  {(code: string) => (
                    <>
                      <LanguageFlag language={findLanguage(code)} />
                      {languageName(code)}
                    </>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {languages.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    <LanguageFlag language={findLanguage(item.value)} />
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {switches.map((item) => (
            <SwitchField
              key={item.id}
              item={item}
              value={user.switches[item.id] ?? item.testValue}
              onChange={(value) => {
                store.setUser({ ...user, switches: { ...user.switches, [item.id]: value } })
              }}
            />
          ))}
          {builtinFields.map(({ name, label }) => {
            const variable = builtin(name)
            const value = user.builtins[name]
            return (
              <BuiltinField
                key={name}
                label={label}
                value={value === undefined ? '' : String(value)}
                placeholder={variable?.testValue === undefined ? '' : String(variable.testValue)}
                onChange={(text) => {
                  // An empty field goes back to the variable's test value.
                  const builtins: SimTestUser['builtins'] = Object.fromEntries(
                    Object.entries({ ...user.builtins, [name]: text }).filter(([, item]) => item !== ''),
                  )
                  const shown = text === '' ? variable?.testValue : text
                  store.setUser(
                    { ...user, builtins },
                    variable && shown !== undefined ? { [variable.id]: shown } : undefined,
                  )
                }}
              />
            )
          })}
          {rolls ? (
            <BuiltinField
              label="Dice value"
              value={user.dice === undefined ? '' : String(user.dice)}
              placeholder="Random"
              onChange={(text) => {
                const value = Number(text.trim())
                const dice = text.trim() === '' || !Number.isInteger(value) ? undefined : value
                store.setUser({ ...user, dice })
              }}
            />
          ) : null}
        </section>
        <section className="flex flex-col gap-2">
          <h2 className="text-headline">Variables</h2>
          {variables.length === 0 ? (
            <p className="text-footnote text-fg-3">None yet</p>
          ) : (
            <dl className="flex flex-col gap-1.5">
              {variables.map((item) => (
                <div key={item.id} className="flex items-baseline justify-between gap-3 text-callout">
                  <dt className="min-w-0 truncate font-mono text-footnote text-fg-2" title={item.label}>
                    {item.idName}
                  </dt>
                  <dd dir="auto" className="min-w-0 truncate text-end">
                    <ValueText item={item} value={vars?.[item.id]} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </aside>
    </ViewOnlyContext>
  )
}

// A variable's value in this try: what was set, else its test value (greyed), else "empty".
function ValueText({ item, value }: { item: Variable; value: SimValue | null | undefined }) {
  const shown = value === undefined ? item.testValue : value
  if (shown === null || shown === undefined || shown === '') return <span className="text-fg-3">empty</span>
  const text = typeof shown === 'boolean' ? (shown ? 'yes' : 'no') : String(shown)
  return (
    <span className={value === undefined ? 'text-fg-3' : undefined} title={value === undefined ? 'Test value' : text}>
      {text}
    </span>
  )
}

function SwitchField({
  item,
  value,
  onChange,
}: {
  item: TestSwitch
  value: boolean | string
  onChange: (value: boolean | string) => void
}) {
  const id = useId()
  if (item.type === 'yesNo')
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-callout">
          {item.label}
        </label>
        <div className="flex items-center gap-2 text-footnote text-fg-2">
          {value === true ? 'yes' : 'no'}
          <Switch
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => {
              onChange(checked)
            }}
          />
        </div>
      </div>
    )
  const options = (item.options ?? []).map((option) => ({ value: option, label: option }))
  return (
    <Field>
      <FieldLabel htmlFor={id}>{item.label}</FieldLabel>
      <Select
        items={options}
        value={typeof value === 'string' ? value : null}
        onValueChange={(option: string | null) => {
          if (option !== null) onChange(option)
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function BuiltinField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    </Field>
  )
}
