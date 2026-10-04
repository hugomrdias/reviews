# sheet

2026-10-04. Strategy: golden pair via CLI (`shadcn add sheet --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/sheet.tsx`: Backdrop/Popup with `data-starting-style`/`data-ending-style` slide transitions per side.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- On mobile width, open the sidebar (sheet slides from the left) and the comments sheet (from the bottom; from the right at 768px and up). Escape closes them and focus returns to the opener.
