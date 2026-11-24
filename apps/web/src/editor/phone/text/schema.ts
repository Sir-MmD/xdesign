// The text editor's TipTap schema (docs/plan/03 section 5.1, 04 section 5.2): exactly SPEC-01's
// RICH_NODES and RICH_MARKS, so what TipTap writes into a text's Y.XmlFragment is what SPEC-04
// reads. Each node and mark draws itself with the preview's classes (Telegram's look inside the
// bubble, preview.css), and parses Telegram's HTML and its own, so pasting keeps only these
// (everything else becomes plain text).
import { Extension, Mark, mergeAttributes, Node } from '@tiptap/core'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Bold } from '@tiptap/extension-bold'
import { Code } from '@tiptap/extension-code'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Document } from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Italic } from '@tiptap/extension-italic'
import { Link } from '@tiptap/extension-link'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Strike } from '@tiptap/extension-strike'
import { Text } from '@tiptap/extension-text'
import { Underline } from '@tiptap/extension-underline'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { RICH_MARKS, RICH_NODES } from '@xdesign/spec'

import { CodeBlockView, PartView, QuoteView, VariableView } from './views'

/** What the editor's nodes write as plain text (copying, the clipboard): a variable's and a part's. */
export interface TextNames {
  /** A variable's `{idName}`. */
  variable: (id: string) => string
  /** A text part's plain text in the language shown. */
  part: (id: string) => string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spoiler: { toggleSpoiler: () => ReturnType }
    dateTime: {
      setDateTime: (attrs: { unix: number; format: string }) => ReturnType
      unsetDateTime: () => ReturnType
    }
  }
}

/** Each paragraph takes its own direction, like Telegram (`dir="auto"`, not stored). */
const TelegramParagraph = Paragraph.extend({
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { dir: 'auto' }), 0]
  },
})

/**
 * Telegram's spoiler. The bubble hides its text under dots (preview.css); the editor draws the dots
 * itself (editor.css), showing the text while the editor has the focus.
 */
const Spoiler = Mark.create({
  name: RICH_MARKS.spoiler,
  parseHTML() {
    return [{ tag: 'tg-spoiler' }, { tag: 'span.tg-spoiler' }]
  },
  renderHTML() {
    return ['span', { class: 'tg-spoiler shown xd-spoiler' }, 0]
  },
  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    }
  },
  addKeyboardShortcuts() {
    // Telegram Desktop's shortcut.
    return { 'Mod-Shift-p': () => this.editor.commands.toggleSpoiler() }
  },
})

/**
 * Telegram's date_time entity (Bot API 9.5) over the text apps that cannot draw dates show: the
 * time as a Unix timestamp and its format. The editor shows the text in the link color, as the
 * bubble does for a date without a format.
 */
const DateTime = Mark.create({
  name: RICH_MARKS.dateTime,
  inclusive: false,
  addAttributes() {
    return {
      unix: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('unix') ?? element.getAttribute('data-unix') ?? 0) || 0,
        renderHTML: (attrs: { unix?: number }) => ({ 'data-unix': String(attrs.unix ?? 0) }),
      },
      format: {
        default: '',
        parseHTML: (element) => element.getAttribute('format') ?? element.getAttribute('data-format') ?? '',
        renderHTML: (attrs: { format?: string }) => ({ 'data-format': attrs.format ?? '' }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'tg-time[unix]' }, { tag: 'span[data-unix]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'tg-link tg-date' }), 0]
  },
  addCommands() {
    return {
      setDateTime:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetDateTime:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})

/** A link keeps only its address (Telegram's text_link); it opens nothing while editing. */
const TelegramLink = Link.extend({
  addAttributes() {
    return { href: { default: null, parseHTML: (element) => element.getAttribute('href') } }
  },
}).configure({
  openOnClick: false,
  autolink: false,
  HTMLAttributes: { class: 'tg-link', 'data-link': 'text', target: null, rel: null },
})

/** A code block, drawn as the look draws one (the preview's TelegramCodeBlock). */
const TelegramCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, { contentDOMElementTag: 'span' })
  },
}).configure({ languageClassPrefix: 'language-', exitOnTripleEnter: true, exitOnArrowDown: true })

/** A quote holds paragraphs only; `expandable` is Telegram's expandable_blockquote. */
const TelegramQuote = Blockquote.extend({
  content: `${RICH_NODES.paragraph}+`,
  addAttributes() {
    return {
      expandable: {
        default: false,
        parseHTML: (element) => element.hasAttribute('expandable'),
        renderHTML: (attrs: { expandable?: boolean }) => (attrs.expandable ? { expandable: '' } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuoteView)
  },
})

/** A variable, a chip with its `{idName}`. */
function variableNode(names: TextNames) {
  return Node.create({
    name: RICH_NODES.variable,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        var: {
          default: '',
          parseHTML: (element) => element.getAttribute('data-variable') ?? '',
          renderHTML: (attrs: { var?: string }) => ({ 'data-variable': attrs.var ?? '' }),
        },
      }
    },
    parseHTML() {
      return [{ tag: 'span[data-variable]' }]
    },
    renderHTML({ node, HTMLAttributes }) {
      return ['span', mergeAttributes(HTMLAttributes, { class: 'xd-chip' }), names.variable(String(node.attrs.var))]
    },
    renderText({ node }) {
      return names.variable(String(node.attrs.var))
    },
    addNodeView() {
      return ReactNodeViewRenderer(VariableView, { as: 'span' })
    },
  })
}

