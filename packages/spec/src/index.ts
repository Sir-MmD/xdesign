export const specPackage = '@xdesign/spec'

// The plain model, the rich text schema and ID names (SPEC-01).
export * from './model/ids.ts'
export * from './model/texts.ts'
export * from './model/steps.ts'
export * from './model/triggers.ts'
export * from './model/content.ts'
export * from './model/buttons.ts'
export * from './model/options.ts'
export * from './model/question.ts'
export * from './model/conditions.ts'
export * from './model/variables.ts'
export * from './model/parts.ts'
export * from './model/bot.ts'
export * from './model/design.ts'
export * from './text/schema.ts'
export * from './names/id-name.ts'
export * from './names/transliterate.ts'

export * as telegram from './telegram/index.ts'

// Texts to Telegram and back, their normal form and their length (SPEC-02).
export * from './text/marks.ts'
export * from './text/normalize.ts'
export * from './text/to-telegram.ts'
export * from './text/from-telegram.ts'

// The Yjs document: layout, accessors, reading and watching, new documents, tidy and migrate
// (SPEC-04).
export { LAYOUT, newId, type DesignEditor } from './ydoc/layout.ts'
export { docToFragment, fragmentToDoc } from './ydoc/rich.ts'
export * from './ydoc/read.ts'
export * from './ydoc/new.ts'
export * from './ydoc/tidy.ts'
export * from './ydoc/migrate.ts'
export * from './ydoc/edits.ts'
export * from './ydoc/steps.ts'
export * from './ydoc/buttons.ts'
export * from './ydoc/texts.ts'
export * from './ydoc/variables.ts'
export * from './ydoc/parts.ts'
export * from './ydoc/media.ts'
export * from './ydoc/bot.ts'
export * from './ydoc/languages.ts'
export * from './ydoc/map.ts'
export * from './ydoc/checks.ts'

// The Try it engine (TRY-01).
export * from './sim/index.ts'

// The checks: issues with their codes, levels and keys for "Ignore here" (SPEC-05).
export * from './checks/issues.ts'
export * from './checks/check.ts'

// The export format spec.json version 1: its schema, the export, the import and the round trip's
// comparison, and the `telegram` block of a message the editor's "Telegram details" show (SPEC-03).
export * from './export/schema.ts'
export * from './export/to-spec.ts'
export * from './export/from-spec.ts'
export * from './export/compare.ts'
export * from './export/files.ts'
export { sendTelegram, waitsFor } from './export/telegram.ts'

// The readable doc design.md with its Mermaid map, the logic sentences the editor shares, and the
// builders' guide HOW-TO-READ.md as a string (EXP-01).
export * from './markdown/say.ts'
export * from './markdown/to-markdown.ts'
export * from './markdown/how-to-read.gen.ts'

// Every arrow of a design with its words, for the MCP connector's get_step (CL-02).
export { designArrows, type MapArrow } from './markdown/map.ts'

// Invoices, the pay button, the payment start points and conditions, and the refund action (PAY-01).
export * from './model/invoice.ts'
export * from './model/actions.ts'

// The events: the action kinds, the event start points, reminders and broadcasts, the action's
// `telegram` block and the conditions a step has (EVT-01).
export { actionTelegram } from './export/telegram.ts'
export { conditionsOf } from './checks/context.ts'
