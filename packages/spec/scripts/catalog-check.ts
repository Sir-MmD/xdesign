// make catalog-check (docs/plan/14-milestones.md section 1): every row of the Telegram catalog
// (src/telegram/) has an id unique in its table, a source that is an https URL (with an anchor
// on core.telegram.org), a Bot API version, and a note when it is unverified. Prints one line
// per problem, naming the table and the row, and fails when there is any.
import { CATALOG } from '../src/telegram/index.ts'

const problems: string[] = []
let rows = 0

for (const [table, tableRows] of Object.entries(CATALOG)) {
  const seen = new Set<string>()
  tableRows.forEach((row, index) => {
    rows++
    const name = `${table} ${row.id || `row ${String(index + 1)}`}`
    if (!row.id) problems.push(`${name}: no id`)
    else if (seen.has(row.id)) problems.push(`${name}: duplicate id`)
    seen.add(row.id)

    if (!row.source) problems.push(`${name}: no source`)
    else if (!URL.canParse(row.source)) problems.push(`${name}: source is not a valid URL: ${row.source}`)
    else {
      const url = new URL(row.source)
      if (url.protocol !== 'https:') problems.push(`${name}: source is not https: ${row.source}`)
      if (url.hostname === 'core.telegram.org' && url.hash.length < 2) {
        problems.push(`${name}: source has no anchor: ${row.source}`)
      }
    }

    if (!row.botApi) problems.push(`${name}: no Bot API version`)
    else if (!/^\d+\.\d+$/.test(row.botApi)) problems.push(`${name}: Bot API version is not a version: ${row.botApi}`)

    if (!row.verified && !row.note) problems.push(`${name}: unverified without a note saying why`)
  })
}

if (problems.length > 0) {
  for (const problem of problems) console.log(problem)
  console.log(`catalog-check: ${String(problems.length)} problems`)
  process.exitCode = 1
} else {
  console.log(`catalog-check: ${String(rows)} rows in ${String(Object.keys(CATALOG).length)} tables, all sourced`)
}
