import { describe, expect, it } from 'vitest'
import { mermaidSources } from './diagrams'

describe('mermaidSources', () => {
  it('finds mermaid fences in page order, once each', () => {
    const markdown = [
      '# Title',
      '```mermaid\nflowchart LR\n  a --> b\n```',
      '> [!NOTE]\n> ```Mermaid\n> sequenceDiagram\n>   A->>B: hi\n> ```',
      '```mermaid\nflowchart LR\n  a --> b\n```',
      '```ts\nconst mermaid = 1\n```',
    ].join('\n\n')
    expect(mermaidSources(markdown, 'README.md')).toEqual(['flowchart LR\n  a --> b', 'sequenceDiagram\n  A->>B: hi'])
  })

  it('reads raw HTML code blocks the way the page does', () => {
    const markdown = '<pre><code class="language-mermaid">pie\n  "a" : 1\n</code></pre>'
    expect(mermaidSources(markdown, 'README.md')).toEqual(['pie\n  "a" : 1'])
  })

  it('finds nothing in files without diagrams', () => {
    expect(mermaidSources('# Just text', 'README.md')).toEqual([])
  })
})
