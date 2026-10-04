# sidebar

2026-10-04. Strategy: golden pair via CLI (`shadcn add sidebar --overwrite`, style `base-nova`). Migrated. Registry deps (button, input, separator, skeleton, sheet, tooltip, use-mobile) were re-delivered and came out identical, except a stray `"use client"` in tooltip, which was reverted.

## Changed

- `src/components/ui/sidebar.tsx`: menu-button tooltip and slots use `render`. This replaced the interim `render={button}` patch from the tooltip commit.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- Desktop: the sidebar trigger collapses and expands it, and ⌘B toggles it.
- Mobile: the trigger opens the sheet, and Escape closes it. Choosing a file closes the sheet (commit 78b5908; before, nothing closed it).
