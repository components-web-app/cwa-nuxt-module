import { computed, reactive, ref, watch } from 'vue'
import type { KitTheme } from '../../../src/tailwind/kit-tokens'
import { createMediaEmulator, emulatedMatchMedia } from './media-emulation'
import { defaultKitSettings, parseKitSettings, readKitSettings, resolveKitTheme, writeKitSettings } from './workbench-settings'
import type { KitSettings } from './workbench-settings'

export const KIT_FRAME_MESSAGE = 'cwa-kit-settings'
export const KIT_SCROLL_MESSAGE = 'cwa-kit-scroll'

const settings = reactive<KitSettings>({ ...defaultKitSettings })
const prefersDark = ref(true)
const ready = ref(false)
let started: (() => void) | undefined

const theme = computed<KitTheme>(() => resolveKitTheme(settings.theme, prefersDark.value))

function storage() {
  return window.localStorage
}

function emulate() {
  const emulator = createMediaEmulator()
  const original = window.matchMedia.bind(window)
  const overrides = () => ({ coarse: settings.touch, reducedMotion: settings.reducedMotion })
  window.matchMedia = emulatedMatchMedia(original, overrides)
  let frame = 0
  const apply = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => emulator.apply(Array.from(document.styleSheets), overrides()))
  }
  const observer = new MutationObserver(apply)
  observer.observe(document.head, { childList: true, subtree: true, characterData: true })
  const onLoad = (event: Event) => (event.target as Element | null)?.tagName === 'LINK' && apply()
  document.addEventListener('load', onLoad, true)
  const stop = watch(overrides, () => emulator.apply(Array.from(document.styleSheets), overrides()), { immediate: true, deep: true })
  return () => {
    stop()
    observer.disconnect()
    document.removeEventListener('load', onLoad, true)
    cancelAnimationFrame(frame)
    window.matchMedia = original
    emulator.restore()
  }
}

export function startKitWorkbench(framed: boolean): () => void {
  if (started) {
    return started
  }
  Object.assign(settings, readKitSettings(storage))
  const scheme = window.matchMedia('(prefers-color-scheme: dark)')
  prefersDark.value = scheme.matches
  const onScheme = (event: MediaQueryListEvent) => {
    prefersDark.value = event.matches
  }
  scheme.addEventListener('change', onScheme)
  const stopEmulating = emulate()
  const stopSaving = framed ? () => {} : watch(settings, value => writeKitSettings(storage, value), { deep: true })
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return
    }
    if (event.data?.type === KIT_FRAME_MESSAGE) {
      Object.assign(settings, parseKitSettings(event.data.settings), { width: 'full' })
    }
    if (event.data?.type === KIT_SCROLL_MESSAGE && typeof event.data.id === 'string') {
      document.getElementById(event.data.id)?.scrollIntoView({ block: 'start' })
    }
  }
  framed && window.addEventListener('message', onMessage)
  if (framed) {
    settings.width = 'full'
  }
  ready.value = true
  started = () => {
    scheme.removeEventListener('change', onScheme)
    window.removeEventListener('message', onMessage)
    stopEmulating()
    stopSaving()
    ready.value = false
    started = undefined
  }
  return started
}

const remountKey = computed(() => `${settings.touch}-${settings.reducedMotion}`)

export function useKitWorkbench() {
  return { settings, theme, ready, remountKey }
}
