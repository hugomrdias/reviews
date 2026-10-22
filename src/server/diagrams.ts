import { create } from 'ondine/compiler/wasm'
// Workers can't compile WebAssembly at runtime, so the bundler compiles it ahead of time.
import all from 'ondine/compiler/wasm/all.wasm?module'
import { mermaidSources, type Diagram } from '@/lib/markdown/diagrams'

const renderer = create({ modules: { all } })

/**
 * Draws a markdown file's ```mermaid fences as SVG with Ondine, so the page
 * arrives with its diagrams. Ondine follows Mermaid's syntax and strict
 * security level: labels are escaped, and the SVG has no scripts, event
 * handlers or external references.
 */
export function renderDiagrams(markdown: string, path: string): Diagram[] {
  return mermaidSources(markdown, path).map((source, i) => {
    // The prefix keeps element ids apart when a page has several diagrams.
    const id = `mermaid-${i}-`
    try {
      return { source, svg: renderer.render(source, { idPrefix: id }).svg, id }
    } catch (error) {
      // A bad diagram shows its error in place; the rest of the file still renders.
      return { source, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
