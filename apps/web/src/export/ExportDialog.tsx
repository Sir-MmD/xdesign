import { useQueryClient } from '@tanstack/react-query'
import { hasRole, routes, versionName } from '@xdesign/api'
import { type PreviewTheme, type SkinId, telegramLooks, telegramThemes } from '@xdesign/preview'
import { type Design, type Lang, readDesign } from '@xdesign/spec'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type * as Y from 'yjs'

import { apiKey, call, useApi } from '@/api/client'
import { FormProblem } from '@/components/forms'
import { LanguageFlag } from '@/components/LanguagePicker'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { versionDesign } from '@/editor/history/versions'
import { buildExport, download, type ExportProgress } from '@/export/exportZip'
import { cachePictures } from '@/export/pictureCache'
import { defaultLook, type PictureLook } from '@/export/pictures'
import { type DesignOnce, useDesignOnce } from '@/export/useDesignOnce'
import { NOW, VersionField } from '@/export/VersionField'
import { findLanguage, languageName } from '@/lib/languages'
import { useLast } from '@/lib/useLast'

type PictureChoice = 'all' | 'default' | 'none'

const pictureItems: { value: PictureChoice; label: string }[] = [
  { value: 'all', label: 'One picture per step and language' },
  { value: 'default', label: 'Default language only' },
  { value: 'none', label: 'No pictures' },
]
const lookItems = telegramLooks.map((look) => ({ value: look.id, label: look.label }))
const themeItems = telegramThemes.map((theme) => ({ value: theme.id, label: theme.label }))

function progressText(progress: ExportProgress): string {
  switch (progress.stage) {
    case 'media':
      return `Fetching media files ${String(progress.done + 1)} of ${String(progress.total)}`
    case 'pictures':
      return `Making pictures ${String(progress.done)} of ${String(progress.total)}`
    case 'zip':
      return 'Making the zip'
  }
}

export interface ExportedDesign {
  id: string
  name: string
  docVersion?: number | undefined
  /** A version from history chosen at first (HIST-02: the History panel's "Export"). */
  version?: string | undefined
}

/**
 * "Export" (docs/plan/06 section 1), from the editor's top bar, a design card's menu and the page
 * of a view-only link (VIEW-01): "Version" ("Now" or a version from history, with "Name this
 * version" for now; HIST-02, not on a view link's page),
 * "Languages" (all, or the chosen ones; the default one always), "Pictures" (one per step and
 * language, the default language only, or none) in a "Phone look" and "Light" or "Dark",
 * "Include open comments" (on by default: design.md lists them as "Open questions"), then
 * "Export" with its progress ("Making pictures 12 of 40") and "Cancel", which stops it. The zip
 * downloads as `<design-idname>-<UTC date>.xdesign.zip`; an export of now with pictures then
 * sends the default language's ones to the Claude link's picture cache (CL-03).
 */
