import { describe, expect, test } from 'vitest'
import { isLinkUrl, isOffSiteUrl } from './link-url'

describe('link URLs (#460)', () => {
  test.each(['/about', '/', '/a/b?c=1#d', 'https://example.com', 'http://example.com/path', 'HTTPS://Example.co.uk/x', 'https://localhost:3001'])('%s is a link URL', (value) => {
    expect(isLinkUrl(value)).toBe(true)
  })

  test.each(['about us', 'about', '//evil.com', 'https://', 'ftp://example.com', '/about us', '', null, undefined])('%s is not', (value) => {
    expect(isLinkUrl(value)).toBe(false)
  })

  test('only a full http(s) address is off-site', () => {
    expect(isOffSiteUrl('https://example.com')).toBe(true)
    expect(isOffSiteUrl('/about')).toBe(false)
  })
})
