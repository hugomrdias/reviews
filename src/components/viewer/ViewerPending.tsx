import { Skeleton } from '@/components/ui/skeleton'

// Its own module, not FileViewer's: the router doesn't code-split pending
// components, so whatever this imports ships in the entry bundle on every page.
export function ViewerPending() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-12">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}
