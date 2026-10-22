import { describe, expect, it } from 'vitest'
import { renderDiagrams } from './diagrams'

describe('renderDiagrams', () => {
  it('draws each mermaid fence as SVG in the Workers runtime', () => {
    const [diagram] = renderDiagrams('```mermaid\nflowchart LR\n  a --> b\n```', 'README.md')
    expect(diagram).toMatchObject({ source: 'flowchart LR\n  a --> b', id: 'mermaid-0-' })
    expect('svg' in diagram && diagram.svg).toMatch(/^<svg [^>]*class="ondine ondine-flowchart"/)
  })

  it('keeps the error of a diagram that fails, and draws the rest', () => {
    const diagrams = renderDiagrams('```mermaid\nflowchart LR\n  a -->\n```\n\n```mermaid\npie\n  "a" : 1\n```', 'README.md')
    expect(diagrams[0]).toMatchObject({ error: expect.stringContaining('Parse error') })
    expect(diagrams[1]).toHaveProperty('svg')
  })

  it('escapes labels', () => {
    const [diagram] = renderDiagrams('```mermaid\nflowchart LR\n  a["<img src=x onerror=alert(1)>"]\n```', 'README.md')
    expect('svg' in diagram && diagram.svg).not.toContain('<img')
  })
})
