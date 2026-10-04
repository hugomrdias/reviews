# badge

2026-10-04. Strategy: golden pair via CLI (`shadcn add badge --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/badge.tsx`: the `Slot` idiom became `useRender` + `mergeProps`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- When used as `TooltipTrigger render={<Badge/>}` (AppSidebar branch badge), the element's `data-slot` is now `tooltip-trigger`, not `badge`. No CSS depends on it.

## Verify by hand

- The branch badge in the sidebar header looks unchanged, and hovering it shows "Showing commit <sha>".
