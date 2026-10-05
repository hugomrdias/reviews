import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

// The wordmark and footer, shared by the home page and the privacy page.

export function Brand() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold">
      <span className="inline-block h-3 w-5 rounded-[2px] bg-marker-strong" aria-hidden />
      Reviews
    </p>
  )
}

export function Credit({ className }: { className?: string }) {
  return (
    <footer className={cn('flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground', className)}>
      <span>
        Made by{' '}
        <a href="https://hugodias.me" rel="author" className="text-link hover:underline">
          Hugo Dias
        </a>
      </span>
      <a href="https://github.com/hugomrdias/reviews" className="text-link hover:underline">
        Source on GitHub
      </a>
      <Link to="/privacy" className="text-link hover:underline">
        Privacy
      </Link>
    </footer>
  )
}
