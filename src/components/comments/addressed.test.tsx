import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FIX_SHA, threads, viewer } from '@/dev/fixtures'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import type { ThreadMutations } from '@/hooks/useThreadMutations'
import type { CommentPermissions, ThreadView } from '@/lib/threads'
import { firstTab, groupThreads } from './CommentsSheet'
import { ThreadCard } from './ThreadCard'

vi.mock(import('@tanstack/react-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  Link: (({ children, search }: { children?: React.ReactNode; search?: object }) => (
    <a data-search={JSON.stringify(search)}>{children}</a>
  )) as never,
}))

const addressedThread = threads.find((t) => t.status === 'addressed')!
const location = { owner: 'acme', repo: 'handbook', ref: 'main', path: 'docs/release-process.md' }

function mutations(permissions: CommentPermissions) {
  const idle = { isPending: false, mutate: () => {}, mutateAsync: async () => {} }
  return { create: idle, reply: idle, edit: idle, remove: idle, setStatus: idle, permissions } as unknown as ThreadMutations
}

function card(thread: ThreadView, permissions: CommentPermissions = { comment: true, moderate: true }) {
  return renderToStaticMarkup(
    <ThreadCard
      anchored={{ thread, state: 'outdated' }}
      location={location}
      viewer={viewer}
      mutations={mutations(permissions)}
      active
    />,
  )
}

describe('an addressed thread', () => {
  it('says who addressed it and links to the change', () => {
    const html = card(addressedThread)
    expect(html).toContain('Addressed by hugomrdias')
    expect(html).toContain(FIX_SHA.slice(0, 7))
    expect(html).toContain('&quot;base&quot;:&quot;' + addressedThread.commitSha)
  })

  it('offers Confirm and Reopen to those who can resolve it', () => {
    const html = card(addressedThread)
    expect(html).toContain('Confirm')
    expect(html).toContain('Reopen')
    expect(html).not.toContain('Resolve')
  })

  it('hides Confirm from commenters who did not start the thread', () => {
    expect(card(addressedThread, { comment: true, moderate: false })).not.toContain('Confirm')
  })

  it("doesn't call its changed text news", () => {
    expect(card(addressedThread)).not.toContain('no longer in this version')
  })

  it('keeps the addressed line once resolved, but not once reopened', () => {
    expect(card({ ...addressedThread, status: 'resolved' })).toContain('Addressed by')
    expect(card({ ...addressedThread, status: 'open' })).not.toContain('Addressed by')
  })
})

describe('groupThreads', () => {
  const at = (status: ThreadView['status'], state: AnchoredThread['state']): AnchoredThread => ({
    thread: { ...addressedThread, id: `${status}-${state}`, status },
    state,
  })

  it('lists addressed threads together, wherever their text went', () => {
    const groups = groupThreads([at('open', 'attached'), at('addressed', 'outdated'), at('open', 'outdated'), at('resolved', 'attached')])
    expect(groups.open.map((a) => a.thread.id)).toEqual(['open-attached'])
    expect(groups.addressed.map((a) => a.thread.id)).toEqual(['addressed-outdated'])
    expect(groups.outdated.map((a) => a.thread.id)).toEqual(['open-outdated'])
    expect(groups.resolved.map((a) => a.thread.id)).toEqual(['resolved-attached'])
  })

  it('opens the sheet on the first tab with something waiting', () => {
    expect(firstTab(groupThreads([at('addressed', 'attached'), at('open', 'outdated')]))).toBe('addressed')
    expect(firstTab(groupThreads([at('open', 'outdated')]))).toBe('outdated')
    expect(firstTab(groupThreads([]))).toBe('open')
  })
})
