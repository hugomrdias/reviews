# input-group

2026-10-04. Strategy: golden pair via CLI (`shadcn add input-group --overwrite`, style `base-nova`). Golden delta applied (Button `type` typing).

## Changed

- `src/components/ui/input-group.tsx`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- The search input in the commit picker and home launcher looks unchanged.
