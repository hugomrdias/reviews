import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype, { type Options as RemarkRehypeOptions } from 'remark-rehype'
import { unified, type PluggableList } from 'unified'
import { extname } from '@/lib/paths'
import { rehypeHeadingIds, rehypeSourceLines, remarkGithubAlerts, remarkStripMdxEsm } from './plugins'
import { markdownSchema } from './schema'

// The one markdown pipeline. The page renders it with react-markdown; the
// server runs it with unified to know the page's text without a browser.

const remarkPlugins: PluggableList = [remarkGfm, remarkFrontmatter, remarkGithubAlerts]
const mdxRemarkPlugins: PluggableList = [...remarkPlugins, remarkStripMdxEsm]
const rehypePlugins: PluggableList = [rehypeRaw, rehypeSourceLines, rehypeHeadingIds, [rehypeSanitize, markdownSchema]]
// react-markdown always adds allowDangerousHtml, so rehype-raw sees raw HTML.
const remarkRehypeOptions: RemarkRehypeOptions = { clobberPrefix: '', allowDangerousHtml: true }

export function markdownPipeline(path: string) {
  return {
    remarkPlugins: extname(path) === 'mdx' ? mdxRemarkPlugins : remarkPlugins,
    remarkRehypeOptions,
    rehypePlugins,
  }
}

/** The page's HTML tree for a markdown file, as react-markdown builds it before rendering. */
export function markdownToHast(source: string, path: string) {
  const pipeline = markdownPipeline(path)
  const processor = unified()
    .use(remarkParse)
    .use(pipeline.remarkPlugins)
    .use(remarkRehype, pipeline.remarkRehypeOptions)
    .use(pipeline.rehypePlugins)
  return processor.runSync(processor.parse(source))
}
