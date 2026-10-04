# select

2026-10-04. Strategy: golden pair via CLI (`shadcn add select --overwrite`, style `base-nova`). Migrated. No app usages.

## Changed

- `src/components/ui/select.tsx`: bare `Select = SelectPrimitive.Root`, `alignItemWithTrigger`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- `onValueChange` now receives `(value | null, details)`; no call sites yet.

## Verify by hand

- Not used in the app yet.
