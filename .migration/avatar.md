# avatar

2026-10-04. Strategy: golden pair via CLI (`shadcn add avatar --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/avatar.tsx`: Base UI Avatar; no `delayMs` usages to rename.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- Avatars in the account menu and on comments load, and the initials fallback shows when the image fails.
