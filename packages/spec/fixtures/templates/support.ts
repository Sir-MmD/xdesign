// The starter template "Support desk" (TPL-01, docs/plan/04 section 15): the main menu, common
// questions with their answers, office hours, a ticket (two questions, then a developer step that
// opens it in the help desk, with a way for when it fails), a fallback for anything typed, and a
// broadcast for the team's news.
import type { Content, Design, Step, TextId, Variable } from '../../src/index.ts'
import { builtinVariables, byId, sayer } from '../build.ts'
import { goTo, inlineKeyboard, row, templateKit } from './kit.ts'

const { buttons, variable, inline, bottom, box } = templateKit()

const variables: Variable[] = [
  ...builtinVariables(),
  variable('var-topic', 'Topic', 'text', 'question', 'Payment'),
  variable('var-problem', 'Problem', 'text', 'question', 'I cannot sign in since yesterday.'),
  variable('var-ticket', 'Ticket number', 'text', 'devStep', 'T-1024'),
]

const say = sayer(variables)
const text = (id: TextId, en: string, fa: string): Content => ({ type: 'text', text: say(id, { en, fa }) })

const steps: Step[] = [
  // Start points.
  {
    ...box('start', '/start', 0, 0),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'start',
      inMenu: true,
      menuDescription: { en: 'Open the main menu', fa: 'باز کردن منوی اصلی' },
    },
    next: 'menu',
  },
  {
    ...box('ticket-start', '/ticket', 0, 3),
    kind: 'start',
    trigger: {
      type: 'command',
      command: 'ticket',
      inMenu: true,
      menuDescription: { en: 'Write to support', fa: 'نوشتن به پشتیبانی' },
    },
    next: 'topic',
  },
  {
    ...box('fallback', 'Anything else', 0, 5),
    kind: 'start',
    trigger: { type: 'fallback', accepts: 'any' },
    next: 'not-understood',
  },
  {
    ...box('news-start', 'Service news', 0, 6),
    kind: 'start',
    trigger: { type: 'broadcast', audience: 'everyone', when: 'Whenever the team has news to share' },
    next: 'news',
  },

  // The main menu, the common questions and the office hours.
  {
    ...box('menu', 'Main menu', 1, 0),
    kind: 'message',
    content: text(
      't-menu',
      'Hi {first_name}! 👋\nThis is our support desk. How can we help you today?',
      'سلام {first_name}! 👋\nاینجا میز پشتیبانی ماست. امروز چطور می‌توانیم کمکتان کنیم؟',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-faq', '❓ Common questions', '❓ پرسش‌های رایج', goTo('faq', 'edit'))),
      row(inline('b-write', '✉️ Write to support', '✉️ نوشتن به پشتیبانی', goTo('topic', 'new'), { look: 'primary' })),
      row(inline('b-hours', '🕘 Office hours', '🕘 ساعت پاسخگویی', goTo('hours', 'edit'))),
    ),
    options: {},
  },
  {
    ...box('faq', 'Common questions', 2, 0),
    kind: 'message',
    content: text(
      't-faq',
      'Common questions\nTap a question to see its answer.',
      'پرسش‌های رایج\nروی یک پرسش بزنید تا پاسخش را ببینید.',
    ),
    keyboard: inlineKeyboard(
      row(
        inline('b-faq-password', 'How do I reset my password?', 'رمزم را چطور عوض کنم؟', goTo('faq-password', 'edit')),
      ),
      row(inline('b-faq-order', 'Where is my order?', 'سفارشم کجاست؟', goTo('faq-order', 'edit'))),
      row(inline('b-faq-back', '⬅️ Back', '⬅️ بازگشت', goTo('menu', 'edit'))),
    ),
    options: {},
  },
  {
    ...box('faq-password', 'Reset a password', 3, 0),
    kind: 'message',
    content: text(
      't-faq-password',
      'To reset your password, open the sign-in page, tap "Forgot password" and follow the email we send you.\n' +
        'No email after 10 minutes? Look in your spam folder, or write to us.',
      'برای عوض کردن رمز، صفحه ورود را باز کنید، «رمز را فراموش کرده‌ام» را بزنید و ایمیلی را که می‌فرستیم دنبال کنید.\n' +
        'بعد از ۱۰ دقیقه ایمیلی نیامد؟ پوشه هرزنامه را ببینید یا به ما بنویسید.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-password-back', '⬅️ Other questions', '⬅️ پرسش‌های دیگر', goTo('faq', 'edit'))),
      row(inline('b-password-write', '✉️ Still need help', '✉️ هنوز کمک لازم دارم', goTo('topic', 'new'))),
    ),
    options: {},
  },
  {
    ...box('faq-order', 'Where is my order', 3, 1),
    kind: 'message',
    content: text(
      't-faq-order',
      'Orders ship within 2 working days. The email with your tracking number shows where your order is now.\n' +
        'Not there after 7 days? Write to us with your order number.',
      'سفارش‌ها ظرف ۲ روز کاری فرستاده می‌شوند. ایمیلی که کد رهگیری دارد نشان می‌دهد سفارشتان الان کجاست.\n' +
        'بعد از ۷ روز نرسید؟ با شماره سفارشتان به ما بنویسید.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-order-back', '⬅️ Other questions', '⬅️ پرسش‌های دیگر', goTo('faq', 'edit'))),
      row(inline('b-order-write', '✉️ Still need help', '✉️ هنوز کمک لازم دارم', goTo('topic', 'new'))),
    ),
    options: {},
  },
  {
    ...box('hours', 'Office hours', 2, 1),
    kind: 'message',
    content: text(
      't-hours',
      'We answer Monday to Friday, 9:00 to 18:00.\nWrite to us any time: messages sent at night or on the weekend are answered the next working day.',
      'از دوشنبه تا جمعه، ساعت ۹ تا ۱۸ پاسخ می‌دهیم.\nهر وقت خواستید بنویسید: پیام‌های شب و آخر هفته روز کاری بعد پاسخ می‌گیرند.',
    ),
    keyboard: inlineKeyboard(row(inline('b-hours-back', '⬅️ Back', '⬅️ بازگشت', goTo('menu', 'edit')))),
    options: {},
  },

  // A ticket: the topic, the problem, then the developer opens it in the help desk.
  {
    ...box('topic', 'Topic', 2, 3),
    kind: 'question',
    prompt: {
      content: text(
        't-topic',
        'What is it about? Pick a topic below, or type your own.',
        'موضوع چیست؟ یکی از موضوع‌های زیر را انتخاب کنید یا خودتان بنویسید.',
      ),
      keyboard: {
        type: 'reply',
        rows: [
          row(
            bottom('b-topic-payment', 'Payment', 'پرداخت', { type: 'text' }),
            bottom('b-topic-account', 'Account', 'حساب کاربری', { type: 'text' }),
          ),
          row(bottom('b-topic-other', 'Something else', 'موضوع دیگر', { type: 'text' })),
          row(bottom('b-topic-cancel', 'Cancel', 'انصراف', { type: 'text' })),
        ],
        oneTime: true,
        persistent: false,
        resize: true,
        placeholder: { en: 'The topic', fa: 'موضوع' },
      },
      options: {},
    },
    expects: 'text',
    checks: { minLength: 2, maxLength: 60 },
    saveTo: 'var-topic',
    wrongAnswer: {
      message: say('t-topic-wrong', {
        en: 'Please pick a topic, or name it in a few words.',
        fa: 'لطفاً یک موضوع انتخاب کنید یا در چند کلمه بنویسید.',
      }),
    },
    cancel: { words: { en: 'Cancel', fa: 'انصراف' }, goTo: 'cancelled' },
    next: 'problem',
  },
  {
    ...box('problem', 'Describe the problem', 3, 3),
    kind: 'question',
    prompt: {
      content: text(
        't-problem',
        'Thanks! Now describe the problem in one message: what you did, what happened, and what you expected.',
        'ممنون! حالا مشکل را در یک پیام شرح دهید: چه کردید، چه شد و انتظار چه چیزی را داشتید.',
      ),
      keyboard: { type: 'removeReply' },
      options: {},
    },
    expects: 'text',
    checks: { minLength: 10, maxLength: 2000 },
    saveTo: 'var-problem',
    wrongAnswer: {
      message: say('t-problem-wrong', {
        en: 'Please write a little more, at least 10 characters, so we can help.',
        fa: 'لطفاً کمی بیشتر بنویسید، دست‌کم ۱۰ نویسه، تا بتوانیم کمک کنیم.',
      }),
      maxTries: 3,
      afterMaxTries: 'menu',
    },
    cancel: { words: { en: 'Cancel', fa: 'انصراف' }, goTo: 'cancelled' },
    next: 'open-ticket',
  },
  {
    ...box('open-ticket', 'Open the ticket', 4, 3),
    note: 'Any help desk with an API works; the team reads the tickets in its chat too.',
    kind: 'devStep',
    description:
      "Open a ticket in the help desk with the topic, the problem and the user's name and Telegram ID, " +
      "post it to the support team's chat and set the ticket number.\n" +
      'When the help desk does not answer, take that way.',
    uses: ['var-topic', 'var-problem'],
    sets: ['var-ticket'],
    outcomes: [
      { id: 'opened', label: 'Ticket opened', goTo: 'ticket-opened' },
      { id: 'down', label: 'Help desk down', goTo: 'ticket-failed' },
    ],
  },
  {
    ...box('ticket-opened', 'Ticket opened', 5, 3),
    kind: 'message',
    content: text(
      't-ticket-opened',
      'Thanks, {first_name}! Your ticket {ticket_number} is open.\nWe usually answer within a few hours, right here in this chat.',
      'ممنون {first_name}! تیکت {ticket_number} شما باز شد.\nمعمولاً ظرف چند ساعت همین‌جا پاسخ می‌دهیم.',
    ),
    keyboard: inlineKeyboard(row(inline('b-opened-menu', '🏠 Main menu', '🏠 منوی اصلی', goTo('menu', 'new')))),
    options: {},
  },
  {
    ...box('ticket-failed', 'Ticket failed', 5, 4),
    kind: 'message',
    content: text(
      't-ticket-failed',
      'Sorry, we could not open your ticket just now. Please try again in a few minutes.',
      'متأسفیم، الان نتوانستیم تیکت شما را باز کنیم. لطفاً چند دقیقه دیگر دوباره امتحان کنید.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-failed-retry', '🔁 Try again', '🔁 دوباره امتحان کنید', goTo('topic', 'new'))),
      row(inline('b-failed-menu', '🏠 Main menu', '🏠 منوی اصلی', goTo('menu', 'new'))),
    ),
    options: {},
  },
  {
    ...box('cancelled', 'Cancelled', 3, 4),
    kind: 'message',
    content: text(
      't-cancelled',
      'No problem, nothing was sent. Write to us whenever you need.',
      'اشکالی ندارد، چیزی فرستاده نشد. هر وقت لازم بود به ما بنویسید.',
    ),
    keyboard: { type: 'removeReply' },
    options: {},
    next: 'menu',
  },

  // Anything typed outside a question, and the team's news.
  {
    ...box('not-understood', 'Not understood', 1, 5),
    kind: 'message',
    content: text(
      't-not-understood',
      'I am a bot and did not understand that. Use the buttons below, or write to support and a person will answer.',
      'من یک ربات هستم و این را متوجه نشدم. از دکمه‌های زیر استفاده کنید یا به پشتیبانی بنویسید تا یک نفر پاسخ دهد.',
    ),
    keyboard: inlineKeyboard(
      row(inline('b-not-write', '✉️ Write to support', '✉️ نوشتن به پشتیبانی', goTo('topic', 'new'))),
      row(inline('b-not-menu', '🏠 Main menu', '🏠 منوی اصلی', goTo('menu', 'new'))),
    ),
    options: {},
  },
  {
    ...box('news', 'News', 1, 6),
    kind: 'message',
    content: text(
      't-news',
      '📣 News from the support team\nWrite your news here: a new feature, a holiday, or planned maintenance.',
      '📣 خبری از تیم پشتیبانی\nخبرتان را اینجا بنویسید: یک امکان تازه، یک تعطیلی یا یک تعمیر برنامه‌ریزی‌شده.',
    ),
    keyboard: inlineKeyboard(row(inline('b-news-menu', '🏠 Main menu', '🏠 منوی اصلی', goTo('menu', 'new')))),
    options: {},
  },
]

export const supportTemplate: Design = {
  formatVersion: 1,
  id: 'template-support',
  name: 'Support desk',
  languages: { default: 'en', list: ['en', 'fa'] },
  bot: {
    name: { en: 'Support desk', fa: 'میز پشتیبانی' },
    about: {
      en: 'Answers to common questions, and a direct line to our team.',
      fa: 'پاسخ پرسش‌های رایج و راهی مستقیم به تیم ما.',
    },
    description: {
      en: 'Hi! I am the support desk.\nI answer common questions, tell you our office hours and pass your message to the team.',
      fa: 'سلام! من میز پشتیبانی هستم.\nبه پرسش‌های رایج پاسخ می‌دهم، ساعت پاسخگویی را می‌گویم و پیامتان را به تیم می‌رسانم.',
    },
    menuButton: 'commands',
    commandOrder: ['start', 'ticket-start'],
  },
  steps: byId(steps),
  buttons: byId(buttons),
  variables: byId(variables),
  switches: {},
  parts: {},
  media: {},
}
