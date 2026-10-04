import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod/mini'
import { RepoLauncher } from '@/components/home/RepoLauncher'
import { UserMenu } from '@/components/shell/UserMenu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { reposQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { SessionUser } from '@/server/auth/session'

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    signin: z.optional(z.enum(['failed', 'expired', 'cancelled'])),
    // Where to go after signing in. Same-site paths only; /auth/login checks again.
    returnTo: z.catch(
      z.optional(
        z
          .string()
          .check(
            z.maxLength(2048),
            z.refine((v) => v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\')),
          ),
      ),
      undefined,
    ),
  }),
  loader: ({ context }) => {
    if (context.viewer) void context.queryClient.prefetchQuery(reposQuery())
  },
  component: Home,
})

function Home() {
  const { viewer } = Route.useRouteContext()
  const { signin, returnTo } = Route.useSearch()
  return viewer ? <Repositories viewer={viewer} /> : <Welcome signin={signin} returnTo={returnTo} />
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** The idea in one picture: a passage marked in the text, its note in the margin. */
function Specimen() {
  return (
    <div aria-hidden className="relative grid grid-cols-[minmax(0,1fr)_13rem] gap-6 select-none sm:gap-8">
      <div className="doc text-[0.9375rem] leading-[1.75] sm:text-base">
        <h3 className="!mt-0 !mb-2 !text-lg">Release process</h3>
        <p className="!mb-0">
          Deploys run nightly. <mark className="rounded-[2px] bg-marker-strong px-0.5 text-inherit">The release train
          leaves at 9am UTC</mark> and anything merged after that waits a day. Hotfixes skip the train but need two
          approvals.
        </p>
      </div>
      <div className="mt-9 self-start border-l-[3px] border-l-marker-strong bg-card py-2.5 pr-3 pl-3 text-left shadow-[0_8px_24px_-12px_rgb(27_34_48/0.25)]">
        <p className="text-xs">
          <span className="font-semibold">maya</span> <span className="text-muted-foreground">2 hr. ago</span>
        </p>
        <p className="mt-1 text-sm leading-snug">Most of the team is in Lisbon now. Could it leave at 10?</p>
      </div>
    </div>
  )
}

function Credit({ className }: { className?: string }) {
  return (
    <footer className={cn('text-sm text-muted-foreground', className)}>
      Made by{' '}
      <a href="https://hugodias.me" rel="author" className="text-link hover:underline">
        Hugo Dias
      </a>
    </footer>
  )
}

const SIGNIN_MESSAGES = {
  expired: 'That sign-in link expired. Sign in again.',
  failed: "GitHub didn't complete the sign-in. Try again.",
} as const

function Welcome({ signin, returnTo }: { signin?: 'failed' | 'expired' | 'cancelled'; returnTo?: string }) {
  const loginHref = returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login'
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-10 md:py-16">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="inline-block h-3 w-5 rounded-[2px] bg-marker-strong" aria-hidden />
        Reviews
      </p>

      <main className="grid flex-1 items-center gap-14 py-14 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-24">
        <div className="flex flex-col gap-6">
          <h1 className="font-serif text-4xl leading-[1.1] font-semibold tracking-tight text-balance md:text-5xl">
            Comment on the docs in your repos
          </h1>
          <p className="max-w-prose text-lg leading-relaxed text-muted-foreground">
            Read a repository's markdown the way GitHub renders it, select any passage, and leave a note for your
            team. Notes live here, never in the repo.
          </p>
          {signin === 'cancelled' ? (
            <Alert>
              <AlertDescription>
                Sign-in was cancelled, so nothing was shared with Reviews.
                {returnTo && (
                  <>
                    {' '}
                    Sign in to open <span className="font-medium break-all text-foreground">{returnTo.slice(1)}</span>.
                  </>
                )}
              </AlertDescription>
            </Alert>
          ) : signin ? (
            <Alert variant="destructive">
              <AlertDescription>{SIGNIN_MESSAGES[signin]}</AlertDescription>
            </Alert>
          ) : returnTo ? (
            <Alert>
              <AlertDescription>
                Sign in to open <span className="font-medium break-all text-foreground">{returnTo.slice(1)}</span>.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col items-start gap-3">
            <a href={loginHref} className={cn(buttonVariants({ size: 'lg' }))}>
              <GitHubMark /> {signin === 'cancelled' ? 'Try again' : 'Sign in with GitHub'}
            </a>
            <p className="text-sm text-muted-foreground">
              People see a repository, and its comments, only if their GitHub account can read it.
            </p>
          </div>
        </div>
        <Specimen />
      </main>
      <Credit />
    </div>
  )
}

function Repositories({ viewer }: { viewer: SessionUser }) {
  const { data: repos, isLoading, isError } = useQuery(reposQuery())

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2 md:px-8">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-3 w-5 rounded-[2px] bg-marker-strong" aria-hidden />
          Reviews
        </p>
        <UserMenu viewer={viewer} />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-12 pb-24 md:px-8">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Open a repository</h1>
          <a href="/github/install" className="shrink-0 text-sm text-link hover:underline">
            Add repositories
          </a>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <Skeleton className="h-10 w-full" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-muted-foreground">Your repositories didn't load. Refresh the page to try again.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <RepoLauncher repos={repos ?? []} viewerLogin={viewer.login} />
            {repos?.length === 0 && (
              <div className="rounded-xl border border-dashed p-6">
                <p className="font-medium">No repositories shared yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Install the Reviews GitHub App on your account or an organization, and choose which repositories
                  to share. You can still open any public repository by pasting its link above.
                </p>
                <a href="/github/install" className={cn(buttonVariants(), 'mt-4')}>
                  Install the GitHub App
                </a>
              </div>
            )}
          </div>
        )}
      </main>
      <Credit className="mx-auto w-full max-w-3xl px-4 pb-8 md:px-8" />
    </div>
  )
}
