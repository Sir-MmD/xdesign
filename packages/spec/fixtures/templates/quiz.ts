// The starter template "Quiz" (TPL-01, docs/plan/04 section 15): three of Telegram's quizzes, each
// saving whether the answer was right ("Save the vote as") and an If after it that adds a point;
// the score picks one of three endings, and "Play again" starts over from zero.
import type { Content, Design, Step, StepId, TextId, Variable } from '../../src/index.ts'
import { builtinVariables, byId, sayer } from '../build.ts'
import { goTo, inlineKeyboard, row, templateKit } from './kit.ts'

const { buttons, variable, inline, box } = templateKit()

const variables: Variable[] = [
  ...builtinVariables(),
  variable('var-score', 'Score', 'number', 'remember', 0),
  variable('var-answer-1', 'Answer 1', 'yesNo', 'question', true),
  variable('var-answer-2', 'Answer 2', 'yesNo', 'question', false),
  variable('var-answer-3', 'Answer 3', 'yesNo', 'question', true),
]

const say = sayer(variables)
const text = (id: TextId, en: string, fa: string): Content => ({ type: 'text', text: say(id, { en, fa }) })

type Words = { en: string; fa: string }

interface Question {
  n: 1 | 2 | 3
  question: Words
  options: Words[]
  // The index of the right option.
  correct: number
  explanation: Words
}

// A quiz that saves whether the answer was right, the If on it, and the point it adds; the next
// question (or the score) comes after either way.
function quizSteps(q: Question, then: StepId): Step[] {
  const n = String(q.n)
  const saved = `var-answer-${n}`
  return [
    {
      ...box(`q${n}`, `Question ${n}`, 2 + 2 * (q.n - 1), 0),
      kind: 'message',
      content: {
        type: 'quiz',
        question: say(`t-q${n}`, q.question),
        options: q.options,
        correct: [q.correct],
        explanation: say(`t-q${n}-why`, q.explanation),
        anonymous: false,
        multiple: false,
        saveTo: saved,
      },
      keyboard: null,
      options: {},
      next: `right-${n}`,
    },
    {
      ...box(`right-${n}`, `Right ${n}?`, 2 + 2 * (q.n - 1), 1),
      kind: 'if',
      cases: [
        { id: 'right', label: 'Right', when: { all: [{ var: saved, op: 'equals', value: true }] }, goTo: `point-${n}` },
      ],
      otherwise: then,
    },
    {
      ...box(`point-${n}`, `Point ${n}`, 3 + 2 * (q.n - 1), 1),
      kind: 'remember',
      actions: [{ var: 'var-score', op: 'add', value: 1 }],
      next: then,
    },
  ]
}

