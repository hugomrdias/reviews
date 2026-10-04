import { Bot } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import type { ThreadMutations } from '@/hooks/useThreadMutations'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { SessionUser } from '@/server/auth/session'
import { ThreadCard, type ThreadLocation } from './ThreadCard'

export type SheetTab = 'open' | 'addressed' | 'outdated' | 'resolved'

export function groupThreads(anchored: AnchoredThread[]) {
  const open = anchored.filter((a) => a.thread.status === 'open' && a.state !== 'outdated')
  // Addressed threads wait for a person wherever their text went, so they get one list.
  const addressed = anchored.filter((a) => a.thread.status === 'addressed')
  const outdated = anchored.filter((a) => a.thread.status === 'open' && a.state === 'outdated')
  const resolved = anchored.filter((a) => a.thread.status === 'resolved')
  return { open, addressed, outdated, resolved }
}

/** The tab to open the sheet on: the first one with something waiting. */
export function firstTab(groups: ReturnType<typeof groupThreads>): SheetTab {
  if (groups.open.length > 0) return 'open'
  if (groups.addressed.length > 0) return 'addressed'
  if (groups.outdated.length > 0) return 'outdated'
  return 'open'
}

interface CommentsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: SheetTab
  onTabChange: (tab: SheetTab) => void
  anchored: AnchoredThread[]
  location: ThreadLocation
  viewer: SessionUser | null
  mutations: ThreadMutations
  /** Close the sheet and show the thread in the page. */
  onReveal: (id: string) => void
  /** Copy the open threads as a prompt for a coding agent. */
  onCopyForAgent: () => void
}

function ThreadList({
  items,
  empty,
  ...rest
}: { items: AnchoredThread[]; empty: string } & Pick<CommentsSheetProps, 'location' | 'viewer' | 'mutations' | 'onReveal'>) {
  const [active, setActive] = useState<string | null>(null)
  if (items.length === 0) return <p className="px-1 py-8 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-col gap-3">
      {items.map((a) => (
        <div key={a.thread.id} className="flex flex-col gap-1">
          <ThreadCard
            anchored={a}
            location={rest.location}
            viewer={rest.viewer}
            mutations={rest.mutations}
            active={active === a.thread.id}
            onActivate={() => setActive(a.thread.id)}
          />
          {(a.state === 'attached' || a.state === 'edited') && a.thread.status !== 'resolved' && (
            <button
              type="button"
              className="ml-4 self-start text-xs text-link hover:underline"
              onClick={() => rest.onReveal(a.thread.id)}
            >
              Show in page
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

/** Every thread on the file, including outdated and resolved ones. */
export function CommentsSheet({
  open,
  onOpenChange,
  tab,
  onTabChange,
  anchored,
  onCopyForAgent,
  ...rest
}: CommentsSheetProps) {
  const wide = useMediaQuery('(min-width: 768px)')
  const groups = groupThreads(anchored)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        className={wide ? 'flex flex-col gap-0 sm:max-w-md' : 'flex max-h-[85dvh] flex-col gap-0'}
      >
        <SheetHeader className="border-b">
          <SheetTitle>Comments on this file</SheetTitle>
          <SheetDescription>
            Addressed comments are ones an agent says it fixed, waiting for a person to confirm. Outdated comments point
            at text that has since changed or been removed.
            {!rest.mutations.permissions.comment && ' You can read comments here; writing them needs write access to the repository.'}
          </SheetDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 self-start"
            disabled={groups.open.length + groups.outdated.length === 0}
            onClick={onCopyForAgent}
          >
            <Bot data-icon="inline-start" />
            Copy for agent
          </Button>
        </SheetHeader>
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as typeof tab)} className="min-h-0 flex-1 gap-0">
          <TabsList activateOnFocus className="mx-4 mt-3 w-[calc(100%-2rem)]">
            <TabsTrigger value="open">Open {groups.open.length}</TabsTrigger>
            <TabsTrigger value="addressed">Addressed {groups.addressed.length}</TabsTrigger>
            <TabsTrigger value="outdated">Outdated {groups.outdated.length}</TabsTrigger>
            <TabsTrigger value="resolved">Resolved {groups.resolved.length}</TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <TabsContent value="open">
              <ThreadList
                items={groups.open}
                empty={
                  rest.mutations.permissions.comment ? 'No open comments. Select text in the page to start one.' : 'No open comments.'
                }
                {...rest}
              />
            </TabsContent>
            <TabsContent value="addressed">
              <ThreadList items={groups.addressed} empty="Nothing waiting to be confirmed." {...rest} />
            </TabsContent>
            <TabsContent value="outdated">
              <ThreadList items={groups.outdated} empty="Every comment still matches the text." {...rest} />
            </TabsContent>
            <TabsContent value="resolved">
              <ThreadList items={groups.resolved} empty="Nothing resolved yet." {...rest} />
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
