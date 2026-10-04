# button

2026-10-04. Strategy: golden pair via CLI (`shadcn add button --overwrite`, style `base-nova`). Migrated; call sites that used `asChild` for links now render plain anchors.

## Changed

- `src/components/ui/button.tsx`: now wraps `@base-ui/react/button` (`ButtonPrimitive`), replacing the Radix `Slot`/`asChild` idiom. The CLI's `cn` import was pointed back at `@/lib/utils`, and the bogus `cn` package it installed was removed.
- `src/components/states/States.tsx` and `src/routes/index.tsx`: six `<Button asChild><a|Link/></Button>` call sites became `<a|Link className={cn(buttonVariants(...))}>`. An interim `render` + `nativeButton={false}` version made Base UI add `role="button"` to the links, so it was replaced (commit 494143a).
- `components.json`: style `radix-nova` changed to `base-nova`.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- The button no longer sets `data-variant` or `data-size` (it matches the golden version). Nothing in the app used them.
- Base UI `Button` adds Space/Enter key handling and `focusableWhenDisabled` support, but no call site uses either.

## Verify by hand

- Tab to "Sign in with GitHub" (signed out) and the state pages ("Back to your repositories"). A screen reader should announce them as links, and Enter should follow them.
- Click a disabled Composer "Comment" button: nothing happens.
