import { Link, useLocation } from '@tanstack/react-router'
import { FileQuestion, FileX, Folder, FileText, LockKeyhole, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { toSplat } from '@/lib/links'
import { basename, isMarkdown } from '@/lib/paths'

function StateBlock({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-3 py-16">
      <div className="text-muted-foreground [&_svg]:size-6">{icon}</div>
      <h1 className="text-xl font-semibold text-balance">{title}</h1>
      <div className="space-y-3 text-[0.9375rem] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  )
}

export function AppNotInstalled({ owner, installUrl }: { owner: string; installUrl: string }) {
  const location = useLocation()
  const href = `${installUrl}&returnTo=${encodeURIComponent(location.href)}`
  return (
    <StateBlock icon={<LockKeyhole />} title={`Reviews isn't installed on ${owner}`}>
      <p>
        Reviews can only read repositories where its GitHub App is installed. Install it on {owner} and choose
        this repository. If you're not an admin there, GitHub will send your request to one.
      </p>
      <Button asChild>
        <a href={href}>Install on {owner}</a>
      </Button>
    </StateBlock>
  )
}

export function RepoNotSelected({ owner, settingsUrl }: { owner: string; settingsUrl: string }) {
  return (
    <StateBlock icon={<LockKeyhole />} title="This repository isn't shared with Reviews">
      <p>
        The app is installed on {owner}, but this repository isn't in its list, or your account can't read it.
        An admin of {owner} can add it in the installation settings.
      </p>
      <Button asChild variant="outline">
        <a href={settingsUrl} target="_blank" rel="noreferrer">
          Open installation settings
        </a>
      </Button>
    </StateBlock>
  )
}

export function RepoNotFound() {
  return (
    <StateBlock icon={<FileQuestion />} title="Repository or branch not found">
      <p>Check the address. If the repository is private, make sure your GitHub account can open it.</p>
      <Button asChild variant="outline">
        <Link to="/">Back to your repositories</Link>
      </Button>
    </StateBlock>
  )
}

export function RateLimited({ resetAt }: { resetAt: number }) {
  const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000))
  return (
    <StateBlock icon={<Timer />} title="GitHub needs a break">
      <p>
        Your account hit GitHub's hourly request limit. It resets in about {minutes} {minutes === 1 ? 'minute' : 'minutes'}.
      </p>
    </StateBlock>
  )
}

export function FileMissing({ path, refName }: { path: string; refName: string }) {
  return (
    <StateBlock icon={<FileX />} title={`${basename(path) || 'This file'} isn't in ${refName}`}>
      <p>It may have been moved, renamed or deleted. Pick another file from the tree.</p>
    </StateBlock>
  )
}

export function UnviewableFile({
  kind,
  path,
  rawHref,
}: {
  kind: 'binary' | 'too-large' | 'lfs'
  path: string
  rawHref: string
}) {
  const reason = {
    binary: 'This is a binary file, so there is nothing to read here.',
    'too-large': 'This file is over 2 MB, too large to show here.',
    lfs: 'This file is stored with Git LFS. Only its pointer is in the repository.',
  }[kind]
  return (
    <StateBlock icon={<FileX />} title={basename(path)}>
      <p>{reason}</p>
      {kind !== 'lfs' && (
        <Button asChild variant="outline">
          <a href={rawHref}>Download the file</a>
        </Button>
      )}
    </StateBlock>
  )
}

/** A directory's files and folders, one level deep. */
export function DirectoryListing({
  owner,
  repo,
  refName,
  path,
  paths,
}: {
  owner: string
  repo: string
  refName: string
  path: string
  paths: readonly string[]
}) {
  const prefix = path ? `${path}/` : ''
  const entries = new Map<string, boolean>()
  for (const p of paths) {
    if (!p.startsWith(prefix)) continue
    const rest = p.slice(prefix.length)
    const slash = rest.indexOf('/')
    const name = slash === -1 ? rest : rest.slice(0, slash)
    entries.set(name, entries.get(name) === true || slash !== -1)
  }
  const sorted = [...entries].sort(([a, aDir], [b, bDir]) => Number(bDir) - Number(aDir) || a.localeCompare(b))
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">{path || `${owner}/${repo}`}</h1>
      {sorted.length === 0 ? (
        <p className="text-muted-foreground">This folder is empty.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {sorted.map(([name, isDir]) => (
            <li key={name}>
              <Link
                to="/$owner/$repo/$"
                params={{ owner, repo, _splat: toSplat(refName, prefix + name) }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent"
              >
                {isDir ? (
                  <Folder className="size-4 text-muted-foreground" />
                ) : (
                  <FileText className={isMarkdown(name) ? 'size-4 text-foreground' : 'size-4 text-muted-foreground'} />
                )}
                <span className={isMarkdown(name) ? 'font-medium' : undefined}>{name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
