# scroll-area

2026-10-04. Strategy: golden pair via CLI (`shadcn add scroll-area --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/scroll-area.tsx`: `ScrollAreaScrollbar`/`ScrollAreaThumb` became `Scrollbar`/`Thumb`. Removed the golden's unused `React` import, which this project's `noUnusedLocals` rejects.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- Any scroll area (if mounted) scrolls with the wheel and shows the thumb.
