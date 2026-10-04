# dialog

2026-10-04. Strategy: golden pair via CLI (`shadcn add dialog --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/dialog.tsx`: Overlay became Backdrop, Content became Popup; Close uses `render`.
- `src/components/ui/command.tsx`: hand-applied the one base-nova hunk (`CommandDialog` takes `children` explicitly, because Base UI Dialog children may be a render function). Not overwritten, since it's cmdk.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- (CommandDialog is not used yet.) Any dialog: Escape closes it, focus returns to the opener, and focus stays trapped inside.
