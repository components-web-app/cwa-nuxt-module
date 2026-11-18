import type { KitTheme } from '../../../src/tailwind/kit-tokens'

export type KitThemeChoice = 'auto' | 'light' | 'dark'

export type KitWidth = 'full' | '1280' | '768' | '390'

export interface KitSettings {
  theme: KitThemeChoice
  touch: boolean
  width: KitWidth
  reducedMotion: boolean
}

export const KIT_SETTINGS_KEY = 'cwa-kit-workbench'

export const kitThemeChoices: KitThemeChoice[] = ['auto', 'light', 'dark']

export const kitWidths: KitWidth[] = ['full', '1280', '768', '390']

export const defaultKitSettings: Readonly<KitSettings> = Object.freeze({ theme: 'auto', touch: false, width: 'full', reducedMotion: false })

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function storageOf(get: () => StorageLike | undefined): StorageLike | undefined {
  try {
    return get()
  }
  catch {
    return undefined
  }
}

export function parseKitSettings(raw: unknown): KitSettings {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return {
    theme: kitThemeChoices.includes(value.theme as KitThemeChoice) ? value.theme as KitThemeChoice : defaultKitSettings.theme,
    touch: typeof value.touch === 'boolean' ? value.touch : defaultKitSettings.touch,
    width: kitWidths.includes(value.width as KitWidth) ? value.width as KitWidth : defaultKitSettings.width,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : defaultKitSettings.reducedMotion,
  }
}

export function readKitSettings(get: () => StorageLike | undefined): KitSettings {
  try {
    const raw = storageOf(get)?.getItem(KIT_SETTINGS_KEY)
    return parseKitSettings(raw ? JSON.parse(raw) : undefined)
  }
  catch {
    return { ...defaultKitSettings }
  }
}

export function writeKitSettings(get: () => StorageLike | undefined, settings: KitSettings): boolean {
  try {
    const storage = storageOf(get)
    if (!storage) {
      return false
    }
    storage.setItem(KIT_SETTINGS_KEY, JSON.stringify(parseKitSettings(settings)))
    return true
  }
  catch {
    return false
  }
}

export function resolveKitTheme(choice: KitThemeChoice, prefersDark: boolean): KitTheme {
  if (choice === 'auto') {
    return prefersDark ? 'dark' : 'light'
  }
  return choice
}
