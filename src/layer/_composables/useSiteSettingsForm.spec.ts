// @vitest-environment nuxt
import { afterEach, describe, expect, test, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useSiteSettingsForm } from './useSiteSettingsForm'
import * as cwaComposable from '#cwa/composables/cwa'

const stored = {
  siteName: 'Kitchens',
  concatTitle: true,
  canonicalUrl: '',
  sitemapXml: '',
  robotsText: '',
  maintenanceModeEnabled: false,
}

function setup(opts: { loadError?: unknown, failures?: { key: string, error: unknown }[] } = {}) {
  const config = ref<Record<string, any>>({ ...stored })
  const saveConfig = vi.fn(async (changed: Record<string, any>) => ({
    totalConfigsChanged: Object.keys(changed).length,
    done: Promise.resolve().then(() => {
      const failed = opts.failures ?? []
      const saved = Object.fromEntries(Object.entries(changed).filter(([key]) => !failed.some(failure => failure.key === key)))
      config.value = { ...config.value, ...saved }
      return failed
    }),
  }))
  const loadConfig = opts.loadError ? vi.fn().mockRejectedValue(opts.loadError) : vi.fn(async () => ({ ...config.value }))
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({
    siteConfig: {
      get config() { return config.value },
      loadConfig,
      saveConfig,
    },
  }))
  const scope = effectScope()
  const settings = scope.run(() => useSiteSettingsForm())!
  return { settings, config, saveConfig, loadConfig, scope }
}

describe('useSiteSettingsForm (#461)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('loads a local copy, so editing it changes nothing stored and counts as unsaved', async () => {
    const { settings, config } = setup()
    await settings.load()

    settings.form.model<string>('siteName').model.value = 'Our kitchens'

    expect(config.value.siteName).toBe('Kitchens')
    expect(settings.form.unsavedFields).toEqual(['siteName'])
  })

  test('a failed load says so and keeps no copy', async () => {
    const { settings } = setup({ loadError: new Error('offline') })
    await settings.load()

    expect(settings.loadError.value).toBe(true)
    expect(settings.local.value).toBeUndefined()
  })

  test('Save sends only the changed settings, in one save, then reads saved', async () => {
    const { settings, saveConfig } = setup()
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'
    settings.form.model('maintenanceModeEnabled').model.value = true

    await settings.save()

    expect(saveConfig).toHaveBeenCalledTimes(1)
    expect(saveConfig).toHaveBeenCalledWith({ siteName: 'Our kitchens', maintenanceModeEnabled: true })
    expect(settings.form.unsavedFields).toEqual([])
    expect(settings.form.savedAt).toEqual(expect.any(Number))
    expect(settings.form.saving).toBe(false)
  })

  test('is saving while the save is in flight', async () => {
    const { settings } = setup()
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'

    const saving = settings.save()
    expect(settings.form.saving).toBe(true)
    await saving
    expect(settings.form.saving).toBe(false)
  })

  test('a setting the API refuses with a 422 keeps its value and shows the API\'s message on it; the rest save', async () => {
    const error = Object.assign(new Error('422'), { statusCode: 422, data: { violations: [{ propertyPath: 'value', message: 'This value is not a valid URL.' }] } })
    const { settings } = setup({ failures: [{ key: 'canonicalUrl', error }] })
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'
    settings.form.model('canonicalUrl').model.value = 'https://kitchens.example'

    await settings.save()

    expect(settings.form.unsavedFields).toEqual(['canonicalUrl'])
    expect(settings.form.fieldErrors).toEqual({ canonicalUrl: 'This value is not a valid URL.' })
    expect(settings.form.failures).toBe(1)
    expect(settings.form.savedAt).toBeUndefined()
  })

  test.each([
    [500, 'The server couldn\'t save 1 setting. What you typed is still here: press Save to try again.'],
    [undefined, 'You\'re offline. 1 setting wasn\'t saved, and what you typed is still here.'],
  ])('a failure with status %s says so for the form', async (statusCode, message) => {
    const { settings } = setup({ failures: [{ key: 'siteName', error: Object.assign(new Error('x'), { statusCode }) }] })
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'

    await settings.save()

    expect(settings.form.formError).toBe(message)
    expect(settings.form.fieldErrors).toEqual({})
    expect(settings.form.unsavedFields).toEqual(['siteName'])
  })

  test.each([
    ['canonicalUrl', 'kitchens.example', 'Enter a full address, like https://example.com.'],
    ['sitemapXml', '<urlset>', expect.stringMatching(/^This isn't valid XML/)],
    ['robotsText', 'Disallow /', expect.stringMatching(/.+/)],
  ])('a client check on %s puts its message on the field and sends nothing', async (field, value, message) => {
    const { settings, saveConfig } = setup()
    await settings.load()
    settings.form.model(field).model.value = value

    await settings.save()

    expect(saveConfig).not.toHaveBeenCalled()
    expect(settings.form.fieldErrors).toEqual({ [field]: message })
    expect(settings.form.failures).toBe(1)
  })

  test('an empty canonical URL is allowed', async () => {
    const { settings, saveConfig } = setup()
    await settings.load()
    settings.form.model('canonicalUrl').model.value = 'https://kitchens.example'
    await settings.save()
    settings.form.model('canonicalUrl').model.value = ''

    await settings.save()

    expect(saveConfig).toHaveBeenLastCalledWith({ canonicalUrl: '' })
  })

  test('editing a field clears its error', async () => {
    const { settings } = setup()
    await settings.load()
    settings.form.model('canonicalUrl').model.value = 'kitchens'
    await settings.save()

    settings.form.model('canonicalUrl').model.value = 'https://kitchens.example'
    await flushPromises()

    expect(settings.form.fieldErrors).toEqual({})
  })

  test('a robots.txt blocking every crawler is a warning, never an error', async () => {
    const { settings, saveConfig } = setup()
    await settings.load()
    settings.form.model('robotsText').model.value = 'User-agent: *\nDisallow: /'
    await flushPromises()

    expect(settings.robotsWarnings.value).toEqual([
      'The user defined robots.txt is blocking indexing for all environments.',
      'It\'s recommended to use the `indexable` Site Config to toggle this instead.',
    ])
    await settings.save()
    expect(saveConfig).toHaveBeenCalledWith({ robotsText: 'User-agent: *\nDisallow: /' })
  })

  test('discard puts back what is stored and clears the errors', async () => {
    const { settings } = setup()
    await settings.load()
    settings.form.model('canonicalUrl').model.value = 'kitchens'
    await settings.save()

    settings.form.discard()

    expect(settings.local.value?.canonicalUrl).toBe('')
    expect(settings.form.unsavedFields).toEqual([])
    expect(settings.form.fieldErrors).toEqual({})
  })

  test('a stored change made elsewhere arrives, keeping what is being edited here', async () => {
    const { settings, config } = setup()
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'

    config.value = { ...config.value, maintenanceModeEnabled: true, siteName: 'Their kitchens' }
    await flushPromises()

    expect(settings.local.value?.maintenanceModeEnabled).toBe(true)
    expect(settings.local.value?.siteName).toBe('Our kitchens')
  })

  test('the stored settings are read inside the reactive callbacks, so a later change is seen (#285)', async () => {
    const { settings, config } = setup()
    await settings.load()
    const unsaved = computed(() => settings.form.unsavedFields.length)
    expect(unsaved.value).toBe(0)

    config.value = { ...config.value, siteName: 'Elsewhere' }
    await flushPromises()
    settings.form.model('siteName').model.value = 'Kitchens'

    expect(unsaved.value).toBe(1)
  })
})
