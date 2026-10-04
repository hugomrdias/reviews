import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { toast } from 'sonner'
import { addComment, createThread, deleteComment, editComment, setThreadStatus } from '@/functions/comments'
import { threadCountsQuery, threadsQuery } from '@/lib/queries'
import type { AnchorData, CommentPermissions, ThreadView } from '@/lib/threads'

/**
 * Comment mutations for one file, with optimistic updates where they matter,
 * and what the viewer is allowed to do so the UI only offers those.
 */
export function useThreadMutations(owner: string, repo: string, path: string, permissions: CommentPermissions) {
  const queryClient = useQueryClient()
  const viewer = useRouteContext({ from: '__root__', select: (c) => c.viewer })
  const threadsKey = threadsQuery(owner, repo, path).queryKey

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: threadsKey })
    void queryClient.invalidateQueries({ queryKey: threadCountsQuery(owner, repo).queryKey })
  }

  const patch = (updater: (threads: ThreadView[]) => ThreadView[]) => {
    const previous = queryClient.getQueryData<ThreadView[]>(threadsKey)
    if (previous) queryClient.setQueryData(threadsKey, updater(previous))
    return { previous }
  }

  const rollback = (message: string) => (_: unknown, __: unknown, context?: { previous?: ThreadView[] }) => {
    if (context?.previous) queryClient.setQueryData(threadsKey, context.previous)
    toast.error(message)
  }

  const create = useMutation({
    mutationFn: (input: { commitSha: string; blobSha: string | null; anchor: AnchorData; body: string }) =>
      createThread({ data: { owner, repo, path, ...input } }),
    onError: () => toast.error('Comment not saved. Check your connection and try again.'),
    onSettled: settle,
  })

  const reply = useMutation({
    mutationFn: (input: { threadId: string; body: string }) => addComment({ data: { owner, repo, ...input } }),
    onMutate: ({ threadId, body }) =>
      patch((threads) =>
        threads.map((t) =>
          t.id === threadId && viewer
            ? {
                ...t,
                comments: [
                  ...t.comments,
                  {
                    id: `pending-${Date.now()}`,
                    author: viewer,
                    body,
                    via: null,
                    createdAt: Date.now(),
                    editedAt: null,
                    deleted: false,
                  },
                ],
              }
            : t,
        ),
      ),
    onError: rollback('Reply not saved. Try again.'),
    onSettled: settle,
  })

  const edit = useMutation({
    mutationFn: (input: { commentId: string; body: string }) => editComment({ data: { owner, repo, ...input } }),
    onMutate: ({ commentId, body }) =>
      patch((threads) =>
        threads.map((t) => ({
          ...t,
          comments: t.comments.map((c) => (c.id === commentId ? { ...c, body, editedAt: Date.now() } : c)),
        })),
      ),
    onError: rollback('Edit not saved. Try again.'),
    onSettled: settle,
  })

  const remove = useMutation({
    mutationFn: (commentId: string) => deleteComment({ data: { owner, repo, commentId } }),
    onMutate: (commentId) =>
      patch((threads) =>
        threads.map((t) => ({
          ...t,
          comments: t.comments.map((c) => (c.id === commentId ? { ...c, body: '', deleted: true } : c)),
        })),
      ),
    onError: rollback('Comment not deleted. Try again.'),
    onSettled: settle,
  })

  const setStatus = useMutation({
    mutationFn: (input: { threadId: string; status: 'open' | 'resolved' }) =>
      setThreadStatus({ data: { owner, repo, ...input } }),
    onMutate: ({ threadId, status }) =>
      patch((threads) =>
        threads.map((t) =>
          t.id === threadId
            ? {
                ...t,
                status,
                resolvedBy: status === 'resolved' ? viewer : null,
                resolvedAt: status === 'resolved' ? Date.now() : null,
              }
            : t,
        ),
      ),
    onSuccess: (_, { status }) => toast.success(status === 'resolved' ? 'Thread resolved' : 'Thread reopened'),
    onError: rollback('Thread not updated. Try again.'),
    onSettled: settle,
  })

  return { create, reply, edit, remove, setStatus, permissions }
}

export type ThreadMutations = ReturnType<typeof useThreadMutations>
