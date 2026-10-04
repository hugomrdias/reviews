import { describe, expect, it } from 'vitest'
import { resolveAssetPath, resolveRepoLink, type LinkContext } from './links'

const paths = ['README.md', 'docs/README.md', 'docs/guide/setup.md', 'docs/api.md', 'img/logo.png', 'src/index.ts']
const ctx: LinkContext = {
  owner: 'acme',
  repo: 'widgets',
  path: 'docs/guide/setup.md',
  paths,
  pathSet: new Set(paths),
}

describe('resolveRepoLink', () => {
  it('resolves relative paths against the current file', () => {
    expect(resolveRepoLink('../api.md', ctx)).toEqual({ kind: 'internal', path: 'docs/api.md', hash: '' })
    expect(resolveRepoLink('./other.md#intro', ctx)).toEqual({
      kind: 'internal',
      path: 'docs/guide/other.md',
      hash: 'intro',
    })
  })

  it('resolves root-relative paths from the repo root', () => {
    expect(resolveRepoLink('/src/index.ts', ctx)).toEqual({ kind: 'internal', path: 'src/index.ts', hash: '' })
  })

  it('opens a directory README', () => {
    expect(resolveRepoLink('..', ctx)).toEqual({ kind: 'internal', path: 'docs/README.md', hash: '' })
    expect(resolveRepoLink('/docs/', ctx)).toEqual({ kind: 'internal', path: 'docs/README.md', hash: '' })
    expect(resolveRepoLink('/src', ctx)).toEqual({ kind: 'internal', path: 'src', hash: '' })
  })

  it('treats bare hashes as in-page links', () => {
    expect(resolveRepoLink('#install-steps', ctx)).toEqual({ kind: 'hash', hash: 'install-steps' })
    expect(resolveRepoLink('?plain=1', ctx)).toEqual({ kind: 'hash', hash: '' })
  })

  it('rejects paths that escape the repo', () => {
    expect(resolveRepoLink('../../../../etc/passwd', ctx)).toEqual({ kind: 'invalid' })
  })

  it('decodes encoded paths', () => {
    expect(resolveRepoLink('my%20notes.md', ctx)).toEqual({
      kind: 'internal',
      path: 'docs/guide/my notes.md',
      hash: '',
    })
  })

  it('keeps same-repo github.com links in the app', () => {
    expect(resolveRepoLink('https://github.com/acme/widgets/blob/main/docs/api.md#auth', ctx)).toEqual({
      kind: 'internal',
      path: 'docs/api.md',
      hash: 'auth',
      ref: 'main',
    })
    expect(resolveRepoLink('https://github.com/acme/other/blob/main/x.md', ctx)).toEqual({
      kind: 'external',
      href: 'https://github.com/acme/other/blob/main/x.md',
    })
  })

  it('leaves other schemes external', () => {
    expect(resolveRepoLink('mailto:a@b.c', ctx).kind).toBe('external')
    expect(resolveRepoLink('//cdn.example.com/x.js', ctx).kind).toBe('external')
  })
})

describe('resolveAssetPath', () => {
  it('resolves relative and root images', () => {
    expect(resolveAssetPath('../../img/logo.png', ctx.path)).toBe('img/logo.png')
    expect(resolveAssetPath('/img/logo.png?raw=true', ctx.path)).toBe('img/logo.png')
  })
  it('ignores external URLs', () => {
    expect(resolveAssetPath('https://example.com/a.png', ctx.path)).toBeNull()
    expect(resolveAssetPath('data:image/png;base64,xx', ctx.path)).toBeNull()
  })
})
