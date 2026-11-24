import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const editorTabs = [
  { value: 'map', label: 'Map' },
  { value: 'setup', label: 'Bot setup' },
  { value: 'texts', label: 'Texts' },
] as const
export type EditorTab = (typeof editorTabs)[number]['value']

/** The tabs "Map", "Bot setup" and "Texts" (04 section 4.1); the address keeps the one shown. */
export function EditorTabs({ tab, onTab }: { tab: EditorTab; onTab: (tab: EditorTab) => void }) {
  return (
    <Tabs
      value={tab}
      onValueChange={(value: EditorTab) => {
        onTab(value)
      }}
    >
      <TabsList aria-label="Editor">
        {editorTabs.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
