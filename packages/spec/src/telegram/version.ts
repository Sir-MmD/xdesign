// The Bot API version the Telegram catalog was checked against (TG-00, docs/plan/08 section 7),
// the fields every catalog row carries, and helpers for the source URLs of Telegram's pages.
export const BOT_API = '10.5'
export const BOT_API_DATE = '2026-11-22'
export const BOT_API_CHANGELOG = 'https://core.telegram.org/bots/api-changelog#november-22-2026'

/** The fields of every catalog row (make catalog-check checks them). */
export type Sourced = {
  /** Where the fact is stated: an https URL, with an anchor on core.telegram.org. */
  readonly source: string
  /** The Bot API version the row was checked against. */
  readonly botApi: string
  /** False when Telegram does not document the fact (observed, reported or assumed). */
  readonly verified: boolean
  /** Why a row is unverified, or a rule that goes with it. */
  readonly note?: string
}

/** A catalog row with its id, as make catalog-check reads every table. */
export type CatalogRow = Sourced & { readonly id: string }

export const apiDoc = (anchor: string) => `https://core.telegram.org/bots/api#${anchor}`
export const changelogDoc = (anchor: string) => `https://core.telegram.org/bots/api-changelog#${anchor}`
export const featuresDoc = (anchor: string) => `https://core.telegram.org/bots/features#${anchor}`
export const starsDoc = (anchor: string) => `https://core.telegram.org/bots/payments-stars#${anchor}`
export const faqDoc = (anchor: string) => `https://core.telegram.org/bots/faq#${anchor}`
