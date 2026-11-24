import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { routes } from '@xdesign/api'
import { ArchiveIcon, LogOutIcon, MoonIcon, SunIcon, UserRoundIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { useApi, useApiMutation } from '@/api/client'
import { Logo } from '@/app/Logo'
import { hasRoute, inDesktopApp, setMeUser, useMe } from '@/app/session'
import { setThemeChoice, themeChoice, useIsDarkTheme } from '@/app/theme'
import { CommentsBell } from '@/comments/CommentsBell'
import { PersonAvatar } from '@/components/PersonAvatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const linkClass =
  'flex h-(--control-h-sm) shrink-0 items-center rounded-md px-3 text-callout font-semibold whitespace-nowrap text-fg-2 transition-colors duration-(--dur-fast) ease-(--ease) hover:bg-surface-2 hover:text-foreground active:bg-surface-press data-[status=active]:bg-brand-weak data-[status=active]:text-brand'

/**
 * The frame of every signed-in page (docs/plan/04 section 1), modeled on xWriter's panel: the
 * sticky top bar with the site name (`GET /api/site`), "Designs", for the site owner "Members",
 * "Settings" and "Maintenance", then (THEME-01) the sun and moon button, (S2) the comments' bell
 * and the person's avatar menu ("Account", "Sign out"); under it the page. Under 760 px the links
 * move to a second row of the bar that scrolls sideways, so the bar fits a phone. The toasts are
 * the root route's, so the sign-in pages have them too. The desktop app (DESK-03, 18 section 9.4)
 * has no Members, Settings, Maintenance or "Sign out", and its menu has "Backups".
 */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe()
  const site = useApi(routes.site)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right,0px)] pl-[env(safe-area-inset-left,0px)]">
      <a
        href="#main-content"
        // Under the page's <base href> the bare fragment would open the base path's page instead.
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-70 focus:rounded-md focus:bg-brand-strong focus:px-4 focus:py-2 focus:text-callout focus:font-semibold focus:text-on-brand"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-(--z-topbar) border-b bg-surface pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex w-full max-w-(--content-max) flex-wrap items-center gap-x-4 px-(--gutter-x) min-[760px]:flex-nowrap">
          <Link
            to="/"
            className="flex h-(--topbar-h) min-w-0 items-center gap-2 truncate text-headline font-semibold text-foreground"
          >
            <Logo small className="size-7" />
            <span className="truncate">{site.data?.name}</span>
          </Link>
          <nav
            aria-label="Main"
            className="order-last -mx-(--gutter-x) no-scrollbar flex basis-[calc(100%+2*var(--gutter-x))] gap-1 overflow-x-auto px-(--gutter-x) pb-2 min-[760px]:order-none min-[760px]:mx-0 min-[760px]:basis-auto min-[760px]:p-0"
          >
            <Link to="/" activeOptions={{ exact: true, includeSearch: false }} className={linkClass}>
              Designs
            </Link>
            {me.isSiteOwner ? (
              <>
                {hasRoute('members') ? (
                  <Link to="/members" className={linkClass}>
                    Members
                  </Link>
                ) : null}
                {hasRoute('updateSettings') ? (
                  <Link to="/settings" className={linkClass}>
                    Settings
                  </Link>
                ) : null}
                {hasRoute('maintenance') ? (
                  <Link to="/maintenance" className={linkClass}>
                    Maintenance
                  </Link>
                ) : null}
              </>
            ) : null}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            <ThemeButton />
            <CommentsBell />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <div
          key={pathname}
          className="x-page mx-auto w-full max-w-(--content-max) px-(--gutter-x) pt-5 pb-[calc(--spacing(10)+env(safe-area-inset-bottom,0px))]"
        >
          {children}
        </div>
      </main>
    </div>
  )
}

/**
 * The sun and moon button (docs/plan/17 section 8): a sun in Dark, a moon in Light. A press switches
 * the whole site at once (app/theme.ts) and saves the choice for the person (`PATCH /api/me`), so
 * it follows them to every device; when the save fails, the site goes back to the saved one.
 */
function ThemeButton() {
  const me = useMe()
  const dark = useIsDarkTheme()
  const queryClient = useQueryClient()
  const update = useApiMutation(routes.updateMe, {
    onSuccess: ({ user }) => {
      // Only the answer of the last press: an earlier one would switch the site back meanwhile.
      if (user.theme === themeChoice()) {
        setMeUser(queryClient, user)
      }
    },
    onError: (error) => {
      setThemeChoice(me.theme)
      toast.error(error.message)
    },
  })
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={label}
            onClick={() => {
              const theme = dark ? 'light' : 'dark'
              setThemeChoice(theme)
              update.mutate({ body: { theme } })
            }}
          />
        }
      >
        {dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The avatar menu: who is signed in, "Account" and "Sign out"; in the desktop app "Account" and "Backups". */
function AccountMenu() {
  const me = useMe()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signOut = useApiMutation(routes.signOut)

  const leave = async () => {
    try {
      await signOut.mutateAsync()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return
    }
    await navigate({ to: '/sign-in', replace: true })
    // After the signed-in pages are gone, so nothing fetches the forgotten answers again.
    queryClient.clear()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={me.name} />}
      >
        <PersonAvatar name={me.name} color={me.color} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2 tracking-normal normal-case">
            <span className="truncate text-callout font-semibold text-foreground">{me.name}</span>
            {inDesktopApp() ? null : (
              <span className="truncate text-footnote font-normal text-fg-3">@{me.username}</span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void navigate({ to: '/account' })
          }}
        >
          <UserRoundIcon aria-hidden />
          Account
        </DropdownMenuItem>
        {hasRoute('desktopBackups') ? (
          <DropdownMenuItem
            onClick={() => {
              void navigate({ to: '/backups' })
            }}
          >
            <ArchiveIcon aria-hidden />
            Backups
          </DropdownMenuItem>
        ) : null}
        {hasRoute('signOut') ? (
          <DropdownMenuItem
            disabled={signOut.isPending}
            onClick={() => {
              void leave()
            }}
          >
            <LogOutIcon aria-hidden />
            Sign out
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
