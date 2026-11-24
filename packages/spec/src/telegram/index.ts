// The Telegram catalog (docs/plan/08): typed, read-only facts of the Bot API that xDesign is built
// on, each row with its source and the Bot API version it was checked against. CATALOG lists
// every table for make catalog-check (scripts/catalog-check.ts).
import { BOT_METHODS, COMMAND_SCOPES, MENU_BUTTON_TYPES } from './bot.ts'
import { BUTTON_KINDS, BUTTON_RULES, LOOKS } from './buttons.ts'
import { CHAT_ACTIONS } from './chatActions.ts'
import { EDIT_FACTS, EDIT_METHODS, EDIT_RULES } from './edit.ts'
import { EFFECT_RULES, EFFECTS } from './effects.ts'
import { ENTITIES, ENTITY_RULES } from './entities.ts'
import { ACTION_METHODS, EVENT_RULES, EVENT_UPDATES } from './events.ts'
import { KEYBOARD_OPTIONS, KEYBOARD_TYPES } from './keyboards.ts'
import { LIMITS } from './limits.ts'
import { ALBUM_GROUPS, MEDIA_FORMATS, MEDIA_RULES } from './media.ts'
import { DICE, MESSAGE_KINDS } from './messages.ts'
import { INVOICE_FIELDS, PAYMENT_EVENTS, PAYMENT_RULES } from './payments.ts'
import { PAID_MEDIA_KINDS, POLL_FIELDS } from './polls.ts'
import { DRAFT_METHODS, DRAFT_STOP, RICH_BLOCKS, RICH_MEDIA_KINDS } from './rich.ts'
import type { CatalogRow } from './version.ts'

export { BOT_API, BOT_API_CHANGELOG, BOT_API_DATE, type CatalogRow, type Sourced } from './version.ts'
export * from './bot.ts'
export * from './buttons.ts'
export * from './chatActions.ts'
export * from './edit.ts'
export * from './effects.ts'
export * from './entities.ts'
export * from './keyboards.ts'
export * from './limits.ts'
export * from './media.ts'
export * from './messages.ts'
export * from './polls.ts'
export * from './rich.ts'
export * from './payments.ts'
export * from './events.ts'

/** Every table of the catalog by name. The keyboard and upload limits are checked inside LIMITS. */
export const CATALOG: Readonly<Record<string, readonly CatalogRow[]>> = {
  MESSAGE_KINDS,
  DICE,
  POLL_FIELDS,
  PAID_MEDIA_KINDS,
  RICH_BLOCKS,
  RICH_MEDIA_KINDS,
  DRAFT_METHODS,
  DRAFT_STOP,
  INVOICE_FIELDS,
  PAYMENT_EVENTS,
  PAYMENT_RULES,
  ACTION_METHODS,
  EVENT_UPDATES,
  EVENT_RULES,
  BUTTON_KINDS,
  LOOKS,
  BUTTON_RULES,
  KEYBOARD_TYPES,
  KEYBOARD_OPTIONS,
  ENTITIES,
  ENTITY_RULES,
  MEDIA_FORMATS,
  ALBUM_GROUPS,
  MEDIA_RULES,
  LIMITS,
  EDIT_METHODS,
  EDIT_RULES,
  EDIT_FACTS,
  EFFECTS,
  EFFECT_RULES,
  CHAT_ACTIONS,
  BOT_METHODS,
  COMMAND_SCOPES,
  MENU_BUTTON_TYPES,
}
