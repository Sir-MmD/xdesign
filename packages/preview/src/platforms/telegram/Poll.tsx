import { type ReactNode, useMemo, useState } from 'react'
import { buildSegments } from './entities'
import type { TgPoll } from './model'
import { Segments } from './parts'
import type { PollLabels } from './skins/tokens'
import { pressProps } from './slots'

/** An option's text: a plain text with its emoji drawn as the look draws them. */
function OptionText({ text }: { text: string }) {
  const segments = useMemo(() => buildSegments(text, []), [text])
  return <Segments nodes={segments} />
}

/**
 * A poll or quiz in the bubble (MSG-03, sendPoll), drawn as the apps draw it (PollTokens,
 * poll.css; calibrate: O-02): the question, the type line ("Anonymous Poll", "Quiz"), each option
 * with its round mark and a line under it, and the footer ("No votes", or "Vote" for several
 * answers). A quiz's right options show their mark in the right color where `right` is given (the
 * editor's phone). Voted, each option shows its share of the votes (the tester's one vote) and its
 * bar, a quiz its right and wrong options, the footer the count or "View Results" (a public poll).
 * `option` draws an option's text in place of the read-only one (the editor); `onVote` makes the
 * options act (Try it): one press votes, or with several answers presses pick and "Vote" votes.
 */
export function Poll({
  poll,
  question,
  labels,
  option,
  onVote,
}: {
  poll: TgPoll
  question: ReactNode
  labels: PollLabels
  option?: ((index: number, shown: ReactNode) => ReactNode) | undefined
  onVote?: ((options: number[]) => void) | undefined
}) {
  const [picked, setPicked] = useState<readonly number[]>([])
  const vote = poll.vote
  const right = poll.right ?? []
  let type = poll.anonymous ? labels.anonymous : labels.public
  if (poll.quiz) type = poll.anonymous ? labels.anonymousQuiz : labels.quiz
  const pick = (index: number) => {
    if (!onVote) return
    if (!poll.multiple) {
      onVote([index])
      return
    }
    setPicked((now) => (now.includes(index) ? now.filter((one) => one !== index) : [...now, index]))
  }
  let footer: ReactNode
  if (vote) {
    if (!poll.anonymous && !poll.quiz) footer = <span className="tg-poll-action">{labels.results}</span>
    else footer = poll.quiz ? labels.answers(1) : labels.votes(1)
  } else if (poll.multiple) {
    const ready = onVote !== undefined && picked.length > 0
    footer = (
      <span
        className={ready ? 'tg-poll-action' : 'tg-poll-action off'}
        {...pressProps(
          ready
            ? () => {
                onVote([...picked].sort((a, b) => a - b))
                setPicked([])
              }
            : undefined,
        )}
      >
        {labels.vote}
      </span>
    )
  } else footer = poll.quiz ? labels.noAnswers : labels.noVotes
  return (
    <div className={vote ? 'tg-poll voted' : 'tg-poll'} data-multiple={poll.multiple}>
      <div className="tg-poll-question">{question}</div>
      <div className="tg-poll-type">{type}</div>
      <div className="tg-poll-options">
        {poll.options.map((text, index) => {
          const chosen = vote?.includes(index) === true
          // right, wrong (a quiz's chosen wrong option), chosen (a poll's), picked (before "Vote").
          let state: string | undefined
          if (poll.quiz && right.includes(index)) state = 'right'
          else if (poll.quiz && chosen) state = 'wrong'
          else if (chosen) state = 'chosen'
          else if (!vote && picked.includes(index)) state = 'picked'
          const shown = <OptionText text={text} />
          return (
            <div
              key={index}
              className="tg-poll-option"
              data-state={state}
              {...pressProps(
                vote || !onVote
                  ? undefined
                  : () => {
                      pick(index)
                    },
              )}
            >
              {vote ? (
                <span className="tg-poll-percent">{chosen ? '100%' : '0%'}</span>
              ) : (
                <span className="tg-poll-mark" />
              )}
              <span className="tg-poll-text">{option ? option(index, shown) : shown}</span>
              {vote ? (
                <span className="tg-poll-result">
                  {state ? <span className="tg-poll-tick" /> : null}
                  <span className="tg-poll-bar" style={{ width: chosen ? '100%' : '0%' }} />
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="tg-poll-footer">{footer}</div>
    </div>
  )
}
