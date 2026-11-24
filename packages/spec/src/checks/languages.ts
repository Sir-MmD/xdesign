// Languages (docs/plan/03-design-model.md section 8): W03 a text, button text, caption, popup,
// placeholder, poll question or option missing in one of the design's languages. A message text
// and a poll's question and options are needed in every language; the others only where the
// default language has them (a button without text in the default language is E12, a question
// without a wrong answer message W05). An invoice's texts are needed in every language.
import type { Lang } from '../model/ids.ts'
import type { LangText, RichText } from '../model/texts.ts'
import type { InvoiceStep } from '../model/steps.ts'
import {
  andList,
  asSending,
  contentOf,
  emptyDoc,
  emptyText,
  keyboardOf,
  slotName,
  textSlots,
  type Context,
} from './context.ts'

export function checkLanguages(ctx: Context): void {
  const { defaultLanguage } = ctx
  const missingRich = (text: RichText, lang: Lang) =>
    lang !== defaultLanguage && !emptyDoc(text[defaultLanguage]) && emptyDoc(text[lang])
  const missingPlain = (text: LangText | undefined, lang: Lang) =>
    text !== undefined && lang !== defaultLanguage && !emptyText(text[defaultLanguage]) && emptyText(text[lang])

  for (const step of ctx.steps) {
    if (step.kind === 'invoice') invoiceLanguages(ctx, step)
    const sending = asSending(step)
    if (!sending) continue
    const keyboard = keyboardOf(sending)
    const placeholder = keyboard?.type === 'reply' || keyboard?.type === 'forceReply' ? keyboard.placeholder : undefined
    const slots = textSlots(sending)
    const content = contentOf(sending)
    const options = content.type === 'poll' || content.type === 'quiz' ? content.options : []
    for (const lang of ctx.languages) {
      const missing = slots
        .filter((slot) =>
          slot.what === 'text' || slot.what === 'question'
            ? emptyDoc(slot.text.doc[lang])
            : missingRich(slot.text.doc, lang),
        )
        .map(slotName)
      options.forEach((option, index) => {
        if (emptyText(option[lang])) missing.push(`option ${String(index + 1)}`)
      })
      if (missingPlain(placeholder, lang)) missing.push('placeholder')
      if (missing.length === 0) continue
      ctx.add('W03', `${ctx.stepName(step)} has no ${andList(missing)} in ${lang}.`, {
        stepId: step.id,
        language: lang,
      })
    }
  }

  for (const { button, step } of ctx.buttons) {
    const popup = button.place === 'inline' && button.action.type === 'goTo' ? button.action.popup?.text : undefined
    for (const lang of ctx.languages) {
      if (lang === defaultLanguage) continue
      const missing: string[] = []
      if (emptyText(button.label[lang])) missing.push('text')
      if (missingPlain(popup, lang)) missing.push('popup text')
      if (missing.length === 0) continue
      ctx.add(
        'W03',
        `The button ${ctx.buttonName(button)} in ${ctx.stepName(step)} has no ${andList(missing)} in ${lang}.`,
        { stepId: step.id, buttonId: button.id, language: lang },
      )
    }
  }
}

// The invoice's title, description, price labels, shipping options and refusal message in each
// language besides the default one (E23 reports them empty there).
function invoiceLanguages(ctx: Context, step: InvoiceStep): void {
  const { invoice } = step
  const texts: [string, LangText][] = [
    ['title', invoice.title],
    ['description', invoice.description],
    ...invoice.prices.map((price, index): [string, LangText] => [
      invoice.prices.length === 1 ? 'price label' : `label of price line ${String(index + 1)}`,
      price.label,
    ]),
    ...(invoice.physical?.flexibleShipping ? invoice.physical.shippingOptions : []).map(
      (option, index): [string, LangText] => [`title of shipping option ${String(index + 1)}`, option.title],
    ),
    ...(step.checkout ? [['refusal message', step.checkout.refuse] as [string, LangText]] : []),
  ]
  for (const lang of ctx.languages) {
    if (lang === ctx.defaultLanguage) continue
    const missing = texts.filter(([, text]) => emptyText(text[lang])).map(([what]) => what)
    if (missing.length === 0) continue
    ctx.add('W03', `${ctx.stepName(step)} has no ${andList(missing)} in ${lang}.`, { stepId: step.id, language: lang })
  }
}
