<template>
  <div
    id="cwa-root-layout"
    ref="rootLayout"
    class="cwa:relative cwa:h-full cwa:flex cwa:flex-col"
    @click="onRootClick"
    @contextmenu="onRootContextMenu"
  >
    <ClientOnly>
      <LazyCwaAdminHeader v-if="showAdmin" />
      <OutdatedContentNotice
        v-else
        class="cwa:absolute cwa:top-0 cwa:mt-1.5 cwa:left-1/2 cwa:-translate-x-1/2 cwa:z-50"
      />
    </ClientOnly>
    <CwaUiAlertWarning v-if="unresolvableWarning">
      <p>{{ unresolvableWarning }}</p>
    </CwaUiAlertWarning>
    <component
      :is="resolvedComponent"
      v-if="resolvedComponent"
      class="cwa:relative"
    >
      <div
        ref="page"
        class="cwa:grow"
      >
        <slot />
      </div>
    </component>
    <ClientOnly>
      <template v-if="showAdmin">
        <LazyCwaAdminResourceManager ref="resourceManager" />
        <LayoutPageOverlay
          v-if="$cwa.admin.isEditing && page && rootLayout"
          :page="page"
          :layout="rootLayout"
        />
        <teleport to="body">
          <DialogsWrapper />
        </teleport>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, getCurrentInstance, watch, nextTick } from 'vue'
import { consola as logger } from 'consola'
import { DialogsWrapper } from 'vuejs-confirm-dialog'
import { useRouter } from 'vue-router'
import { useWindowScroll } from '@vueuse/core'
import { useCwa, useHead } from '#imports'
import { LazyCwaAdminHeader, LazyCwaAdminResourceManager, LazyCwaDefaultLayout } from '#components'
import OutdatedContentNotice from '#cwa/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import type { GlobalComponentNames } from '#cwa/types'
import LayoutPageOverlay from '#cwa/templates/components/main/admin/resource-manager/LayoutPageOverlay.vue'

const $cwa = useCwa()
const currentRoute = useRouter().currentRoute
const resourceManager = ref<null | InstanceType<typeof LazyCwaAdminResourceManager>>(null)
const page = ref<null | HTMLElement>(null)
const rootLayout = ref<null | HTMLElement>(null)
const instance = getCurrentInstance()

const cwaPageMeta = computed(() => {
  return currentRoute.value.meta?.cwa
})

function callResourceManagerHandler(handler: 'contextMenuHandler' | 'clickHandler', e: MouseEvent, type: 'layout' | 'page') {
  resourceManager.value && resourceManager.value[handler](e, type)
}

function isInPage(e: MouseEvent) {
  return !!page.value && (page.value === e.target || page.value.contains(e.target as Node))
}

function onRootClick(e: MouseEvent) {
  callResourceManagerHandler('clickHandler', e, isInPage(e) ? 'page' : 'layout')
}

function onRootContextMenu(e: MouseEvent) {
  callResourceManagerHandler('contextMenuHandler', e, isInPage(e) ? 'page' : 'layout')
}

const layoutResource = computed(() => {
  return $cwa.resources.layout.value
})

const layoutUiComponent = computed<GlobalComponentNames>(() => {
  return cwaPageMeta.value?.staticLayout || (layoutResource.value?.data?.uiComponent as GlobalComponentNames) || LazyCwaDefaultLayout
})

// Whether the current context resolves to a named layout component (not falling back to default).
const hasNamedLayout = computed(() => !!(cwaPageMeta.value?.staticLayout || layoutResource.value?.data?.uiComponent))

// Track the last confirmed real layout component so we can avoid a brief flash back to the
// unstyled default during navigation. The flash occurs when the early-switch fires before the
// route resource's HTTP response has arrived: layoutIri is defined (we know the new layout IRI
// from the page resource) but layoutResource.data is still undefined (the layout entity hasn't
// been fetched yet), causing layoutUiComponent to momentarily fall back to LazyCwaDefaultLayout.
const stableLayoutUiComponent = ref<GlobalComponentNames | undefined>(hasNamedLayout.value ? layoutUiComponent.value : undefined)
watch(hasNamedLayout, (isNamed) => {
  if (isNamed) {
    stableLayoutUiComponent.value = layoutUiComponent.value
  }
})

// The name a layout asks for, when it does not resolve to a registered component - i.e. the app
// renamed or deleted it, leaving the stored `uiComponent` dangling. Vue would render an unresolvable
// name as an UNKNOWN HTML ELEMENT, so the page content survives but every bit of layout chrome is
// lost and it reads as a blank page. Only strings can dangle; the default layout is a component. #277
const unresolvableUiComponent = computed<string | undefined>(() => {
  const components = instance?.appContext.components
  if (typeof components !== 'object') {
    return
  }
  const name = layoutUiComponent.value
  if (typeof name !== 'string' || name in components) {
    return
  }
  return name
})

const unresolvableWarning = computed(() => {
  if (!unresolvableUiComponent.value) {
    return
  }
  const iri = $cwa.resources.layoutIri.value
  return `The layout component '${unresolvableUiComponent.value}' for resource '${iri}' cannot be resolved`
})

// Shout, but keep the site up: falling back means one dangling value cannot take every page down,
// while the warning above makes the fault impossible to miss (an admin fixes it on the layout).
watch(unresolvableWarning, (warning) => {
  warning && logger.warn(warning)
}, { immediate: true })

// todo: adjust to not be global https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
const resolvedComponent = computed(() => {
  if (typeof instance?.appContext.components !== 'object') {
    return LazyCwaDefaultLayout
  }
  if (unresolvableUiComponent.value) {
    return LazyCwaDefaultLayout
  }
  // If we're momentarily without a named layout but we know a layout IRI exists (the layout
  // entity data hasn't arrived yet), hold the last known real layout to avoid a flash back
  // to the unstyled default during navigation.
  if (!hasNamedLayout.value && $cwa.resources.layoutIri.value && stableLayoutUiComponent.value) {
    return stableLayoutUiComponent.value
  }
  return layoutUiComponent.value
})

const cachedWindowScroll = ref<{ x: number, y: number }>()
const windowScroll = useWindowScroll()

watch(() => $cwa.admin.isEditing, () => {
  cachedWindowScroll.value = {
    x: windowScroll.x.value,
    y: windowScroll.y.value,
  }
}, {
  flush: 'pre',
})

watch(() => $cwa.admin.isEditing, async () => {
  // when lots of elements on the page are replaced with drafts, it can cause the scroll to revert to the top of the page. Prevent this.
  // we may need to wait for other components to have loaded in from drafts... todo: have a think about draft component loading and taking some time.
  await nextTick()
  setTimeout(() => {
    if (cachedWindowScroll.value) {
      window.scrollTo(cachedWindowScroll.value.x, cachedWindowScroll.value.y)
      cachedWindowScroll.value = undefined
    }
  }, 10)
}, {
  flush: 'post',
})

const showAdmin = $cwa.auth.isAdmin
useHead({
  titleTemplate: () => {
    // read the getter INSIDE the callback: `getConfig` returns a fresh object from `mergeConfig` on
    // every recompute, so resolving it once at setup leaves this reading a snapshot - the setting
    // would not take effect until a page reload, and nothing would track the computed to re-run us
    if ($cwa.siteConfig.config.concatTitle) {
      return '%s %separator %siteName'
    }
    return '%s'
  },
})

defineSlots<{
  default(): any
}>()
</script>
