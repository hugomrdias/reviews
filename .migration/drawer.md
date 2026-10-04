# drawer

2026-10-04. Strategy: golden pair via CLI (`shadcn add drawer --overwrite`, style `base-nova`). An opt-in vaul-to-Base UI migration, done on request after the Radix migration.

## Changed

- `src/components/ui/drawer.tsx`: vaul replaced by `@base-ui/react/drawer`. It adds Backdrop, Viewport > Popup > Content, swipe-direction data attributes and `--drawer-*` vars, plus an optional `DrawerSwipeHandle`.
- `src/components/viewer/FileViewer.tsx`: the mobile comment drawer passes `showSwipeHandle` to keep the handle vaul always drew.
- `package.json`: `vaul` removed. `vite.config.ts`: `vaul` dropped and `@base-ui/react/drawer` added to the pre-bundle list.
- Leftover scan `grep -n "vaul"` in `src`: clean.

## Left alone

- No other drawer call sites exist.

## Behavior changes

- Swipe physics and timing come from Base UI instead of vaul (`swipeDirection="down"` by default). No snap points are used.

## Verify by hand

- At phone width, tap highlighted text: the drawer slides up with the thread and its handle. Swipe it down or press Escape to close it; the floating "comments" button returns.
- In the drawer, "…" > Edit focuses the edit box. Escape cancels the edit, and a second Escape closes the drawer.
