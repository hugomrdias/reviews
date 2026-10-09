import { afterEach, describe, expect, it, vi } from 'vitest'
import { getFileContent, getPathEntry } from './content'

// Each test uses its own repo ID, so cached answers never leak between tests.
let nextRepoId = 1
const SHA = 'a'.repeat(40)
const BLOB = 'b'.repeat(40)

const base64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))

/** Answers the contents API with `contents` and the blobs API with `blob`. */
function stubGitHub(contents: () => Response, blob = () => new Response('from the blob')) {
  const fetch = vi.fn(async (url: string) => (url.includes('/git/blobs/') ? blob() : contents()))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

async function read(path: string) {
  const repoId = nextRepoId++
  const found = await getPathEntry('token', repoId, 'octo', 'docs', SHA, path)
  if (found.kind !== 'file') return found
  return getFileContent('token', repoId, 'octo', 'docs', found.entry)
}

describe('getPathEntry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads a small file in one call, without the blob', async () => {
    // GitHub wraps its base64 in lines.
    const content = base64('# Guide\n\nCafé ☕\n').replace(/(.{8})/g, '$1\n')
    const fetch = stubGitHub(() =>
      Response.json({ type: 'file', path: 'docs/guide.md', sha: BLOB, size: 18, content, encoding: 'base64' }),
    )
    await expect(read('docs/guide.md')).resolves.toEqual({
      kind: 'text',
      path: 'docs/guide.md',
      blobSha: BLOB,
      size: 18,
      text: '# Guide\n\nCafé ☕\n',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain(`/repos/octo/docs/contents/docs/guide.md?ref=${SHA}`)
  })

  it('loads a file GitHub sends without content by its blob', async () => {
    const fetch = stubGitHub(() =>
      Response.json({ type: 'file', path: 'big.md', sha: BLOB, size: 1_500_000, content: '', encoding: 'none' }),
    )
    await expect(read('big.md')).resolves.toMatchObject({ kind: 'text', text: 'from the blob' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reads a symlink as its target, like the tree does', async () => {
    stubGitHub(
      () => Response.json({ type: 'symlink', path: 'link.md', sha: BLOB, size: 9, target: 'README.md' }),
      () => new Response('README.md'),
    )
    await expect(read('link.md')).resolves.toMatchObject({ kind: 'text', text: 'README.md' })
  })

  it('hands over the bytes it downloaded, images included', async () => {
    stubGitHub(() =>
      Response.json({ type: 'file', path: 'a.png', sha: BLOB, size: 3, content: btoa('\x89PN'), encoding: 'base64' }),
    )
    const repoId = nextRepoId++
    const onContent = vi.fn()
    await getPathEntry('token', repoId, 'octo', 'docs', SHA, 'a.png', onContent)
    expect(onContent).toHaveBeenCalledWith(new Uint8Array([0x89, 0x50, 0x4e]))
    // A cached answer has no bytes to hand over.
    onContent.mockClear()
    await getPathEntry('token', repoId, 'octo', 'docs', SHA, 'a.png', onContent)
    expect(onContent).not.toHaveBeenCalled()
  })

  it('encodes each segment of the path', async () => {
    const fetch = stubGitHub(() => Response.json([]))
    await read('docs/a b/#1.md')
    expect(fetch.mock.calls[0][0]).toContain('/contents/docs/a%20b/%231.md?')
  })

  it.each([
    ['a directory', () => Response.json([{ type: 'file', path: 'docs/a.md' }]), { kind: 'directory' }],
    ['the root', () => Response.json([]), { kind: 'directory' }],
    ['a missing path', () => new Response(null, { status: 404 }), { kind: 'missing' }],
    ['a submodule', () => Response.json({ type: 'submodule', path: 'vendor/x', sha: BLOB, size: 0 }), { kind: 'missing' }],
  ])('answers %s', async (_, contents, expected) => {
    stubGitHub(contents)
    await expect(read('docs')).resolves.toEqual(expected)
  })

  it('leaves GitHub errors alone', async () => {
    stubGitHub(() => new Response(null, { status: 502 }))
    await expect(read('docs/a.md')).rejects.toThrow('GitHub 502')
  })
})
