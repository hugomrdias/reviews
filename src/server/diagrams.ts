import { create } from 'ondine/compiler/wasm'
// Workers can't compile WebAssembly at runtime, so the bundler compiles it ahead of time.
import all from 'ondine/compiler/wasm/all.wasm?module'
import { mermaidSources, type Diagram } from '@/lib/markdown/diagrams'

const renderer = create({ modules: { all } })

// Diagrams draw inside the file's request, so a file draws only so much: a
// 1,000-edge flowchart takes about 30ms. Fences past the budget show their source.
const MAX_DIAGRAMS = 30
const MAX_SOURCE = 100_000
const MAX_SVG = 3_000_000

/**
 * Draws a markdown file's ```mermaid fences as SVG with Ondine, so the page
 * arrives with its diagrams. Ondine follows Mermaid's syntax and strict
 * security level: labels are escaped, and the SVG has no scripts, event
 * handlers or external references.
 */
export function renderDiagrams(markdown: string, path: string): Diagram[] {
  let sourceChars = 0
  let svgChars = 0
  return mermaidSources(markdown, path).map((source, i) => {
    sourceChars += source.length
    if (i >= MAX_DIAGRAMS || sourceChars > MAX_SOURCE || svgChars >= MAX_SVG) {
      return { source, error: 'This file has more diagrams than the page draws.' }
    }
    // The prefix keeps element ids apart when a page has several diagrams.
    const id = `mermaid-${i}-`
    try {
      const { svg } = renderer.render(source, { idPrefix: id, outputLimit: MAX_SVG - svgChars })
      svgChars += svg.length
      return { source, svg, id }
    } catch (error) {
      // A bad diagram shows its error in place; the rest of the file still renders.
      return { source, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
