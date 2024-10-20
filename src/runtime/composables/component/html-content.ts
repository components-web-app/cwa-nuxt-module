import { createApp, onBeforeUnmount, onMounted, resolveComponent, watch } from 'vue'
import type { Ref, WatchStopHandle } from 'vue'
import { hasProtocol } from 'ufo'
import { defineNuxtLink } from '#app'
import { useCwa } from '#cwa/runtime/composables/cwa'

// Todo: work on the nuxt link replacement so external links are not clickable during editing - make into composable for dynamically  changing anchor links into components for internal routing and easier manipulation of disabling

export const useHtmlContent = (container: Ref<null | HTMLElement>) => {
  let watchStopHandle: undefined | WatchStopHandle
  const $cwa = useCwa()

  const isExternal = (props: any) => {
    if (props.external) {
      return true
    }
    if (props.target && props.target !== '_self') {
      return true
    }
    return props.to === '' || hasProtocol(props.to, { acceptRelative: true })
  }

  const linkClickHandler = (e: PointerEvent, props: any) => {
    $cwa.navigationDisabled && isExternal(props) && e.preventDefault()
  }

  function convertAnchor(anchor: HTMLElement) {
    const href = anchor.getAttribute('href')
    if (!href) {
      return
    }

    const props: any = {
      to: href,
      innerHTML: anchor.innerHTML,
    }

    for (const attr of anchor.attributes) {
      if (!['href'].includes(attr.name)) {
        const anchorAttr = anchor.getAttribute(attr.name)
        if (anchorAttr) {
          props[attr.name] = anchorAttr
        }
      }
    }
    const rlComponent = resolveComponent('RouterLink')
    if (typeof rlComponent === 'string') {
      return
    }
    const nlComponent = defineNuxtLink({})
    const app = createApp(nlComponent, { ...props, onClick: (e: PointerEvent) => linkClickHandler(e, props) })
    app.component('RouterLink', rlComponent)
    return app
  }

  function replaceAnchors() {
    if (!container.value) {
      return
    }
    const anchors: HTMLCollectionOf<HTMLAnchorElement> = container.value.getElementsByTagName('a')
    Array.from(anchors).forEach((anchor: HTMLElement) => {
      // Attempt to create a NuxtLink from the anchor
      const nuxtLink = convertAnchor(anchor)
      if (nuxtLink) {
        // If successful replace the anchor with a span to act as the container for the component
        const parent = anchor.parentNode
        if (parent) {
          const linkContainer = document.createElement('span')
          parent.replaceChild(linkContainer, anchor)
          // mount the NuxtLink component in the span
          nuxtLink.mount(linkContainer)
        }
      }
    })
  }

  onMounted(() => {
    watchStopHandle = watch(container, replaceAnchors, {
      immediate: true,
    })
  })

  onBeforeUnmount(() => {
    watchStopHandle && watchStopHandle()
  })
}
