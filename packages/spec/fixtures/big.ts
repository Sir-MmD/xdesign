// The 300-step design of make spec-check (SPEC-06): a tree of menus grown breadth first from
// /start, each menu a text message with three buttons, with a question and an If box in every ten
// steps, in English and Persian. It shows that the checks and the export stay fast on a large
// design; the arrows still open when it is full go back to the first menu.
import type {
  Button,
  ButtonId,
  Design,
  IfCase,
  IfStep,
  InlineButton,
  QuestionStep,
  StartStep,
  Step,
  StepId,
  Variable,
} from '../src/index.ts'
import { builtinVariables, byId, idNames, sayer } from './build.ts'

const STEPS = 300

export const big: Design = bigDesign(STEPS)

function bigDesign(count: number): Design {
  const idName = idNames()
  const variables = builtinVariables()
  const say = sayer(variables)
  const steps: Step[] = []
  const buttons: Button[] = []
  // The arrows still to draw, breadth first, with the depth of the step they will point to.
  const open: { draw: (target: StepId) => void; depth: number }[] = []
  // How many steps each depth (column of the map) has so far.
  const rows: number[] = []
  const place = (depth: number) => {
    const row = rows[depth] ?? 0
    rows[depth] = row + 1
    return { x: depth * 320, y: row * 240 }
  }

  const start: StartStep = {
    id: 's0',
    idName: idName('/start'),
    title: '/start',
    ...place(0),
    kind: 'start',
    trigger: { type: 'command', command: 'start', inMenu: true, menuDescription: { en: 'Start', fa: 'شروع' } },
  }
  steps.push(start)
  open.push({
    draw: (target) => {
      start.next = target
    },
    depth: 1,
  })

  // The variable of the last question, for the next If box.
  let answer: Variable | undefined
  for (let n = 1; steps.length < count; n++) {
    const arrow = open.shift()
    if (arrow === undefined) break
    const id = `s${String(n)}`
    const { depth } = arrow
    arrow.draw(id)
    if (n % 10 === 4) {
      answer = {
        id: `v${String(n)}`,
        idName: idName(`Answer ${String(n)}`, '', 'var_'),
        label: `Answer ${String(n)}`,
        type: 'text',
        source: 'question',
      }
      variables.push(answer)
      const question: QuestionStep = {
        id,
        idName: idName(`Question ${String(n)}`),
        title: `Question ${String(n)}`,
        ...place(depth),
        kind: 'question',
        prompt: {
          content: {
            type: 'text',
            text: say(`t${String(n)}`, {
              en: `Question ${String(n)}: what would you like, {first_name}?`,
              fa: `پرسش ${String(n)}: چه می‌خواهید، {first_name}؟`,
            }),
          },
          keyboard: null,
          options: {},
        },
        expects: 'text',
        checks: { maxLength: 200 },
        saveTo: answer.id,
        wrongAnswer: {
          message: say(`t${String(n)}w`, { en: 'Please answer in a few words.', fa: 'لطفاً در چند کلمه پاسخ دهید.' }),
        },
      }
      steps.push(question)
      open.push({
        draw: (target) => {
          question.next = target
        },
        depth: depth + 1,
      })
    } else if (n % 10 === 7 && answer !== undefined) {
      const answered: IfCase = { id: 'answered', label: 'Answered', when: { all: [{ var: answer.id, op: 'isSet' }] } }
      const box: IfStep = {
        id,
        idName: idName(`Check ${String(n)}`),
        title: `Check ${String(n)}`,
        ...place(depth),
        kind: 'if',
        cases: [answered],
      }
      steps.push(box)
      open.push({
        draw: (target) => {
          answered.goTo = target
        },
        depth: depth + 1,
      })
      open.push({
        draw: (target) => {
          box.otherwise = target
        },
        depth: depth + 1,
      })
    } else {
      const ids: ButtonId[] = []
      for (let k = 1; k <= 3; k++) {
        const button: InlineButton = {
          id: `b${String(n)}_${String(k)}`,
          idName: idName(`Option ${String(n)} ${String(k)}`, 'btn_'),
          label: { en: `Option ${String(n)}.${String(k)}`, fa: `گزینه ${String(n)}.${String(k)}` },
          look: 'default',
          place: 'inline',
          action: { type: 'goTo', show: 'edit' },
        }
        buttons.push(button)
        ids.push(button.id)
        open.push({
          draw: (target) => {
            button.action = { type: 'goTo', target, show: 'edit' }
          },
          depth: depth + 1,
        })
      }
      steps.push({
        id,
        idName: idName(`Menu ${String(n)}`),
        title: `Menu ${String(n)}`,
        ...place(depth),
        kind: 'message',
        content: {
          type: 'text',
          text: say(`t${String(n)}`, {
            en: `Menu ${String(n)}: pick one of the options below.`,
            fa: `منوی ${String(n)}: یکی از گزینه‌های زیر را انتخاب کنید.`,
          }),
        },
        keyboard: {
          type: 'inline',
          rows: [
            { type: 'buttons', ids: ids.slice(0, 2) },
            { type: 'buttons', ids: ids.slice(2) },
          ],
        },
        options: {},
      })
    }
  }
  for (const arrow of open) arrow.draw('s1')

  return {
    formatVersion: 1,
    id: 'big',
    name: 'Big menu',
    languages: { default: 'en', list: ['en', 'fa'] },
    bot: {
      name: { en: 'Big menu bot', fa: 'ربات منوی بزرگ' },
      about: { en: 'A large tree of menus.', fa: 'درختی بزرگ از منوها.' },
      description: { en: 'Pick your way through 300 steps.', fa: 'راه خود را در میان ۳۰۰ گام پیدا کنید.' },
      menuButton: 'commands',
      commandOrder: ['s0'],
    },
    steps: byId(steps),
    buttons: byId(buttons),
    variables: byId(variables),
    switches: {},
    parts: {},
    media: {},
  }
}
