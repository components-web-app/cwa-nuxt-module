import { computed, reactive, ref, watch } from 'vue'
import isEqual from 'lodash-es/isEqual'
import { asArray, parseRobotsTxt, validateRobots } from '#robots/util'
import { useCwa } from '#cwa/composables/cwa'
import type { SiteConfigParams } from '#cwa/types'
import type { ResourceModelField } from '#cwa/resources/model-editors'
import type { CwaFieldState } from '#cwa/storage/stores/resources/state'
import type { DialogForm } from '#cwa/templates/components/core/ui/dialog-form'

type Settings = Partial<SiteConfigParams> & Record<string, any>

const IDLE: CwaFieldState = Object.freeze({ status: 'idle', waiting: false, slow: false })

function settingsText(count: number) {
  return `${count} ${count === 1 ? 'setting' : 'settings'}`
}

function isFullUrl(value: string) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  }
  catch {
    return false
  }
}

function violationMessage(error: unknown) {
  const data = (error as { data?: { violations?: { message?: string }[], detail?: string } } | undefined)?.data
  return data?.violations?.[0]?.message || data?.detail || 'This value is not valid.'
}

export function robotsTxtWarnings(robotsText: string | undefined) {
  if (!robotsText) {
    return []
  }
  const wildCardGroups = parseRobotsTxt(robotsText).groups.filter((group: any) => asArray(group.userAgent).includes('*'))
  if (!wildCardGroups.some((group: any) => asArray(group.disallow).includes('/'))) {
    return []
  }
  return [
    'The user defined robots.txt is blocking indexing for all environments.',
    'It\'s recommended to use the `indexable` Site Config to toggle this instead.',
  ]
}

export function useSiteSettingsForm() {
  const $cwa = useCwa()
  const local = ref<Settings>()
  const loading = ref(true)
  const loadError = ref(false)
  const fieldErrors = ref<Record<string, string>>({})
  const formError = ref<string>()
  const saving = ref(false)
  const savedAt = ref<number>()
  const failures = ref(0)

  const stored = computed<Settings>(() => ($cwa.siteConfig.config ?? {}) as Settings)

  function changed() {
    const copy = local.value ?? {}
    return Object.keys(copy).filter(key => !isEqual(copy[key], stored.value[key]))
  }

  const unsavedFields = computed(() => changed())

  async function load() {
    loading.value = true
    loadError.value = false
    try {
      local.value = { ...await $cwa.siteConfig.loadConfig() } as Settings
    }
    catch {
      loadError.value = true
    }
    finally {
      loading.value = false
    }
  }

  watch(stored, (next, previous) => {
    if (!local.value) {
      return
    }
    const copy = local.value
    const edits = Object.keys(copy).filter(key => !isEqual(copy[key], previous?.[key]))
    local.value = { ...next, ...Object.fromEntries(edits.map(key => [key, copy[key]])) }
  })

  watch(() => ({ ...local.value }), (now, before) => {
    const cleared = Object.keys(fieldErrors.value).filter(field => !isEqual(now[field], before?.[field]))
    if (cleared.length) {
      const errors = { ...fieldErrors.value }
      cleared.forEach(field => delete errors[field])
      fieldErrors.value = errors
    }
  })

  const robotsWarnings = computed(() => robotsTxtWarnings(local.value?.robotsText))

  async function clientErrors(keys: string[]) {
    const errors: Record<string, string> = {}
    const copy = local.value ?? {}
    if (keys.includes('canonicalUrl') && copy.canonicalUrl && !isFullUrl(copy.canonicalUrl)) {
      errors.canonicalUrl = 'Enter a full address, like https://example.com.'
    }
    if (keys.includes('robotsText') && copy.robotsText) {
      const { errors: robotsErrors } = validateRobots(parseRobotsTxt(copy.robotsText))
      if (robotsErrors.length) {
        errors.robotsText = robotsErrors.join(' ')
      }
    }
    if (keys.includes('sitemapXml') && copy.sitemapXml) {
      const { XMLValidator } = await import('fast-xml-parser')
      const result = XMLValidator.validate(copy.sitemapXml)
      if (result !== true) {
        errors.sitemapXml = `This isn't valid XML: ${result.err.msg}`
      }
    }
    return errors
  }

  async function save() {
    if (!local.value || saving.value) {
      return
    }
    if (typeof local.value.canonicalUrl === 'string') {
      local.value.canonicalUrl = local.value.canonicalUrl.trim()
    }
    const keys = changed()
    if (!keys.length) {
      return
    }
    saving.value = true
    try {
      const errors = await clientErrors(keys)
      if (Object.keys(errors).length) {
        fieldErrors.value = errors
        formError.value = undefined
        savedAt.value = undefined
        failures.value++
        return
      }
      const copy = local.value
      const sent: Settings = Object.fromEntries(keys.map(key => [key, copy[key]]))
      const failed = await $cwa.siteConfig.saveConfig(sent as Partial<SiteConfigParams>)
      const now = local.value ?? copy
      keys
        .filter(key => !failed.some(failure => failure.key === key) && isEqual(now[key], sent[key]))
        .forEach((key) => {
          now[key] = stored.value[key]
        })
      const refused = failed.filter(({ error }) => (error as { statusCode?: number } | undefined)?.statusCode === 422)
      const others = failed.filter(failure => !refused.includes(failure))
      fieldErrors.value = Object.fromEntries(refused.map(({ key, error }) => [key, violationMessage(error)]))
      if (!others.length) {
        formError.value = undefined
      }
      else if (others.some(({ error }) => (error as { statusCode?: number } | undefined)?.statusCode)) {
        formError.value = `The server couldn't save ${settingsText(others.length)}. What you typed is still here: press Save to try again.`
      }
      else {
        formError.value = `You're offline. ${settingsText(others.length)} ${others.length === 1 ? 'wasn\'t' : 'weren\'t'} saved, and what you typed is still here.`
      }
      if (failed.length) {
        savedAt.value = undefined
        failures.value++
        return
      }
      savedAt.value = Date.now()
    }
    finally {
      saving.value = false
    }
  }

  const models = new Map<string, ResourceModelField<any>>()

  function model<T = unknown>(field: string): ResourceModelField<T> {
    let found = models.get(field)
    if (!found) {
      found = {
        field,
        model: computed({
          get: () => local.value?.[field],
          set: (value) => {
            if (local.value) {
              local.value[field] = value
            }
          },
        }),
        state: computed<CwaFieldState>(() => {
          const error = fieldErrors.value[field]
          return error ? { status: 'error', waiting: false, slow: false, error: { kind: 'violation', message: error } } : IDLE
        }),
        remoteChange: computed(() => undefined),
      } as unknown as ResourceModelField<any>
      models.set(field, found)
    }
    return found as ResourceModelField<T>
  }

  function discard() {
    fieldErrors.value = {}
    formError.value = undefined
    local.value = { ...stored.value }
  }

  const form: DialogForm = reactive({
    unsavedFields,
    fieldErrors,
    conflicts: {},
    formError,
    saving,
    savedAt,
    failures,
    model,
    discard,
  }) as unknown as DialogForm

  return { form, local, loading, loadError, load, save, robotsWarnings }
}
