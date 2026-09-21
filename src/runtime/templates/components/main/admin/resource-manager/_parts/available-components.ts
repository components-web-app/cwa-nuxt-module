import type { ApiDocumentationComponentMetadata } from '#cwa/api/api-documentation'

export function isComponentAllowedInGroup(
  meta: Pick<ApiDocumentationComponentMetadata, 'endpoint' | 'explicitAllowOnly'>,
  normalizedAllowed: string[] | null | undefined,
): boolean {
  if (normalizedAllowed) {
    return normalizedAllowed.includes(meta.endpoint)
  }
  return !meta.explicitAllowOnly
}
