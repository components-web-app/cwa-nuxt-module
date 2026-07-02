import type { ApiDocumentationComponentMetadata } from '#cwa/api/api-documentation'

/**
 * Whether a component type may be offered/added to a component group, mirroring the server-side
 * `ComponentPositionValidator` rule (#249):
 *
 * - If the group restricts placement via `allowedComponents` (a non-empty-or-empty list is still a
 *   restriction), the component's endpoint must be listed.
 * - If the group is unrestricted (`allowedComponents` is null/undefined), the component is offered
 *   unless it is `explicitAllowOnly` — an opt-in-only type that must be explicitly allowed.
 *
 * `normalizedAllowed` must already have the API path prefix stripped so it matches the prefix-free
 * `meta.endpoint` values from `getComponentMetadata`.
 */
export function isComponentAllowedInGroup(
  meta: Pick<ApiDocumentationComponentMetadata, 'endpoint' | 'explicitAllowOnly'>,
  normalizedAllowed: string[] | null | undefined,
): boolean {
  if (normalizedAllowed) {
    return normalizedAllowed.includes(meta.endpoint)
  }
  return !meta.explicitAllowOnly
}