export function ExportDialog({
  design,
  onOpenChange,
  doc,
  look,
}: {
  /**
   * The design to export; the dialog is open while it is set. With its document version (the
   * page of a view-only link, which has no session) the dialog does not read its header.
   */
  design: ExportedDesign | undefined
  onOpenChange: (open: boolean) => void
  /** The editor's live document; without it the dialog reads the design's document itself. */
  doc?: Y.Doc | undefined
  /** The editor's phone look, the pictures' look at first. */
  look?: PictureLook | undefined
}) {
  const shown = useLast(design)
  return (
    <Dialog open={design !== undefined} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {shown ? (
          <ExportForm
            key={`${shown.id} ${shown.version ?? NOW}`}
            design={shown}
            doc={doc}
            look={look ?? defaultLook}
            open={design !== undefined}
            onDone={() => {
              onOpenChange(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ExportForm({
  design,
  doc,
  look,
  open,
  onDone,
}: {
  design: ExportedDesign
  doc: Y.Doc | undefined
  look: PictureLook
  open: boolean
  onDone: () => void
}) {
  const loaded = useDesignOnce(design.id, doc)
  const header = useApi(routes.design, { params: { id: design.id } }, { enabled: design.docVersion === undefined })
  const docVersion = design.docVersion ?? header.data?.design.docVersion
  // HIST-02: "Now" or a version from history, for people with a session (not a view link's page).
  const queryClient = useQueryClient()
  const role = header.data?.role
  const versions = useApi(routes.versions, { params: { id: design.id } }, { enabled: role !== undefined })
  const [versionId, setVersionId] = useState(design.version ?? NOW)
  const [naming, setNaming] = useState('')
  const [nameError, setNameError] = useState<string>()
  const version = useApi(
    routes.version,
    { params: { id: design.id, versionId } },
    { enabled: versionId !== NOW, staleTime: 'static' },
  )
  const fromVersion = useMemo<DesignOnce>(() => {
    if (!version.data) return {}
    try {
      return { design: versionDesign(version.data).design }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [version.data])
  const chosen: DesignOnce =
    versionId === NOW ? loaded : version.isError ? { error: version.error.message } : fromVersion
  const [unchosen, setUnchosen] = useState<ReadonlySet<Lang>>(new Set())
  const [pictures, setPictures] = useState<PictureChoice>('all')
  const [skin, setSkin] = useState<SkinId>(look.skin)
  const [theme, setTheme] = useState<PreviewTheme>(look.theme)
  const [comments, setComments] = useState(true)
  // The page of a view-only link (it gives the version, VIEW-01) has no comments and does not
  // send pictures to the picture cache (it has no session).
  const withComments = design.docVersion === undefined
  const [progress, setProgress] = useState<ExportProgress>()
  const [problem, setProblem] = useState<string>()
  const running = useRef<AbortController>(undefined)

  // Closing the dialog (or leaving the page) stops a running export.
  useEffect(() => {
    if (!open) running.current?.abort()
  }, [open])
  useEffect(
    () => () => {
      running.current?.abort()
    },
    [],
  )

  const start = async (shownDesign: Design) => {
    const controller = new AbortController()
    running.current = controller
    setProblem(undefined)
    const { languages } = shownDesign
    const langs = languages.list.filter((lang) => lang === languages.default || !unchosen.has(lang))
    try {
      // A version exports as it was, with its document version and name; now, with the name it was just given.
      let exported = shownDesign
      let exportedVersion = docVersion ?? 1
      let exportedName: string | null = null
      if (versionId !== NOW && version.data) {
        exportedVersion = version.data.version.docVersion
        exportedName = version.data.version.kind === 'named' ? version.data.version.name : null
      } else {
        if (doc) exported = designNow(doc, shownDesign)
        if (naming.trim() !== '') {
          const named = await call(routes.nameVersion, { params: { id: design.id }, body: { name: naming } })
          void queryClient.invalidateQueries({ queryKey: apiKey(routes.versions, { params: { id: design.id } }) })
          // Made once: trying again after a failure does not name it twice.
          setNaming('')
          exportedVersion = named.version.docVersion
          exportedName = named.version.name
        }
      }
      const pictureLook = { skin, theme }
      const made = await buildExport(exported, {
        langs,
        pictureLangs: pictures === 'all' ? langs : pictures === 'default' ? [languages.default] : [],
        look: pictureLook,
        docVersion: exportedVersion,
        versionName: exportedName,
        commentsOf: comments && withComments ? design.id : undefined,
        signal: controller.signal,
        onProgress: setProgress,
      })
      download(made.name, made.zip, 'application/zip')
      toast.success(`Exported ${design.name}.`)
      // CL-03: the default language's pictures of now also go to the picture cache (06 section 7.4).
      if (withComments && versionId === NOW) {
        cachePictures(design.id, exported, made.pictures, { docVersion: exportedVersion, look: pictureLook })
      }
      onDone()
    } catch (error) {
      if (!controller.signal.aborted) setProblem(error instanceof Error ? error.message : String(error))
    } finally {
      if (running.current === controller) running.current = undefined
      setProgress(undefined)
    }
  }

  const busy = progress !== undefined
  const shownDesign = chosen.design
  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!shownDesign || busy || running.current) return
        if (versionId === NOW && naming.trim() !== '') {
          const checked = versionName.safeParse(naming)
          setNameError(checked.success ? undefined : checked.error.issues[0]?.message)
          if (!checked.success) return
        }
        void start(shownDesign)
      }}
    >
      <DialogHeader>
        <DialogTitle>Export {design.name}</DialogTitle>
      </DialogHeader>
      {role !== undefined && versions.data ? (
        <VersionField
          versions={versions.data.versions}
          value={versionId}
          onValueChange={setVersionId}
          canName={hasRole(role, 'editor')}
          name={naming}
          onNameChange={setNaming}
          nameError={nameError}
          disabled={busy}
        />
      ) : null}
      {chosen.error !== undefined ? (
        <FormProblem message={chosen.error} />
      ) : !shownDesign ? (
        <div role="status" aria-label="Loading the design" className="grid gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          <FieldSet disabled={busy}>
            <FieldLegend variant="label">Languages</FieldLegend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {shownDesign.languages.list.map((lang) => {
                const isDefault = lang === shownDesign.languages.default
                return (
                  <Label key={lang} className="flex items-center gap-2 text-body font-normal">
                    <Checkbox
                      checked={isDefault || !unchosen.has(lang)}
                      disabled={isDefault || busy}
                      onCheckedChange={(checked) => {
                        setUnchosen((current) => {
                          const next = new Set(current)
                          if (checked) next.delete(lang)
                          else next.add(lang)
                          return next
                        })
                      }}
                    />
                    <LanguageFlag language={findLanguage(lang)} />
                    {languageName(lang)}
                    {isDefault ? <span className="text-fg-3">(default)</span> : null}
                  </Label>
                )
              })}
            </div>
          </FieldSet>
          <FieldSet disabled={busy}>
            <FieldLegend variant="label">Pictures</FieldLegend>
            <Select<PictureChoice>
              items={pictureItems}
              value={pictures}
              disabled={busy}
              onValueChange={(value) => {
                if (value !== null) setPictures(value)
              }}
            >
              <SelectTrigger className="w-full" aria-label="Pictures">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pictureItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pictures === 'none' ? null : (
              <div className="flex flex-wrap gap-3">
                <Select<SkinId>
                  items={lookItems}
                  value={skin}
                  disabled={busy}
                  onValueChange={(value) => {
                    if (value !== null) setSkin(value)
                  }}
                >
                  <SelectTrigger aria-label="Phone look">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lookItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select<PreviewTheme>
                  items={themeItems}
                  value={theme}
                  disabled={busy}
                  onValueChange={(value) => {
                    if (value !== null) setTheme(value)
                  }}
                >
                  <SelectTrigger aria-label="Light or Dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FieldSet>
          {withComments ? (
            <Label className="flex items-center gap-2 text-body font-normal">
              <Checkbox
                checked={comments}
                disabled={busy}
                onCheckedChange={(checked) => {
                  setComments(checked)
                }}
              />
              Include open comments
            </Label>
          ) : null}
        </>
      )}
      {progress ? (
        <p role="status" className="text-subhead text-fg-2">
          {progressText(progress)}
        </p>
      ) : null}
      <FormProblem message={problem} />
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (running.current) running.current.abort()
            else onDone()
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!shownDesign || docVersion === undefined || busy} pending={busy}>
          Export
        </Button>
      </DialogFooter>
    </form>
  )
}

/** The editor's document as it is when "Export" is pressed (it may have changed since the dialog opened). */
function designNow(doc: Y.Doc, fallback: Design): Design {
  try {
    return readDesign(doc)
  } catch {
    return fallback
  }
}
