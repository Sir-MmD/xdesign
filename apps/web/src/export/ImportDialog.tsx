import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import { FileUpIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { FormProblem } from '@/components/forms'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { importExport, readExport, type ReadExport, stepCount } from '@/export/importDesign'
import { cn } from '@/lib/utils'

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`
}

/**
 * "Import" of the Designs page (docs/plan/06 section 6): drop an `.xdesign.zip` or a `spec.json`
 * (or choose it); the file is read and checked in the browser, then "Import <name>: 34 steps, 2
 * languages, 12 media files" and "Import as a new design" make a new design owned by the
 * importer, upload its media files and open it.
 */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Mounted only while open, so each import starts from no file. */}
        <ImportForm
          onDone={() => {
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function ImportForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [read, setRead] = useState<ReadExport>()
  const [problems, setProblems] = useState<string[]>([])
  const [over, setOver] = useState(false)
  const [reading, setReading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [problem, setProblem] = useState<string>()
  const importing = progress !== undefined

  const take = async (file: File | undefined) => {
    if (!file || importing) return
    setReading(true)
    setProblem(undefined)
    try {
      const result = await readExport(file)
      setRead(result.ok ? result.read : undefined)
      setProblems(result.ok ? [] : result.problems)
    } finally {
      setReading(false)
    }
  }

  const start = async (shown: ReadExport) => {
    setProblem(undefined)
    setProgress({ done: 0, total: 0 })
    try {
      const imported = await importExport(shown, (done, total) => {
        setProgress({ done, total })
      })
      void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
      if (imported.problems.length > 0) {
        toast.warning(`Imported ${imported.name}, but not every media file: ${imported.problems.join('; ')}`)
      } else {
        toast.success(`Imported ${imported.name}.`)
      }
      onDone()
      await navigate({ to: '/d/$id', params: { id: imported.id } })
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      setProgress(undefined)
    }
  }

  const uploads = read ? [...read.media.keys()].filter((path) => read.files.has(path)).length : 0
  const missing = read ? read.media.size - uploads : 0
  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (read && !importing) void start(read)
      }}
    >
      <DialogHeader>
        <DialogTitle>Import</DialogTitle>
      </DialogHeader>
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-strong px-4 py-8 text-center transition-[border-color,background-color] duration-(--dur-fast) ease-(--ease)',
          over && 'border-brand bg-brand-weak',
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => {
          setOver(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          void take(event.dataTransfer.files[0])
        }}
      >
        <FileUpIcon aria-hidden className="size-8 text-fg-3" />
        <p className="text-subhead text-fg-2">Drop an .xdesign.zip or a spec.json here.</p>
        <input
          ref={input}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            void take(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={importing}
          pending={reading}
          onClick={() => {
            input.current?.click()
          }}
        >
          Choose a file
        </Button>
      </div>
      {problems.length > 0 ? (
        <div role="alert" className="grid gap-1 text-subhead text-error">
          <p className="font-semibold">This file cannot be imported:</p>
          <ul className="list-disc ps-5">
            {problems.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {read ? (
        <div className="grid gap-1">
          <p dir="auto" className="text-headline">
            Import {read.design.name}: {plural(stepCount(read.design), 'step')},{' '}
            {plural(read.design.languages.list.length, 'language')}, {plural(uploads, 'media file')}
          </p>
          {missing > 0 ? (
            <p className="text-footnote text-fg-3">
              {plural(missing, 'media file')} of the design come only with its .xdesign.zip; without them they show as
              placeholders.
            </p>
          ) : null}
        </div>
      ) : null}
      {progress && progress.total > 0 ? (
        <p role="status" className="text-subhead text-fg-2">
          Uploading media files {String(Math.min(progress.done + 1, progress.total))} of {String(progress.total)}
        </p>
      ) : null}
      <FormProblem message={problem} />
      <DialogFooter>
        <Button type="button" variant="outline" disabled={importing} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!read || importing} pending={importing}>
          Import as a new design
        </Button>
      </DialogFooter>
    </form>
  )
}
