# tooltip

2026-10-04. Strategy: golden pair via CLI (`shadcn add tooltip --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/tooltip.tsx`: Portal > Positioner > Popup; arrow per side.
- `src/routes/__root.tsx`: `TooltipProvider delayDuration={300}` became `delay={300}`.
- `src/components/shell/AppSidebar.tsx`: `TooltipTrigger asChild` became `render={<Badge/>}`.
- `src/components/comments/ThreadCard.tsx`: Tooltip around the thread-actions menu trigger, now nested `render` (Tooltip trigger renders the Menu trigger, which renders Button).
- Reverted an unrelated `"use client"` the sidebar's registry dependencies re-added.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- Radix's `disableHoverableContent` had no usages. The skip-delay concept is gone (Base UI handles grouped tooltips differently).

## Verify by hand

- Hover the sidebar branch badge: the tooltip appears after about 300ms, above the badge, with its arrow.
- Hover the "…" on an active thread: "Thread actions" shows, and clicking still opens the menu.
