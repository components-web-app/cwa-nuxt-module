// @vitest-environment node

import { describe, expect, test } from 'vitest'
import { createCwaResourceError } from './cwa-resource-error'
import { isApiUnreachable } from './api-unreachable'

function fetchError(properties: { statusCode?: number, request?: string }) {
  return createCwaResourceError({ message: 'failed', ...properties })
}

describe('isApiUnreachable', () => {
  test('a request that got no response at all means the API is unreachable', () => {
    expect(isApiUnreachable(fetchError({ request: 'https://api.example.com/_api/_/routes//' }))).toBe(true)
  })

  test.each([502, 503, 504])('a %i means the API is unreachable', (statusCode) => {
    expect(isApiUnreachable(fetchError({ statusCode, request: 'https://api.example.com/_api/_/routes//' }))).toBe(true)
  })

  test('an API 500 is not unreachable, because the API answered', () => {
    expect(isApiUnreachable(fetchError({ statusCode: 500, request: 'https://api.example.com/_api/_/routes//' }))).toBe(false)
  })

  test.each([401, 403, 404])('a %i is not unreachable', (statusCode) => {
    expect(isApiUnreachable(fetchError({ statusCode, request: 'https://api.example.com/_api/_/routes//' }))).toBe(false)
  })

  test('an error with no status and no request is not unreachable', () => {
    expect(isApiUnreachable(createCwaResourceError(new Error('Not Saved. The response was not a valid CWA Resource. (/x)')))).toBe(false)
  })

  test('no error at all is not unreachable', () => {
    expect(isApiUnreachable(undefined)).toBe(false)
  })
})
