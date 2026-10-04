# project

2026-10-04. Whole-project migration of shadcn `radix-nova` to `base-nova`, using golden pairs via the shadcn CLI. All 16 Radix wrappers were pristine apart from CLI resolution artifacts, so each was overwritten component by component, with one commit each.

## Dependencies

- Added `@base-ui/react` 1.8.0 (exact pin). Removed `radix-ui` 1.6.7 and, after the drawer moved to Base UI, `vaul`. `cmdk` still pulls `@radix-ui/react-dialog` in transitively; that's expected.
- shadcn 4.21.1 still rewrites the utils import to `"cn"` and installs a bogus `cn` package on every `add`. Both were undone after each add.
- `vite.config.ts`: `radix-ui` replaced by the `@base-ui/react/*` subpaths in use, and the list now applies to the Worker (SSR) environment too (commit 9a80d25). Before that, a cold start re-optimized mid-render and produced duplicate-React errors.

## App-code sweep

- `asChild`: every call site moved to `render`, or to `buttonVariants` on a real anchor for links.
- `TooltipProvider delayDuration` became `delay`.
- `DropdownMenuItem onSelect` became `onClick` (silent break: still typechecks).
- `data-[state=open]` became `data-popup-open` on one menu trigger.
- Group labels wrapped in a group (runtime throw otherwise).
- No usages of the other consumer-prop entries (activationMode, decorative, delayMs, position, onOpenAutoFocus, …).

## Intentionally untouched

- `command.tsx` (cmdk): only the `CommandDialog` children-typing hunk was applied.
- `sonner.tsx`.

## Result

- `pnpm typecheck`: clean. `pnpm test`: 40/40. `pnpm build`: OK (same as the baseline before the migration).
- The largest server chunk went from 257 KB to 319 KB gzip.
- Browser-checked in the dev server: home, account menu, mobile sidebar sheet, comments sheet and tabs, thread and comment menus, tooltip, compare-view commit picker, state pages, signed-out home SSR.

## Follow-up fixes

- `drawer.tsx` moved from vaul to Base UI (see `drawer.md`).
- Tab focus activation and theme-menu close-on-click restored at the call sites.
- Pre-existing issues fixed:
  - Comment-count hydration mismatch: the server loader waits for thread counts (and threads, for text files) before rendering. The browser still loads them in the background, and a failed comment fetch never blocks the file.
  - `resolveLanguage: "plaintext"` error: fence languages Shiki doesn't bundle fall back to `text` (`ansi` is kept). A test fails if the `shiki` pin drifts from the copy `@pierre/diffs` uses.
  - The mobile sidebar now closes after opening a file.
  - Unknown URLs now show a not-found page instead of TanStack's bare default.

## Known and left as is

- The build prints four "`::highlight` is not a valid pseudo-element" warnings. The minifier doesn't know the CSS Custom Highlight API, but the rules survive minification.
- The client chunk is over Vite's 500 KB warning size.

0 wrappers remain on Radix.
