# toggle

2026-10-04. Strategy: golden pair via CLI (`shadcn add toggle --overwrite`, style `base-nova`). Migrated (also delivered as a dependency of toggle-group; identical).

## Changed

- `src/components/ui/toggle.tsx`: callable `TogglePrimitive`; `data-[state=on]` became `data-pressed`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- Toggle any `Toggle` in the viewer: the pressed style shows and `aria-pressed` flips.
