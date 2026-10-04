import { defaultSchema, type Schema } from 'hast-util-sanitize'

/**
 * GitHub's sanitization rules (hast-util-sanitize's default is derived from
 * them), plus the attributes our own plugins add. No styles, scripts,
 * iframes or event handlers.
 */
export const markdownSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), ['dataAlert', /^[a-z]+$/]],
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'dataSline', 'dataEline'],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
}

/** Comment bodies: GFM, but no raw HTML at all (react-markdown skips it by default). */
export const commentSchema: Schema = {
  ...defaultSchema,
  tagNames: (defaultSchema.tagNames ?? []).filter((t) => !['img', 'picture', 'source', 'input'].includes(t)),
}
