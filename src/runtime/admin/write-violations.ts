import type Cwa from '#cwa/cwa'
import { violationField } from '#cwa/admin/field-states'
import { writeFieldStates } from '#cwa/resources/field-state-writer'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import type { CwaErrorEvent, CwaViolationError } from '#cwa/storage/stores/error/state'
import type { ApiResourceEvent } from '#cwa/resources/resources-manager'

export interface BarFields {
  iri: () => string | undefined
  fields: () => string[]
  show: (field: string) => void
}

const bars = new WeakMap<Cwa, BarFields>()
const claims = new WeakMap<Cwa, Map<number, CwaViolationError[]>>()

export function registerBarFields($cwa: Cwa, bar: BarFields) {
  bars.set($cwa, bar)
  return () => {
    bars.get($cwa) === bar && bars.delete($cwa)
  }
}

function iriOf(event: ApiResourceEvent) {
  return (event.iri || event.endpoint).split('?')[0] as string
}

function writesTo($cwa: Cwa, event: ApiResourceEvent, current: string) {
  if (current === NEW_RESOURCE_IRI) {
    return event.endpoint === $cwa.resources.getResource(NEW_RESOURCE_IRI).value?.data?._metadata?.adding?.endpoint
  }
  return $cwa.resources.findAllPublishableIris(current).includes(iriOf(event))
}

function clearOnSave($cwa: Cwa) {
  $cwa.resourcesManager.writeSaved ??= (event) => {
    const iri = iriOf(event)
    for (const each of new Set([iri, ...$cwa.resources.findAllPublishableIris(iri)])) {
      const entry = $cwa.resources.getResource(each).value
      entry && writeFieldStates(states => states.writeSaved(entry))
    }
  }
}

function claim($cwa: Cwa, error: CwaErrorEvent): CwaViolationError[] {
  const violations = error.violations ?? []
  const event = error.event
  const bar = bars.get($cwa)
  const current = bar?.iri()
  if (error.statusCode !== 422 || !violations.length || !event || !('data' in event) || event.onRequest || !bar || !current || !writesTo($cwa, event, current)) {
    return violations
  }
  const fields = bar.fields()
  const messages: Record<string, string> = {}
  const left: CwaViolationError[] = []
  for (const violation of violations) {
    const field = violationField(violation.property, fields)
    if (!field) {
      left.push(violation)
      continue
    }
    messages[field] ??= violation.message
  }
  const first = fields.find(field => field in messages)
  const entry = $cwa.resources.getResource(current).value
  if (!first || !entry) {
    return violations
  }
  clearOnSave($cwa)
  writeFieldStates(states => states.writeRefused(entry, messages, 422, event.retry))
  bar.show(first)
  return left
}

export function unclaimedViolations($cwa: Cwa, error: CwaErrorEvent): CwaViolationError[] {
  let claimed = claims.get($cwa)
  if (!claimed) {
    claimed = new Map()
    claims.set($cwa, claimed)
  }
  let left = claimed.get(error.timestamp)
  if (!left) {
    left = claim($cwa, error)
    claimed.set(error.timestamp, left)
  }
  return left
}
