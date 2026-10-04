import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { zipSync } from 'fflate'

const repo = resolve(import.meta.dirname, '..')
const source = 'plugins/reviews'
const output = join(repo, 'dist/reviews-plugin.zip')
// Files git tracks or would track, so ignored local files like .DS_Store stay out.
// Tracked files deleted from the working tree are listed too, hence the existsSync.
const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', source], { cwd: repo, encoding: 'utf8' })
  .split('\0')
  .filter((path) => path && existsSync(join(repo, path)))
  .sort()
const files = await Promise.all(paths.map(async (path) => [posix.relative(source, path), await readFile(join(repo, path))]))

await mkdir(dirname(output), { recursive: true })
await writeFile(output, zipSync(Object.fromEntries(files), { level: 6, mtime: new Date(1980, 0, 1) }))
console.log(`Created ${relative(repo, output)}`)
