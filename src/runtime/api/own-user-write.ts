import { toRaw } from 'vue'
import type { FetchError } from 'ofetch'
import type Cwa from '#cwa/cwa'
import type { CwaUser } from '#cwa/storage/stores/auth/state'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { violationField } from '#cwa/admin/field-states'

export interface OwnUserWriteResult {
  user?: CwaUser
  fieldErrors: Record<string, string>
  failure?: string
}

export async function writeOwnUser($cwa: Cwa, data: Record<string, unknown>, fields: string[]): Promise<OwnUserWriteResult> {
  const endpoint = $cwa.auth.user?.['@id']
  if (!endpoint) {
    return { fieldErrors: {}, failure: 'You\'re not signed in.' }
  }
  let outcome: Promise<{ resource?: CwaResource, error?: FetchError<any> }> | undefined
  const event = {
    endpoint,
    data,
    onRequest: (_iri: string, done?: Promise<{ resource?: CwaResource, error?: FetchError<any> }>) => {
      outcome = done
    },
  }
  const resource = await $cwa.resourcesManager.updateResource(event)
  if (resource) {
    return { user: resource as CwaUser, fieldErrors: {} }
  }
  const error = (await outcome)?.error
  for (const stored of $cwa.resourcesManager.errors) {
    if (stored.event && toRaw(stored.event) === event) {
      $cwa.resourcesManager.removeError(stored.timestamp)
    }
  }
  const fieldErrors: Record<string, string> = {}
  const unclaimed: string[] = []
  const violations = error?.statusCode === 422 && Array.isArray(error.data?.violations) ? error.data.violations as { propertyPath?: string, message?: string }[] : undefined
  for (const violation of violations ?? []) {
    const field = violationField(violation.propertyPath, fields)
    const message = violation.message || 'This value is not valid.'
    if (field) {
      fieldErrors[field] ??= message
    }
    else {
      unclaimed.push(message)
    }
  }
  if (violations) {
    return { fieldErrors, failure: unclaimed.length ? unclaimed.join(' ') : undefined }
  }
  return {
    fieldErrors,
    failure: error?.statusCode ? 'The server couldn\'t save it. Nothing changed.' : 'You\'re offline. Nothing was saved.',
  }
}
