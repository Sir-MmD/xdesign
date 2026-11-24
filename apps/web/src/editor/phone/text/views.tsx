// The text editor's node views (docs/plan/04 section 5.2): code blocks and quotes drawn by the
// preview's own TelegramCodeBlock and TelegramQuote (the look's header, marks and sizes, Q-28), and
// the chips of variables and text parts, which read their names from the design. They render inside
// the bubble, in the preview's shadow root, so their styles are the preview's and editor.css.
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps, useEditorState } from '@tiptap/react'
import { TelegramCodeBlock, TelegramQuote } from '@xdesign/preview'
import { plainText, type RichDoc } from '@xdesign/spec'
import { useEffect, useRef } from 'react'

import { useDesign, useLang } from '../../context'

/** Whether the node opens the text (a look spaces such a block apart). */
function useOpensText({ editor, getPos }: Pick<ReactNodeViewProps, 'editor' | 'getPos'>): boolean {
  return useEditorState({ editor, selector: () => getPos() === 0 })
}

export function CodeBlockView({ node, editor, getPos }: ReactNodeViewProps) {
  const first = useOpensText({ editor, getPos })
  const language =
    typeof node.attrs.language === 'string' && node.attrs.language !== '' ? node.attrs.language : undefined
  // The look's header and copy bar are drawings, not text to type in.
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    box.current?.querySelectorAll<HTMLElement>('.tg-pre-header, .tg-pre-copy-bar').forEach((element) => {
      element.contentEditable = 'false'
    })
  })
  return (
    <NodeViewWrapper>
      <span ref={box}>
        <TelegramCodeBlock language={language} length={node.textContent.length} first={first}>
          <NodeViewContent<'span'> as="span" />
        </TelegramCodeBlock>
      </span>
    </NodeViewWrapper>
  )
}

export function QuoteView({ node, editor, getPos }: ReactNodeViewProps) {
  const first = useOpensText({ editor, getPos })
  return (
    <NodeViewWrapper>
      <TelegramQuote
        collapsed={node.attrs.expandable === true}
        first={first}
        text={node.textBetween(0, node.content.size, '\n')}
        held
      >
        <NodeViewContent />
      </TelegramQuote>
    </NodeViewWrapper>
  )
}

export function VariableView({ node, selected }: ReactNodeViewProps) {
  const design = useDesign()
  const id = String(node.attrs.var)
  const variable = design.variables[id]
  return (
    <NodeViewWrapper
      as="span"
      className={selected ? 'xd-chip selected' : 'xd-chip'}
      title={variable ? variable.label : 'Deleted variable'}
    >
      {`{${variable?.idName ?? '?'}}`}
    </NodeViewWrapper>
  )
}

export function PartView({ node, selected }: ReactNodeViewProps) {
  const design = useDesign()
  const lang = useLang()
  const part = design.parts[String(node.attrs.part)]
  let shown = '?'
  if (part?.kind === 'text') {
    const doc: RichDoc | undefined = part.text.doc[lang] ?? part.text.doc[design.languages.default]
    const text = doc ? plainText(doc, (id) => design.variables[id]?.idName ?? '?') : ''
    shown = text === '' ? part.name : text
  }
  return (
    <NodeViewWrapper
      as="span"
      className={selected ? 'xd-chip selected' : 'xd-chip'}
      title={part?.name ?? 'Deleted part'}
    >
      {shown}
    </NodeViewWrapper>
  )
}
