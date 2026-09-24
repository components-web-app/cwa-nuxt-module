import { START_LOCATION } from 'vue-router'
import type { RouteLocationNormalized, RouterOptions } from 'vue-router'
import { SCROLL_TARGET_TIMEOUT, waitForScrollTarget } from './scroll/wait-for-scroll-target'
import type { ScrollTarget } from './scroll/wait-for-scroll-target'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'

type SavedPosition = { left: number, top: number } | null

const TRAILING_SLASH_RE = /\/$/

function queryElement(selector: string): Element | null | undefined {
  try {
    return document.querySelector(selector)
  }
  catch {
    return undefined
  }
}

function hashElementScrollMarginTop(selector: string) {
  const element = queryElement(selector)
  if (!element) {
    return 0
  }
  return (Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0) + (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
}

function subscribeToLayoutChanges(cb: () => void) {
  let frame = requestAnimationFrame(function tick() {
    frame = requestAnimationFrame(tick)
    cb()
  })
  let observer: ResizeObserver | undefined
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => cb())
    observer.observe(document.documentElement)
  }
  return () => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
  }
}

function resolveScrollTarget(to: RouteLocationNormalized, savedPosition: SavedPosition): ScrollTarget | undefined {
  if (savedPosition) {
    return { height: savedPosition.top + window.innerHeight }
  }
  if (to.hash && queryElement(to.hash) !== undefined) {
    return { selector: to.hash }
  }
}

function waitForContent(to: RouteLocationNormalized, savedPosition: SavedPosition, isLoading: () => boolean) {
  const target = resolveScrollTarget(to, savedPosition)
  if (!target) {
    return Promise.resolve(false)
  }
  return waitForScrollTarget({
    target,
    isLoading,
    readHeight: () => document.documentElement.scrollHeight,
    onHeightChange: subscribeToLayoutChanges,
    findElement: selector => !!queryElement(selector),
    timeout: SCROLL_TARGET_TIMEOUT,
  })
}

function calculatePosition(to: RouteLocationNormalized, savedPosition: SavedPosition, hashBehaviour: ScrollBehavior) {
  if (savedPosition) {
    return savedPosition
  }
  if (to.hash) {
    return { el: to.hash, top: hashElementScrollMarginTop(to.hash), behavior: hashBehaviour }
  }
  return { left: 0, top: 0 }
}

const scrollBehavior: RouterOptions['scrollBehavior'] = (to, from, savedPosition) => {
  const nuxtApp = useNuxtApp()
  const router = useRouter()
  const hashScrollBehaviour = (router.options as { scrollBehaviorType?: ScrollBehavior })?.scrollBehaviorType ?? 'auto'

  if (to.path.replace(TRAILING_SLASH_RE, '') === from.path.replace(TRAILING_SLASH_RE, '')) {
    if (from.hash && !to.hash) {
      return savedPosition ?? { left: 0, top: 0 }
    }
    if (to.hash) {
      return { el: to.hash, top: hashElementScrollMarginTop(to.hash), behavior: hashScrollBehaviour }
    }
    return false
  }

  const scrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop
  if (scrollToTop === false) {
    return false
  }

  const isLoading = () => !!nuxtApp.$cwa?.resources.isLoading.value

  const settleScroll = async () => {
    const deferred = await waitForContent(to, savedPosition as SavedPosition, isLoading)
    if (router.currentRoute.value.fullPath !== to.fullPath) {
      return false
    }
    return calculatePosition(to, savedPosition as SavedPosition, deferred ? 'instant' : hashScrollBehaviour)
  }

  if (from === START_LOCATION) {
    return settleScroll()
  }

  return new Promise((resolve) => {
    const doScroll = () => {
      requestAnimationFrame(() => {
        if (router.currentRoute.value.fullPath !== to.fullPath) {
          resolve(false)
          return
        }
        resolve(settleScroll())
      })
    }
    nuxtApp.hooks.hookOnce('page:loading:end', () => {
      const transitionPromise = (nuxtApp as unknown as { '~transitionPromise'?: Promise<void> })['~transitionPromise']
      if (transitionPromise) {
        transitionPromise.then(doScroll)
      }
      else {
        doScroll()
      }
    })
  })
}

export default { scrollBehavior }
