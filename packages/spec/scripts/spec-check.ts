// make spec-check (docs/plan/14-milestones.md section 1, 06 section 6), for every fixture design
// in fixtures/ and every starter template in fixtures/templates/: validateDesign passes; the
// checks run (the counts per level; the coffee shop and the templates have no errors and their
// warnings are listed); its export validates against the JSON Schema make gen writes (read
// through Zod's fromJSONSchema); importing the export, and reading the design back from its Yjs
// document after setting every title again, give the same design (sameDesign's comparison, texts
// in normal form); and on the 300-step design check and toSpec stay within their time. Writes
// fixtures/out/<name>.spec.json and .md (git-ignored) of the coffee shop and the templates for the
// owner to read. Prints one line per fixture that passes, the failing step with its details
// otherwise.
import { z } from 'zod'

import { big } from '../fixtures/big.ts'
import { coffeeShop } from '../fixtures/coffee-shop.ts'
import { STARTER_TEMPLATES } from '../fixtures/templates/index.ts'
import {
  check,
  designDifference,
  designEdits,
  docFromDesign,
  fromSpec,
  normalizeRichDoc,
  readDesign,
  toMarkdown,
  toSpec,
  validateDesign,
  type Design,
  type Issue,
  type RichDoc,
  type RichText,
  type Spec,
} from '../src/index.ts'

// The spec package's lint rule forbids node: imports (its code also runs in the browser); this
// script runs in Node only.
const fs = process.getBuiltinModule('node:fs')

type Fixture = {
  name: string
  design: unknown
  // The example and the templates: no errors allowed, their warnings listed and their spec.json
  // and design.md written.
  example?: boolean
  // The most `check` and `toSpec` may take on it, in milliseconds (the best of RUNS runs).
  limits?: { check: number; toSpec: number }
}

const FIXTURES: Fixture[] = [
  { name: 'coffee-shop', design: coffeeShop, example: true },
  { name: 'big', design: big, limits: { check: 100, toSpec: 300 } },
  ...STARTER_TEMPLATES.map((template) => ({ name: `template-${template.id}`, design: template.design, example: true })),
]
const RUNS = 5

const schemaFile = new URL('../schema/bot-spec.v1.schema.json', import.meta.url)
const outDir = new URL('../fixtures/out/', import.meta.url)
const specSchema = z.fromJSONSchema(JSON.parse(fs.readFileSync(schemaFile, 'utf8')) as z.core.JSONSchema.JSONSchema)

class StepFailure extends Error {}

function fail(step: string, details: string): never {
  throw new StepFailure(`${step} failed: ${details}`)
}

/** Every rich text of the design in SPEC-02's normal form, the form the round trips compare. */
function normalTexts(design: Design): Design {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk)
    if (value === null || typeof value !== 'object') return value
    if (Object.keys(value).length === 2 && 'id' in value && 'doc' in value) {
      const docs = Object.entries(value.doc as RichText).map(([lang, doc]): [string, RichDoc | undefined] => [
        lang,
        doc && normalizeRichDoc(doc),
      ])
      return { id: value.id, doc: Object.fromEntries(docs) }
    }
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, walk(inner)]))
  }
  return walk(design) as Design
}

function exportOf(design: Design, issues: readonly Issue[]): Spec {
  return toSpec(design, {
    exportedBy: 'xDesign spec-check',
    exportedAt: '2026-01-01T00:00:00.000Z',
    docVersion: 1,
    mediaFile: (item) => `media/${item.id}`,
    checks: issues.map((issue) => ({
      level: issue.level,
      code: issue.code,
      where: issue.stepId ?? '',
      ...(issue.buttonId !== undefined && { button: issue.buttonId }),
      ...(issue.language !== undefined && { language: issue.language }),
      message: issue.message,
      ...(issue.ignored === true && { ignored: true }),
    })),
  })
}

// The fastest of RUNS runs, in whole milliseconds.
function timeOf(run: () => unknown): number {
  let best = Infinity
  for (let n = 0; n < RUNS; n++) {
    const start = performance.now()
    run()
    best = Math.min(best, performance.now() - start)
  }
  return Math.round(best)
}

