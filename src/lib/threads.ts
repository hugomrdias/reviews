// Comment thread shapes shared by the server functions and the UI.

export interface Author {
  id: number
  login: string
  name: string | null
  avatarUrl: string | null
}

export interface CommentView {
  id: string
  author: Author
  body: string
  createdAt: number
  editedAt: number | null
  deleted: boolean
}

export type AnchorKind = 'text' | 'lines'

export interface AnchorData {
  kind: AnchorKind
  quoteExact: string
  quotePrefix: string
  quoteSuffix: string
  textStart: number | null
  textEnd: number | null
  lineStart: number | null
  lineEnd: number | null
}

export interface ThreadView {
  id: string
  path: string
  commitSha: string
  blobSha: string | null
  anchor: AnchorData
  status: 'open' | 'resolved'
  resolvedBy: Author | null
  resolvedAt: number | null
  author: Author
  createdAt: number
  updatedAt: number
  comments: CommentView[]
}

/** What the signed-in user may do with comments on a repo. */
export interface CommentPermissions {
  /** Start threads, reply, and edit or delete their own comments. Needs write access. */
  comment: boolean
  /** Resolve or reopen anyone's thread. Needs maintain or admin. */
  moderate: boolean
}

/** Commenters can resolve their own threads; maintainers can resolve any. */
export function canResolve(permissions: CommentPermissions, authorId: number, userId: number | undefined) {
  return permissions.comment && (permissions.moderate || authorId === userId)
}

export const MAX_COMMENT_LENGTH = 10_000
export const MAX_QUOTE_LENGTH = 4_000
export const CONTEXT_LENGTH = 32
