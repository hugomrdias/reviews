import { describe, expect, it } from 'vitest'
import { CodedError, ERROR_CODES, errorCode, shouldRetryQuery } from './errors'

describe('errorCode', () => {
  it.each(ERROR_CODES)('reads %s from a coded error', (code) => {
    expect(errorCode(new CodedError(code))).toBe(code)
  })

  it('reads the code from a plain error, which is what reaches the client', () => {
    expect(errorCode(new Error('NO_WRITE_ACCESS'))).toBe('NO_WRITE_ACCESS')
  })

  it.each([
    ['another message', new Error('Not found: /repos/octo/docs')],
    ['a code inside a longer message', new Error('NO_ACCESS to octo/docs')],
    ['a string', 'NO_ACCESS'],
    ['nothing', undefined],
  ])('ignores %s', (_, error) => {
    expect(errorCode(error)).toBeNull()
  })
})

describe('shouldRetryQuery', () => {
  it('retries other errors twice', () => {
    const error = new Error('GitHub 502 for /repos/octo/docs/git/trees/abc')
    expect(shouldRetryQuery(0, error)).toBe(true)
    expect(shouldRetryQuery(1, error)).toBe(true)
    expect(shouldRetryQuery(2, error)).toBe(false)
  })

  it.each(ERROR_CODES)('never retries %s', (code) => {
    expect(shouldRetryQuery(0, new CodedError(code))).toBe(false)
    expect(shouldRetryQuery(0, new Error(code))).toBe(false)
  })
})
