import { FileTree, useFileTree, type FileTreePreloadedData } from '@pierre/trees/react'
import { prepareFileTreeInput, type FileTreeDirectoryHandle, type FileTreeOptions } from '@pierre/trees'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toSplat } from '@/lib/links'
import { ancestors } from '@/lib/paths'
import { useTheme } from '@/lib/theme'

export const TREE_ID = 'repo-tree'

/** Options shared by the server preload and the client, which must match. */
export function treeOptions(paths: readonly string[], selected: string) {
  return {
    id: TREE_ID,
    preparedInput: prepareFileTreeInput(paths, { flattenEmptyDirectories: true }),
    flattenEmptyDirectories: true,
    initialExpandedPaths: selected ? ancestors(selected) : [],
    initialSelectedPaths: selected ? [selected] : [],
    search: true,
    fileTreeSearchMode: 'hide-non-matches' as const,
    density: 'compact' as const,
    icons: 'standard' as const,
    initialVisibleRowCount: 40,
  }
}

interface RepoTreeProps {
  owner: string
  repo: string
  ref: string
  sha: string
  paths: readonly string[]
  /** The open file or directory. */
  path: string
  /** Open comments per file. */
  counts: Record<string, number>
  preloaded?: FileTreePreloadedData | null
  /** Called after a row click opens another file. */
  onOpenFile?: () => void
}

/**
 * The repo's files, from @pierre/trees. Selecting a file navigates; the
 * route's path selects and reveals the row. Rows show open comment counts.
 */
export function RepoTree({ owner, repo, ref, sha, paths, path, counts, preloaded, onOpenFile }: RepoTreeProps) {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const pathSet = useMemo(() => new Set(paths), [paths])
  const countsRef = useRef(counts)
  countsRef.current = counts
  const current = useRef({ path, ref, pathSet, onOpenFile })
  current.current = { path, ref, pathSet, onOpenFile }
  // Set while the route drives the selection, so it doesn't navigate back.
  const syncing = useRef(false)

  // useFileTree reads its options only when it creates the tree, and preparing
  // the paths walks every file in the repo, so build them once, not per render.
  const [options] = useState((): FileTreeOptions => ({
    ...treeOptions(paths, path),
    onSelectionChange: (selected) => {
      if (syncing.current) return
      const next = selected[0]
      const { path: open, ref: openRef, pathSet: files, onOpenFile: opened } = current.current
      if (!next || next === open || !files.has(next)) return
      void navigate({
        to: '/$owner/$repo/$',
        params: { owner, repo, _splat: toSplat(openRef, next) },
      })
      opened?.()
    },
    renderRowDecoration: ({ item }) => {
      if (item.kind !== 'file') return null
      const n = countsRef.current[item.path]
      return n ? { text: String(n), title: n === 1 ? '1 open comment' : `${n} open comments` } : null
    },
  }))
  const { model } = useFileTree(options)

  // A different commit: swap the paths, keep the tree.
  const shownSha = useRef(sha)
  useEffect(() => {
    if (shownSha.current === sha) return
    shownSha.current = sha
    model.resetPaths({
      preparedInput: prepareFileTreeInput(paths, { flattenEmptyDirectories: true }),
      initialExpandedPaths: ancestors(path),
    })
  }, [model, sha, paths, path])

  // Route → tree: select and reveal the open file.
  useEffect(() => {
    if (!path) return
    for (const dir of ancestors(path)) {
      const handle = model.getItem(dir)
      if (handle?.isDirectory()) {
        const folder = handle as FileTreeDirectoryHandle
        if (!folder.isExpanded()) folder.expand()
      }
    }
    // Select only the open file: a link from a markdown file must not leave
    // the previous file selected too.
    syncing.current = true
    try {
      for (const other of model.getSelectedPaths()) {
        if (other !== path) model.getItem(other)?.deselect()
      }
      const item = model.getItem(path)
      if (item && !item.isSelected()) item.select()
    } finally {
      syncing.current = false
    }
    model.scrollToPath(path, { offset: 'nearest', focus: false })
  }, [model, path])

  // Comment counts changed: ask the tree to repaint its rows.
  useEffect(() => {
    model.setIcons('standard')
  }, [model, counts])

  return (
    <FileTree
      model={model}
      preloadedData={preloaded ?? undefined}
      className="h-full min-h-0"
      style={
        {
          colorScheme: theme === 'system' ? 'light dark' : theme,
          '--trees-bg-override': 'var(--sidebar)',
          '--trees-fg-override': 'var(--sidebar-foreground)',
          '--trees-font-family-override': 'var(--font-sans)',
          '--trees-selected-bg-override': 'var(--sidebar-accent)',
          '--trees-selected-fg-override': 'var(--sidebar-accent-foreground)',
          '--trees-fg-muted-override': 'var(--muted-foreground)',
          '--trees-border-color-override': 'var(--sidebar-border)',
          '--trees-search-bg-override': 'var(--background)',
          '--trees-input-bg-override': 'var(--background)',
          '--trees-focus-ring-color-override': 'var(--ring)',
          '--trees-accent-override': 'var(--marker-strong)',
        } as React.CSSProperties
      }
    />
  )
}
