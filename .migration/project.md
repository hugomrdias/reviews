# project

2026-10-04. Whole-project migration of shadcn `radix-nova` to `base-nova`, using golden pairs via the shadcn CLI. All 16 Radix wrappers were pristine apart from CLI resolution artifacts, so each was overwritten component by component, with one commit each.

## Dependencies

- Added `@base-ui/react` 1.8.0 (exact pin). Removed `radix-ui` 1.6.7. `cmdk` and `vaul` still pull Radix packages transitively; that's expected.
- shadcn 4.21.1 still rewrites the utils import to `"cn"` and installs a bogus `cn` package on every `add`. Both were undone after each add.
- `vite.config.ts` `optimizeDeps.include`: `radix-ui` was replaced by the 16 `@base-ui/react/*` subpaths in use.

## App-code sweep

- `asChild`: every call site moved to `render`, or to `buttonVariants` on a real anchor for links.
- `TooltipProvider delayDuration` became `delay`.
- `DropdownMenuItem onSelect` became `onClick` (silent break: still typechecks).
- `data-[state=open]` became `data-popup-open` on one menu trigger.
- Group labels wrapped in a group (runtime throw otherwise).
- No usages of the other consumer-prop entries (activationMode, decorative, delayMs, position, onOpenAutoFocus, …).

## Intentionally untouched

- `drawer.tsx` (vaul): base-nova moves it to Base UI Drawer, but that's an opt-in vaul migration.
- `command.tsx` (cmdk): only the `CommandDialog` children-typing hunk was applied.
- `sonner.tsx`.

## Result

- `pnpm typecheck`: clean. `pnpm test`: 40/40. `pnpm build`: OK (same as the baseline before the migration).
- The largest server chunk went from 257 KB to 319 KB gzip.
- Browser-checked in the dev server: home, account menu, mobile sidebar sheet, comments sheet and tabs, thread and comment menus, tooltip, compare-view commit picker, state pages, signed-out home SSR.

## Pre-existing issues seen (not caused by this migration)

- Hydration mismatch on the header comment count (server 0, client 1).
- @pierre/diffs logs `resolveLanguage: "plaintext" not found`.
- The mobile sidebar sheet stays open after choosing a file.

0 wrappers remain on Radix.
