# popover

2026-10-04. Strategy: golden pair via CLI (`shadcn add popover --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/popover.tsx`: Portal > Positioner > Popup; `align`/`side`/offsets are forwarded to the Positioner.
- `src/components/code/CommitPicker.tsx`: `PopoverTrigger asChild` became `render={<Button .../>}`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes



## Verify by hand

- On "Changes", open the commit picker: focus lands in the search box, and arrow keys and Enter pick a commit. It closes, the base updates, and focus returns to the trigger.
- In a narrow pane, the popover flips from end to start alignment instead of overflowing.
