// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useSiteSettingsForm } from './useSiteSettingsForm'
import * as cwaComposable from '#cwa/composables/cwa'
import SiteConfig from '#cwa/api/site-config'
import { SiteConfigStore } from '#cwa/storage/stores/site-config/site-config-store'

const mockUpdateSiteConfig = vi.hoisted(() => vi.fn())
mockNuxtImport('updateSiteConfig', () => mockUpdateSiteConfig)

const stored: Record<string, string> = {
  siteName: 'Kitchens',
  concatTitle: 'true',
  canonicalUrl: '',
  robotsText: 'User-agent: *\nAllow: /',
  maintenanceModeEnabled: 'false',
}

function setup(opts: { loadError?: unknown, refuse?: Record<string, unknown>, hold?: Promise<void> } = {}) {
  const refuse = opts.refuse ?? {}
  const fetch = vi.fn(async (_path: string, options?: { body?: { key: string, value: unknown } }) => {
    if (!options?.body) {
      if (opts.loadError) {
        throw opts.loadError
      }
      return { member: Object.entries(stored).map(([key, value]) => ({ key, value })) }
    }
    await opts.hold
    const { key, value } = options.body
    if (key in refuse) {
      throw refuse[key]
    }
    return { key, value }
  })
  const cwaFetch = { fetch, getRequestOptions: vi.fn((method: string) => ({ method, headers: {} })) }
  const storeDefinition = new SiteConfigStore('settings-form')
  // @ts-expect-error partial CwaFetch
  const siteConfig = new SiteConfig(cwaFetch, storeDefinition, {})
  const saveConfig = vi.spyOn(siteConfig, 'saveConfig')
  // @ts-expect-error partial mock
  vi.spyOn(cwaComposable, 'useCwa').mockImplementation(() => ({ siteConfig }))
  const scope = effectScope()
  const settings = scope.run(() => useSiteSettingsForm())!
  const sent = () => fetch.mock.calls.filter(([, options]) => options?.body).map(([path, options]) => [path, options!.body])
  return { settings, siteConfig, store: storeDefinition.useStore(), saveConfig, sent, scope }
}

