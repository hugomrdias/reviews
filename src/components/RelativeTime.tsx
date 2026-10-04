import { absoluteTime, relativeTime } from '@/lib/time'

/** "3 hr. ago", with the full date on hover. */
export function RelativeTime({ timestamp, className }: { timestamp: number; className?: string }) {
  return (
    <time className={className} dateTime={new Date(timestamp).toISOString()} title={absoluteTime(timestamp)}>
      {relativeTime(timestamp)}
    </time>
  )
}