function checkFixture(fixture: Fixture): string[] {
  const valid = validateDesign(fixture.design)
  if (!valid.ok) {
    fail('validateDesign', valid.problems.map((problem) => `${problem.path} ${problem.message}`).join('; '))
  }
  const { design } = valid
  const lines: string[] = []
  const parts = [`${String(Object.keys(design.steps).length)} steps`]

  const issues = check(design)
  const count = (level: Issue['level']) => issues.filter((issue) => issue.level === level).length
  if (fixture.example === true && count('error') > 0) {
    const errors = issues.filter((issue) => issue.level === 'error')
    fail('check', errors.map((issue) => `${issue.code} ${issue.message}`).join('; '))
  }
  parts.push(
    `checks: ${String(count('error'))} errors, ${String(count('warning'))} warnings, ${String(count('info'))} good to know`,
  )
  if (fixture.example === true) {
    for (const issue of issues) if (issue.level === 'warning') lines.push(`  ${issue.code} ${issue.message}`)
  }

  const json = JSON.stringify(exportOf(design, issues), null, 2) + '\n'
  const schema = specSchema.safeParse(JSON.parse(json))
  if (!schema.success) {
    const problems = schema.error.issues.slice(0, 5)
    fail('JSON Schema', problems.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; '))
  }
  parts.push('spec.json matches the JSON Schema')

  const imported = fromSpec(JSON.parse(json))
  if (!imported.ok) {
    fail('fromSpec', imported.problems.map((problem) => `${problem.path} ${problem.message}`).join('; '))
  }
  const exported = designDifference(normalTexts(design), normalTexts(imported.design))
  if (exported !== null) fail('export then import', `the designs differ at ${exported}`)

  // The Yjs document, with every title set again as the editor sets it, so the ID names that
  // follow the titles must come out as the fixture has them (its step titled "Back" is back_2).
  let read: Design
  try {
    const doc = docFromDesign(design)
    const edits = designEdits(doc, 'spec-check')
    for (const step of Object.values(design.steps)) edits.steps.setTitle(step.id, step.title)
    read = readDesign(doc)
  } catch (error) {
    fail('readDesign(docFromDesign)', error instanceof Error ? error.message : String(error))
  }
  const yjs = designDifference(normalTexts(design), normalTexts(read))
  if (yjs !== null) fail('readDesign(docFromDesign)', `the designs differ at ${yjs}`)
  parts.push('export then import and the Yjs document give the same design')

  if (fixture.limits !== undefined) {
    const checkMs = timeOf(() => check(design))
    const toSpecMs = timeOf(() => exportOf(design, issues))
    if (checkMs > fixture.limits.check) {
      fail('speed', `check took ${String(checkMs)} ms, more than ${String(fixture.limits.check)} ms`)
    }
    if (toSpecMs > fixture.limits.toSpec) {
      fail('speed', `toSpec took ${String(toSpecMs)} ms, more than ${String(fixture.limits.toSpec)} ms`)
    }
    parts.push(`check ${String(checkMs)} ms, toSpec ${String(toSpecMs)} ms`)
  }

  const markdown = toMarkdown(design, {
    checks: issues,
    exportedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    mediaFile: (item) => `media/${item.id}`,
  })

  if (fixture.example === true) {
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(new URL(`${fixture.name}.spec.json`, outDir), json)
    parts.push(`wrote fixtures/out/${fixture.name}.spec.json`)
    fs.writeFileSync(new URL(`${fixture.name}.md`, outDir), markdown)
    parts.push(`wrote fixtures/out/${fixture.name}.md`)
  }
  return [`${fixture.name}: ${parts.join('; ')}`, ...lines]
}

let failed = 0
for (const fixture of FIXTURES) {
  try {
    for (const line of checkFixture(fixture)) console.log(line)
  } catch (error) {
    if (!(error instanceof StepFailure)) throw error
    failed++
    console.log(`${fixture.name}: ${error.message}`)
  }
}
if (failed > 0) {
  console.log(`spec-check: ${String(failed)} of ${String(FIXTURES.length)} fixtures failed`)
  process.exitCode = 1
} else {
  console.log(`spec-check: ${String(FIXTURES.length)} fixtures passed`)
}
