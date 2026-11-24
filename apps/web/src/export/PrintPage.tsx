import { Link } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import { type Design, mediaFiles, toMarkdown } from '@xdesign/spec'
import { ArrowLeftIcon, PrinterIcon } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { useApi } from '@/api/client'
import { FormProblem } from '@/components/forms'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { parseMarkdown } from '@/export/markdown'
import { MarkdownView } from '@/export/MarkdownView'
import { makePictures, picturePath, type PictureLook, picturesOf } from '@/export/pictures'
import { useDesignOnce } from '@/export/useDesignOnce'

/**
 * The printable page `/d/<id>/print` (docs/plan/06 section 5): design.md drawn as HTML on white
 * paper, with the pictures made on the spot in the given look (every language, as in the doc),
 * the Mermaid map, a new page before each section and print styles; "Print or save as PDF" opens
 * the browser's print dialog once the pictures are made.
 */
export function PrintPage({ designId, look }: { designId: string; look: PictureLook }) {
  const header = useApi(routes.design, { params: { id: designId } })
  const loaded = useDesignOnce(designId)
  const design = loaded.design
  const docVersion = header.data?.design.docVersion
  const back = (
    <Link to="/d/$id" params={{ id: designId }} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
      <ArrowLeftIcon aria-hidden />
      <span dir="auto">{header.data?.design.name ?? 'Back'}</span>
    </Link>
  )

  // The browser names the PDF after the page's title.
  useEffect(() => {
    if (!design) return
    const before = document.title
    document.title = design.name
    return () => {
      document.title = before
    }
  }, [design])

  const problem = loaded.error ?? header.error?.message
  if (problem !== undefined || !design || docVersion === undefined) {
    return (
      <Paper toolbar={back}>
        {problem !== undefined ? (
          <FormProblem message={problem} />
        ) : (
          <div role="status" aria-label="Loading the design" className="grid gap-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        )}
      </Paper>
    )
  }
  return (
    <PrintView
      // Another look draws the pictures again from the start.
      key={`${look.skin}:${look.theme}`}
      design={design}
      docVersion={docVersion}
      look={look}
      back={back}
    />
  )
}

/** The page around the paper: the toolbar (not printed) and the white sheet. */
function Paper({ toolbar, children }: { toolbar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-2 print:bg-white">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-surface px-4 py-3 print:hidden">
        {toolbar}
      </header>
      <article className="mx-auto my-6 max-w-4xl bg-white px-10 py-8 text-[15px] text-neutral-900 [color-scheme:light] shadow-(--shadow-md) max-[760px]:px-4 print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {children}
      </article>
    </div>
  )
}

function PrintView({
  design,
  docVersion,
  look,
  back,
}: {
  design: Design
  docVersion: number
  look: PictureLook
  back: ReactNode
}) {
  const { skin, theme } = look
  const [exportedAt] = useState(() => new Date().toISOString())
  const pictures = useMemo(() => picturesOf(design, design.languages.list), [design])
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map())
  const [done, setDone] = useState(0)
  const ready = done >= pictures.length

  const blocks = useMemo(() => {
    const paths = new Set(pictures.map((picture) => picturePath(picture.name, picture.lang)))
    const files = mediaFiles(design)
    return parseMarkdown(
      toMarkdown(design, {
        pictures: (name, lang) => {
          const path = picturePath(name, lang)
          return paths.has(path) ? path : null
        },
        exportedAt,
        version: docVersion,
        mediaFile: (item) => files.get(item.id) ?? item.name,
      }),
    )
  }, [design, docVersion, exportedAt, pictures])

  useEffect(() => {
    const controller = new AbortController()
    const made: string[] = []
    makePictures(design, pictures, {
      look: { skin, theme },
      date: exportedAt,
      signal: controller.signal,
      onPicture: (path, png) => {
        const url = URL.createObjectURL(png)
        made.push(url)
        setUrls((current) => new Map(current).set(path, url))
      },
      onProgress: setDone,
    }).catch(() => undefined)
    return () => {
      controller.abort()
      for (const url of made) URL.revokeObjectURL(url)
    }
  }, [design, pictures, skin, theme, exportedAt])

  return (
    <Paper
      toolbar={
        <>
          {back}
          <p role="status" className="me-auto text-subhead text-fg-2">
            {ready ? null : `Making pictures ${String(done)} of ${String(pictures.length)}`}
          </p>
          <Button
            disabled={!ready}
            onClick={() => {
              window.print()
            }}
          >
            <PrinterIcon aria-hidden />
            Print or save as PDF
          </Button>
        </>
      }
    >
      <MarkdownView blocks={blocks} picture={(path) => urls.get(path)} />
    </Paper>
  )
}
