import { useQueryClient } from '@tanstack/react-query'
import { routes } from '@xdesign/api'

// The switch "Ask first" of a key or connected app (docs/plan/17 sections 13.4 and 13.6, MCP-01b,
// MCP-03b): what others than the site owner read beside it, and the refresh of the lists that show
// it; (MCP-03b) the question of an app's "Disconnect", on the Account page and in Settings.

export const askFirstOwnerOnly = 'Only the site owner can turn this off.'

export const disconnectText =
  'Its connection ends at once: its next call is refused, and it can use xDesign again only after it is connected and allowed again.'

/** Refreshes the Account page's keys and apps and Settings' "Claude connections" after a change. */
export function useRefreshConnections() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [routes.apiKeys.key] }),
      queryClient.invalidateQueries({ queryKey: [routes.claudeApps.key] }),
      queryClient.invalidateQueries({ queryKey: [routes.claudeConnections.key] }),
    ])
}
