import { afterEach, describe, expect, test, vi } from 'vitest'
import { consola } from 'consola'
import { resolveAllowedComponents } from './allowed-components'

vi.mock('#build/cwa-config', () => ({
  resourcesConfig: {
    Image: { ui: ['CwaComponentImageUiHero', 'CwaComponentImageUiWide'] },
    Title: { ui: ['CwaComponentTitleUiBig'] },
    Text: { ui: [] },
  },
}))

const metadata = {
  Image: { resourceName: 'Image', endpoint: '/component/images', isPublishable: false, explicitAllowOnly: false },
  Title: { resourceName: 'Title', endpoint: '/component/titles', isPublishable: false, explicitAllowOnly: false },
  Text: { resourceName: 'Text', endpoint: '/component/texts', isPublishable: false, explicitAllowOnly: false },
}

const getComponentMetadata = vi.fn(async () => metadata)

function captureWarnings() {
  return vi.spyOn(consola, 'warn').mockImplementation(() => undefined)
}

describe('resolveAllowedComponents UI names', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('short names sync as the values a component stores: default as null, a UI as its full name', async () => {
    const warn = captureWarnings()

    expect(await resolveAllowedComponents([{ component: 'Image', ui: ['default', 'Hero'] }], getComponentMetadata)).toEqual({
      allowedComponents: ['/component/images'],
      allowedComponentUi: { '/component/images': { ui: [null, 'CwaComponentImageUiHero'] } },
    })
    expect(warn).not.toHaveBeenCalled()
  })

  test('full UI names, the old syntax, sync the same and warn once per name that they stop working in the next alpha', async () => {
    const warn = captureWarnings()
    const rules = [{ component: 'Image', ui: ['CwaComponentImage', 'CwaComponentImageUiWide'] }]

    const first = await resolveAllowedComponents(rules, getComponentMetadata)
    const second = await resolveAllowedComponents(rules, getComponentMetadata)

    expect(first).toEqual({
      allowedComponents: ['/component/images'],
      allowedComponentUi: { '/component/images': { ui: [null, 'CwaComponentImageUiWide'] } },
    })
    expect(second).toEqual(first)
    expect(warn.mock.calls).toEqual([
      ['[CWA] The allowedComponents UI \'CwaComponentImage\' is a full UI name, the old syntax. Use the short name \'default\', from CwaComponentUis.Image. Full UI names will stop working in the next alpha, without further warning.'],
      ['[CWA] The allowedComponents UI \'CwaComponentImageUiWide\' is a full UI name, the old syntax. Use the short name \'Wide\', from CwaComponentUis.Image. Full UI names will stop working in the next alpha, without further warning.'],
    ])
  })

  test('a short name that is not that component\'s UI syncs nothing and warns, as an unknown component name does', async () => {
    const warn = captureWarnings()

    expect(await resolveAllowedComponents([
      'Text',
      { component: 'Title', ui: ['default', 'Hero'] },
    ], getComponentMetadata)).toBeUndefined()
    expect(warn).toHaveBeenCalledExactlyOnceWith('[CWA] allowedComponents was not synced: Title has no UI named Hero. Use a name from CwaComponentUis.Title.')
  })

  test('another component\'s full UI name is not this component\'s UI', async () => {
    const warn = captureWarnings()

    expect(await resolveAllowedComponents([{ component: 'Title', ui: ['CwaComponentImageUiHero'] }], getComponentMetadata)).toBeUndefined()
    expect(warn).toHaveBeenCalledExactlyOnceWith('[CWA] allowedComponents was not synced: Title has no UI named CwaComponentImageUiHero. Use a name from CwaComponentUis.Title.')
  })
})
