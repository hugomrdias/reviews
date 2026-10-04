# tabs

2026-10-04. Strategy: golden pair via CLI (`shadcn add tabs --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/tabs.tsx`: Trigger became Tab, Content became Panel, `data-[state=active]` became `data-active`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- Base UI tabs default to manual activation. The comments sheet restores the Radix behavior with `activateOnFocus` on its `TabsList` (commit ea215a8), so arrow keys switch tabs again. The wrapper matches the registry.

## Verify by hand

- In the comments sheet, click each tab. Then focus a tab and press the arrow keys: the panel should switch as focus moves.
