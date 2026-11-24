// The starter template "Sign-up form" (TPL-01, docs/plan/04 section 15): a sign-up for an event in
// four questions with their checks (a name, an email, an age with an If for the youngest, and a
// phone shared with Telegram's contact button or typed), a summary to confirm or start over, and a
// developer step that saves the sign-up, with a way for an email that is already signed up.
import type { Content, Design, Step, TextId, Variable } from '../../src/index.ts'
import { builtinVariables, byId, sayer } from '../build.ts'
import { goTo, inlineKeyboard, row, templateKit } from './kit.ts'

const { buttons, variable, inline, bottom, box } = templateKit()

const variables: Variable[] = [
  ...builtinVariables(),
  variable('var-name', 'Full name', 'text', 'question', 'Sara Ahmadi'),
  variable('var-email', 'Email', 'text', 'question', 'sara@example.com'),
  variable('var-age', 'Age', 'number', 'question', 29),
  variable('var-phone', 'Phone', 'phone', 'question', '+989121234567'),
]

const say = sayer(variables)
const text = (id: TextId, en: string, fa: string): Content => ({ type: 'text', text: say(id, { en, fa }) })
const cancel = { words: { en: 'Cancel', fa: 'انصراف' }, goTo: 'cancelled' }

const steps: Step[] = [
  {
    ...box('start', '/start', 0, 0),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'start',
      inMenu: true,
      menuDescription: { en: 'Sign up', fa: 'ثبت‌نام' },
    },
    next: 'welcome',
  },
  {
    ...box('welcome', 'Welcome', 1, 0),
    kind: 'message',
    content: text(
      't-welcome',
      'Hi {first_name}! 👋\nSign up for our event in four short questions. It takes a minute, and you can type Cancel at any time.',
      'سلام {first_name}! 👋\nبا چهار پرسش کوتاه در رویداد ما ثبت‌نام کنید. یک دقیقه طول می‌کشد و هر وقت خواستید می‌توانید «انصراف» بنویسید.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-sign-up', '✍️ Sign up', '✍️ ثبت‌نام', goTo('ask-name', 'new'), { look: 'primary' })),
      row(inline('b-about', 'ℹ️ About the event', 'ℹ️ درباره رویداد', goTo('about', 'edit'))),
    ),
    options: {},
  },
  {
    ...box('about', 'About the event', 1, 1),
    kind: 'message',
    content: text(
      't-about',
      'About the event\nWrite here what the event is, when and where it takes place, and what to bring.',
      'درباره رویداد\nاینجا بنویسید رویداد چیست، کی و کجا برگزار می‌شود و چه چیزی همراه بیاورند.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-about-sign-up', '✍️ Sign up', '✍️ ثبت‌نام', goTo('ask-name', 'new'), { look: 'primary' })),
      row(inline('b-about-back', '⬅️ Back', '⬅️ بازگشت', goTo('welcome', 'edit'))),
    ),
    options: {},
  },

  // The questions, each with its checks.
  {
    ...box('ask-name', 'Your name', 2, 0),
    kind: 'question',
    prompt: {
      content: text('t-ask-name', 'What is your full name?', 'نام و نام خانوادگی شما چیست؟'),
      keyboard: { type: 'forceReply', placeholder: { en: 'Your full name', fa: 'نام و نام خانوادگی' } },
      options: {},
    },
    expects: 'text',
    checks: { minLength: 2, maxLength: 64 },
    saveTo: 'var-name',
    wrongAnswer: {
      message: say('t-ask-name-wrong', {
        en: 'Please send your name, 2 to 64 characters.',
        fa: 'لطفاً نامتان را بفرستید، بین ۲ تا ۶۴ نویسه.',
      }),
    },
    cancel,
    next: 'ask-email',
  },
  {
    ...box('ask-email', 'Your email', 3, 0),
    kind: 'question',
    prompt: {
      content: text(
        't-ask-email',
        'Thanks, {full_name}! What is your email? We send the details of the event there.',
        'ممنون {full_name}! ایمیل شما چیست؟ جزئیات رویداد را به آن می‌فرستیم.',
      ),
      keyboard: { type: 'forceReply', placeholder: { en: 'name@example.com', fa: 'name@example.com' } },
      options: {},
    },
    expects: 'email',
    checks: { pattern: 'email', maxLength: 254 },
    saveTo: 'var-email',
    wrongAnswer: {
      message: say('t-ask-email-wrong', {
        en: 'That does not look like an email address. Please try again, like name@example.com.',
        fa: 'این به نشانی ایمیل شبیه نیست. لطفاً دوباره بفرستید، مثل name@example.com.',
      }),
      maxTries: 3,
      afterMaxTries: 'cancelled',
    },
    cancel,
    next: 'ask-age',
  },
  {
    ...box('ask-age', 'Your age', 4, 0),
    kind: 'question',
    prompt: {
      content: text('t-ask-age', 'How old are you?', 'چند سال دارید؟'),
      keyboard: { type: 'forceReply', placeholder: { en: 'Your age', fa: 'سن شما' } },
      options: {},
    },
    expects: 'number',
    checks: { min: 1, max: 120, wholeNumber: true },
    saveTo: 'var-age',
    wrongAnswer: {
      message: say('t-ask-age-wrong', {
        en: 'Please send your age as a whole number, like 25.',
        fa: 'لطفاً سنتان را به صورت یک عدد صحیح بفرستید، مثل ۲۵.',
      }),
      maxTries: 3,
      afterMaxTries: 'cancelled',
    },
    cancel,
    next: 'old-enough',
  },
  {
    ...box('old-enough', 'Old enough?', 5, 0),
    kind: 'if',
    cases: [
      { id: 'young', label: 'Under 18', when: { all: [{ var: 'var-age', op: 'lt', value: 18 }] }, goTo: 'too-young' },
    ],
    otherwise: 'ask-phone',
  },
  {
    ...box('ask-phone', 'Your phone', 6, 0),
    kind: 'question',
    prompt: {
      content: text(
        't-ask-phone',
        'Last one: your phone number, so we can reach you on the day. Tap the button below to share it, or type it.',
        'آخرین پرسش: شماره تلفنتان، تا روز رویداد بتوانیم با شما تماس بگیریم. با دکمه زیر آن را بفرستید یا بنویسید.',
      ),
      keyboard: {
        type: 'reply',
        rows: [
          row(bottom('b-share-phone', '📱 Share my phone number', '📱 ارسال شماره تلفن من', { type: 'sharePhone' })),
          row(bottom('b-phone-cancel', 'Cancel', 'انصراف', { type: 'text' })),
        ],
        oneTime: true,
        persistent: false,
        resize: true,
        placeholder: { en: 'Or type your number', fa: 'یا شماره را بنویسید' },
      },
      options: {},
    },
    expects: 'phone',
    checks: { pattern: 'phone' },
    saveTo: 'var-phone',
    wrongAnswer: {
      message: say('t-ask-phone-wrong', {
        en: 'Please tap "Share my phone number", or type your number with the country code, like +44 20 7946 0958.',
        fa: 'لطفاً «ارسال شماره تلفن من» را بزنید یا شماره را با کد کشور بنویسید، مثل +98 912 123 4567.',
      }),
      maxTries: 3,
      afterMaxTries: 'cancelled',
    },
    cancel,
    next: 'got-phone',
  },
  {
    ...box('got-phone', 'Got the phone', 7, 0),
    kind: 'message',
    content: text('t-got-phone', 'Thanks! One last look at your answers:', 'ممنون! یک نگاه آخر به پاسخ‌هایتان:'),
    // Takes the phone button away.
    keyboard: { type: 'removeReply' },
    options: {},
    next: 'summary',
  },
  {
    ...box('summary', 'Summary', 8, 0),
    kind: 'message',
    content: text(
      't-summary',
      'Name: {full_name}\nEmail: {email}\nAge: {age}\nPhone: {phone}\nIs everything right?',
      'نام: {full_name}\nایمیل: {email}\nسن: {age}\nتلفن: {phone}\nهمه چیز درست است؟',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-confirm', '✅ Confirm', '✅ تأیید', goTo('save', 'edit'), { look: 'success' })),
      row(inline('b-start-over', '✏️ Start over', '✏️ از اول', goTo('ask-name', 'new'))),
    ),
    options: {},
  },
  {
    ...box('save', 'Save the sign-up', 9, 0),
    note: 'A spreadsheet or the event tool both work; ask the organizer which one they use.',
    kind: 'devStep',
    description:
      "Save the sign-up (name, email, age, phone and the user's Telegram ID) in the list of the event.\n" +
      'When that email is already on the list, take that way.',
    uses: ['var-name', 'var-email', 'var-age', 'var-phone'],
    sets: [],
    outcomes: [
      { id: 'saved', label: 'Saved', goTo: 'signed-up' },
      { id: 'taken', label: 'Already signed up', goTo: 'already' },
    ],
  },
  {
    ...box('signed-up', 'Signed up', 10, 0),
    kind: 'message',
    content: text(
      't-signed-up',
      'You are signed up, {full_name}! 🎉\nWe will send the details to {email}. See you there!',
      '{full_name}، ثبت‌نام شما انجام شد! 🎉\nجزئیات را به {email} می‌فرستیم. آنجا می‌بینیمتان!',
    ),
    keyboard: null,
    options: {},
    next: 'end',
  },
  {
    ...box('already', 'Already signed up', 10, 1),
    kind: 'message',
    content: text(
      't-already',
      '{email} is already signed up. To change something, write to the organizers.',
      '{email} قبلاً ثبت‌نام شده است. برای تغییر چیزی به برگزارکنندگان بنویسید.',
    ),
    keyboard: null,
    options: {},
    next: 'end',
  },
  {
    ...box('too-young', 'Too young', 5, 1),
    kind: 'message',
    content: text(
      't-too-young',
      'Sorry, this event is for people aged 18 or older.',
      'متأسفیم، این رویداد برای افراد ۱۸ سال و بالاتر است.',
    ),
    keyboard: null,
    options: {},
    next: 'end',
  },
  {
    ...box('cancelled', 'Cancelled', 3, 2),
    kind: 'message',
    content: text(
      't-cancelled',
      'The sign-up is cancelled; nothing was saved. Send /start to begin again.',
      'ثبت‌نام لغو شد و چیزی ذخیره نشد. برای شروع دوباره /start را بفرستید.',
    ),
    keyboard: { type: 'removeReply' },
    options: {},
    next: 'end',
  },
  { ...box('end', 'End', 11, 0), kind: 'end' },
]

export const signUpTemplate: Design = {
  formatVersion: 1,
  id: 'template-sign-up',
  name: 'Sign-up form',
  languages: { default: 'en', list: ['en', 'fa'] },
  bot: {
    name: { en: 'Event sign-up', fa: 'ثبت‌نام رویداد' },
    about: { en: 'Sign up for our event in a minute.', fa: 'در یک دقیقه در رویداد ما ثبت‌نام کنید.' },
    description: {
      en: 'Hi! I sign you up for our event.\nI ask for your name, email, age and phone, and you confirm before anything is saved.',
      fa: 'سلام! من شما را در رویداد ما ثبت‌نام می‌کنم.\nنام، ایمیل، سن و تلفن شما را می‌پرسم و پیش از ذخیره، خودتان تأیید می‌کنید.',
    },
    menuButton: 'commands',
    commandOrder: ['start'],
  },
  steps: byId(steps),
  buttons: byId(buttons),
  variables: byId(variables),
  switches: {},
  parts: {},
  media: {},
}
