import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { zipSync } from 'fflate'

const repo = resolve(import.meta.dirname, '..')
const source = join(repo, 'plugins/reviews')
const output = join(repo, 'dist/reviews-plugin.zip')
const entries = await readdir(source, { recursive: true, withFileTypes: true })
const paths = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort()
const files = await Promise.all(paths.map(async (path) => [relative(source, path).split(sep).join('/'), await readFile(path)]))

await mkdir(dirname(output), { recursive: true })
await writeFile(output, zipSync(Object.fromEntries(files), { level: 6, mtime: new Date(1980, 0, 1) }))
console.log(`Created ${relative(repo, output)}`)
