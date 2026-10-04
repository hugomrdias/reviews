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

export const MAX_COMMENT_LENGTH = 10_000
export const MAX_QUOTE_LENGTH = 4_000
export const CONTEXT_LENGTH = 32
