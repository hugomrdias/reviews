const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })

/** "3 hr. ago", "yesterday", "just now". */
export function relativeTime(timestamp: number | string, now = Date.now()) {
  const then = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp)
  const seconds = Math.round((then - now) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

export function absoluteTime(timestamp: number | string) {
  return new Date(timestamp).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortSha(sha: string) {
  return sha.slice(0, 7)
}