const steps: Step[] = [
  {
    ...box('start', '/start', 0, 0),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'start',
      inMenu: true,
      menuDescription: { en: 'Start the quiz', fa: 'شروع مسابقه' },
    },
    next: 'intro',
  },
  {
    ...box('intro', 'Welcome', 1, 0),
    kind: 'message',
    content: text(
      't-intro',
      'Welcome to the quiz, {first_name}! 🧠\nThree questions, one answer each. Ready?',
      '{first_name}، به مسابقه خوش آمدید! 🧠\nسه پرسش، برای هر کدام یک پاسخ. آماده‌اید؟',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-play', '▶️ Start the quiz', '▶️ شروع مسابقه', goTo('reset', 'new'), { look: 'primary' })),
    ),
    options: {},
  },
  {
    ...box('reset', 'Score to zero', 1, 1),
    kind: 'remember',
    actions: [{ var: 'var-score', op: 'set', value: 0 }],
    next: 'q1',
  },
  ...quizSteps(
    {
      n: 1,
      question: { en: 'Which planet is the largest?', fa: 'بزرگ‌ترین سیاره کدام است؟' },
      options: [
        { en: 'Jupiter', fa: 'مشتری' },
        { en: 'Saturn', fa: 'زحل' },
        { en: 'Earth', fa: 'زمین' },
      ],
      correct: 0,
      explanation: {
        en: 'Jupiter is more than twice as heavy as all the other planets together.',
        fa: 'مشتری از همه سیاره‌های دیگر روی هم بیش از دو برابر سنگین‌تر است.',
      },
    },
    'q2',
  ),
  ...quizSteps(
    {
      n: 2,
      question: { en: 'How many minutes are in a day?', fa: 'یک روز چند دقیقه است؟' },
      options: [
        { en: '1,000', fa: '۱٬۰۰۰' },
        { en: '1,440', fa: '۱٬۴۴۰' },
        { en: '3,600', fa: '۳٬۶۰۰' },
      ],
      correct: 1,
      explanation: { en: '24 hours × 60 minutes = 1,440 minutes.', fa: '۲۴ ساعت × ۶۰ دقیقه = ۱٬۴۴۰ دقیقه.' },
    },
    'q3',
  ),
  ...quizSteps(
    {
      n: 3,
      question: { en: 'Which is the longest river?', fa: 'طولانی‌ترین رود کدام است؟' },
      options: [
        { en: 'The Amazon', fa: 'آمازون' },
        { en: 'The Danube', fa: 'دانوب' },
        { en: 'The Nile', fa: 'نیل' },
      ],
      correct: 2,
      explanation: {
        en: 'The Nile is about 6,650 km long; the Amazon comes close.',
        fa: 'نیل حدود ۶٬۶۵۰ کیلومتر است؛ آمازون نزدیک به آن است.',
      },
    },
    'score',
  ),
  {
    ...box('score', 'Final score', 8, 0),
    kind: 'if',
    cases: [
      { id: 'all', label: 'All right', when: { all: [{ var: 'var-score', op: 'gte', value: 3 }] }, goTo: 'perfect' },
      { id: 'most', label: 'Two right', when: { all: [{ var: 'var-score', op: 'equals', value: 2 }] }, goTo: 'good' },
    ],
    otherwise: 'try-again',
  },
  {
    ...box('perfect', 'All right', 9, 0),
    kind: 'message',
    content: text(
      't-perfect',
      '🏆 {score} of 3: a perfect score, {first_name}!',
      '🏆 {score} از ۳: امتیاز کامل، {first_name}!',
    ),
    keyboard: inlineKeyboard(row(inline('b-perfect-again', '🔁 Play again', '🔁 دوباره بازی', goTo('reset', 'new')))),
    options: { effect: '5046509860389126442' },
  },
  {
    ...box('good', 'Two right', 9, 1),
    kind: 'message',
    content: text(
      't-good',
      '👏 {score} of 3: well done! One more and it is perfect.',
      '👏 {score} از ۳: آفرین! یکی دیگر و کامل است.',
    ),
    keyboard: inlineKeyboard(row(inline('b-good-again', '🔁 Play again', '🔁 دوباره بازی', goTo('reset', 'new')))),
    options: {},
  },
  {
    ...box('try-again', 'Try again', 9, 2),
    kind: 'message',
    content: text(
      't-try-again',
      '🙂 {score} of 3. The answers are under each question; give it another go!',
      '🙂 {score} از ۳. پاسخ‌ها زیر هر پرسش هستند؛ یک بار دیگر امتحان کنید!',
    ),
    keyboard: inlineKeyboard(row(inline('b-try-again', '🔁 Play again', '🔁 دوباره بازی', goTo('reset', 'new')))),
    options: {},
  },
]

export const quizTemplate: Design = {
  formatVersion: 1,
  id: 'template-quiz',
  name: 'Quiz',
  languages: { default: 'en', list: ['en', 'fa'] },
  bot: {
    name: { en: 'Quiz Night', fa: 'شب مسابقه' },
    about: { en: 'A short quiz with a score at the end.', fa: 'یک مسابقه کوتاه با امتیاز در پایان.' },
    description: {
      en: 'Hi! I ask you three questions and tell you your score.\nTap Start to play.',
      fa: 'سلام! سه پرسش از شما می‌پرسم و امتیازتان را می‌گویم.\nبرای بازی «شروع» را بزنید.',
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
