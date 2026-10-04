import { startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

// Same as TanStack Start's default client entry, minus <StrictMode>.
// StrictMode detaches and reattaches refs in development. @pierre/diffs'
// React wrapper (1.5.1) then hydrates a second instance over the first
// one's leftover <pre>, mistakes it for server-rendered output, and never
// renders code. Production doesn't double-attach, so this only keeps dev
// faithful to prod.

// Hot updates can re-run this module; hydrate the document only once.
const w = window as Window & { __reviewsHydrated?: boolean }
if (!w.__reviewsHydrated) {
  w.__reviewsHydrated = true
  startTransition(() => {
    hydrateRoot(document, <StartClient />)
  })
}
