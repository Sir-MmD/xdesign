// The built-in starter templates (TPL-01, docs/plan/04 section 15, 01 section 6.10): a shop with
// Stars, a support desk, a quiz and a sign-up form, each a whole design in English with a Persian
// version. The server lists them in the gallery and copies one into a new design ("Use this
// template"); make spec-check checks each like the example design (no errors allowed). Imported
// as `@xdesign/spec/templates`, so only the server's bundle carries them.
import type { Design } from '../../src/index.ts'
import { quizTemplate } from './quiz.ts'
import { shopTemplate } from './shop.ts'
import { signUpTemplate } from './signup.ts'
import { supportTemplate } from './support.ts'

export interface StarterTemplate {
  // Its ID in the gallery and in "Use this template"; the design's name is the template's name.
  id: string
  // The gallery's picture: the web app draws an icon for it.
  icon: 'shop' | 'support' | 'quiz' | 'signUp'
  description: string
  design: Design
}

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    id: 'shop',
    icon: 'shop',
    description:
      'Sell digital products for Telegram Stars: product pages, invoices, the download after paying, ' +
      "the buyer's purchases and help with a payment.",
    design: shopTemplate,
  },
  {
    id: 'support',
    icon: 'support',
    description:
      'Answer customers: common questions, office hours, a ticket your team receives, and a broadcast for news.',
    design: supportTemplate,
  },
  {
    id: 'quiz',
    icon: 'quiz',
    description:
      "Three of Telegram's quizzes: each answer is saved, an If adds the points, and the score picks the ending.",
    design: quizTemplate,
  },
  {
    id: 'sign-up',
    icon: 'signUp',
    description:
      'Collect sign-ups: a name, an email, an age and a phone, each with its checks, a summary to confirm, ' +
      'and a developer step that saves it.',
    design: signUpTemplate,
  },
]