describe('useSiteSettingsForm (#461)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('loads a local copy, so editing it changes nothing stored and counts as unsaved', async () => {
    const { settings, siteConfig } = setup()
    await settings.load()

    settings.form.model<string>('siteName').model.value = 'Our kitchens'

    expect(siteConfig.config.siteName).toBe('Kitchens')
    expect(settings.form.unsavedFields).toEqual(['siteName'])
  })

  test('a failed load says so and keeps no copy', async () => {
    const { settings } = setup({ loadError: new Error('offline') })
    await settings.load()

    expect(settings.loadError.value).toBe(true)
    expect(settings.local.value).toBeUndefined()
  })

  test('Save sends only the changed settings, in one save, then reads saved', async () => {
    const { settings, saveConfig, sent } = setup()
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'
    settings.form.model('maintenanceModeEnabled').model.value = true

    await settings.save()

    expect(saveConfig).toHaveBeenCalledTimes(1)
    expect(saveConfig).toHaveBeenCalledWith({ siteName: 'Our kitchens', maintenanceModeEnabled: true })
    expect(sent()).toEqual([
      ['/_/site_config_parameters/siteName', { key: 'siteName', value: 'Our kitchens' }],
      ['/_/site_config_parameters/maintenanceModeEnabled', { key: 'maintenanceModeEnabled', value: 'true' }],
    ])
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

  test.each([
    ['siteName', 'CWA Web App'],
    ['robotsText', ''],
  ])('clearing %s saves it empty, the field shows the setting now in effect, and nothing is left unsaved', async (field, inEffect) => {
    const { settings, sent } = setup()
    await settings.load()
    settings.form.model(field).model.value = ''

    await settings.save()
    await flushPromises()

    expect(sent()).toEqual([[`/_/site_config_parameters/${field}`, { key: field, value: '' }]])
    expect(settings.local.value?.[field]).toBe(inEffect)
    expect(settings.form.unsavedFields).toEqual([])
  })

  test('a change typed while the save is in flight is kept and still unsaved', async () => {
    let release!: () => void
    const hold = new Promise<void>((resolve) => {
      release = resolve
    })
    const { settings } = setup({ hold })
    await settings.load()
    settings.form.model('siteName').model.value = ''

    const saving = settings.save()
    await flushPromises()
    settings.form.model('siteName').model.value = 'Typed meanwhile'
    release()
    await saving
    await flushPromises()

    expect(settings.local.value?.siteName).toBe('Typed meanwhile')
    expect(settings.form.unsavedFields).toEqual(['siteName'])
  })

  test('a setting the API refuses with a 422 keeps its value and shows the API\'s message on it; the rest save', async () => {
    const error = Object.assign(new Error('422'), { statusCode: 422, data: { violations: [{ propertyPath: 'value', message: 'This value is not a valid URL.' }] } })
    const { settings } = setup({ refuse: { canonicalUrl: error } })
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
    const { settings } = setup({ refuse: { siteName: Object.assign(new Error('x'), { statusCode }) } })
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'

    await settings.save()

    expect(settings.form.formError).toBe(message)
    expect(settings.form.fieldErrors).toEqual({})
    expect(settings.form.unsavedFields).toEqual(['siteName'])
  })

  test('a setting that was never stored and failed is created again on the retry', async () => {
    const { settings, sent } = setup({ refuse: { sitemapXml: Object.assign(new Error('x'), { statusCode: 500 }) } })
    await settings.load()
    settings.form.model('sitemapXml').model.value = '<urlset></urlset>'
    await settings.save()

    await settings.save()

    expect(sent().map(([path]) => path)).toEqual(['/_/site_config_parameters', '/_/site_config_parameters'])
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

  test('the canonical URL is trimmed before it is checked and sent', async () => {
    const { settings, sent } = setup()
    await settings.load()
    settings.form.model('canonicalUrl').model.value = '  https://kitchens.example \n'

    await settings.save()

    expect(settings.form.fieldErrors).toEqual({})
    expect(sent()).toEqual([['/_/site_config_parameters/canonicalUrl', { key: 'canonicalUrl', value: 'https://kitchens.example' }]])
    expect(settings.form.unsavedFields).toEqual([])
  })

  test('a canonical URL of only spaces is no change', async () => {
    const { settings, saveConfig } = setup()
    await settings.load()
    settings.form.model('canonicalUrl').model.value = '   '

    await settings.save()

    expect(saveConfig).not.toHaveBeenCalled()
    expect(settings.form.unsavedFields).toEqual([])
  })

  test('an empty canonical URL is allowed', async () => {
    const { settings, sent } = setup()
    await settings.load()
    settings.form.model('canonicalUrl').model.value = 'https://kitchens.example'
    await settings.save()
    settings.form.model('canonicalUrl').model.value = ''

    await settings.save()

    expect(sent().at(-1)).toEqual(['/_/site_config_parameters/canonicalUrl', { key: 'canonicalUrl', value: '' }])
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
    const { settings, store } = setup()
    await settings.load()
    settings.form.model('siteName').model.value = 'Our kitchens'

    store.$patch({ config: { ...store.config, maintenanceModeEnabled: true, siteName: 'Their kitchens' } })
    await flushPromises()

    expect(settings.local.value?.maintenanceModeEnabled).toBe(true)
    expect(settings.local.value?.siteName).toBe('Our kitchens')
  })

  test('the stored settings are read inside the reactive callbacks, so a later change is seen (#285)', async () => {
    const { settings, store } = setup()
    await settings.load()
    const unsaved = computed(() => settings.form.unsavedFields.length)
    expect(unsaved.value).toBe(0)

    store.$patch({ config: { ...store.config, siteName: 'Elsewhere' } })
    await flushPromises()
    settings.form.model('siteName').model.value = 'Kitchens'

    expect(unsaved.value).toBe(1)
  })
})
