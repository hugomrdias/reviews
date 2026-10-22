import { memo } from 'react'
import { PlainCode } from '@/components/code/CodeBlock'
import { DiagramZoom } from '@/components/markdown/DiagramZoom'
import type { Diagram } from '@/lib/markdown/diagrams'

/**
 * A ```mermaid fence, drawn on the server by Ondine (server/diagrams.ts), so
 * the page arrives with it. Colors follow the theme through `--ondine-*`
 * properties. Invalid diagrams keep the source and show the parse error, and a
 * fence the server didn't draw shows its source.
 */
export const MermaidDiagram = memo(function MermaidDiagram({
  source,
  diagram,
}: {
  source: string
  diagram: Diagram | undefined
}) {
  if (diagram && 'svg' in diagram) {
    return (
      <div data-anchor-skip>
        <DiagramZoom id={diagram.id} svg={diagram.svg}>
          <div
            role="img"
            aria-label="Mermaid diagram"
            className="mermaid-diagram overflow-x-auto rounded-lg border bg-card p-4"
            // Ondine's output: authored strings are escaped, and it has no scripts or event handlers.
            dangerouslySetInnerHTML={{ __html: diagram.svg }}
          />
        </DiagramZoom>
      </div>
    )
  }
  return (
    <div data-anchor-skip className="overflow-hidden rounded-lg border bg-card">
      {diagram && 'error' in diagram && (
        <p className="border-b px-4 py-2 font-sans text-sm whitespace-pre-wrap text-destructive">
          Unable to render Mermaid diagram: {diagram.error}
        </p>
      )}
      <PlainCode code={source} />
    </div>
  )
})
