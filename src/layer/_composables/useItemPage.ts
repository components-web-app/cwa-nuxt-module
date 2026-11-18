import { computed, isRef, onMounted, reactive, ref, toRaw, toValue, watch } from 'vue'
import type { ComputedRef, MaybeRefOrGetter, Ref } from 'vue'
import type { FetchError } from 'ofetch'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import isEqual from 'lodash-es/isEqual'
import { useCwaResourceRoute } from '#cwa/composables/useCwaResourceRoute'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useCwa } from '#cwa/composables/cwa'
import type { ApiResourceEvent } from '#cwa/resources/resources-manager'
import type { ResourceModelField, RemoteFieldChange } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import type { DialogFieldConflict, DialogForm } from '#cwa/templates/components/core/ui/dialog-form'

const IDLE: CwaFieldState = Object.freeze({ status: 'idle', waiting: false, slow: false })
const SOMEONE_ELSE = 'Someone else'

function fieldOfPath(path: string | undefined) {
  return path?.split(/[.[]/)[0] || undefined
}

export type TempCwaResource = Omit<CwaResource, '@id' | '_metadata'>

type StartsWithHash = `#${string}`

type UseItemOps = {
  createEndpoint: string | Ref<string>
  emit: ((evt: 'close') => void) & ((evt: 'reload') => void)
  resourceType?: string
  defaultResource: MaybeRefOrGetter<Omit<TempCwaResource, '@type'>>
  validate?: (data: any) => boolean | Record<string, string> | undefined
  endpoint?: Ref<string | undefined>
  routeHashAfterAdd?: ComputedRef<StartsWithHash>
  iri?: Ref<string | undefined>
  excludeFields?: string[]
  dismissStoredErrors?: boolean
}

export const useItemPage = ({ emit, resourceType, defaultResource, createEndpoint, validate, endpoint: userDefinedEndpoint, routeHashAfterAdd, iri, excludeFields, dismissStoredErrors }: UseItemOps) => {
  const $cwa = useCwa()
  const router = useRouter()
  const route = useRoute()

  function getStringFromParam(paramName: string): string {
    const paramValue = route.params[paramName]
    return (Array.isArray(paramValue) ? paramValue[0] : paramValue) || ''
  }

  const endpoint = computed(() => userDefinedEndpoint?.value || getStringFromParam('iri'))
  if (!endpoint.value) {
    throw new Error('No Endpoint Found For useItemPage composable')
  }

  const isLoading = ref(true)
  const isUpdating = ref(false)
  const localResourceData = ref<TempCwaResource | CwaResource>()
  const resourceIri = computed(() => (iri?.value || endpoint.value))

  const fieldErrors = ref<Record<string, string>>({})
  const conflicts = ref<Record<string, DialogFieldConflict>>({})
  const formError = ref<string>()
  const savedAt = ref<number>()
  const failures = ref(0)

  const isAdding = computed(() => endpoint.value === 'add')
  const apiState = computed(() => (isAdding.value ? undefined : $cwa.resources.getResource(resourceIri.value).value?.apiState))
  const resource = computed(() => isAdding.value ? localResourceData.value : $cwa.resources.getResource(resourceIri.value).value?.data)

  function formatDate(dateStr: string) {
    return dayjs(dateStr).format('DD/MM/YY @ HH:mm UTCZ')
  }

  async function loadResource() {
    if (isAdding.value) {
      localResourceData.value = {
        '@type': resourceType,
        ...toValue(defaultResource),
      }
      return localResourceData.value
    }
    const fetchProps = {
      path: endpoint.value,
      iri: iri?.value,
      shallowFetch: true,
    }
    const loadedResource = await $cwa.fetchResource(fetchProps)
    isLoading.value = false
    return loadedResource
  }

  async function deleteResource(refreshEndpoints?: string[] | undefined, requestCompleteFn?: ApiResourceEvent['requestCompleteFn'], confirmed = false) {
    isUpdating.value = true
    let deleted = false
    await $cwa.resourcesManager.deleteResource({
      endpoint: iri?.value || endpoint.value,
      refreshEndpoints,
      requestCompleteFn,
      saveCompleteFn: () => {
        deleted = true
        // if in cwa view
        emit('reload')
        emit('close')
      },
    }, confirmed)
    isUpdating.value = false
    return deleted
  }

  function saveTitle() {
    if (isAdding.value) {
      return
    }
    return saveResource()
  }

  function changedFields() {
    const local: { [key: string]: any } = localResourceData.value || {}
    const stored: { [key: string]: any } = resource.value || {}
    const changed: { [key: string]: any } = {}
    for (const [key, value] of Object.entries(local)) {
      if (!isEqual(value, stored[key])) {
        changed[key] = value
      }
    }
    return changed
  }

  async function saveResource(close = false, extraData?: Record<string, any>) {
    if (!localResourceData.value) {
      return
    }
    const invalid = validate?.(localResourceData.value)
    if (invalid === false) {
      return
    }
    if (typeof invalid === 'object' && Object.keys(invalid).length) {
      fieldErrors.value = { ...fieldErrors.value, ...invalid }
      formError.value = undefined
      savedAt.value = undefined
      failures.value++
      return
    }
    const doRequest = async () => {
      const data: { [key: string]: any } = {
        ...(isAdding.value ? localResourceData.value : changedFields()),
        ...extraData,
      }
      if (excludeFields) {
        for (const field of excludeFields) {
          data[field] && (delete data[field])
        }
      }
      if (isAdding.value) {
        const newResource = await $cwa.resourcesManager.createResource({
          endpoint: isRef(createEndpoint) ? createEndpoint.value : createEndpoint,
          data,
          source: 'admin-modal',
        })
        if (newResource) {
          emit('reload')
          if (close) {
            emit('close')
          }
          else {
            router.push({ name: route.name, params: { iri: newResource['@id'] }, query: route.query, hash: routeHashAfterAdd?.value })
          }
        }
        return newResource
      }

      if (!Object.keys(data).length) {
        if (close) {
          emit('close')
        }
        return resource.value as CwaResource | undefined
      }

      const base: { [key: string]: any } = { ...resource.value }
      let outcome: Promise<{ resource?: CwaResource, error?: FetchError<any> }> | undefined
      const event = {
        endpoint: iri?.value || endpoint.value,
        data,
        onRequest: (_iri: string, done?: Promise<{ resource?: CwaResource, error?: FetchError<any> }>) => {
          outcome = done
        },
      }
      const updatedResource = await $cwa.resourcesManager.updateResource(event)
      const failure = updatedResource ? undefined : (await outcome)?.error
      if (failure) {
        saveFailed(event, failure, Object.keys(data), base)
      }
      else if (updatedResource) {
        saveSucceeded(Object.keys(data))
      }
      if (updatedResource && localResourceData.value && updatedResource['@id'] === resource.value?.['@id']) {
        const local: { [key: string]: any } = { ...localResourceData.value }
        for (const key of Object.keys(data)) {
          if (key in updatedResource) {
            local[key] = updatedResource[key]
          }
          else {
            delete local[key]
          }
        }
        localResourceData.value = local as CwaResource
      }
      if (close && updatedResource) {
        emit('close')
      }
      return updatedResource
    }

    isUpdating.value = true
    const savedResource = await doRequest()
    isUpdating.value = false
    return savedResource
  }

  function dismissStoredError(event: object) {
    for (const error of $cwa.resourcesManager.errors) {
      if (error.event && toRaw(error.event) === event) {
        $cwa.resourcesManager.removeError(error.timestamp)
      }
    }
  }

  function saveSucceeded(fields: string[]) {
    const errors = { ...fieldErrors.value }
    for (const field of fields) {
      delete errors[field]
    }
    fieldErrors.value = errors
    formError.value = undefined
    savedAt.value = Date.now()
  }

  function saveFailed(event: object, failure: FetchError<any>, fields: string[], base: { [key: string]: any }) {
    dismissStoredErrors && dismissStoredError(event)
    savedAt.value = undefined
    const status = failure.statusCode
    if (status === 422 && Array.isArray(failure.data?.violations)) {
      const errors: Record<string, string> = {}
      const general: string[] = []
      for (const violation of failure.data.violations as { propertyPath?: string, message?: string }[]) {
        const field = fieldOfPath(violation.propertyPath)
        const message = violation.message || 'This value is not valid.'
        if (field && fields.includes(field)) {
          errors[field] ??= message
        }
        else {
          general.push(message)
        }
      }
      fieldErrors.value = { ...fieldErrors.value, ...errors }
      formError.value = general.length ? general.join(' ') : undefined
    }
    else if (status === 412 && failure.data?.['@id']) {
      const theirs: { [key: string]: any } = failure.data
      const found: Record<string, DialogFieldConflict> = {}
      for (const field of fields) {
        if (field in theirs && !isEqual(theirs[field], base[field])) {
          found[field] = { name: SOMEONE_ELSE, value: theirs[field] }
        }
      }
      conflicts.value = { ...conflicts.value, ...found }
      formError.value = Object.keys(found).length ? undefined : 'Someone else saved this first. Their changes are shown, and yours are kept: press Save again.'
      const storedVersion = resource.value?._metadata?.version
      const theirVersion = theirs._metadata?.version
      if (typeof theirVersion === 'number' && (typeof storedVersion !== 'number' || theirVersion > storedVersion)) {
        $cwa.resourcesManager.storeResource({ resource: theirs as CwaResource })
      }
    }
    else {
      formError.value = status ? 'The server couldn\'t save it. Nothing changed, and what you typed is still here.' : 'You\'re offline. This wasn\'t saved, and what you typed is still here.'
    }
    failures.value++
  }

  const unsavedFields = computed(() => {
    if (isAdding.value) {
      return []
    }
    return Object.keys(changedFields()).filter(field => !excludeFields?.includes(field))
  })

  watch(() => ({ ...localResourceData.value }) as { [key: string]: any }, (now, before) => {
    const cleared = Object.keys(fieldErrors.value).filter(field => !isEqual(now[field], before?.[field]))
    if (cleared.length) {
      const errors = { ...fieldErrors.value }
      cleared.forEach(field => delete errors[field])
      fieldErrors.value = errors
    }
  })

  function resolveConflict(field: string, value?: { value: unknown }) {
    const { [field]: _resolved, ...rest } = conflicts.value
    conflicts.value = rest
    if (value && localResourceData.value) {
      (localResourceData.value as { [key: string]: any })[field] = value.value
    }
  }

  const models = new Map<string, ResourceModelField<any>>()

  function model<T = unknown>(field: string): ResourceModelField<T> {
    let found = models.get(field)
    if (!found) {
      const conflict = computed(() => conflicts.value[field])
      found = {
        field,
        model: computed({
          get: () => (localResourceData.value as { [key: string]: any } | undefined)?.[field],
          set: (value) => {
            if (localResourceData.value) {
              (localResourceData.value as { [key: string]: any })[field] = value
            }
          },
        }),
        state: computed<CwaFieldState>(() => {
          const error = fieldErrors.value[field]
          if (conflict.value) {
            return { status: 'conflict', waiting: false, slow: false, held: { user: { id: '', name: conflict.value.name }, value: conflict.value.value } }
          }
          return error ? { status: 'error', waiting: false, slow: false, error: { kind: 'violation', message: error } } : IDLE
        }),
        remoteChange: computed<RemoteFieldChange<unknown> | undefined>(() => conflict.value
          ? {
              name: conflict.value.name,
              value: conflict.value.value,
              accept: () => resolveConflict(field, { value: conflict.value!.value }),
              keep: async () => resolveConflict(field),
            }
          : undefined),
      }
      models.set(field, found)
    }
    return found as ResourceModelField<T>
  }

  function discard() {
    fieldErrors.value = {}
    conflicts.value = {}
    formError.value = undefined
    syncLocalResourceWithStore()
  }

  const form: DialogForm = reactive({
    unsavedFields,
    fieldErrors,
    conflicts,
    formError,
    saving: isUpdating,
    savedAt,
    failures,
    model,
    discard,
  }) as unknown as DialogForm

  function syncLocalResourceWithStore(newResource?: TempCwaResource | undefined) {
    const storeResource = newResource || resource.value
    if (!isAdding.value && storeResource) {
      localResourceData.value = { ...storeResource }
    }
  }

  function keepLocalEdits(newResource?: TempCwaResource | CwaResource, oldResource?: TempCwaResource | CwaResource) {
    const local: { [key: string]: any } | undefined = localResourceData.value
    if (isAdding.value || !newResource || !local || !oldResource || newResource['@id'] !== oldResource['@id']) {
      syncLocalResourceWithStore(newResource)
      return
    }
    const stored: { [key: string]: any } = oldResource
    const edits = Object.entries(local).filter(([key, value]) => !isEqual(value, stored[key]))
    localResourceData.value = { ...newResource, ...Object.fromEntries(edits) }
  }

  watch(resource, keepLocalEdits)
  watch(endpoint, loadResource)

  onMounted(async () => {
    await loadResource()
    if (!resource.value || (resourceType !== undefined && resource.value['@type'] !== resourceType)) {
      emit('close')
      isLoading.value = false
      return
    }
    isLoading.value = false
  })

  const { getInternalResourceLink } = useCwaResourceRoute()

  return {
    isLoading,
    isUpdating,
    resource,
    localResourceData,
    isAdding,
    apiState,
    formatDate,
    deleteResource,
    saveTitle,
    saveResource,
    loadResource,
    resetResource: syncLocalResourceWithStore,
    getInternalResourceLink,
    form,
  }
}
