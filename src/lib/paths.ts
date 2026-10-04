// Path helpers shared by client and server. Repo paths never start with '/'.

export function extname(path: string) {
  const base = basename(path)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

export function basename(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function dirname(path: string) {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

/** Joins and normalizes repo paths. Returns null when ".." escapes the root. */
export function joinPath(base: string, relative: string): string | null {
  const parts = base ? base.split('/') : []
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (parts.length === 0) return null
      parts.pop()
    } else {
      parts.push(segment)
    }
  }
  return parts.join('/')
}

/** "a/b/c.md" → ["a", "a/b"] */
export function ancestors(path: string) {
  const parts = path.split('/')
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
}

export function isMarkdown(path: string) {
  return ['md', 'mdx', 'markdown'].includes(extname(path))
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
}

const OTHER_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  woff: 'font/woff',
  woff2: 'font/woff2',
}

export function isImage(path: string) {
  return extname(path) in IMAGE_TYPES
}

/** Content types the asset proxy may serve. Never HTML. */
export function assetContentType(path: string): string | null {
  const ext = extname(path)
  return IMAGE_TYPES[ext] ?? OTHER_TYPES[ext] ?? null
}

/** README-like files, in the order GitHub prefers them. */
export const README_NAMES = ['README.md', 'readme.md', 'Readme.md', 'README.mdx', 'README', 'index.md']

export function findReadme(dir: string, paths: ReadonlySet<string>) {
  for (const name of README_NAMES) {
    const candidate = dir ? `${dir}/${name}` : name
    if (paths.has(candidate)) return candidate
  }
  return null
}

/** True when `path` is a directory in the tree (some file lives under it). */
export function isDirectory(path: string, paths: readonly string[]) {
  if (path === '') return true
  const prefix = `${path}/`
  return paths.some((p) => p.startsWith(prefix))
}
