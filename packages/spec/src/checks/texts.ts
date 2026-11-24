// Texts and lengths (docs/plan/03-design-model.md section 8): E01 message texts, E02 captions,
// E06 copy texts and popups, W08 long button texts in a row of two or more (the texts of polls
// and quizzes are E20's, those of rich messages E28's). Lengths are what Telegram counts (measure), each limit comes from the
// catalog.
import { limit } from '../telegram/limits.ts'
import { asButtonStep, asSending, slotName, textSlots, type Context } from './context.ts'

export function checkTexts(ctx: Context): void {
  const { max: textMax } = limit('text')
  const { max: captionMax } = limit('caption')
  for (const step of ctx.steps) {
    const sending = asSending(step)
    if (!sending) continue
    for (const slot of textSlots(sending)) {
      if (slot.what === 'question' || slot.what === 'explanation' || slot.what === 'block') continue
      const caption = slot.what === 'caption'
      const max = caption ? captionMax : textMax
      for (const lang of ctx.languages) {
        const doc = slot.text.doc[lang]
        if (!doc) continue
        const length = ctx.length(doc, lang)
        if (length <= max) continue
        ctx.add(
          caption ? 'E02' : 'E01',
          `The ${slotName(slot)} of ${ctx.stepName(step)} in ${lang} is ` +
            `${String(length)} characters long; Telegram allows at most ${String(max)}.`,
          { stepId: step.id, language: lang },
        )
      }
    }
  }

  const { max: copyMax } = limit('copyText')
  const { max: popupMax } = limit('popupText')
  for (const { button, step } of ctx.buttons) {
    if (button.place !== 'inline') continue
    const { action } = button
    const text = action.type === 'copyText' ? action.text : action.type === 'goTo' ? action.popup?.text : undefined
    if (!text) continue
    const what = action.type === 'copyText' ? 'copy text' : 'popup text'
    const max = action.type === 'copyText' ? copyMax : popupMax
    for (const lang of ctx.languages) {
      const length = ctx.plainLength(text[lang] ?? '')
      if (length <= max) continue
      ctx.add(
        'E06',
        `The ${what} of ${ctx.buttonName(button)} in ${ctx.stepName(step)} in ${lang} is ${String(length)} ` +
          `characters long; Telegram allows at most ${String(max)}.`,
        { stepId: step.id, buttonId: button.id, language: lang },
      )
    }
  }

  // Phones cut a long text when a row has two or more buttons; each button and language once.
  const { max: rowMax } = limit('buttonTextInRow')
  const reported = new Set<string>()
  for (const step of ctx.steps) {
    const sending = asButtonStep(step)
    if (!sending) continue
    for (const row of ctx.rows(sending)) {
      if (row.length < 2) continue
      for (const button of row) {
        for (const lang of ctx.languages) {
          const length = ctx.plainLength(button.label[lang] ?? '')
          const key = `${button.id}:${lang}`
          if (length <= rowMax || reported.has(key)) continue
          reported.add(key)
          ctx.add(
            'W08',
            `The text of ${ctx.buttonName(button)} in ${ctx.stepName(step)} is ${String(length)} characters ` +
              `long in ${lang}; in a row of two or more buttons, phones cut texts longer than about ${String(rowMax)}.`,
            { stepId: step.id, buttonId: button.id, language: lang },
          )
        }
      }
    }
  }
}
