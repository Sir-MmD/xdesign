import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { hasRole, routes } from '@xdesign/api'
import {
  BookmarkPlusIcon,
  CopyIcon,
  EllipsisIcon,
  HistoryIcon,
  ImageUpIcon,
  KeyboardIcon,
  LayoutTemplateIcon,
  MessageSquareIcon,
  PrinterIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useApiMutation } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SaveTemplateDialog } from '@/designs/SaveTemplateDialog'
import { refreshPictures } from '@/export/pictureCache'

import { useCommentStore } from '../comments/store'
import { useDesign, useEditor } from '../context'
import { useHistoryStore } from '../history/store'
import { useLook } from '../look'
import { shortcuts } from '../shortcuts'

/**
 * The top bar's "..." menu (04 section 4.1): "Duplicate design" (the copy is the person's, as on
 * Designs), "Save as template" (TPL-01, design owner and site owner), "Print" (EXP-02's print page
 * in the phone's look), "Refresh pictures for Claude" (CL-03: the picture cache of now in the
 * phone's look), "History" and "Name this version" (HIST-02, the second for Editors), "Comments"
 * (CMT-02's panel) and "Keyboard shortcuts" (section 14).
 */
export function MoreMenu({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [look] = useLook()
  const comments = useCommentStore()
  const { role, live } = useEditor()
  const { name } = useDesign()
  const history = useHistoryStore()
  const [showKeys, setShowKeys] = useState(false)
  const [templating, setTemplating] = useState(false)
  const duplicate = useApiMutation(routes.duplicateDesign, {
    onSuccess: ({ design }) => {
      void queryClient.invalidateQueries({ queryKey: [routes.designs.key] })
      toast.success(`Made ${design.name}.`, {
        action: {
          label: 'Open',
          onClick: () => {
            void navigate({ to: '/d/$id', params: { id: design.id } })
          },
        },
      })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More" />}>
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            disabled={duplicate.isPending}
            onClick={() => {
              duplicate.mutate({ params: { id } })
            }}
          >
            <CopyIcon aria-hidden />
            Duplicate design
          </DropdownMenuItem>
          {role === 'owner' ? (
            <DropdownMenuItem
              onClick={() => {
                setTemplating(true)
              }}
            >
              <LayoutTemplateIcon aria-hidden />
              Save as template
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={() => {
              void navigate({ to: '/d/$id/print', params: { id }, search: { look: look.skin, theme: look.theme } })
            }}
          >
            <PrinterIcon aria-hidden />
            Print
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              refreshPictures({ id, name }, { look, doc: live.doc })
            }}
          >
            <ImageUpIcon aria-hidden />
            Refresh pictures for Claude
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              comments.set({ panel: true })
            }}
          >
            <MessageSquareIcon aria-hidden />
            Comments
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              history.setPanel(true)
            }}
          >
            <HistoryIcon aria-hidden />
            History
          </DropdownMenuItem>
          {hasRole(role, 'editor') ? (
            <DropdownMenuItem
              onClick={() => {
                history.open({ kind: 'name' })
              }}
            >
              <BookmarkPlusIcon aria-hidden />
              Name this version
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setShowKeys(true)
            }}
          >
            <KeyboardIcon aria-hidden />
            Keyboard shortcuts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveTemplateDialog
        design={templating ? { id, name } : undefined}
        onOpenChange={(open) => {
          if (!open) setTemplating(false)
        }}
      />
      <Dialog open={showKeys} onOpenChange={setShowKeys}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-callout">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.keys} className="contents">
                <dt>
                  <kbd className="rounded-sm border bg-surface-2 px-1.5 py-0.5 font-mono text-footnote">
                    {shortcut.keys}
                  </kbd>
                </dt>
                <dd className="text-fg-2">{shortcut.does}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
