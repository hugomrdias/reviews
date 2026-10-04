import { memo, useEffect, useId, useState } from 'react'
import { PlainCode } from '@/components/code/CodeBlock'
import { useTheme } from '@/lib/theme'

type Mermaid = typeof import('mermaid').default

let mermaidPromise: Promise<Mermaid> | undefined

/** Mermaid is large, so it loads on the first diagram, in the browser only. */
function loadMermaid() {
  mermaidPromise ??= import('mermaid').then((m) => m.default)
  return mermaidPromise
}

async function renderDiagram(id: string, source: string, dark: boolean) {
  const [mermaid] = await Promise.all([loadMermaid(), document.fonts.ready])
  mermaid.initialize({
    startOnLoad: false,
    // Diagrams come from arbitrary repos: labels are sanitized and
    // click handlers are off. Diagrams can't loosen this with %%{init}%%.
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: dark ? 'dark' : 'neutral',
    fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-sans'),
  })
  const { svg } = await mermaid.render(id, source)
  return svg
}

type State = { status: 'pending' } | { status: 'done'; svg: string } | { status: 'error'; message: string }

/**
 * A ```mermaid fence, drawn as a diagram the way GitHub does. The server and
 * the first client render show the source; the diagram replaces it once
 * Mermaid loads. Invalid diagrams keep the source and show the parse error.
 */
export const MermaidDiagram = memo(function MermaidDiagram({ source }: { source: string }) {
  const { resolvedTheme } = useTheme()
  // Mermaid uses the id in CSS selectors, so it must be selector-safe.
  const id = `mermaid-${useId().replace(/[^\w-]/g, '')}`
  const [state, setState] = useState<State>({ status: 'pending' })

  useEffect(() => {
    let cancelled = false
    renderDiagram(id, source, resolvedTheme === 'dark').then(
      (svg) => !cancelled && setState({ status: 'done', svg }),
      (error: unknown) =>
        !cancelled && setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [id, source, resolvedTheme])

  if (state.status === 'done') {
    return (
      <div
        data-anchor-skip
        role="img"
        aria-label="Mermaid diagram"
        className="mermaid-diagram overflow-x-auto rounded-lg border bg-card p-4"
        // Mermaid's own output under securityLevel 'strict' (DOMPurify-sanitized).
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    )
  }
  return (
    <div data-anchor-skip className="overflow-hidden rounded-lg border bg-card">
      {state.status === 'error' && (
        <p className="border-b px-4 py-2 font-sans text-sm text-destructive">
          Unable to render Mermaid diagram: {state.message}
        </p>
      )}
      <PlainCode code={source} />
    </div>
  )
})
