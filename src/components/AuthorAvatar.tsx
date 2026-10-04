import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Author } from '@/lib/threads'
import { cn } from '@/lib/utils'

/** GitHub avatar URL at `size` pixels. */
export function avatarSrc(url: string, size: number) {
  return `${url}${url.includes('?') ? '&' : '?'}s=${size}`
}

const SIZE_CLASS = { 20: 'size-5', 24: 'size-6' } as const

/** A GitHub user's avatar, `size` CSS pixels square, fetched at 2x for sharp screens. */
export function AuthorAvatar({
  author,
  size = 20,
  className,
}: {
  author: Pick<Author, 'login' | 'avatarUrl'>
  size?: keyof typeof SIZE_CLASS
  className?: string
}) {
  return (
    <Avatar className={cn(SIZE_CLASS[size], className)}>
      {author.avatarUrl && <AvatarImage src={avatarSrc(author.avatarUrl, size * 2)} alt="" />}
      <AvatarFallback className="text-[10px]">{author.login.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}
