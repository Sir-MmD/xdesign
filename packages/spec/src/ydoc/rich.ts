// Rich texts in Yjs (docs/plan/03-design-model.md sections 3 and 5.1), stored exactly the way
// TipTap's Collaboration stores a document (@tiptap/y-tiptap 3.3.0, prosemirrorJSONToYXmlFragment
// and yXmlFragmentToProsemirrorJSON), so the editor reads what is written here and the other way
// round: a Y.XmlElement per node, named after the node, with its attributes (null ones left out);
// the adjacent text nodes of a node share one Y.XmlText, where each mark is a formatting
// attribute named after the mark holding the mark's attributes (`{}` when it has none). Like
// y-tiptap, marks on the other inline nodes (hard breaks, variables, emoji, parts) are not kept.
// The logic is copied, not imported: y-tiptap pulls in ProseMirror.
import * as Y from 'yjs'

import type { Lang, TextId } from '../model/ids.ts'
import type { RichText } from '../model/texts.ts'
import { RICH_MARKS, RICH_NODES, type RichDoc } from '../text/schema.ts'
import type { YText } from './layout.ts'

// A node of TipTap JSON, of any type.
export type RichJsonNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: RichJsonNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
}

type XmlValue = object | string | number | boolean
type XmlElement = Y.XmlElement<Record<string, XmlValue>>
// Yjs types an element's attributes as strings; TipTap stores any JSON value.
type XmlNode = Y.XmlElement | Y.XmlText

// The attributes the rich text schema keeps (text/schema.ts); TipTap's others (a link's target,
// rel and class) are dropped when a fragment is read. Names outside the schema keep them all.
const nodeAttrs: Partial<Record<string, readonly string[]>> = {
  [RICH_NODES.codeBlock]: ['language'],
  [RICH_NODES.blockquote]: ['expandable'],
  [RICH_NODES.variable]: ['var'],
  [RICH_NODES.customEmoji]: ['id', 'fallback'],
  [RICH_NODES.part]: ['part'],
}
const markAttrs: Partial<Record<string, readonly string[]>> = {
  [RICH_MARKS.link]: ['href'],
  [RICH_MARKS.dateTime]: ['unix', 'format'],
}
const nodeNames = new Set<string>(Object.values(RICH_NODES))
const markNames = new Set<string>(Object.values(RICH_MARKS))

// y-tiptap names a mark that may overlap itself `<name>--<hash>`.
const hashedMarkName = /(.*)(--[a-zA-Z0-9+/=]{8})$/

/** The TipTap document of a fragment (yXmlFragmentToProsemirrorJSON). */
export function fragmentToDoc(fragment: Y.XmlFragment): RichDoc {
  const content = fragment.toArray().flatMap(readNode)
  // The shape is the editor's; readDesign checks it in development builds.
  return { type: RICH_NODES.doc, content } as RichDoc
}

function readNode(item: Y.XmlElement | Y.XmlText | Y.XmlHook): RichJsonNode[] {
  if (item instanceof Y.XmlText) {
    const delta = item.toDelta() as { insert: unknown; attributes?: Record<string, Record<string, unknown>> }[]
    return delta.map((op) => {
      const node: RichJsonNode = { type: RICH_NODES.text, text: typeof op.insert === 'string' ? op.insert : '' }
      if (op.attributes) {
        node.marks = Object.entries(op.attributes).map(([key, value]) => {
          const type = hashedMarkName.exec(key)?.[1] ?? key
          const attrs = pick(value, markNames.has(type) ? (markAttrs[type] ?? []) : undefined)
          return Object.keys(attrs).length > 0 ? { type, attrs } : { type }
        })
      }
      return node
    })
  }
  if (item instanceof Y.XmlElement) {
    const node: RichJsonNode = { type: item.nodeName }
    const attrs = pick(
      item.getAttributes(),
      nodeNames.has(item.nodeName) ? (nodeAttrs[item.nodeName] ?? []) : undefined,
    )
    if (Object.keys(attrs).length > 0) node.attrs = attrs
    const children = item.toArray()
    if (children.length > 0) node.content = children.flatMap(readNode)
    return [node]
  }
  return []
}

// The given keys of an object (all of them without a list).
function pick(object: Record<string, unknown>, keys: readonly string[] | undefined): Record<string, unknown> {
  if (keys === undefined) return { ...object }
  const picked: Record<string, unknown> = {}
  for (const key of keys) {
    if (object[key] !== undefined) picked[key] = object[key]
  }
  return picked
}

/** Replaces the content of a fragment with a TipTap document (prosemirrorJSONToYXmlFragment). */
export function docToFragment(doc: RichDoc, fragment: Y.XmlFragment): void {
  const write = () => {
    fragment.delete(0, fragment.length)
    fragment.insert(0, richNodesToY(doc.content))
  }
  if (fragment.doc) fragment.doc.transact(write)
  else write()
}

/** The Yjs types of a list of nodes: runs of text nodes as one Y.XmlText, others as elements. */
export function richNodesToY(nodes: readonly RichJsonNode[]): XmlNode[] {
  const types: XmlNode[] = []
  let run: RichJsonNode[] = []
  const flush = () => {
    if (run.length > 0) types.push(textToY(run))
    run = []
  }
  for (const node of nodes) {
    if (node.type === RICH_NODES.text) {
      run.push(node)
      continue
    }
    flush()
    types.push(elementToY(node))
  }
  flush()
  return types
}

function elementToY(node: RichJsonNode): XmlNode {
  const element: XmlElement = new Y.XmlElement(node.type)
  for (const [key, value] of Object.entries(node.attrs ?? {})) {
    if (value !== null && value !== undefined) element.setAttribute(key, value)
  }
  const children = richNodesToY(node.content ?? [])
  if (children.length > 0) element.insert(0, children)
  return element as Y.XmlElement
}

function textToY(nodes: readonly RichJsonNode[]): Y.XmlText {
  const text = new Y.XmlText()
  text.applyDelta(
    nodes.map((node) => ({
      insert: node.text ?? '',
      attributes: Object.fromEntries((node.marks ?? []).map((mark) => [mark.type, mark.attrs ?? {}])),
    })),
  )
  return text
}

/** The documents of a rich text; a language whose fragment is still empty is left out. */
export function readRichText(text: YText | undefined): RichText {
  const rich: RichText = {}
  text?.forEach((fragment, lang) => {
    if (fragment instanceof Y.XmlFragment && fragment.length > 0) rich[lang] = fragmentToDoc(fragment)
  })
  return rich
}

/**
 * Adds a rich text with a fragment for every language of the design (so two people never
 * create the same fragment at once) and the documents of `rich` written into them.
 */
export function addRichText(texts: Y.Map<YText>, id: TextId, rich: RichText, languages: readonly Lang[]): void {
  const text = new Y.Map<Y.XmlFragment>()
  texts.set(id, text)
  for (const lang of new Set([...languages, ...Object.keys(rich)])) {
    const fragment = text.set(lang, new Y.XmlFragment())
    const doc = rich[lang]
    if (doc) docToFragment(doc, fragment)
  }
}
