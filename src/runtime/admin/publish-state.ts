import { computed } from 'vue'
import type { Ref } from 'vue'
import type Cwa from '#cwa/cwa'
import { getPublishedResourceState } from '#cwa/resources/resource-utils'
import type { CwaResource } from '#cwa/resources/resource-utils'

export type PublishAction = 'Publish now' | 'Schedule'

const SCHEDULING = 'publishScheduling'
const SCHEDULE_VALUE = 'publishScheduleValue'
const SAVING = 'publishSaving'

export function usePublishState($cwa: Cwa, iri: Ref<string | undefined>, given?: Ref<CwaResource | undefined>) {
  const stack = $cwa.admin.resourceStackManager
  const resource = computed(() => given ? given.value : iri.value ? $cwa.resources.getResource(iri.value).value?.data : undefined)
  const published = computed(() => resource.value ? getPublishedResourceState({ data: resource.value }) : undefined)

  const scheduledAt = computed<string | undefined>(() => {
    const publishedAt = resource.value?.publishedAt
    if (published.value !== false || !publishedAt) {
      return
    }
    return new Date(publishedAt).getTime() > Date.now() ? publishedAt : undefined
  })

  const scheduling = computed<boolean>({
    get: () => stack.getState(SCHEDULING) ?? !!scheduledAt.value,
    set: value => stack.setState(SCHEDULING, value),
  })

  const scheduleValue = computed<string | null>({
    get: () => {
      const chosen = stack.getState(SCHEDULE_VALUE)
      return chosen === undefined ? scheduledAt.value ?? null : chosen
    },
    set: value => stack.setState(SCHEDULE_VALUE, value),
  })

  const saving = computed(() => !!stack.getState(SAVING))

  const action = computed<PublishAction | undefined>(() => {
    if (published.value !== false) {
      return
    }
    return scheduling.value ? 'Schedule' : 'Publish now'
  })

  async function save(publishedAt: string | null) {
    const endpoint = iri.value
    if (!endpoint) {
      return
    }
    stack.setState(SAVING, true)
    try {
      await $cwa.resourcesManager.updateResource({
        endpoint,
        data: { publishedAt },
      })
    }
    finally {
      stack.setState(SAVING, false)
    }
  }

  function run() {
    if (action.value === 'Publish now') {
      return save('now')
    }
    const chosen = scheduleValue.value
    if (action.value !== 'Schedule' || !chosen) {
      return
    }
    return save(new Date(chosen).getTime() > Date.now() ? chosen : 'now')
  }

  function cancelSchedule() {
    stack.setState(SCHEDULE_VALUE, undefined)
    return save(null)
  }

  return { published, scheduledAt, scheduling, scheduleValue, saving, action, run, cancelSchedule }
}
