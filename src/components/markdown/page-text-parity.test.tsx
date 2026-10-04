// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { releaseProcess } from '@/dev/fixtures'
import { buildTextIndex } from '@/lib/anchoring/text-index'
import { pageText } from '@/lib/markdown/page-text'
import { ThemeProvider } from '@/lib/theme'
import { MarkdownView, type RepoContext } from './MarkdownView'

vi.mock('@pierre/diffs/react', () => ({ File: () => null }))
vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({ server: () => ({ client: () => () => 'system' }) }),
}))
vi.mock('@tanstack/react-start/server', () => ({ getCookie: () => undefined }))
// Internal links need a router; a plain anchor renders the same text.
vi.mock(import('@tanstack/react-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  Link: (({ children }: { children?: React.ReactNode }) => <a>{children}</a>) as never,
}))

const paths = ['README.md', 'docs/on-call.md']

function ctx(path: string): RepoContext {
  return { owner: 'acme', repo: 'widgets', ref: 'main', sha: 'a'.repeat(40), path, paths, pathSet: new Set(paths) }
}

/** What the page's text index reads, from the server-rendered markup. */
function domText(source: string, path: string) {
  const root = document.createElement('div')
  root.innerHTML = renderToStaticMarkup(
    <ThemeProvider initial="light">
      <MarkdownView source={source} ctx={ctx(path)} />
    </ThemeProvider>,
  )
  return buildTextIndex(root).text
}

const kitchenSink = `---
title: Everything
---

# Heading with \`code\` and **bold**

A paragraph with *emphasis*, a [link](./README.md), an ![image](img.png) and a footnote.[^1]
It wraps onto a second line.

> [!WARNING]
> Rotate the keys first.

> A plain quote.

- [x] done
- [ ] not done
  - nested item

1. first
2. second

| Name | Value |
|------|-------|
| a    | 1     |
| b    | **2** |

\`\`\`ts
const hidden = 'code blocks are skipped'
\`\`\`

\`\`\`mermaid
flowchart LR
  a --> b
\`\`\`

<details>
<summary>More</summary>

Inside **details**.

</details>

<p align="center">Raw <em>HTML</em> &amp; entities &copy;</p>

<!-- a comment -->

Term with a hard break\\
next line.

---

[^1]: The footnote text.
`

describe('pageText matches the page', () => {
  it.each([
    ['the release process fixture', releaseProcess, 'docs/release-process.md'],
    ['every kind of block', kitchenSink, 'docs/everything.md'],
    ['mdx with imports', `import X from './x'\n\n# Title\n\nBody text.`, 'docs/page.mdx'],
  ])('%s', (_, source, path) => {
    expect(pageText(source, path).text).toBe(domText(source, path))
  })
})

describe('pageText', () => {
  const { text } = pageText(kitchenSink, 'docs/everything.md')

  it('includes text the page adds, such as alert titles', () => {
    expect(text).toMatch(/Warning\s*Rotate the keys first\./)
  })

  it('leaves out code blocks, diagrams, front matter and comments', () => {
    expect(text).not.toContain('code blocks are skipped')
    expect(text).not.toContain('flowchart')
    expect(text).not.toContain('title: Everything')
    expect(text).not.toContain('a comment')
  })
})
