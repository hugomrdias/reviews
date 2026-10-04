import { describe, expect, it } from 'vitest'
import { pickLongestRef, splitRefPath } from './refs'

describe('pickLongestRef', () => {
  it('prefers the longest branch that matches whole segments', () => {
    const refs = ['feature', 'feature/auth', 'featureful']
    expect(pickLongestRef('feature/auth/docs/a.md', refs)).toBe('feature/auth')
    expect(pickLongestRef('feature/docs/a.md', refs)).toBe('feature')
    expect(pickLongestRef('feature', refs)).toBe('feature')
  })

  it('does not match partial segments', () => {
    expect(pickLongestRef('featureful-x/a.md', ['featureful'])).toBeNull()
  })
})

describe('splitRefPath', () => {
  it('splits the path after the ref', () => {
    expect(splitRefPath('feature/auth/docs/a.md', 'feature/auth')).toBe('docs/a.md')
    expect(splitRefPath('main', 'main')).toBe('')
  })
})
