// Marks of the rich text (docs/plan/03-design-model.md section 5.1) as Telegram entities, and the
// normal form of a list of marks that the converters compare: the schema's order, one mark of
// each type, only the schema's attributes.
import type { EntityType } from '../telegram/entities.ts'
import { RICH_MARKS, type RichMark, type RichMarkName } from './schema.ts'

/** The MessageEntity type of each mark: the catalog's richText column read the other way. */
export const MARK_ENTITY = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikethrough',
  spoiler: 'spoiler',
  code: 'code',
  link: 'text_link',
  dateTime: 'date_time',
} as const satisfies Record<RichMarkName, EntityType>

const MARK_ORDER: readonly RichMarkName[] = Object.values(RICH_MARKS)

/** Marks in the schema's order, the first of each type, with only the schema's attributes. */
export function normalMarks(marks: readonly RichMark[] | undefined): RichMark[] {
  const byType = new Map<RichMarkName, RichMark>()
  for (const mark of marks ?? []) {
    if (!byType.has(mark.type)) byType.set(mark.type, bareMark(mark))
  }
  return MARK_ORDER.flatMap((type) => byType.get(type) ?? [])
}

/** Equal marks give equal keys. */
export function markKey(mark: RichMark): string {
  return JSON.stringify(bareMark(mark))
}

// A mark without the attributes TipTap may add beyond the schema.
function bareMark(mark: RichMark): RichMark {
  switch (mark.type) {
    case RICH_MARKS.link:
      return { type: mark.type, attrs: { href: mark.attrs.href } }
    case RICH_MARKS.dateTime:
      return { type: mark.type, attrs: { unix: mark.attrs.unix, format: mark.attrs.format } }
    default:
      return { type: mark.type }
  }
}