/** A custom emoji: its fallback emoji, underlined as the bubble shows one it cannot draw. */
const CustomEmoji = Node.create({
  name: RICH_NODES.customEmoji,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (element) => element.getAttribute('emoji-id') ?? element.getAttribute('data-custom-emoji') ?? '',
        renderHTML: (attrs: { id?: string }) => ({ 'data-custom-emoji': attrs.id ?? '' }),
      },
      fallback: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-fallback') ?? element.textContent,
        renderHTML: (attrs: { fallback?: string }) => ({ 'data-fallback': attrs.fallback ?? '' }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'tg-emoji[emoji-id]' }, { tag: 'span[data-custom-emoji]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { class: 'tg-custom-emoji', title: 'Custom emoji' }),
      String(node.attrs.fallback),
    ]
  },
  renderText({ node }) {
    return String(node.attrs.fallback)
  },
})

/** A text part placed in the text: its text, read-only here (the part editor changes it). */
function partNode(names: TextNames) {
  return Node.create({
    name: RICH_NODES.part,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    addAttributes() {
      return {
        part: {
          default: '',
          parseHTML: (element) => element.getAttribute('data-part') ?? '',
          renderHTML: (attrs: { part?: string }) => ({ 'data-part': attrs.part ?? '' }),
        },
      }
    },
    parseHTML() {
      return [{ tag: 'span[data-part]' }]
    },
    renderHTML({ node, HTMLAttributes }) {
      return ['span', mergeAttributes(HTMLAttributes, { class: 'xd-chip' }), names.part(String(node.attrs.part))]
    },
    renderText({ node }) {
      return names.part(String(node.attrs.part))
    },
    addNodeView() {
      return ReactNodeViewRenderer(PartView, { as: 'span' })
    },
  })
}

/**
 * The info row's room at the end of the last paragraph (PRV-02's risk): the bubble keeps it with a
 * float after the text (`.tg-meta-spacer`), which would drop under a block editor and add a line.
 * A widget at the text's end copies that spacer and the spacer itself is hidden while it does; after
 * a closing quote or code block, or on its own line, the bubble's spacer stays, as in the bubble.
 */
const MetaRoom = Extension.create({
  name: 'metaRoom',
  addProseMirrorPlugins() {
    const room = document.createElement('span')
    room.setAttribute('aria-hidden', 'true')
    room.style.display = 'none'
    const key = new PluginKey<DecorationSet>('metaRoom')
    let hidden: HTMLElement | null = null
    let placed = false
    // Only real changes, so the observer below does not wake itself.
    const show = (element: HTMLElement, shown: boolean) => {
      const display = shown ? '' : 'none'
      if (element.style.display !== display) element.style.display = display
    }
    const sync = (view: EditorView) => {
      const source = view.dom.closest('.tg-text')?.querySelector<HTMLElement>(':scope > .tg-meta-spacer') ?? null
      if (hidden && hidden !== source) show(hidden, true)
      hidden = null
      if (placed && source && !source.classList.contains('own-line')) {
        if (room.className !== source.className) room.className = source.className
        if (room.innerHTML !== source.innerHTML) room.innerHTML = source.innerHTML
        show(room, true)
        show(source, false)
        hidden = source
      } else {
        show(room, false)
        if (source) show(source, true)
      }
    }
    return [
      new Plugin({
        key,
        props: {
          decorations: (state) => {
            const last = state.doc.lastChild
            placed = last?.type.name === RICH_NODES.paragraph
            if (!placed) return DecorationSet.empty
            return DecorationSet.create(state.doc, [
              Decoration.widget(state.doc.content.size - 1, room, { side: 1, key: 'metaRoom', ignoreSelection: true }),
            ])
          },
        },
        view: (view) => {
          // The bubble's spacer changes without the text (the time, its own line after right to left).
          let observer: MutationObserver | null = null
          const frame = requestAnimationFrame(() => {
            const text = view.dom.closest('.tg-text')
            sync(view)
            if (!text) return
            observer = new MutationObserver(() => {
              sync(view)
            })
            observer.observe(text, { childList: true, subtree: true, attributes: true, characterData: true })
          })
          return {
            update: () => {
              sync(view)
            },
            destroy: () => {
              cancelAnimationFrame(frame)
              observer?.disconnect()
              if (hidden) show(hidden, true)
              hidden = null
            },
          }
        },
      }),
    ]
  },
})

/** The schema's extensions, without the collaboration and the editor's own behaviour (PhoneText.tsx). */
export function richExtensions(names: TextNames) {
  return [
    Document,
    TelegramParagraph,
    Text,
    HardBreak,
    Bold.configure({ HTMLAttributes: { class: 'tg-bold' } }),
    Italic,
    Underline,
    Strike,
    Spoiler,
    Code.configure({ HTMLAttributes: { class: 'tg-code' } }),
    TelegramLink,
    DateTime,
    TelegramCodeBlock,
    TelegramQuote,
    variableNode(names),
    CustomEmoji,
    partNode(names),
    MetaRoom,
  ]
}
