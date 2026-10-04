import { Link } from '@tanstack/react-router'
import { Bot, Check, Copy, GitCompareArrows, History, MoreHorizontal, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import type { ThreadMutations } from '@/hooks/useThreadMutations'
import { toSplat } from '@/lib/links'
import type { SessionUser } from '@/server/auth/session'
import { canResolve, type Author, type CommentView } from '@/lib/threads'
import { absoluteTime, relativeTime, shortSha } from '@/lib/time'
import { cn } from '@/lib/utils'
import { CommentBody } from './CommentBody'
import { Composer } from './Composer'

export interface ThreadLocation {
  owner: string
  repo: string
  ref: string
  path: string
}

export function avatarSrc(url: string, size: number) {
  return `${url}${url.includes('?') ? '&' : '?'}s=${size}`
}

export function AuthorAvatar({ author, className }: { author: Author; className?: string }) {
  return (
    <Avatar className={cn('size-5', className)}>
      {author.avatarUrl && <AvatarImage src={avatarSrc(author.avatarUrl, 40)} alt="" />}
      <AvatarFallback className="text-[10px]">{author.login.slice(0, 2)}</AvatarFallback>
    </Avatar>
  )
}

function Comment({
  comment,
  own,
  mutations,
}: {
  comment: CommentView
  own: boolean
  mutations: ThreadMutations
}) {
  const [editing, setEditing] = useState(false)
  const menuTrigger = useRef<HTMLButtonElement>(null)
  return (
    <div className="group/comment flex flex-col gap-1">
      <div className="flex items-center gap-2 text-xs">
        <AuthorAvatar author={comment.author} />
        <span className="font-semibold text-foreground">{comment.author.login}</span>
        {comment.via && (
          <Badge variant="secondary" className="max-w-32" title={`Posted by ${comment.via} for ${comment.author.login}`}>
            <Bot data-icon="inline-start" />
            <span className="sr-only">via</span>
            <span className="truncate">{comment.via}</span>
          </Badge>
        )}
        <time className="text-muted-foreground" dateTime={new Date(comment.createdAt).toISOString()} title={absoluteTime(comment.createdAt)}>
          {relativeTime(comment.createdAt)}
        </time>
        {comment.editedAt && <span className="text-muted-foreground">edited</span>}
        {own && mutations.permissions.comment && !comment.deleted && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  ref={menuTrigger}
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-6 [@media(hover:hover)]:opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100"
                  aria-label="Comment actions"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            {/* Edit and Delete unmount the trigger. Base UI would then send focus
                back through its history, out of the comments sheet and away from
                the edit box, so only return it while the trigger is still here. */}
            <DropdownMenuContent align="end" finalFocus={() => menuTrigger.current?.isConnected ?? false}>
              <DropdownMenuItem onClick={() => setEditing(true)}>Edit</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => mutations.remove.mutate(comment.id)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {comment.deleted ? (
        <p className="pl-7 text-sm text-muted-foreground italic">Comment deleted</p>
      ) : editing ? (
        <Composer
          className="pl-7"
          placeholder="Edit comment"
          submitLabel="Save"
          initialValue={comment.body}
          autoFocus
          pending={mutations.edit.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={async (body) => {
            await mutations.edit.mutateAsync({ commentId: comment.id, body })
            setEditing(false)
          }}
        />
      ) : (
        <div className="pl-7">
          <CommentBody body={comment.body} />
        </div>
      )}
    </div>
  )
}

const STATE_NOTE: Record<string, string> = {
  edited: 'The text changed since this comment.',
  outdated: 'This text is no longer in this version.',
  unplaced: 'Comment on the rendered page.',
}

interface ThreadCardProps {
  anchored: AnchoredThread
  location: ThreadLocation
  viewer: SessionUser | null
  mutations: ThreadMutations
  active: boolean
  /** Hide the quote when the note sits right beside its text (margin, code). */
  inline?: boolean
  onActivate?: () => void
  className?: string
}

/**
 * A margin note. Quiet until active: a rule in the margin color and the
 * first comment. Active notes show the whole thread and a reply box.
 */
export function ThreadCard({
  anchored,
  location,
  viewer,
  mutations,
  active,
  inline,
  onActivate,
  className,
}: ThreadCardProps) {
  const { thread, state } = anchored
  const resolved = thread.status === 'resolved'
  const visible = active ? thread.comments : thread.comments.slice(0, 1)
  const hidden = thread.comments.length - visible.length
  const note = resolved ? null : STATE_NOTE[state]

  const copyLink = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('thread', thread.id)
    url.hash = ''
    void navigator.clipboard.writeText(url.toString()).then(() => toast.success('Link copied'))
  }

  return (
    <article
      data-thread={thread.id}
      aria-label={`Comment by ${thread.author.login}`}
      onClick={(e) => {
        if (!active && !(e.target as HTMLElement).closest('a,button,textarea,[role=menuitem]')) onActivate?.()
      }}
      className={cn(
        'relative border-l-[3px] py-2.5 pr-3 pl-3.5 font-sans transition-[background-color,box-shadow]',
        state === 'attached' && !resolved && 'border-l-marker-strong',
        state === 'edited' && !resolved && 'border-l-marker-edited border-dashed',
        (state === 'outdated' || state === 'unplaced' || resolved) && 'border-l-border',
        active ? 'rounded-r-md bg-card shadow-[0_1px_3px_rgb(27_34_48/0.08),0_8px_24px_-12px_rgb(27_34_48/0.18)]' : 'cursor-pointer hover:bg-card/60',
        className,
      )}
    >
      {!inline && (
        <blockquote
          className={cn(
            'mb-2 font-serif text-[0.8125rem] leading-snug text-muted-foreground italic',
            active ? 'line-clamp-4' : 'line-clamp-2',
            state === 'outdated' && 'line-through decoration-muted-foreground/40',
          )}
        >
          {thread.anchor.quoteExact}
        </blockquote>
      )}

      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      {resolved && thread.resolvedBy && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Check className="size-3.5" /> Resolved by {thread.resolvedBy.login}
          {thread.resolvedAt && ` ${relativeTime(thread.resolvedAt)}`}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((comment) => (
          <Comment key={comment.id} comment={comment} own={viewer?.id === comment.author.id} mutations={mutations} />
        ))}
      </div>

      {hidden > 0 && (
        <button type="button" className="mt-2 pl-7 text-xs text-link hover:underline" onClick={onActivate}>
          {hidden === 1 ? '1 more reply' : `${hidden} more replies`}
        </button>
      )}

      {active && (
        <div className="mt-3 flex flex-col gap-2">
          {!resolved && mutations.permissions.comment && (
            <Composer
              placeholder="Reply"
              submitLabel="Reply"
              pending={mutations.reply.isPending}
              onSubmit={(body) => mutations.reply.mutateAsync({ threadId: thread.id, body })}
            />
          )}
          <div className="flex items-center gap-1">
            {canResolve(mutations.permissions, thread.author.id, viewer?.id) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  mutations.setStatus.mutate({ threadId: thread.id, status: resolved ? 'open' : 'resolved' })
                }
              >
                {resolved ? <RotateCcw /> : <Check />}
                {resolved ? 'Reopen' : 'Resolve'}
              </Button>
            )}
            <ThreadMenu thread={anchored} location={location} onCopyLink={copyLink} />
          </div>
        </div>
      )}
    </article>
  )
}

function ThreadMenu({
  thread: { thread, state },
  location,
  onCopyLink,
}: {
  thread: AnchoredThread
  location: ThreadLocation
  onCopyLink: () => void
}) {
  const sha = shortSha(thread.commitSha)
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="ml-auto size-8" aria-label="Thread actions" />}
            />
          }
        >
          <MoreHorizontal />
        </TooltipTrigger>
        <TooltipContent>Thread actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onCopyLink}>
          <Copy /> Copy link to thread
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link
              to="/$owner/$repo/$"
              params={{ owner: location.owner, repo: location.repo, _splat: toSplat(thread.commitSha, location.path) }}
              search={{ from: location.ref, thread: thread.id }}
            />
          }
        >
          <History /> View the file at {sha}
        </DropdownMenuItem>
        {state !== 'attached' && (
          <DropdownMenuItem
            render={
              <Link
                to="/$owner/$repo/$"
                params={{ owner: location.owner, repo: location.repo, _splat: toSplat(location.ref, location.path) }}
                search={{ view: 'compare', base: thread.commitSha, thread: thread.id }}
              />
            }
          >
            <GitCompareArrows /> See what changed since {sha}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
