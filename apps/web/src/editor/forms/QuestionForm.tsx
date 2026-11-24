import type { Expects, QuestionStep } from '@xdesign/spec'
import { useId } from 'react'

import { LanguageFlag } from '@/components/LanguagePicker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { findLanguage, languageName } from '@/lib/languages'

import { useDesign, useEditor, useLang } from '../context'
import { AnswerChecks } from './AnswerChecks'
import { Field, FormSection, OptionalNumber, TargetSelect, TitleField } from './fields'
import { ANSWER_TYPES, checksFor, EXPECTS_ITEMS } from './question'
import { VariableSelect } from './VariableSelect'
import { WrongAnswerBubble } from './WrongAnswerBubble'

/**
 * A question's form under its prompt on the phone (04 section 6): its "Title" (the box's name),
 * "Expects" with the checks of that kind of answer and "Save the answer as"; "Wrong answer" (its
 * message in a small phone, "Try at most N times", "Then go to"); "Cancel word" in the language
 * shown and where it "Goes to". The box's dots are "Valid answer", "Wrong N times" and "Cancel".
 */
export function QuestionForm({ step }: { step: QuestionStep }) {
  const design = useDesign()
  const lang = useLang()
  const { edits } = useEditor()
  const cancelId = useId()
  const setExpects = (expects: Expects) => {
    edits.steps.set(step.id, { expects, checks: checksFor(step.checks, expects) })
    // The answer's own variable takes the type of the new kind of answer.
    const variable = design.variables[step.saveTo]
    const type = ANSWER_TYPES[expects]
    if (variable?.source === 'question' && variable.type !== type) edits.variables.set(variable.id, { type })
  }
  const words = step.cancel?.words ?? {}
  const several = design.languages.list.length > 1
  return (
    <>
      <FormSection>
        <TitleField step={step} />
        <Field label="Expects">
          {(labelId) => (
            <Select<Expects>
              items={EXPECTS_ITEMS}
              value={step.expects}
              onValueChange={(expects) => {
                if (expects !== null && expects !== step.expects) setExpects(expects)
              }}
            >
              <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPECTS_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <AnswerChecks
          expects={step.expects}
          checks={step.checks}
          onChange={(checks) => {
            edits.steps.set(step.id, { checks })
          }}
        />
        <Field label="Save the answer as">
          {(labelId) => (
            <VariableSelect
              aria-labelledby={labelId}
              which="settable"
              newVariable={{ source: 'question', type: ANSWER_TYPES[step.expects] }}
              className="w-full"
              value={step.saveTo}
              onChange={(saveTo) => {
                edits.steps.set(step.id, { saveTo })
              }}
            />
          )}
        </Field>
      </FormSection>
      <FormSection title="Wrong answer">
        <WrongAnswerBubble step={step} />
        <div className="flex flex-wrap items-center gap-2 text-callout">
          Try at most
          <OptionalNumber
            aria-label="Tries"
            className="h-(--control-h-sm) w-20"
            value={step.wrongAnswer.maxTries}
            min={1}
            max={100}
            whole
            onCommit={(maxTries) => {
              edits.steps.set(step.id, { wrongAnswer: { ...step.wrongAnswer, maxTries } })
            }}
          />
          times
        </div>
        <Field label="Then go to">
          {(labelId) => (
            <TargetSelect
              from={step}
              value={step.wrongAnswer.afterMaxTries}
              aria-labelledby={labelId}
              onChange={(target) => {
                edits.steps.connect({ step: step.id, arrow: 'afterMaxTries' }, target)
              }}
            />
          )}
        </Field>
      </FormSection>
      <FormSection title="Cancel">
        <div className="grid gap-2">
          <Label htmlFor={cancelId}>
            Cancel word
            {several ? (
              <span className="flex items-center gap-1.5 font-normal text-fg-3">
                <LanguageFlag language={findLanguage(lang)} />
                {languageName(lang)}
              </span>
            ) : null}
          </Label>
          <p className="-mt-1.5 text-footnote text-fg-3">Several words: put commas between them.</p>
          <Input
            id={cancelId}
            placeholder={lang === design.languages.default ? 'Cancel' : (words[design.languages.default] ?? 'Cancel')}
            value={words[lang] ?? ''}
            onChange={(event) => {
              edits.texts.setPlain({ step: step.id, field: 'cancelWords' }, lang, event.target.value)
            }}
          />
        </div>
        <Field label="Goes to">
          {(labelId) => (
            <TargetSelect
              from={step}
              value={step.cancel?.goTo}
              aria-labelledby={labelId}
              onChange={(target) => {
                edits.steps.connect({ step: step.id, arrow: 'cancel' }, target)
              }}
            />
          )}
        </Field>
      </FormSection>
    </>
  )
}
