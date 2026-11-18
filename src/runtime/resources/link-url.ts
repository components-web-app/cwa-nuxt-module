const PATH = /^\/(?!\/)\S*$/
const ABSOLUTE = /^https?:\/\/[^\s/?#]+(?:[/?#]\S*)?$/i

export function isLinkUrl(value: unknown): boolean {
  return typeof value === 'string' && (PATH.test(value) || ABSOLUTE.test(value))
}

export function isOffSiteUrl(value: unknown): boolean {
  return typeof value === 'string' && ABSOLUTE.test(value)
}
