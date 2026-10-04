import { z } from 'zod'
import { CONTEXT_LENGTH, MAX_COMMENT_LENGTH, MAX_QUOTE_LENGTH } from '@/lib/threads'

export const ownerSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/)
export const shaSchema = z.string().regex(/^[0-9a-f]{40}$/)
export const pathSchema = z.string().max(1024)

export const repoInput = z.object({ owner: ownerSchema, repo: ownerSchema })
export const fileInput = repoInput.extend({ sha: shaSchema, path: pathSchema })

export const bodySchema = z.string().trim().min(1).max(MAX_COMMENT_LENGTH)

export const anchorSchema = z.object({
  kind: z.enum(['text', 'lines']),
  quoteExact: z.string().min(1).max(MAX_QUOTE_LENGTH),
  quotePrefix: z.string().max(CONTEXT_LENGTH * 2),
  quoteSuffix: z.string().max(CONTEXT_LENGTH * 2),
  textStart: z.number().int().nonnegative().nullable(),
  textEnd: z.number().int().nonnegative().nullable(),
  lineStart: z.number().int().positive().nullable(),
  lineEnd: z.number().int().positive().nullable(),
})
