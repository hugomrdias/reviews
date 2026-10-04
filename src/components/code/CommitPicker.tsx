import { useQuery } from '@tanstack/react-query'
import { Check, ChevronsUpDown, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fileCommitsQuery } from '@/lib/queries'
import type { ThreadView } from '@/lib/threads'
import { relativeTime, shortSha } from '@/lib/time'
import { cn } from '@/lib/utils'

interface CommitPickerProps {
  owner: string
  repo: string
  headSha: string
  path: string
  baseSha: string | null
  threads: ThreadView[]
  onSelect: (sha: string) => void
}

/** Picks the commit to compare against: commits with comments first, then the file's history. */
export function CommitPicker({ owner, repo, headSha, path, baseSha, threads, onSelect }: CommitPickerProps) {
  const [open, setOpen] = useState(false)
  const { data: commits = [], isLoading } = useQuery(fileCommitsQuery(owner, repo, headSha, path))
  const history = commits.filter((c) => c.sha !== headSha)
  const commented = [...new Set(threads.map((t) => t.commitSha))].filter((sha) => sha !== headSha)
  const label = commits.find((c) => c.sha === baseSha)

  const choose = (sha: string) => {
    onSelect(sha)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" role="combobox" aria-expanded={open} className="max-w-72 justify-between gap-2" />
        }
      >
        <span className="truncate">
          {baseSha ? (
            <>
              Compared with <span className="font-mono">{shortSha(baseSha)}</span>
              {label && <span className="text-muted-foreground"> {label.message}</span>}
            </>
          ) : (
            'Choose a commit'
          )}
        </span>
        <ChevronsUpDown className="opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search commits" />
          <CommandList>
            <CommandEmpty>{isLoading ? 'Loading history…' : 'No commits found.'}</CommandEmpty>
            {commented.length > 0 && (
              <CommandGroup heading="Commits with comments">
                {commented.map((sha) => {
                  const commit = commits.find((c) => c.sha === sha)
                  return (
                    <CommandItem key={`c-${sha}`} value={`${sha} ${commit?.message ?? ''}`} onSelect={() => choose(sha)}>
                      <MessageSquare className="text-muted-foreground" />
                      <span className="font-mono text-xs">{shortSha(sha)}</span>
                      <span className="truncate">{commit?.message ?? 'Commit no longer in history'}</span>
                      <Check className={cn('ml-auto', sha === baseSha ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
            <CommandGroup heading="History of this file">
              {history.map((commit) => (
                <CommandItem key={commit.sha} value={`${commit.sha} ${commit.message} ${commit.authorName}`} onSelect={() => choose(commit.sha)}>
                  <span className="font-mono text-xs text-muted-foreground">{shortSha(commit.sha)}</span>
                  <span className="min-w-0 flex-1 truncate">{commit.message}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{commit.date && relativeTime(commit.date)}</span>
                  <Check className={cn(commit.sha === baseSha ? 'opacity-100' : 'opacity-0')} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
