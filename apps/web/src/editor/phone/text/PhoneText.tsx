// The text in the phone's bubble, editable in place (docs/plan/04 section 5.2, PRV-02's `text`
// slot): a TipTap editor per text and language bound to SPEC-04's Y.XmlFragment (Collaboration),
// with the other people's carets from the awareness, Ctrl+Z in the person's one undo history
// (README.md), paste limited to the schema (Telegram HTML through SPEC-02's fromTelegramHtml), and
// "Not translated" for a language without its text yet, and text parts dropped from the palette
// (PARTS-01). It draws inside the preview's shadow root: editor.css is adopted there, the toolbar
// goes to the page (TextToolbar.tsx).
import { Extension } from '@tiptap/core'
import { Collaboration } from '@tiptap/extension-collaboration'
import { Slice } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { EditorContent, useEditor as useTiptap } from '@tiptap/react'
import { yCursorPlugin, ySyncPluginKey } from '@tiptap/y-tiptap'
import { type Design, fromTelegram, fromTelegramHtml, plainText, type RichDoc, type RichText } from '@xdesign/spec'
import { type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

import { languageName } from '@/lib/languages'

import { useDesign, useEditor, useLang } from '../../context'
import { dropTextPart } from '../../parts/drop'
import { useSelectionStore } from '../../selection'
import css from './editor.css?inline'
import { richExtensions, type TextNames } from './schema'
import { TextToolbar } from './TextToolbar'

let sheet: CSSStyleSheet | null = null

/** Adopts editor.css into the shadow root the element is in (the preview's, PreviewFrame). */
function adoptSheet(element: HTMLElement | null): void {
  const root = element?.getRootNode()
  if (!(root instanceof ShadowRoot)) return
  if (!sheet) {
    sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
  }
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
}

/** The names the editor's nodes write as plain text, from the design shown. */
class DesignNames implements TextNames {
  private design: Design
  private lang: string

  constructor(design: Design, lang: string) {
    this.design = design
    this.lang = lang
  }

  read(design: Design, lang: string): void {
    this.design = design
    this.lang = lang
  }

  variable = (id: string): string => `{${this.design.variables[id]?.idName ?? '?'}}`

  part = (id: string): string => {
    const part = this.design.parts[id]
    if (part?.kind !== 'text') return ''
    const doc = part.text.doc[this.lang] ?? part.text.doc[this.design.languages.default]
    return doc ? plainText(doc, (varId) => this.design.variables[varId]?.idName ?? '?') : ''
  }

  /** The variable an ID name in a pasted `{name}` stands for. */
  variableId = (idName: string): string | undefined =>
    Object.values(this.design.variables).find((variable) => variable.idName === idName)?.id
}

// Tags of Telegram HTML (parse_mode HTML) in pasted plain text, and `{name}` placeholders.
const telegramTag =
  /<\/?(?:b|strong|i|em|u|ins|s|strike|del|code|pre|a|blockquote|tg-spoiler|tg-emoji|tg-time|span)\b[^>]*>/i
const placeholder = /\{([a-z0-9_]+)\}/gi

/**
 * Plain text pasted outside a code block: Telegram HTML through fromTelegramHtml, a text with known
 * `{name}` variables through fromTelegram; anything else is left to ProseMirror (null).
 */
function pastedDoc(text: string, names: DesignNames): RichDoc | null {
  const variable = names.variableId
  if (telegramTag.test(text)) return fromTelegramHtml(text, { variable })
  for (const match of text.matchAll(placeholder)) {
    if (match[1] !== undefined && names.variableId(match[1]) !== undefined) return fromTelegram({ text }, { variable })
  }
  return null
}

/** Ctrl+Z and Ctrl+Shift+Z or Ctrl+Y in the text use the person's one undo history (README.md). */
const SharedUndo = Extension.create<{ undoManager: Y.UndoManager | null }>({
  name: 'sharedUndo',
  // Before Collaboration's own keys (priority 1000).
  priority: 1100,
  addOptions() {
    return { undoManager: null }
  },
  onCreate() {
    // TipTap's changes carry y-tiptap's origin: the person's undo manager tracks it too.
    this.options.undoManager?.trackedOrigins.add(ySyncPluginKey)
  },
  addKeyboardShortcuts() {
    const undo = () => {
      this.options.undoManager?.undo()
      return true
    }
    const redo = () => {
      this.options.undoManager?.redo()
      return true
    }
    return { 'Mod-z': undo, 'Shift-Mod-z': redo, 'Mod-y': redo }
  },
})

/** A caret of another person: a line in their color with their name over it. */
function caretOf(user: { name: string; color: string }): HTMLElement {
  const caret = document.createElement('span')
  caret.className = 'xd-caret'
  caret.style.borderColor = user.color
  const label = document.createElement('span')
  label.className = 'xd-caret-label'
  label.style.backgroundColor = user.color
  label.textContent = user.name
  caret.append(label)
  return caret
}

/**
 * The other people's carets and selections in this text (y-tiptap's cursor plugin). Their place
 * goes in the awareness field `caret`: `cursor` is the map pointer (live.ts, MAP-02).
 */
const Carets = Extension.create<{ awareness: Awareness | null }>({
  name: 'carets',
  addOptions() {
    return { awareness: null }
  },
  addProseMirrorPlugins() {
    const { awareness } = this.options
    if (!awareness) return []
    return [
      yCursorPlugin(
        awareness,
        {
          cursorBuilder: caretOf,
          selectionBuilder: (user: { color: string }) => ({ style: `background-color: ${user.color}40` }),
        },
        'caret',
      ),
    ]
  },
})

/**
 * The phone's text slot for one rich text: the editor, or the default language's text greyed with
 * "Not translated: click to write the <language> text" when the language shown has none yet.
 * `plain`: without the formatting toolbar (a poll's question); `gift`: with only the formatting a
 * gift's text keeps (EVT-02).
 */
export function PhoneText({
  textId,
  doc,
  shown,
  plain = false,
  gift = false,
}: {
  textId: string
  doc: RichText
  shown: ReactNode
  plain?: boolean
  gift?: boolean
}) {
  const design = useDesign()
  const lang = useLang()
  const [writing, setWriting] = useState<string | null>(null)
  const key = `${textId}:${lang}`
  const fallback = design.languages.default
  const untranslated = lang !== fallback && doc[lang] === undefined && doc[fallback] !== undefined && writing !== key
  const write = () => {
    setWriting(key)
  }
  return (
    <div ref={adoptSheet} className="xd-text">
      {untranslated ? (
        <span
          className="xd-untranslated"
          role="button"
          tabIndex={0}
          onClick={write}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              write()
            }
          }}
        >
          <span className="xd-untranslated-note">Not translated: click to write the {languageName(lang)} text</span>
          <span className="xd-untranslated-text">{shown}</span>
        </span>
      ) : (
        <TextEditor key={key} textId={textId} lang={lang} focus={writing === key} plain={plain} gift={gift} />
      )}
    </div>
  )
}

