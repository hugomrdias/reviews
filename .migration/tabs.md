# tabs

2026-10-04. Strategy: golden pair via CLI (`shadcn add tabs --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/tabs.tsx`: Trigger became Tab, Content became Panel, `data-[state=active]` became `data-active`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- **Manual activation:** arrow keys now move focus between tabs without switching. Press Enter or Space to activate (comments sheet: Open, Outdated, Resolved). Flagged, not patched; opt in with `activateOnFocus` on `TabsList` if you want the Radix feel back.

## Verify by hand

- In the comments sheet, click each tab. Then focus a tab and use the arrow keys plus Enter.
