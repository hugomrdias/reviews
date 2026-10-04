import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/lib/theme'
import { MarkdownView, type RepoContext } from './MarkdownView'

vi.mock('@pierre/diffs/react', () => ({ File: () => null }))
vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({ server: () => ({ client: () => () => 'system' }) }),
}))
vi.mock('@tanstack/react-start/server', () => ({ getCookie: () => undefined }))

const paths = ['README.md', 'img/a.png']
const ctx: RepoContext = {
  owner: 'acme',
  repo: 'widgets',
  ref: 'main',
  sha: 'a'.repeat(40),
  path: 'README.md',
  paths,
  pathSet: new Set(paths),
}

function render(source: string) {
  return renderToStaticMarkup(
    <ThemeProvider initial="light">
      <MarkdownView source={source} ctx={ctx} />
    </ThemeProvider>,
  )
}

describe('MarkdownView sanitization', () => {
  it.each([
    ['<script>alert(1)</script>', /<script/i],
    ['<img src=x onerror="alert(1)">', /onerror/i],
    ['<iframe src="https://evil.example"></iframe>', /<iframe/i],
    ['<svg onload="alert(1)"><circle/></svg>', /onload|<svg/i],
    ['<p style="position:fixed">x</p>', /style=/i],
    ['[click](javascript:alert(1))', /javascript:/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
  ])('strips %s', (source, forbidden) => {
    expect(render(source)).not.toMatch(forbidden)
  })
})

describe('MarkdownView output', () => {
  it('gives headings GitHub ids', () => {
    expect(render('## Getting started')).toContain('id="user-content-getting-started"')
    expect(render('# A\n\n# A')).toContain('id="user-content-a-1"')
  })

  it('renders GitHub alerts without the marker', () => {
    const html = render('> [!WARNING]\n> Rotate the keys first.')
    expect(html).toContain('data-alert-box')
    expect(html).toContain('Rotate the keys first.')
    expect(html).not.toContain('[!WARNING]')
  })

  it('records source lines on blocks', () => {
    expect(render('one\n\ntwo')).toContain('data-sline="3"')
  })

  it('loads relative images through the asset proxy', () => {
    expect(render('![logo](img/a.png)')).toContain(`/api/raw/acme/widgets/${'a'.repeat(40)}/img/a.png`)
  })

  it('renders code blocks as plain text on the server', () => {
    const html = render('```ts\nconst a = 1\n```')
    expect(html).toContain('data-anchor-skip')
    expect(html).toContain('const a = 1')
  })

  it('renders mermaid fences as their source on the server', () => {
    const html = render('```mermaid\nflowchart LR\n  a --> b\n```')
    expect(html).toContain('data-anchor-skip')
    expect(html).toContain('a --&gt; b')
    expect(html).not.toContain('<svg')
  })

  it('renders task lists and tables', () => {
    expect(render('- [x] done')).toContain('type="checkbox"')
    expect(render('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table')
  })
})
