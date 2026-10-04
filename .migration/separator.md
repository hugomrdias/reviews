# separator

2026-10-04. Strategy: golden pair via CLI (`shadcn add separator --overwrite`, style `base-nova`). Migrated.

## Changed

- `src/components/ui/separator.tsx`: now `SeparatorPrimitive` (callable); the `decorative` prop is gone.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- Radix rendered `decorative` separators with `role="none"`. Base UI always renders `role="separator"`, so the RepoHeader divider is now exposed to assistive tech.

## Verify by hand

- In the repo header, the vertical divider between the sidebar toggle and the breadcrumb is 16px tall and vertically centered, in light and dark themes.
