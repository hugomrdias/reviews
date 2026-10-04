import { ClientOnly } from '@tanstack/react-router'
import { lazy, Suspense, type ReactNode } from 'react'
import type * as Diffs from '@pierre/diffs/react'

// @pierre/diffs and Shiki are the largest part of the viewer, and a markdown
// page without code blocks never uses them, so they load on first use.
const load = () => import('@pierre/diffs/react')

export const File = lazy(() => load().then((m) => ({ default: m.File }))) as unknown as typeof Diffs.File

export const MultiFileDiff = lazy(() =>
  load().then((m) => ({ default: m.MultiFileDiff })),
) as unknown as typeof Diffs.MultiFileDiff

/** Diffs only render in the browser. `fallback` shows on the server and until they load. */
export function DiffsOnly({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ClientOnly>
  )
}
