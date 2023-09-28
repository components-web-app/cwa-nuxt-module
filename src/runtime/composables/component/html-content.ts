import { createApp, onBeforeUnmount, onMounted, Ref, watch } from 'vue'
import { NuxtLink } from '#components'

// Todo: work on the nuxt link replacement so external links are not clickable during editing - make into composable for dynamically  changing anchor links into components for internal routing and easier manipulation of disabling

export const useHtmlContent = (container: Ref<null|HTMLElement>) => {
  let watchStopHandle: undefined|WatchStopHandle
  function convertAnchor (anchor: HTMLElement) {
    const href = anchor.getAttribute('href')
    if (!href) {
      return
    }
    const props: any = {
      to: href,
      innerHTML: anchor.innerHTML,
      something: 'else'
    }
    for (const attr of anchor.attributes) {
      if (!['href'].includes(attr.name)) {
        const anchorAttr = anchor.getAttribute(attr.name)
        if (anchorAttr) {
          props[attr.name] = anchorAttr
        }
      }
    }
    return createApp(NuxtLink, props)
  }

  function replaceAnchors () {
    if (!container.value) {
      return
    }
    const anchors: HTMLElement[] = container.value.getElementsByTagName('a')
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
      immediate: true
    })
  })

  onBeforeUnmount(() => {
    watchStopHandle && watchStopHandle()
  })
}