/**
 * The same editor for a rich text in a given language, in a text slot of another bubble (the
 * Texts tab's popover, LANG-01); the caret goes to the end.
 */
export function SlotTextEditor({ textId, lang }: { textId: string; lang: string }) {
  return (
    <div ref={adoptSheet} className="xd-text">
      <TextEditor textId={textId} lang={lang} focus />
    </div>
  )
}

function TextEditor({
  textId,
  lang,
  focus,
  plain = false,
  gift = false,
}: {
  textId: string
  lang: string
  focus: boolean
  plain?: boolean
  gift?: boolean
}) {
  const design = useDesign()
  const { edits, live, undoManager } = useEditor()
  const selection = useSelectionStore()
  const awareness = useSyncExternalStore(live.subscribe, () => live.getState().awareness)
  // The language's fragment; SPEC-04 creates it when it is missing (a language without the text yet).
  const fragment = useMemo(() => edits.texts.fragment(textId, lang), [edits, textId, lang])
  const [names] = useState(() => new DesignNames(design, lang))
  useEffect(() => {
    names.read(design, lang)
  }, [names, design, lang])

  const extensions = useMemo(
    () => [
      ...richExtensions(names),
      Collaboration.configure({ fragment }),
      Carets.configure({ awareness }),
      SharedUndo.configure({ undoManager }),
    ],
    [names, fragment, awareness, undoManager],
  )
  const editor = useTiptap(
    {
      extensions,
      injectCSS: false,
      autofocus: focus ? 'end' : false,
      editorProps: {
        attributes: { 'aria-label': 'Message text', spellcheck: 'true' },
        handleDOMEvents: {
          // Keys typed here are the text's: the editor's shortcuts (undo, the map's keys) listen on
          // the window and cannot see into the phone's shadow root, so they never get them.
          keydown: (_view, event) => {
            event.stopPropagation()
            return false
          },
        },
        handleDrop: (view: EditorView, event: DragEvent) => dropTextPart(view, event, textId),
        handlePaste: (view: EditorView, event: ClipboardEvent) => {
          const data = event.clipboardData
          if (!data || data.types.includes('text/html')) return false
          if (view.state.selection.$from.parent.type.spec.code) return false
          const doc = pastedDoc(data.getData('text/plain'), names)
          if (!doc) return false
          try {
            const node = view.state.schema.nodeFromJSON(doc)
            view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(node.content)).scrollIntoView())
          } catch {
            return false
          }
          return true
        },
      },
      onFocus: () => {
        live.setPresence({ text: { id: textId, lang } })
        selection.set({ text: textId })
      },
      onBlur: () => {
        live.setPresence({ text: null })
        selection.set({ text: null })
      },
    },
    [extensions],
  )
  // Typing in it no longer counts once it is gone.
  useEffect(
    () => () => {
      if (selection.get().text === textId) {
        live.setPresence({ text: null })
        selection.set({ text: null })
      }
    },
    [live, selection, textId],
  )

  return (
    <>
      <EditorContent editor={editor} />
      {plain ? null : <TextToolbar editor={editor} gift={gift} />}
    </>
  )
}
