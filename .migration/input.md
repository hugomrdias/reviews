# input

2026-10-04. Strategy: golden pair via CLI (`shadcn add input --overwrite`, style `base-nova`). Migrated to Base UI `Input` (part of base-nova; not a Radix component).

## Changed

- `src/components/ui/input.tsx`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- The sidebar search box takes input and filters.
