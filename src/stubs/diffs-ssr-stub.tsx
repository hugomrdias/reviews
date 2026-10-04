// Stand-in for @pierre/diffs and shiki during SSR. Code highlighting only runs in the
// browser (inside <ClientOnly>), so the Worker never bundles Shiki.
const render = () => null
export const File = render
export const MultiFileDiff = render
export const FileDiff = render
export const PatchDiff = render
export const bundledLanguages = {}
