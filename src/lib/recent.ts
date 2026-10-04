// Recently opened repos, per browser. A convenience for picking up where you
// left off; it never leaves the device, and every access tolerates storage
// being unavailable.

const KEY = 'reviews:recent'
const LIMIT = 6

export interface RecentRepo {
  owner: string
  repo: string
  /** Last ref and file viewed, to resume reading. */
  ref: string
  path: string
  at: number
}

export function readRecent(): RecentRepo[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, LIMIT) : []
  } catch {
    return []
  }
}

export function recordRecent(entry: Omit<RecentRepo, 'at'>) {
  try {
    const key = `${entry.owner}/${entry.repo}`.toLowerCase()
    const rest = readRecent().filter((r) => `${r.owner}/${r.repo}`.toLowerCase() !== key)
    localStorage.setItem(KEY, JSON.stringify([{ ...entry, at: Date.now() }, ...rest].slice(0, LIMIT)))
  } catch {
    // Private mode or blocked storage: skip it.
  }
}
