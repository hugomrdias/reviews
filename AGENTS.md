<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## Project conventions

- **UI:** shadcn/ui on Base UI (`base-nova` style). Follow the `shadcn` skill in `.agents/skills/`, with one deliberate exception: the GitHub alert callouts in `src/components/markdown/MarkdownView.tsx` use raw Tailwind palette colors (sky, emerald, violet, amber, red) on purpose. They mirror GitHub's Note, Tip, Important, Warning and Caution colors, so keep them.
- **Base UI idioms:** compose with `render`, not `asChild`. A `Button` that renders a link needs `nativeButton={false}`. Menu items take `onClick` (there is no `onSelect`), and `DropdownMenuLabel` must sit inside a `DropdownMenuGroup` or `DropdownMenuRadioGroup`, or it throws at runtime.
- **Imports** use the `@/` alias.
- **Commits and pull request titles** use Conventional Commits: `<type>(<optional scope>): <concise imperative description>`. release-please reads them from `main` to version the app and the plugin, so a user-visible change needs `feat` or `fix`, and a change to `plugins/reviews` needs one for installed plugins to update.
- **Dependencies are pinned exactly** (`.npmrc` has `save-exact=true`). TanStack Start is a release candidate and `@pierre/trees` is in beta; upgrade them on purpose, not in passing.
