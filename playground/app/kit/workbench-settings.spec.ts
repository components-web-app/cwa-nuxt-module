import { describe, expect, test } from 'vitest'
import { KIT_SETTINGS_KEY, defaultKitSettings, parseKitSettings, readKitSettings, resolveKitTheme, writeKitSettings } from './workbench-settings'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    values,
  }
}

describe('kit workbench settings', () => {
  test('a saved setting comes back on the next visit', () => {
    const storage = memoryStorage()
    writeKitSettings(() => storage, { theme: 'light', touch: true, width: '390', reducedMotion: true })
    expect(readKitSettings(() => storage)).toEqual({ theme: 'light', touch: true, width: '390', reducedMotion: true })
  })

  test('a first visit gets the defaults: auto theme, full width, fine pointer, motion on', () => {
    expect(readKitSettings(() => memoryStorage())).toEqual(defaultKitSettings)
    expect(defaultKitSettings).toEqual({ theme: 'auto', touch: false, width: 'full', reducedMotion: false })
  })

  test('storage that throws, as in a private window, gives the defaults and reports the write as not kept', () => {
    const throwing = () => {
      throw new Error('SecurityError')
    }
    expect(readKitSettings(throwing)).toEqual(defaultKitSettings)
    expect(writeKitSettings(throwing, { ...defaultKitSettings, theme: 'dark' })).toBe(false)
    const failingSet = { getItem: () => null, setItem: () => {
      throw new Error('QuotaExceededError')
    } }
    expect(writeKitSettings(() => failingSet, { ...defaultKitSettings })).toBe(false)
  })

  test('a stored value that is not JSON, or from an older shape, falls back per setting', () => {
    expect(readKitSettings(() => memoryStorage({ [KIT_SETTINGS_KEY]: '{not json' }))).toEqual(defaultKitSettings)
    expect(parseKitSettings({ theme: 'sepia', touch: 'yes', width: 1024, reducedMotion: true })).toEqual({ ...defaultKitSettings, reducedMotion: true })
    expect(parseKitSettings(null)).toEqual(defaultKitSettings)
  })

  test('auto follows the system colour scheme; light and dark are forced', () => {
    expect(resolveKitTheme('auto', true)).toBe('dark')
    expect(resolveKitTheme('auto', false)).toBe('light')
    expect(resolveKitTheme('light', true)).toBe('light')
    expect(resolveKitTheme('dark', false)).toBe('dark')
  })
})
