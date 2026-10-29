import type { Element, ElementContent, Root } from 'hast'
import { visit } from 'unist-util-visit'
import { markdownToHast } from './pipeline'

// ```mermaid fences render on the server (server/diagrams.ts), and the page
// looks each one up by its source. Both sides read fences with codeFence, so
// the page finds every diagram the server drew.

/** A fence drawn as SVG, or why it couldn't be. */
export type Diagram = { source: string } & ({ svg: string; id: string } | { error: string })

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

/** The language and source of a `<pre><code>` block, or null for any other pre. */
export function codeFence(pre: Element) {
  const code = pre.children.find((c): c is Element => c.type === 'element' && c.tagName === 'code')
  if (!code) return null
  const className = code.properties.className
  const lang = (Array.isArray(className) ? className : [])
    .map(String)
    .find((c) => c.startsWith('language-'))
    ?.slice('language-'.length)
  return { lang, source: textOf(code).replace(/\n$/, '') }
}

export function isMermaid(lang: string | undefined) {
  return lang?.toLowerCase() === 'mermaid'
}

/** The sources of a markdown file's ```mermaid fences, in page order and without repeats. */
export function mermaidSources(markdown: string, path: string): string[] {
  // Most files have none, so skip the parse for them.
  if (!/mermaid/i.test(markdown)) return []
  const sources = new Set<string>()
  visit(markdownToHast(markdown, path) as Root, 'element', (node) => {
    if (node.tagName !== 'pre') return
    const fence = codeFence(node)
    if (fence && isMermaid(fence.lang)) sources.add(fence.source)
  })
  return [...sources]
}
