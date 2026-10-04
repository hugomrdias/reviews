# hover-card

2026-10-04. Strategy: golden pair via CLI (`shadcn add hover-card --overwrite`, style `base-nova`). Migrated (primitive renamed to PreviewCard; wrapper names unchanged). No app usages.

## Changed

- `src/components/ui/hover-card.tsx`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- Not used in the app yet; nothing to check.
