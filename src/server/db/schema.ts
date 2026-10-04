import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  // GitHub user id.
  id: integer('id').primaryKey(),
  login: text('login').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = sqliteTable(
  'sessions',
  {
    // sha256 of the cookie token, hex. The raw token never touches the database.
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessTokenEnc: text('access_token_enc').notNull(),
    accessExpiresAt: integer('access_expires_at').notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    refreshExpiresAt: integer('refresh_expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
  },
  (t) => [index('sessions_user').on(t.userId)],
)

export const threads = sqliteTable(
  'threads',
  {
    id: text('id').primaryKey(),
    // Numeric GitHub repo id, so threads survive renames and transfers.
    repoId: integer('repo_id').notNull(),
    // Last known owner/name, for display only.
    repoFullName: text('repo_full_name').notNull(),
    path: text('path').notNull(),
    commitSha: text('commit_sha').notNull(),
    // Blob sha of the file at commit_sha; a cheap "file unchanged" check.
    blobSha: text('blob_sha'),
    anchorKind: text('anchor_kind', { enum: ['text', 'lines'] }).notNull(),
    quoteExact: text('quote_exact').notNull(),
    quotePrefix: text('quote_prefix').notNull().default(''),
    quoteSuffix: text('quote_suffix').notNull().default(''),
    // Offsets into the rendered text ('text' anchors only; a hint for re-anchoring).
    textStart: integer('text_start'),
    textEnd: integer('text_end'),
    // 1-based inclusive source lines: exact for 'lines', a hint for 'text'.
    lineStart: integer('line_start'),
    lineEnd: integer('line_end'),
    status: text('status', { enum: ['open', 'resolved'] }).notNull().default('open'),
    resolvedBy: integer('resolved_by').references(() => users.id),
    resolvedAt: integer('resolved_at'),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('threads_repo_path').on(t.repoId, t.path, t.status),
    index('threads_repo_status').on(t.repoId, t.status),
  ],
)

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    // The agent that posted this for the author, such as "Claude Code". Null when posted in the app.
    via: text('via'),
    createdAt: integer('created_at').notNull(),
    editedAt: integer('edited_at'),
    // Soft delete: a thread is never lost because its comments were removed.
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('comments_thread').on(t.threadId, t.createdAt), check('comments_body_len', sql`length(${t.body}) <= 10000`)],
)

export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Thread = typeof threads.$inferSelect
export type Comment = typeof comments.$inferSelect
