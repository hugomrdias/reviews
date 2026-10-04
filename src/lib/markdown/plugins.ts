import GithubSlugger from 'github-slugger'
import type { Element, Root as HastRoot, Text as HastText } from 'hast'
import type { Blockquote, Paragraph, Root as MdastRoot, Text } from 'mdast'
import { visit } from 'unist-util-visit'

export const ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const
export type AlertType = (typeof ALERT_TYPES)[number]

/** The title the page shows above an alert's text. It's part of the page's text. */
export const ALERT_LABELS: Record<AlertType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)?/i

/**
 * GitHub alerts: "> [!NOTE]" blockquotes. Marks the blockquote with
 * data-alert and removes the marker text; the renderer does the rest.
 */
export function remarkGithubAlerts() {
  return (tree: MdastRoot) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0]
      if (first?.type !== 'paragraph') return
      const text = (first as Paragraph).children[0]
      if (text?.type !== 'text') return
      const match = ALERT_MARKER.exec((text as Text).value)
      if (!match) return
      ;(text as Text).value = (text as Text).value.slice(match[0].length)
      if ((text as Text).value === '') (first as Paragraph).children.shift()
      // A leading line break left over after the marker.
      const next = (first as Paragraph).children[0]
      if (next?.type === 'break') (first as Paragraph).children.shift()
      if ((first as Paragraph).children.length === 0) node.children.shift()
      node.data = { ...node.data, hProperties: { dataAlert: match[1].toLowerCase() } }
    })
  }
}

/** Drops MDX import/export lines, which would otherwise show up as text. */
export function remarkStripMdxEsm() {
  return (tree: MdastRoot) => {
    tree.children = tree.children.filter((node) => {
      if (node.type !== 'paragraph') return true
      const first = node.children[0]
      return !(first?.type === 'text' && /^(import|export)\s/.test(first.value))
    })
  }
}

function textContent(node: Element | HastText): string {
  if (node.type === 'text') return node.value
  return node.children
    .map((child) => (child.type === 'element' || child.type === 'text' ? textContent(child) : ''))
    .join('')
}

/**
 * Heading ids the way GitHub makes them. Runs before sanitize, which adds
 * the "user-content-" prefix, so ids match GitHub's own anchors.
 */
export function rehypeHeadingIds() {
  return (tree: HastRoot) => {
    const slugger = new GithubSlugger()
    visit(tree, 'element', (node: Element) => {
      if (!/^h[1-6]$/.test(node.tagName) || node.properties.id) return
      node.properties.id = slugger.slug(textContent(node))
    })
  }
}

const LINE_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'pre', 'blockquote', 'table', 'tr', 'th', 'td', 'dt', 'dd',
])

/**
 * Records which source lines each block came from, so a selection in the
 * rendered view can point back at the markdown source.
 */
export function rehypeSourceLines() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (!LINE_TAGS.has(node.tagName) || !node.position) return
      node.properties.dataSline = node.position.start.line
      node.properties.dataEline = node.position.end.line
    })
  }
}
