import type { ReactNode } from 'react'
import type { PreviewOptions } from '../../core/types'
import { EyeIcon } from './parts'
import type { SkinTokens } from './skins/tokens'

/**
 * The info row (10 section 8.9): views with the eye, the signature and the time, at the
 * bubble's bottom-right corner (bottom-left with `left`: Web A in a message that starts
 * right to left); over media without text it sits on a dark pill, under big emoji (`big`) on
 * the look's pill. The look writes it its app's way (SkinTokens.meta, 29 section 8.6): the count
 * in the app's form, and the parts apart (Web A), the signature joined to the time ("Jane,
 * 3:05 PM") or everything in one text after the eye ("1.2K Jane, 3:05 PM", iOS).
 */
export function Meta({
  views,
  time,
  signature,
  skin,
  options,
  overlay = false,
  left = false,
  big = false,
}: {
  views: number
  time: string
  signature?: string | undefined
  skin: SkinTokens
  options: PreviewOptions
  overlay?: boolean
  left?: boolean
  big?: boolean
}) {
  const count = options.views ? skin.meta.views(views) : undefined
  const sign = signature ? signature.slice(0, 16) : undefined
  let content: ReactNode
  if (skin.meta.form === 'string') {
    const text = [count, sign === undefined ? undefined : `${sign},`, time].filter((part) => part !== undefined)
    content = (
      <>
        {count === undefined ? null : <EyeIcon className="before-count" src={skin.icons.views} />}
        <span className="tg-meta-time">{text.join(' ')}</span>
      </>
    )
  } else {
    const counter =
      count === undefined ? null : skin.meta.viewsFirst ? (
        <>
          <span className="tg-meta-count first">{count}</span>
          <EyeIcon className="after-count" src={skin.icons.views} />
        </>
      ) : (
        <>
          <EyeIcon className="before-count" src={skin.icons.views} />
          <span className="tg-meta-count last">{count}</span>
        </>
      )
    content = (
      <>
        {counter}
        {sign === undefined ? null : skin.meta.form === 'joined' ? (
          <>
            <span className="tg-meta-signature joined">{sign}</span>
            {', '}
          </>
        ) : (
          <span className="tg-meta-signature">{sign}</span>
        )}
        <span className="tg-meta-time">{time}</span>
      </>
    )
  }
  const className = big ? 'tg-meta overlay big' : overlay ? 'tg-meta overlay' : left ? 'tg-meta left' : 'tg-meta'
  return (
    <span className={className} aria-hidden>
      {content}
    </span>
  )
}

/**
 * Keeps room for the info row at the end of the last line: an invisible copy, floated
 * right like Web A's info row in text (left with `left`), so a last line that ends on the
 * other side makes room too; it moves under the text when the last line is too long, as
 * in Telegram. `ownLine` puts it under the text in any case (the apps after right-to-left
 * text, bidi.ts).
 */
export function MetaSpacer({ ownLine = false, ...props }: Parameters<typeof Meta>[0] & { ownLine?: boolean }) {
  const className = ownLine ? 'tg-meta-spacer own-line' : props.left ? 'tg-meta-spacer left' : 'tg-meta-spacer'
  return (
    <span className={className} aria-hidden>
      <Meta {...props} />
    </span>
  )
}
