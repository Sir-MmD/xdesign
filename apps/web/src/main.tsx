// The SPA's entry: TanStack Query for server data and TanStack Router with the file routes
// of src/routes (the route tree is generated into routeTree.gen.ts). The theme and the motion
// level come first, so <html> has its `dark` class and `data-motion` before React renders.
import './app/theme'
import './app/motion'
import './styles/index.css'

import { CSPProvider } from '@base-ui/react/csp-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { isApiError } from '@/api/client'
import { watchSessionEnd } from '@/app/session'
import { TooltipProvider } from '@/components/ui/tooltip'
import { basePath } from '@/lib/base'

import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A refusal (4xx) answers the same again; only an unreachable server or a failure (5xx) is tried twice more.
      retry: (failures, error) => failures < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
    },
  },
})

// Under the site's base path (lib/base.ts): the routes' paths and the locations the guards see
// (`/sign-in`, a `next` to come back to) stay without it; the router adds it to the address bar.
const router = createRouter({ routeTree, basepath: basePath, context: { queryClient }, scrollRestoration: true })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

watchSessionEnd(router, queryClient)

const root = document.getElementById('root')
if (!root) {
  throw new Error('index.html has no #root element')
}

// Base UI must not create <style> elements, which the Content Security Policy (`style-src
// 'self'`) blocks; its one rule is in styles/app.css.
createRoot(root).render(
  <StrictMode>
    <CSPProvider disableStyleElements>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={300}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </CSPProvider>
  </StrictMode>,
)
