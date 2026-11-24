// design.md drawn as React elements on the printable page (docs/plan/06 section 5), from the
// blocks of markdown.ts: white paper colors whatever the site's theme, the map's `mermaid` block
// drawn by Mermaid, pictures side by side, and a new printed page before each `##` section.
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import type { Block, Inline } from '@/export/markdown'
import { cn } from '@/lib/utils'

let mermaidLoaded: Promise<(typeof import('mermaid'))['default']> | undefined
let mermaidQueue: Promise<unknown> = Promise.resolve()
let charts = 0

// Mermaid, loaded with the page that needs it. Its limits are raised so the map of a 300-step
// design still draws.
function loadMermaid() {
  mermaidLoaded ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      maxTextSize: 10_000_000,
      maxEdges: 100_000,
    })
    return mermaid
  })
  return mermaidLoaded
}

/** The SVG of a chart; one chart at a time, as Mermaid draws in a shared scratch element. */
function drawChart(code: string): Promise<string> {
  const drawing = mermaidQueue.then(async () => {
    const mermaid = await loadMermaid()
    charts++
    const id = `xd-chart-${String(charts)}`
    try {
      return (await mermaid.render(id, code)).svg
    } finally {
      document.getElementById(id)?.remove()
      document.getElementById(`d${id}`)?.remove()
    }
  })
  mermaidQueue = drawing.catch(() => undefined)
  return drawing
}

function Chart({ code }: { code: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [problem, setProblem] = useState<string>()
  useEffect(() => {
    let gone = false
    drawChart(code).then(
      (svg) => {
        // Mermaid's own output, cleaned by Mermaid ("strict"); the page's scripts stay 'self' only.
        if (!gone && box.current) box.current.innerHTML = svg
      },
      (error: unknown) => {
        if (!gone) setProblem(error instanceof Error ? error.message : String(error))
      },
    )
    return () => {
      gone = true
    }
  }, [code])
  if (problem !== undefined) {
    return (
      <div className="my-3 grid gap-2">
        <p className="text-sm text-red-700">The map could not be drawn: {problem}</p>
        <CodeBlock text={code} />
      </div>
    )
  }
  return <div ref={box} className="my-4 overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" />
}

function CodeBlock({ text }: { text: string }) {
  return (
    <pre
      dir="auto"
      className="my-3 overflow-x-auto rounded-md border border-neutral-300 bg-neutral-50 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
    >
      <code>{text}</code>
    </pre>
  )
}

/** What a picture of design.md shows: its address once made, undefined while it is being made. */
export type PictureSource = (path: string) => string | undefined

function scrollToAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: 'start' })
}

function InlineView({ inlines, picture }: { inlines: readonly Inline[]; picture: PictureSource }) {
  return inlines.map((inline, index): ReactNode => {
    switch (inline.type) {
      case 'text':
        return inline.text
      case 'code':
        return (
          <code key={index} className="rounded bg-neutral-100 px-1 py-px font-mono text-[0.9em]">
            {inline.text}
          </code>
        )
      case 'strong':
        return (
          <strong key={index} className="font-semibold">
            <InlineView inlines={inline.children} picture={picture} />
          </strong>
        )
      case 'link': {
        const anchor = inline.href.startsWith('#') ? inline.href.slice(1) : undefined
        return (
          <a
            key={index}
            href={inline.href}
            className="text-blue-700 underline underline-offset-2"
            {...(anchor === undefined
              ? { target: '_blank', rel: 'noreferrer' }
              : {
                  onClick: (event: MouseEvent) => {
                    event.preventDefault()
                    scrollToAnchor(anchor)
                  },
                })}
          >
            <InlineView inlines={inline.children} picture={picture} />
          </a>
        )
      }
      case 'image': {
        const src = picture(inline.src)
        return (
          <span key={index} className="inline-flex max-w-full break-inside-avoid flex-col items-center gap-1 align-top">
            {src === undefined ? (
              <span className="grid h-60 w-40 place-items-center rounded-md border border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                Making the picture
              </span>
            ) : (
              <img
                src={src}
                alt={inline.alt}
                className="max-h-[560px] w-auto max-w-full rounded-md border border-neutral-200"
              />
            )}
            <span dir="auto" className="text-xs text-neutral-500">
              {inline.alt}
            </span>
          </span>
        )
      }
      case 'break':
        return <br key={index} />
      case 'soft':
        return ' '
    }
  })
}

const headingClass: Record<number, string> = {
  1: 'mb-4 text-3xl font-bold',
  2: 'mt-10 mb-3 border-b border-neutral-300 pb-1 text-2xl font-bold',
  3: 'mt-8 mb-2 text-xl font-semibold',
  4: 'mt-6 mb-2 text-lg font-semibold',
}

/** design.md drawn as HTML; each `##` section after the first starts a new printed page. */
export function MarkdownView({ blocks, picture }: { blocks: readonly Block[]; picture: PictureSource }) {
  let sections = 0
  return blocks.map((block, index) => {
    const key = String(index)
    switch (block.type) {
      case 'heading': {
        const Tag = `h${String(Math.min(block.level, 6))}` as 'h1'
        const pageBreak = block.level === 2 && sections++ > 0
        return (
          <Tag
            key={key}
            id={block.id}
            dir="auto"
            className={cn(
              'scroll-mt-20',
              headingClass[block.level] ?? headingClass[4],
              pageBreak && 'print:break-before-page',
            )}
          >
            <InlineView inlines={block.children} picture={picture} />
          </Tag>
        )
      }
      case 'paragraph': {
        const pictures = block.children.every((inline) => inline.type === 'image' || inline.type === 'soft')
        if (pictures) {
          return (
            <div key={key} className="my-3 flex flex-wrap items-start gap-4">
              <InlineView inlines={block.children.filter((inline) => inline.type !== 'soft')} picture={picture} />
            </div>
          )
        }
        return (
          <p key={key} dir="auto" className="my-3 leading-relaxed">
            <InlineView inlines={block.children} picture={picture} />
          </p>
        )
      }
      case 'list':
        return (
          <ul key={key} className="my-3 list-disc ps-6 leading-relaxed">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} dir="auto">
                <InlineView inlines={item} picture={picture} />
              </li>
            ))}
          </ul>
        )
      case 'quote':
        return (
          <blockquote key={key} className="my-3 border-s-4 border-neutral-300 ps-4 text-neutral-700">
            {block.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex} dir="auto" className="my-1 leading-relaxed">
                <InlineView inlines={paragraph} picture={picture} />
              </p>
            ))}
          </blockquote>
        )
      case 'code':
        return block.info === 'mermaid' ? (
          <Chart key={key} code={block.text} />
        ) : (
          <CodeBlock key={key} text={block.text} />
        )
      case 'table':
        return (
          <div key={key} className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {block.head.map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      dir="auto"
                      className="border border-neutral-300 bg-neutral-100 px-2 py-1 text-start font-semibold"
                    >
                      <InlineView inlines={cell} picture={picture} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="break-inside-avoid">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} dir="auto" className="border border-neutral-300 px-2 py-1 align-top">
                        <InlineView inlines={cell} picture={picture} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
    }
  })
}
