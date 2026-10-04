# dropdown-menu

2026-10-04. Strategy: golden pair via CLI (`shadcn add dropdown-menu --overwrite`, style `base-nova`). Migrated; consumer sweep needed runtime-only fixes that tsc does not catch.

## Changed

- `src/components/ui/dropdown-menu.tsx`: Menu primitive; Label became GroupLabel; Portal > Positioner > Popup.
- `src/components/shell/UserMenu.tsx`: trigger uses `render`. Labels moved inside `DropdownMenuGroup` / `DropdownMenuRadioGroup`, because Base UI throws "MenuGroupContext is missing" otherwise. Sign out is `DropdownMenuItem nativeButton render={<button type="submit"/>}`.
- `src/components/comments/ThreadCard.tsx`: `onSelect` became `onClick`; `onSelect` still typechecks as the DOM event but never fires on Base UI items. Link items use `render={<Link/>}`, and `data-[state=open]` became `data-popup-open` on the comment trigger.
- `ThreadCard.tsx` `finalFocus` guard (commit 1296627): Edit/Delete unmount the trigger, and Base UI then sent focus to an element behind the comments sheet. Focus now returns only while the trigger is mounted.
- `src/components/comments/Composer.tsx`: Escape stops propagation, so it cancels the box without closing the surrounding sheet. This behavior predates the migration (Radix caught Escape in capture phase), fixed here because the same flow was being repaired.
- Leftover scan `grep -n "radix-ui\|@radix-ui"` on this file: clean.

## Left alone

- `command.tsx` (cmdk), `drawer.tsx` (vaul) and `sonner.tsx` are not Radix and were not migrated; see `project.md`.

## Behavior changes

- **Radio items stay open on click** (`closeOnClick` defaults to false on Base UI radio/checkbox items). Picking a theme in the account menu no longer closes the menu. Flagged, not patched.

## Verify by hand

- Account menu: Enter opens it, arrows move, the theme radio switches the theme, Escape closes it and focus returns to the trigger.
- Active thread "…": "Copy link" shows the toast, and "View the file at <sha>" navigates.
- Own comment "…" > Edit: the edit box is focused. Escape cancels only the edit; a second Escape closes the sheet.
